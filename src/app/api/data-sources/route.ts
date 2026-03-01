import { NextResponse } from "next/server";
import { google } from "googleapis";
import { registryToPageView, loadRegistry, normalizeColumn, saveRegistry, SpreadsheetEntry } from "@/lib/data-source-registry";
import { GOOGLE_CREDS_PATH, GOOGLE_SCOPES } from "@/lib/dashboard-config";

/* ─────────────────────────────────────────────────
   Hierarchy Columns — mandatory drill-down keys
   ───────────────────────────────────────────────── */
const HIERARCHY_COLUMNS = [
    { key: "ultg", exact: "Master ULTG", required: true },
    { key: "gi", exact: "Master Gardu Induk", required: true },
    { key: "bay", exact: "Master Bay", required: false },
];

/* ─────────────────────────────────────────────────
   Fuzzy Match
   ───────────────────────────────────────────────── */
function levenshtein(a: string, b: string): number {
    const m = a.length, n = b.length;
    const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
        Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
    );
    for (let i = 1; i <= m; i++)
        for (let j = 1; j <= n; j++)
            dp[i][j] = a[i - 1] === b[j - 1]
                ? dp[i - 1][j - 1]
                : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    return dp[m][n];
}

function fuzzyMatch(target: string, candidates: string[]): { name: string; score: number }[] {
    const t = target.toUpperCase();
    return candidates
        .map((c) => {
            const cu = c.toUpperCase();
            const dist = levenshtein(t, cu);
            const maxLen = Math.max(t.length, cu.length);
            const score = maxLen > 0 ? Math.round((1 - dist / maxLen) * 100) : 0;
            return { name: c, score };
        })
        .filter((m) => m.score > 30)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);
}

/* ─────────────────────────────────────────────────
   Type Detection
   ───────────────────────────────────────────────── */
function detectColumnType(sample: string): string {
    if (!sample || sample.trim() === "") return "empty";
    const s = sample.trim();
    if (/^-?\d{1,3}\.\d{3,}$/.test(s)) return "koordinat";
    if (/^\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4}$/.test(s)) return "tanggal";
    if (/^\d{4}[/\-]\d{1,2}[/\-]\d{1,2}$/.test(s)) return "tanggal";
    if (/^-?\d+([.,]\d+)?$/.test(s)) return "angka";
    if (/^(ya|tidak|yes|no|true|false|0|1)$/i.test(s)) return "boolean";
    if (/^https?:\/\//.test(s)) return "url";
    return "teks";
}

function colIndexToLetter(idx: number): string {
    if (idx < 26) return String.fromCharCode(65 + idx);
    return String.fromCharCode(65 + Math.floor(idx / 26) - 1) + String.fromCharCode(65 + (idx % 26));
}

/* ─────────────────────────────────────────────────
   GET — Health check & data source overview
   ───────────────────────────────────────────────── */
export async function GET(req: Request) {
    const url = new URL(req.url);

    // Raw mode: return full registry JSON (for unused spreadsheet detection)
    if (url.searchParams.get("raw") === "1") {
        const registry = loadRegistry();
        return NextResponse.json({ success: true, data: registry });
    }

    // Explore mode: fetch ALL sheets + headers for a specific spreadsheet
    const exploreId = url.searchParams.get("explore");
    if (exploreId) {
        try {
            const auth = new google.auth.GoogleAuth({
                keyFile: GOOGLE_CREDS_PATH,
                scopes: [...GOOGLE_SCOPES],
            });
            const sheetsApi = google.sheets({ version: "v4", auth });

            // Fetch spreadsheet metadata
            const meta = await sheetsApi.spreadsheets.get({
                spreadsheetId: exploreId,
                fields: "properties.title,sheets.properties(title,gridProperties)",
            });
            const title = meta.data.properties?.title || "Untitled";
            const sheetsRaw = meta.data.sheets || [];

            // Fetch headers for each sheet
            const sheetsData = await Promise.all(
                sheetsRaw.map(async (s) => {
                    const name = s.properties?.title || "Unknown";
                    const rowCount = s.properties?.gridProperties?.rowCount || 0;
                    const colCount = s.properties?.gridProperties?.columnCount || 0;
                    let headers: string[] = [];
                    try {
                        const hRes = await sheetsApi.spreadsheets.values.get({
                            spreadsheetId: exploreId,
                            range: `'${name}'!1:1`,
                        });
                        headers = (hRes.data.values?.[0] || []).map(String).filter(Boolean);
                    } catch { /* sheet might be empty */ }
                    return { name, rowCount, colCount, headers };
                })
            );

            // Cross-reference with registry for link status
            const registry = loadRegistry();
            const entry = registry.find((e: SpreadsheetEntry) => e.spreadsheetId === exploreId);
            const registered = new Map<string, { usedBy: string[]; route: string }>();
            if (entry) {
                for (const sh of entry.sheets) {
                    registered.set(sh.sheetName, { usedBy: sh.usedBy || [], route: sh.route || "" });
                }
            }

            const result = sheetsData.map((s) => {
                const reg = registered.get(s.name);
                return {
                    ...s,
                    registered: !!reg,
                    usedBy: reg?.usedBy || [],
                    route: reg?.route || "",
                };
            });

            return NextResponse.json({ success: true, spreadsheetId: exploreId, title, sheets: result });
        } catch (err: unknown) {
            return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
        }
    }

    const withHealthCheck = url.searchParams.get("healthcheck") === "1";

    // Convert per-spreadsheet registry → per-page view for Data Source Manager
    const pageView = registryToPageView();

    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: GOOGLE_CREDS_PATH,
            scopes: [...GOOGLE_SCOPES],
        });
        const sheetsApi = google.sheets({ version: "v4", auth });

        /* ── 1. Collect unique spreadsheet IDs ── */
        const allIds = new Set<string>();
        pageView.forEach((p) => p.spreadsheets.forEach((s) => allIds.add(s.spreadsheetId)));

        /* ── 2. Collect which sheet names we NEED headers for ── */
        const neededSheets = new Map<string, Set<string>>();
        pageView.forEach((p) =>
            p.spreadsheets.forEach((sp) =>
                sp.sheets.forEach((sh) => {
                    if (!neededSheets.has(sp.spreadsheetId)) neededSheets.set(sp.spreadsheetId, new Set());
                    const set = neededSheets.get(sp.spreadsheetId)!;
                    set.add(sh.sheetName);
                }),
            ),
        );

        /* ── 3. Fetch metadata + headers ── */
        type SheetInfo = { name: string; rowCount: number; colCount: number };
        type HeaderInfo = { headers: string[]; sampleRow: string[] };

        const metaMap: Record<string, {
            title: string;
            sheets: SheetInfo[];
            headers: Record<string, HeaderInfo>;
            responseTime: number;
            error: string | null;
        }> = {};

        await Promise.all(
            [...allIds].map(async (id) => {
                const start = Date.now();
                try {
                    const meta = await sheetsApi.spreadsheets.get({
                        spreadsheetId: id,
                        fields: "properties.title,sheets.properties(title,gridProperties)",
                    });
                    const title = meta.data.properties?.title || "Untitled";
                    const sheetsRaw = meta.data.sheets || [];
                    const sheets: SheetInfo[] = sheetsRaw.map((s) => ({
                        name: s.properties?.title || "Unknown",
                        rowCount: s.properties?.gridProperties?.rowCount || 0,
                        colCount: s.properties?.gridProperties?.columnCount || 0,
                    }));

                    const needed = neededSheets.get(id) || new Set();
                    const headerResults: Record<string, HeaderInfo> = {};

                    await Promise.all(
                        sheets.filter((s) => needed.has(s.name) || needed.has("")).map(async (s) => {
                            try {
                                const hRes = await sheetsApi.spreadsheets.values.get({
                                    spreadsheetId: id, range: `'${s.name}'!1:2`,
                                });
                                const allRows = hRes.data.values || [];
                                const headers = (allRows[0] || []).map((h: string) => h?.trim()).filter(Boolean);
                                const sampleRow = allRows.length > 1
                                    ? (allRows[1] || []).map((v: string) => v?.toString().trim() || "")
                                    : [];
                                headerResults[s.name] = { headers, sampleRow };
                            } catch {
                                headerResults[s.name] = { headers: [], sampleRow: [] };
                            }
                        }),
                    );

                    metaMap[id] = { title, sheets, headers: headerResults, responseTime: Date.now() - start, error: null };
                } catch (err: unknown) {
                    metaMap[id] = {
                        title: "Error", sheets: [], headers: {},
                        responseTime: Date.now() - start,
                        error: err instanceof Error ? err.message : "Unknown",
                    };
                }
            }),
        );

        /* ── 3b. Auto-sync spreadsheet titles ── */
        const registry = loadRegistry();
        let titleChanged = false;
        for (const entry of registry) {
            const meta = metaMap[entry.spreadsheetId];
            if (meta && !meta.error && meta.title !== "Error" && meta.title !== entry.title) {
                entry.title = meta.title;
                titleChanged = true;
            }
        }
        if (titleChanged) saveRegistry(registry);

        /* ── 4. API Health Check ── */
        const routeSet = new Set<string>();
        pageView.forEach((p) =>
            p.spreadsheets.forEach((sp) => sp.sheets.forEach((sh) => routeSet.add(sh.route))),
        );

        const apiHealth: Record<string, { status: number; ok: boolean; time: number; count?: number }> = {};

        if (withHealthCheck) {
            const baseUrl = url.origin;
            await Promise.allSettled(
                [...routeSet].map(async (route) => {
                    const start = Date.now();
                    try {
                        const res = await fetch(`${baseUrl}${route}`, { signal: AbortSignal.timeout(10000) });
                        let count: number | undefined;
                        if (res.ok) {
                            try {
                                const json = await res.json();
                                if (Array.isArray(json)) count = json.length;
                                else if (json.data && Array.isArray(json.data)) count = json.data.length;
                                else if (json.towers && Array.isArray(json.towers)) count = json.towers.length;
                                else if (json.strikes && Array.isArray(json.strikes)) count = json.strikes.length;
                                else if (json.garduInduk && Array.isArray(json.garduInduk)) count = json.garduInduk.length;
                            } catch { /* not JSON */ }
                        }
                        apiHealth[route] = { status: res.status, ok: res.ok, time: Date.now() - start, count };
                    } catch {
                        apiHealth[route] = { status: 0, ok: false, time: Date.now() - start };
                    }
                }),
            );
        }

        /* ── 5. Build per-page result ── */
        const norm = (s: string) => s.toUpperCase().replace(/\s+/g, " ").trim();

        const pages = pageView.map((pageReg) => {
            let totalChecks = 0;
            let passedChecks = 0;

            const spreadsheets = pageReg.spreadsheets.map((spReg) => {
                const meta = metaMap[spReg.spreadsheetId];

                const sheets = spReg.sheets.map((shReg) => {
                    let actualName = shReg.sheetName;
                    let status: "ok" | "missing" = "ok";
                    let rowCount = 0, colCount = 0;
                    let actualHeaders: string[] = [];
                    let sampleRow: string[] = [];
                    let suggestions: { name: string; score: number }[] = [];

                    totalChecks++;

                    if (shReg.sheetName === "") {
                        if (meta.sheets.length > 0) {
                            const first = meta.sheets[0];
                            actualName = first.name;
                            rowCount = first.rowCount;
                            colCount = first.colCount;
                            const hdr = meta.headers[first.name];
                            if (hdr) { actualHeaders = hdr.headers; sampleRow = hdr.sampleRow; }
                            passedChecks++;
                        } else {
                            status = "missing";
                        }
                    } else {
                        // Direct lookup — no override layer, sheetName is always up-to-date
                        let found = meta.sheets.find((s) => s.name === shReg.sheetName);
                        if (!found) found = meta.sheets.find((s) => norm(s.name) === norm(shReg.sheetName));
                        if (found) {
                            actualName = found.name;
                            rowCount = found.rowCount;
                            colCount = found.colCount;
                            const hdr = meta.headers[found.name];
                            if (hdr) { actualHeaders = hdr.headers; sampleRow = hdr.sampleRow; }
                            passedChecks++;
                        } else {
                            actualName = shReg.sheetName;
                            status = "missing";
                            suggestions = fuzzyMatch(shReg.sheetName, meta.sheets.map((s) => s.name));
                        }
                    }

                    // Resolve columns — no override layer
                    const resolvedColumns = shReg.columnsUsed.map(normalizeColumn);
                    const disabledSet = new Set(shReg.disabledColumns || []);

                    const columnMeta = actualHeaders.map((header, idx) => {
                        const sample = sampleRow[idx] || "";
                        const type = detectColumnType(sample);
                        const pos = colIndexToLetter(idx);
                        const matched = resolvedColumns.find((c) => norm(c.name) === norm(header));
                        const hMatch = HIERARCHY_COLUMNS.find((h) => norm(h.exact) === norm(header));
                        const isDisabled = !hMatch && disabledSet.has(header);
                        return {
                            position: pos, index: idx, name: header, type, sample,
                            isUsed: (!!matched || !!hMatch) && !isDisabled,
                            configName: matched ? matched.name : null,
                            configPos: matched?.pos || null,
                            isOverride: false,
                            isHierarchy: !!hMatch,
                            hierarchyKey: hMatch?.key || null,
                            isDisabled,
                        };
                    });

                    resolvedColumns.forEach((col) => {
                        if (col.name === "(semua kolom)") { totalChecks++; passedChecks++; return; }
                        totalChecks++;
                        const nameMatch = actualHeaders.some((h) => norm(h) === norm(col.name));
                        if (nameMatch) passedChecks++;
                    });

                    const missingColumns = resolvedColumns
                        .filter((col) =>
                            col.name !== "(semua kolom)" &&
                            !actualHeaders.some((h) => norm(h) === norm(col.name)),
                        )
                        .map((col) => {
                            const matches = fuzzyMatch(col.name, actualHeaders);
                            const currentAtPos = col.pos ? actualHeaders[col.pos.charCodeAt(0) - 65] || null : null;
                            return { name: col.name, expectedPos: col.pos || null, currentAtPos, suggestion: matches.length > 0 && matches[0].score > 50 ? matches[0].name : null };
                        });

                    const routeHealth = apiHealth[shReg.route] || null;

                    const hierarchy = HIERARCHY_COLUMNS.map((h) => {
                        const found = actualHeaders.find((hdr) => norm(hdr) === norm(h.exact));
                        const expectsThis = resolvedColumns.some((c) =>
                            c.name === "(semua kolom)" || norm(c.name) === norm(h.exact)
                        );
                        return { key: h.key, label: h.exact, required: h.required && expectsThis, found: !!found, matchedAs: found || null };
                    });
                    const resolveLevel = hierarchy.find((h) => h.key === "bay")?.found ? "bay" : "gi";

                    return {
                        configuredName: actualName || shReg.sheetName || "(sheet pertama)",
                        actualName, label: shReg.label, route: shReg.route, status,
                        rowCount, colCount, columnMeta, missingColumns, suggestions, routeHealth,
                        hierarchy, resolveLevel,
                    };
                });

                return {
                    spreadsheetId: spReg.spreadsheetId,
                    title: meta.title, responseTime: meta.responseTime, error: meta.error,
                    allSheetNames: meta.sheets.map((s) => s.name), sheets,
                };
            });

            const healthScore = totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 100;
            return { page: pageReg.page, path: pageReg.path, icon: pageReg.icon, healthScore, totalChecks, passedChecks, spreadsheets };
        });

        const overallHealth = pages.length > 0 ? Math.round(pages.reduce((s, p) => s + p.healthScore, 0) / pages.length) : 100;
        return NextResponse.json({ timestamp: new Date().toISOString(), overallHealth, apiHealth, pages });
    } catch (err: unknown) {
        return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
    }
}

/* ─────────────────────────────────────────────────
   POST — Add new spreadsheet
   ───────────────────────────────────────────────── */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { spreadsheetId, title, sheets } = body;

        if (!spreadsheetId || !title || !sheets || !Array.isArray(sheets)) {
            return NextResponse.json(
                { success: false, error: "Missing required fields: spreadsheetId, title, sheets" },
                { status: 400 },
            );
        }

        const registry = loadRegistry();

        // Check for duplicate spreadsheetId
        if (registry.some((r) => r.spreadsheetId === spreadsheetId)) {
            return NextResponse.json(
                { success: false, error: `Spreadsheet "${spreadsheetId}" sudah terdaftar` },
                { status: 409 },
            );
        }

        // Generate unique ID from title
        const id = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

        const newEntry: SpreadsheetEntry = { id, spreadsheetId, title, sheets };
        registry.push(newEntry);
        saveRegistry(registry);

        return NextResponse.json({ success: true, data: newEntry, message: `"${title}" berhasil ditambahkan` });
    } catch (err: unknown) {
        return NextResponse.json(
            { success: false, error: err instanceof Error ? err.message : "Failed to add entry" },
            { status: 500 },
        );
    }
}

/* ─────────────────────────────────────────────────
   DELETE — Remove unused spreadsheet
   ───────────────────────────────────────────────── */
export async function DELETE(request: Request) {
    try {
        const url = new URL(request.url);
        const id = url.searchParams.get("id");

        if (!id) {
            return NextResponse.json({ success: false, error: "Missing query parameter: id" }, { status: 400 });
        }

        const registry = loadRegistry();
        const idx = registry.findIndex((r) => r.id === id);

        if (idx === -1) {
            return NextResponse.json({ success: false, error: `Entry "${id}" tidak ditemukan` }, { status: 404 });
        }

        // Safety: check if any sheets are still used by pages
        const entry = registry[idx];
        const usedSheets = entry.sheets.filter((s) => s.usedBy.length > 0);
        if (usedSheets.length > 0) {
            const pages = usedSheets.flatMap((s) => s.usedBy);
            return NextResponse.json(
                { success: false, error: `Spreadsheet masih digunakan oleh: ${pages.join(", ")}. Unlink dulu sebelum hapus.` },
                { status: 409 },
            );
        }

        const removed = registry.splice(idx, 1)[0];
        saveRegistry(registry);

        return NextResponse.json({ success: true, data: removed, message: `"${removed.title}" berhasil dihapus` });
    } catch (err: unknown) {
        return NextResponse.json(
            { success: false, error: err instanceof Error ? err.message : "Failed to delete entry" },
            { status: 500 },
        );
    }
}

/* ─────────────────────────────────────────────────
   PATCH — Sheet rename, column toggle, column remap,
           link-to-page, unlink-from-page
   All changes go directly to spreadsheet-config.json
   ───────────────────────────────────────────────── */
export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        const { action } = body;

        const registry = loadRegistry();

        /* ── Link sheet to a dashboard page ── */
        if (action === "link-to-page") {
            const { spreadsheetId, sheetName, page, route } = body;
            if (!spreadsheetId || !sheetName || !page) {
                return NextResponse.json({ error: "Missing required fields for link-to-page" }, { status: 400 });
            }

            const norm = (s: string) => s.toUpperCase().replace(/\s+/g, " ").trim();
            let linked = false;
            for (const entry of registry) {
                if (entry.spreadsheetId !== spreadsheetId) continue;
                for (const sh of entry.sheets) {
                    if (norm(sh.sheetName) !== norm(sheetName)) continue;
                    if (!sh.usedBy.includes(page)) {
                        sh.usedBy.push(page);
                    }
                    if (route) sh.route = route;
                    linked = true;
                }
            }

            if (!linked) {
                return NextResponse.json({ error: `Sheet "${sheetName}" not found` }, { status: 404 });
            }

            saveRegistry(registry);
            return NextResponse.json({ success: true, message: `Sheet "${sheetName}" linked to ${page}` });
        }

        /* ── Unlink sheet from a dashboard page ── */
        if (action === "unlink-from-page") {
            const { spreadsheetId, sheetName, page } = body;
            if (!spreadsheetId || !sheetName || !page) {
                return NextResponse.json({ error: "Missing required fields for unlink-from-page" }, { status: 400 });
            }

            const norm = (s: string) => s.toUpperCase().replace(/\s+/g, " ").trim();
            let unlinked = false;
            for (const entry of registry) {
                if (entry.spreadsheetId !== spreadsheetId) continue;
                for (const sh of entry.sheets) {
                    if (norm(sh.sheetName) !== norm(sheetName)) continue;
                    sh.usedBy = sh.usedBy.filter((p) => p !== page);
                    if (sh.usedBy.length === 0) sh.route = "";
                    unlinked = true;
                }
            }

            if (!unlinked) {
                return NextResponse.json({ error: `Sheet "${sheetName}" not found` }, { status: 404 });
            }

            saveRegistry(registry);
            return NextResponse.json({ success: true, message: `Sheet "${sheetName}" unlinked from ${page}` });
        }

        /* ── Toggle column disabled state ── */
        if (action === "toggle") {
            const { spreadsheetId, sheetName, columnName, enabled } = body;
            if (!spreadsheetId || !sheetName || !columnName || enabled === undefined) {
                return NextResponse.json({ error: "Missing required fields for toggle" }, { status: 400 });
            }

            const norm = (s: string) => s.toUpperCase().replace(/\s+/g, " ").trim();
            for (const entry of registry) {
                if (entry.spreadsheetId !== spreadsheetId) continue;
                for (const sh of entry.sheets) {
                    if (norm(sh.sheetName) !== norm(sheetName)) continue;
                    if (!sh.disabledColumns) sh.disabledColumns = [];
                    if (enabled) {
                        sh.disabledColumns = sh.disabledColumns.filter((c) => c !== columnName);
                    } else {
                        if (!sh.disabledColumns.includes(columnName)) sh.disabledColumns.push(columnName);
                    }
                    // Clean up empty array
                    if (sh.disabledColumns.length === 0) delete sh.disabledColumns;
                }
            }

            saveRegistry(registry);
            return NextResponse.json({ success: true, columnName, enabled, message: `${columnName} → ${enabled ? "aktif" : "nonaktif"}` });
        }

        /* ── Rename sheet (update config directly) ── */
        if (action === "sheet-rename") {
            const { spreadsheetId, configuredSheetName, newSheetName } = body;
            if (!spreadsheetId || !configuredSheetName || !newSheetName) {
                return NextResponse.json({ error: "Missing required fields for sheet-rename" }, { status: 400 });
            }

            const norm = (s: string) => s.toUpperCase().replace(/\s+/g, " ").trim();
            let renamed = false;
            for (const entry of registry) {
                if (entry.spreadsheetId !== spreadsheetId) continue;
                for (const sh of entry.sheets) {
                    if (norm(sh.sheetName) === norm(configuredSheetName)) {
                        sh.sheetName = newSheetName.trim();
                        renamed = true;
                    }
                }
            }

            if (!renamed) {
                return NextResponse.json({ error: `Sheet "${configuredSheetName}" not found` }, { status: 404 });
            }

            saveRegistry(registry);
            return NextResponse.json({ success: true, message: `Sheet "${configuredSheetName}" → "${newSheetName.trim()}"` });
        }

        /* ── Column remap ── */
        const { spreadsheetId, sheetName, configCol, sheetCol } = body;
        if (!spreadsheetId || !sheetName || !configCol || !sheetCol) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        let updated = false;
        const norm = (s: string) => s.toUpperCase().replace(/\s+/g, " ").trim();
        for (const entry of registry) {
            if (entry.spreadsheetId !== spreadsheetId) continue;
            for (const sh of entry.sheets) {
                if (norm(sh.sheetName) !== norm(sheetName)) continue;
                sh.columnsUsed = sh.columnsUsed.map((col) => {
                    const colName = typeof col === "string" ? col : col.name;
                    if (colName === configCol) { updated = true; return typeof col === "string" ? sheetCol : { ...col, name: sheetCol }; }
                    return col;
                });
            }
        }

        if (!updated) return NextResponse.json({ error: `Column "${configCol}" not found` }, { status: 404 });

        saveRegistry(registry);
        return NextResponse.json({ success: true, updated: `${configCol} → ${sheetCol}`, message: "Registry updated." });
    } catch (err: unknown) {
        return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
    }
}
