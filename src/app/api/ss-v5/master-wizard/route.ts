/**
 * Master Hierarchy Config — Backend (v2, BQ-sourced)
 *
 * Schema v2: source dari BQ tables (hasil DTS sync), bukan Sheets API langsung.
 * Ref: Spreadsheet Sync/docs/MASTER_CONFIG_SCHEMA.md
 *
 * Routes:
 *   GET  /api/ss-v5/master-wizard?action=config
 *        → load current masterConfig dari Firestore
 *
 *   POST { action: "test-extraction", masterConfig }
 *        → dry-run: SELECT COUNT(DISTINCT ...) per level, return counts tanpa commit ke dim_*
 *
 *   POST { action: "save", masterConfig, skipRebuild? }
 *        → validate schema v2 → write Firestore → auto-trigger CF master-regenerate
 *
 *   POST { action: "rebuild" }
 *        → manual retry trigger CF master-regenerate tanpa save
 */
import { NextResponse } from 'next/server';
import { getFirestore, getBigQuery } from '@/lib/ss-v5/firestore-singleton';

const fs = getFirestore();
const bq = getBigQuery();

interface LevelSourceBQ {
    dataset: string;
    table: string;
    columns: {
        name: string;
        parentNames?: { upt?: string; ultg?: string; gi?: string };
        attrs?: Record<string, string>;
    };
}

interface MasterConfigV2 {
    version: 2;
    source: 'bigquery';
    configuredAt?: string;
    configuredBy?: string;
    scope?: { uptFilter?: string };
    levels: {
        upt: LevelSourceBQ;
        ultg: LevelSourceBQ;
        gi: LevelSourceBQ;
        bay: LevelSourceBQ;
    };
}

type ValidationError = { code: string; message: string; level?: string; field?: string };

/* ─────────── Validation (mirror di FE + CF buat fail-fast 3 lapis) ─────────── */

function validateSchemaV2(cfg: unknown): ValidationError[] {
    const errors: ValidationError[] = [];
    if (!cfg || typeof cfg !== 'object') {
        return [{ code: 'MASTER_CONFIG_MISSING', message: 'masterConfig kosong' }];
    }
    const c = cfg as Partial<MasterConfigV2>;
    if (c.version !== 2) {
        errors.push({
            code: 'MASTER_CONFIG_VERSION_MISMATCH',
            message: `version harus 2 (got: ${c.version ?? 'unset'})`,
        });
    }
    if (c.source !== 'bigquery') {
        errors.push({
            code: 'MASTER_CONFIG_INVALID_SOURCE',
            message: `source harus 'bigquery' (got: ${c.source ?? 'unset'})`,
        });
    }
    if (!c.levels) {
        errors.push({ code: 'MASTER_CONFIG_LEVEL_MISSING', message: 'levels kosong' });
        return errors;
    }
    const levels: Array<keyof MasterConfigV2['levels']> = ['upt', 'ultg', 'gi', 'bay'];
    for (const lvl of levels) {
        const src = c.levels[lvl];
        if (!src) {
            errors.push({ code: 'MASTER_CONFIG_LEVEL_MISSING', message: `level ${lvl} belum di-set`, level: lvl });
            continue;
        }
        if (!src.dataset) errors.push({ code: 'MASTER_CONFIG_LEVEL_MISSING', message: `level ${lvl} butuh 'dataset'`, level: lvl, field: 'dataset' });
        if (!src.table) errors.push({ code: 'MASTER_CONFIG_LEVEL_MISSING', message: `level ${lvl} butuh 'table'`, level: lvl, field: 'table' });
        if (!src.columns || !src.columns.name) {
            errors.push({ code: 'MASTER_CONFIG_LEVEL_MISSING', message: `level ${lvl} butuh 'columns.name'`, level: lvl, field: 'columns.name' });
        }
    }
    // Parent requirements
    const parentRules: Array<[keyof MasterConfigV2['levels'], string[]]> = [
        ['ultg', ['upt']],
        ['gi', ['upt', 'ultg']],
        ['bay', ['ultg', 'gi']],
    ];
    for (const [lvl, reqs] of parentRules) {
        const src = c.levels?.[lvl];
        if (!src) continue;
        const parents = src.columns?.parentNames || {};
        for (const r of reqs) {
            if (!parents[r as 'upt' | 'ultg' | 'gi']) {
                errors.push({
                    code: 'MASTER_CONFIG_PARENT_MISSING',
                    message: `level ${lvl} butuh parentNames.${r}`,
                    level: lvl,
                    field: `columns.parentNames.${r}`,
                });
            }
        }
    }
    return errors;
}

/* ─────────── Firestore R/W ─────────── */

async function getCurrentConfig() {
    const snap = await fs.collection('service_runtime_configs').doc('spreadsheet_sync').get();
    if (!snap.exists) return null;
    const data = snap.data() || {};
    return data.masterConfig ?? null;
}

async function saveConfig(cfg: MasterConfigV2) {
    // Always enforce v2 markers on write, bump configuredAt
    const doc = {
        masterConfig: {
            ...cfg,
            version: 2 as const,
            source: 'bigquery' as const,
            configuredAt: new Date().toISOString(),
        },
    };
    await fs.collection('service_runtime_configs').doc('spreadsheet_sync').set(doc, { merge: true });
    return { saved: true };
}

/* ─────────── Dry-run test extraction (pure SQL) ─────────── */

/**
 * Validate BQ identifier safe (BQ allowed chars: alphanumeric + underscore + hyphen).
 * Throw kalau ga match — fail loud, no silent SQL injection vector.
 */
function assertSafeIdent(kind: string, name: string): void {
    if (!/^[A-Za-z_][A-Za-z0-9_\-]*$/.test(name)) {
        throw Object.assign(new Error(`INVALID_${kind.toUpperCase()}_IDENT: "${name}"`), {
            code: `INVALID_${kind.toUpperCase()}_IDENT`,
        });
    }
}

async function testExtraction(cfg: MasterConfigV2) {
    const levels: Array<keyof MasterConfigV2['levels']> = ['upt', 'ultg', 'gi', 'bay'];
    const results: Record<string, { ok: boolean; distinctCount?: number; rowCount?: number; error?: string }> = {};

    await Promise.all(
        levels.map(async (lvl) => {
            const src = cfg.levels[lvl];
            if (!src || !src.dataset || !src.table || !src.columns?.name) {
                results[lvl] = { ok: false, error: `config level ${lvl} incomplete` };
                return;
            }
            // SQL injection guard — validate identifier sebelum interpolasi
            try {
                assertSafeIdent('dataset', src.dataset);
                assertSafeIdent('table', src.table);
                assertSafeIdent('column', src.columns.name);
            } catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                results[lvl] = { ok: false, error: msg };
                return;
            }
            const col = '`' + src.columns.name + '`';
            const tbl = '`' + src.dataset + '`.`' + src.table + '`';
            try {
                const [rows] = await bq.query({
                    query: `
                        SELECT
                          COUNT(DISTINCT TRIM(${col})) AS distinctCount,
                          COUNT(*) AS rowCount
                        FROM ${tbl}
                        WHERE ${col} IS NOT NULL AND TRIM(${col}) != ''
                    `,
                });
                const r = (rows && rows[0]) || {};
                results[lvl] = {
                    ok: true,
                    distinctCount: Number(r.distinctCount ?? 0),
                    rowCount: Number(r.rowCount ?? 0),
                };
            } catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                results[lvl] = { ok: false, error: msg };
            }
        })
    );
    return results;
}

/* ─────────── Trigger CF rebuild ─────────── */

async function triggerMasterRebuild():
    Promise<
        | { ok: true; counts: Record<string, number>; durationMs: number; warnings?: string[] }
        | { ok: false; error: string; code?: string; details?: unknown }
    > {
    const CF_URL = process.env.SS_SYNC_CF_URL || 'https://ss-sync-xelpk4dj7q-et.a.run.app';
    try {
        const { GoogleAuth } = await import('google-auth-library');
        const auth = new GoogleAuth();
        const client = await auth.getIdTokenClient(CF_URL);
        const res = await client.request({
            url: CF_URL,
            method: 'POST',
            data: { action: 'master-regenerate' },
            timeout: 5 * 60 * 1000,
        });
        const data = res.data as {
            masterRebuild?: {
                ok: boolean;
                counts?: Record<string, number>;
                durationMs?: number;
                warnings?: string[];
            };
            error?: string;
            code?: string;
            details?: unknown;
        };
        if (data?.masterRebuild?.ok) {
            return {
                ok: true,
                counts: data.masterRebuild.counts ?? {},
                durationMs: data.masterRebuild.durationMs ?? 0,
                warnings: data.masterRebuild.warnings,
            };
        }
        return {
            ok: false,
            error: data?.error || 'CF returned unexpected shape',
            code: data?.code,
            details: data?.details,
        };
    } catch (e: unknown) {
        // google-auth client.request throws structured error for non-2xx
        const err = e as { response?: { data?: { error?: string; code?: string; details?: unknown } }; message?: string };
        const body = err.response?.data;
        if (body?.error) {
            return { ok: false, error: body.error, code: body.code, details: body.details };
        }
        return { ok: false, error: err.message || String(e) };
    }
}

/* ─────────── Handlers ─────────── */

export async function GET(req: Request) {
    try {
        const url = new URL(req.url);
        const action = url.searchParams.get('action');
        if (action === 'config' || !action) {
            const cfg = await getCurrentConfig();
            return NextResponse.json({ ok: true, masterConfig: cfg });
        }
        return NextResponse.json({ ok: false, error: 'Unknown action' }, { status: 400 });
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('[master-wizard GET]', e);
        return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { action } = body || {};

        if (action === 'test-extraction') {
            const { masterConfig } = body;
            const errs = validateSchemaV2(masterConfig);
            if (errs.length > 0) {
                return NextResponse.json(
                    { ok: false, code: errs[0].code, error: errs[0].message, validation: errs },
                    { status: 422 }
                );
            }
            const result = await testExtraction(masterConfig);
            return NextResponse.json({ ok: true, extraction: result });
        }

        if (action === 'save') {
            const { masterConfig, skipRebuild } = body;
            const errs = validateSchemaV2(masterConfig);
            if (errs.length > 0) {
                return NextResponse.json(
                    { ok: false, code: errs[0].code, error: errs[0].message, validation: errs },
                    { status: 422 }
                );
            }

            const saveResult = await saveConfig(masterConfig as MasterConfigV2);

            if (skipRebuild) {
                return NextResponse.json({
                    ok: true,
                    ...saveResult,
                    rebuild: { skipped: true },
                    note: 'Config tersimpan, rebuild di-skip per request.',
                });
            }

            const rebuild = await triggerMasterRebuild();
            if (rebuild.ok) {
                return NextResponse.json({
                    ok: true,
                    ...saveResult,
                    rebuild: {
                        ok: true,
                        counts: rebuild.counts,
                        durationMs: rebuild.durationMs,
                        warnings: rebuild.warnings,
                    },
                    note:
                        `Config tersimpan + dim_* rebuilt: ` +
                        `${rebuild.counts.upt ?? 0} UPT / ${rebuild.counts.ultg ?? 0} ULTG / ` +
                        `${rebuild.counts.gi ?? 0} GI / ${rebuild.counts.bay ?? 0} Bay ` +
                        `(${rebuild.durationMs}ms)`,
                });
            }
            return NextResponse.json({
                ok: true,
                ...saveResult,
                rebuild: { ok: false, error: rebuild.error, code: rebuild.code, details: rebuild.details },
                note: `Config tersimpan TAPI rebuild gagal: ${rebuild.error}. Retry via tombol Rebuild.`,
            });
        }

        if (action === 'rebuild') {
            const rebuild = await triggerMasterRebuild();
            if (rebuild.ok) {
                return NextResponse.json({
                    ok: true,
                    counts: rebuild.counts,
                    durationMs: rebuild.durationMs,
                    warnings: rebuild.warnings,
                });
            }
            return NextResponse.json(
                { ok: false, error: rebuild.error, code: rebuild.code, details: rebuild.details },
                { status: 500 }
            );
        }

        return NextResponse.json({ ok: false, error: `Unknown action "${action}"` }, { status: 400 });
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('[master-wizard POST]', e);
        return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }
}
