/**
 * POST /api/ss-v5/wizard/dry-run
 *
 * Simulasi sync TANPA create resource — scan Sheet via Sheets API untuk preview.
 * Hasil dipakai Wizard Step 3 sebelum user klik "Yes, Create".
 *
 * Scope sempit (3-layer architecture):
 *   - Wizard ini cuma sync mentah (FLAT) — zero FK hirarki.
 *   - FK resolution probe (ORPHAN_GI/ORPHAN_BAY/MISSING_*) dihapus dari wizard.
 *   - Untuk validasi FK: user setup dulu via Data Level Config page, rejected_rows akan
 *     ke-populate saat first DTS cycle.
 *
 * Flow per sheet:
 *   1. Fetch headers (row 1) via Sheets API
 *   2. G10 rule: skip kolom dengan header kosong → tandai sebagai placeholder
 *   3. Fetch sample 50 row (row 2-51) untuk preview
 *   4. Count estimated total rows + storage
 *
 * Pre-flight checks (~5):
 *   - sheet_permission       SA bisa baca spreadsheet (FAIL kalau 403/404)
 *   - master_ready           dim_* status info (WARN — raw sync OK tanpa master)
 *   - sheet_names            sheet tab names BQ-safe (FAIL kalau special char)
 *   - schema_probe           per-sheet Sheets API scan OK
 *
 * Input: { spreadsheetId, sheets: Record<string, SheetConfig> }
 * Output:
 *   {
 *     ok: true,
 *     preChecks: PreflightCheck[],
 *     canProceed: boolean,
 *     preview: Array<{
 *       sheet, tableName, hierarchyLevel,
 *       headers: Array<{ name, safeName, included, reason? }>,
 *       sampleRows, totalRowsEstimate, rejectedEstimate, rejectedSample, storageEstimateKB
 *     }>,
 *     totalEstimate: { rows, rejected, storageKB }
 *   }
 */
import { NextResponse } from 'next/server';
import { PROJECT, SS_PLATFORM, toSafeName } from '@/lib/ss-v5/sql-generator';
import type { SheetConfig } from '@/lib/ss-v5/data-source-schema';
import { getBigQuery } from '@/lib/ss-v5/firestore-singleton';

const bq = getBigQuery();

const SAMPLE_ROWS = 50;

/** Sheet name valid regex — BQ-safe (alphanumeric + underscore + space, no special char). */
const SHEET_NAME_VALID = /^[a-zA-Z0-9_\s\-.]+$/;

interface SheetPreview {
    sheet: string;
    tableName: string;
    hierarchyLevel: string;
    headers: Array<{ name: string; safeName: string; included: boolean; reason?: string }>;
    sampleRows: Array<Record<string, string>>;
    totalRowsEstimate: number;
    rejectedEstimate: number;
    rejectedSample: Array<{ rowNumber: number; reason: string; value: string }>;
    storageEstimateKB: number;
    error?: string;
}

interface PreflightCheck {
    id: string;
    name: string;
    status: 'PASS' | 'FAIL' | 'WARN';
    message: string;
}

/**
 * Pre-flight: dim_* status — WARN only.
 * Wizard scope sempit (FLAT sync), dim_* empty OK. Kalau user mau setup FK
 * hirarki nanti, lakukan via Data Level Config page setelah Master Config terisi.
 */
async function checkMasterReady(): Promise<PreflightCheck> {
    try {
        const [rows] = await bq.query({
            query: `
                SELECT
                    (SELECT COUNT(*) FROM \`${PROJECT}.${SS_PLATFORM}.dim_upt\` WHERE is_active) AS upt,
                    (SELECT COUNT(*) FROM \`${PROJECT}.${SS_PLATFORM}.dim_ultg\` WHERE is_active) AS ultg,
                    (SELECT COUNT(*) FROM \`${PROJECT}.${SS_PLATFORM}.dim_gi\` WHERE is_active) AS gi,
                    (SELECT COUNT(*) FROM \`${PROJECT}.${SS_PLATFORM}.dim_bay\` WHERE is_active) AS bay
            `,
        });
        const r = (rows[0] ?? {}) as { upt: number; ultg: number; gi: number; bay: number };
        const upt = Number(r.upt ?? 0);
        const ultg = Number(r.ultg ?? 0);
        const gi = Number(r.gi ?? 0);
        const bay = Number(r.bay ?? 0);
        if (upt === 0 || ultg === 0 || gi === 0) {
            return {
                id: 'master_ready',
                name: 'Master Hierarchy populated',
                status: 'WARN',
                message: `dim_* masih kosong (UPT=${upt}, ULTG=${ultg}, GI=${gi}, Bay=${bay}). OK untuk sync mentah. Set FK hirarki nanti via Data Level Config setelah Master Config terisi.`,
            };
        }
        return {
            id: 'master_ready',
            name: 'Master Hierarchy populated',
            status: 'PASS',
            message: `${upt} UPT · ${ultg} ULTG · ${gi} GI · ${bay} Bay aktif`,
        };
    } catch (e: any) {
        return {
            id: 'master_ready',
            name: 'Master Hierarchy populated',
            status: 'WARN',
            message: `Gagal query dim_* (non-fatal untuk wizard FLAT): ${e.message}`,
        };
    }
}

/**
 * Pre-flight: SA bisa read spreadsheet? (permission check)
 * Return PASS kalau spreadsheets.get sukses, FAIL kalau 403/404.
 */
async function checkSheetPermission(
    sheetsApi: any,
    spreadsheetId: string
): Promise<PreflightCheck> {
    try {
        const res = await sheetsApi.spreadsheets.get({
            spreadsheetId,
            fields: 'properties.title,sheets.properties.title',
        });
        const title = res.data.properties?.title || '(no title)';
        const sheetCount = res.data.sheets?.length ?? 0;
        return {
            id: 'sheet_permission',
            name: 'Sheet Access Permission',
            status: 'PASS',
            message: `SA bisa baca "${title}" (${sheetCount} tab)`,
        };
    } catch (e: any) {
        const msg = e.message || String(e);
        return {
            id: 'sheet_permission',
            name: 'Sheet Access Permission',
            status: 'FAIL',
            message: `SA tidak punya akses: ${msg}. Share spreadsheet ke compute default SA.`,
        };
    }
}

/**
 * Pre-flight: Sheet tab names valid? (BQ-safe naming)
 */
function checkSheetNames(sheetTabs: string[]): PreflightCheck {
    const invalid = sheetTabs.filter((s) => !SHEET_NAME_VALID.test(s));
    if (invalid.length === 0) {
        return {
            id: 'sheet_names',
            name: 'Sheet Names Valid',
            status: 'PASS',
            message: `${sheetTabs.length} sheet name valid`,
        };
    }
    return {
        id: 'sheet_names',
        name: 'Sheet Names Valid',
        status: 'FAIL',
        message: `Sheet name invalid (special char): ${invalid.join(', ')}. Rename di Google Sheets.`,
    };
}

async function dryRunSheet(
    sheetsApi: any,
    spreadsheetId: string,
    sheetTab: string,
    cfg: SheetConfig
): Promise<SheetPreview> {
    try {
        // Headers (row 1) + Sample (row 2..51)
        const res = await sheetsApi.spreadsheets.values.get({
            spreadsheetId,
            range: `${sheetTab}!A1:ZZ${SAMPLE_ROWS + 1}`,
        });
        const values = res.data.values ?? [];
        const rawHeaders: string[] = (values[0] ?? []).map((h: string) => String(h).trim());
        const sampleRaw = values.slice(1);

        // G10: header kosong = placeholder = SKIP kolom
        const headers = rawHeaders.map((h, i) => {
            const name = h || `(kosong)`;
            const safeName = toSafeName(h) || `col_${i + 1}`;
            const included = !!h; // kalau header kosong → skip
            return {
                name,
                safeName,
                included,
                reason: included ? undefined : 'Header kosong → kolom skip (G10 rule)',
            };
        });

        // Sample rows (include kolom yang valid saja)
        const sampleRows = sampleRaw.slice(0, 20).map((row: string[]) => {
            const obj: Record<string, string> = {};
            headers.forEach((h, i) => {
                if (h.included) obj[h.safeName] = String(row[i] ?? '');
            });
            return obj;
        });

        // Total row estimate — ambil row count dari sheet metadata (approx)
        const meta = await sheetsApi.spreadsheets.get({
            spreadsheetId,
            ranges: [`${sheetTab}!A:A`],
            fields: 'sheets.properties(sheetId,title,gridProperties(rowCount))',
        });
        const sheetProps = meta.data.sheets?.find(
            (s: any) => s.properties?.title === sheetTab
        );
        const totalRowsEstimate = Math.max(0, (sheetProps?.properties?.gridProperties?.rowCount ?? 0) - 1);

        // Storage estimate — rough: per row avg 200 bytes
        const storageEstimateKB = Math.round((totalRowsEstimate * 200) / 1024);

        // FLAT sync: zero FK probe — rejected list kosong (validasi FK hirarki di luar scope wizard).
        return {
            sheet: sheetTab,
            tableName: cfg.tableName,
            hierarchyLevel: cfg.hierarchyLevel ?? 'FLAT',
            headers,
            sampleRows,
            totalRowsEstimate,
            rejectedEstimate: 0,
            rejectedSample: [],
            storageEstimateKB,
        };
    } catch (e: any) {
        return {
            sheet: sheetTab,
            tableName: cfg.tableName,
            hierarchyLevel: cfg.hierarchyLevel ?? 'FLAT',
            headers: [],
            sampleRows: [],
            totalRowsEstimate: 0,
            rejectedEstimate: 0,
            rejectedSample: [],
            storageEstimateKB: 0,
            error: e.message,
        };
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { spreadsheetId, sheets } = body as {
            spreadsheetId: string;
            sheets: Record<string, SheetConfig>;
        };

        if (!spreadsheetId || !sheets) {
            return NextResponse.json(
                { ok: false, error: 'spreadsheetId + sheets required' },
                { status: 400 }
            );
        }

        // Sheets API client (ADC via compute default SA)
        const { google } = await import('googleapis');
        const { GoogleAuth } = await import('google-auth-library');
        const auth = new GoogleAuth({
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });
        const client = await auth.getClient();
        const sheetsApi = google.sheets({ version: 'v4', auth: client as any });

        // Pre-flight checks (Validate-All-Before-Commit pattern)
        const sheetTabs = Object.keys(sheets);
        const [masterCheck, permissionCheck] = await Promise.all([
            checkMasterReady(),
            checkSheetPermission(sheetsApi, spreadsheetId),
        ]);
        const nameCheck = checkSheetNames(sheetTabs);
        const preChecks: PreflightCheck[] = [permissionCheck, masterCheck, nameCheck];

        // Kalau pre-check FAIL, skip preview generation (hemat API call)
        const anyFail = preChecks.some((c) => c.status === 'FAIL');
        if (anyFail) {
            return NextResponse.json({
                ok: true,
                preChecks,
                canProceed: false,
                preview: [],
                totalEstimate: { rows: 0, rejected: 0, storageKB: 0 },
                message: 'Pre-flight check FAIL. Fix issue dulu sebelum create.',
            });
        }

        // Process each sheet (parallel) — no dim_* load, FLAT scope
        const entries = Object.entries(sheets);
        const preview = await Promise.all(
            entries.map(([tab, cfg]) => dryRunSheet(sheetsApi, spreadsheetId, tab, cfg))
        );

        // Additional check: per-sheet schema valid (ada error di preview)
        const schemaCheck: PreflightCheck = preview.some((p) => p.error)
            ? {
                  id: 'schema_probe',
                  name: 'Schema & Data Probe',
                  status: 'FAIL',
                  message: `${preview.filter((p) => p.error).length} sheet error saat scan. Cek detail per-sheet`,
              }
            : {
                  id: 'schema_probe',
                  name: 'Schema & Data Probe',
                  status: 'PASS',
                  message: `${preview.length} sheet berhasil di-scan`,
              };
        preChecks.push(schemaCheck);

        const totalEstimate = preview.reduce(
            (acc, p) => ({
                rows: acc.rows + p.totalRowsEstimate,
                rejected: acc.rejected + p.rejectedEstimate,
                storageKB: acc.storageKB + p.storageEstimateKB,
            }),
            { rows: 0, rejected: 0, storageKB: 0 }
        );

        const canProceed = preChecks.every((c) => c.status !== 'FAIL');

        return NextResponse.json({
            ok: true,
            preChecks,
            canProceed,
            preview,
            totalEstimate,
            message: canProceed
                ? 'All pre-flight check PASS. Ready to create.'
                : 'Pre-flight check FAIL. Fix issue sebelum create.',
        });
    } catch (e: any) {
        console.error('[wizard/dry-run]', e);
        return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
    }
}
