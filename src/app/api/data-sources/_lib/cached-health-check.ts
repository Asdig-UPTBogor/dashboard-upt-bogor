/**
 * Cached Health Check — Membaca dari worker cache, bukan fetch ke Google Sheets
 *
 * DSM tidak perlu fetch sendiri ke Google Sheets API.
 * Worker sudah fetch semua sheet setiap menit → data ada di sheetCache.
 * Drift report juga sudah ada dari drift-audit yang jalan di worker.
 *
 * Handler ini:
 * 1. Baca registry (config)
 * 2. Baca headers/data dari sheetCache (sudah di-populate worker)
 * 3. Baca drift report (sudah di-generate worker)
 * 4. Compute health score per page
 * 5. Return JSON — TANPA API call ke Google Sheets
 */

import { NextResponse } from "next/server";
import { getAllPages } from "@/lib/sidebar-config";
import {
    registryToPageView, loadRegistry, normalizeColumn,
    getHierarchyConfig, matchHierarchyColumn,
    listPageConfigs, syncRegistryUsedBy,
} from "@/lib/data-source-registry";
import { sheetCache } from "@/lib/sheet-cache";
import { getDriftReport } from "@/lib/drift-store";
import { norm, fuzzyMatch, colIndexToLetter } from "./helpers";

/* ── Progress event types for SSE streaming ── */
export type CachedProgressEvent =
    | { type: "progress"; step: "sync"; message: string }
    | { type: "progress"; step: "metadata"; spreadsheetId: string; title: string; current: number; total: number; sheetCount: number }
    | { type: "progress"; step: "headers"; sheet: string; spreadsheet: string; columns: { pos: string; name: string; found: boolean }[]; rows: number }
    | { type: "progress"; step: "headers_fail"; sheet: string; spreadsheet: string }
    | { type: "progress"; step: "analyzing"; message: string }
    | { type: "complete"; data: unknown };

export type OnCachedProgress = (event: CachedProgressEvent) => void;

export async function handleCachedHealthCheck(url: URL, onProgress?: OnCachedProgress) {
    const withHealthCheck = url.searchParams.get("healthcheck") === "1";
    const emit = onProgress || (() => { });

    // Sync usedBy from page-configs → registry
    emit({ type: "progress", step: "sync", message: "Syncing registry…" });
    syncRegistryUsedBy();

    // Per-page view
    const pageView = registryToPageView();

    // Build columnsUsed lookup dari page-configs
    const pageConfigColumnsMap = new Map<string, { name: string; pos: string }[]>();
    try {
        const allPageConfigs = listPageConfigs();
        for (const pc of allPageConfigs) {
            for (const ds of pc.dataSources || []) {
                const key = `${ds.spreadsheetId}::${ds.sheetName}`;
                const cols = (ds.columnsUsed || []).map((c: { name: string; pos: string }) => ({
                    name: c.name, pos: c.pos,
                }));
                pageConfigColumnsMap.set(key, cols);
            }
        }
    } catch { /* per-page configs not available */ }

    // API health: only run actual API checks if withHealthCheck is requested
    const apiHealth: Record<string, { ok: boolean; status?: number; time: number; count?: number }> = {};
    if (withHealthCheck) {
        // Lightweight check: only test API routes, NOT fetch sheets
        const apiRoutes = new Set<string>();
        pageView.forEach(p =>
            p.spreadsheets.forEach(sp =>
                sp.sheets.forEach(sh => {
                    if (sh.route) apiRoutes.add(sh.route);
                }),
            ),
        );
        for (const route of apiRoutes) {
            const t0 = Date.now();
            try {
                const r = await fetch(`${url.origin}${route}`, { signal: AbortSignal.timeout(5000) });
                const json = await r.json().catch(() => ({}));
                apiHealth[route] = {
                    ok: r.ok,
                    status: r.status,
                    time: Date.now() - t0,
                    count: Array.isArray(json) ? json.length : json?.data?.length,
                };
            } catch {
                apiHealth[route] = { ok: false, time: Date.now() - t0 };
            }
        }
    }

    try {
        // Collect unique spreadsheet IDs
        const allIds = new Set<string>();
        pageView.forEach(p => p.spreadsheets.forEach(s => allIds.add(s.spreadsheetId)));
        const allIdsList = [...allIds];

        // Build metadata from CACHE (no Google Sheets API call!)
        const metaMap: Record<string, {
            title: string;
            sheets: { name: string; rowCount: number; colCount: number }[];
            headers: Record<string, { headers: string[]; sampleRow: string[] }>;
            responseTime: number;
            error: string | null;
        }> = {};

        const cacheStatus = sheetCache.getStatus();
        const registry = loadRegistry();

        for (let idIdx = 0; idIdx < allIdsList.length; idIdx++) {
            const ssId = allIdsList[idIdx];
            const regEntry = registry.find(r => r.spreadsheetId === ssId);
            const title = regEntry?.title || ssId.slice(0, 12);

            // Find all cached sheets for this spreadsheet
            const cachedSheets: { name: string; rowCount: number; colCount: number }[] = [];
            const headerResults: Record<string, { headers: string[]; sampleRow: string[] }> = {};

            // Get sheets from registry config
            const neededSheets = new Set<string>();
            pageView.forEach(p =>
                p.spreadsheets
                    .filter(sp => sp.spreadsheetId === ssId)
                    .forEach(sp => sp.sheets.forEach(sh => neededSheets.add(sh.sheetName))),
            );

            let fetchMs = 0;
            for (const sheetName of neededSheets) {
                const entry = sheetCache.getEntry(ssId, sheetName);
                if (entry) {
                    cachedSheets.push({
                        name: sheetName,
                        rowCount: entry.data.rowCount,
                        colCount: entry.data.headers.length,
                    });
                    headerResults[sheetName] = {
                        headers: entry.data.headers,
                        sampleRow: [], // tidak perlu sample row dari cache
                    };
                    fetchMs = Math.max(fetchMs, entry.fetchMs);

                    // Column match info for SSE
                    const cfgKey = `${ssId}::${sheetName}`;
                    const expectedCols = pageConfigColumnsMap.get(cfgKey) || [];
                    let matchedColumns: { pos: string; name: string; found: boolean }[];
                    if (expectedCols.length > 0) {
                        matchedColumns = expectedCols.map(ec => ({
                            pos: ec.pos,
                            name: ec.name,
                            found: entry.data.headers.some(h => h.toLowerCase() === ec.name.toLowerCase()),
                        }));
                    } else {
                        matchedColumns = entry.data.headers.map((h, idx) => ({
                            pos: colIndexToLetter(idx), name: h, found: true,
                        }));
                    }

                    emit({
                        type: "progress", step: "headers",
                        sheet: sheetName, spreadsheet: title,
                        columns: matchedColumns,
                        rows: entry.data.rowCount,
                    });
                } else {
                    // Sheet belum di-cache oleh worker
                    cachedSheets.push({ name: sheetName, rowCount: 0, colCount: 0 });
                    headerResults[sheetName] = { headers: [], sampleRow: [] };
                    emit({ type: "progress", step: "headers_fail", sheet: sheetName, spreadsheet: title });
                }
            }

            emit({
                type: "progress", step: "metadata",
                spreadsheetId: ssId, title,
                current: idIdx + 1, total: allIdsList.length,
                sheetCount: cachedSheets.length,
            });

            metaMap[ssId] = {
                title,
                sheets: cachedSheets,
                headers: headerResults,
                responseTime: fetchMs,
                error: null,
            };
        }

        // ── Build per-page results (same logic as original health-check) ──
        emit({ type: "progress", step: "analyzing", message: "Computing health scores…" });

        let totalChecks = 0;
        let passedChecks = 0;

        const pages = pageView.map(pageReg => {
            const spreadsheets = pageReg.spreadsheets.map(spReg => {
                const meta = metaMap[spReg.spreadsheetId] || {
                    title: "Unknown", sheets: [], headers: {}, responseTime: 0, error: "Not in cache",
                };

                const sheets = spReg.sheets.map(shReg => {
                    const actualName = shReg.sheetName || "";
                    const hdr = meta.headers[actualName];
                    const actualHeaders = hdr?.headers || [];
                    const sheetMeta = meta.sheets.find(s => s.name === actualName);
                    const rowCount = sheetMeta?.rowCount || 0;
                    const colCount = sheetMeta?.colCount || 0;

                    const status = actualHeaders.length > 0 ? "ok" : (meta.error ? "error" : "empty");
                    const suggestions: { type: string; message: string; severity: string }[] = [];

                    // Resolve columns from page-configs (satu-satunya sumber kebenaran kolom)
                    const cfgKey = `${spReg.spreadsheetId}::${actualName}`;
                    const resolvedColumns: { name: string; pos: string }[] = pageConfigColumnsMap.get(cfgKey) || [];

                    const columnMeta = resolvedColumns.map(col => {
                        const idx = actualHeaders.findIndex(h => norm(h) === norm(col.name));
                        const actualPos = idx >= 0 ? colIndexToLetter(idx) : null;
                        const type = idx >= 0 ? "text" : null;
                        return {
                            name: col.name,
                            configuredPos: col.pos || null,
                            actualPos,
                            type,
                            match: idx >= 0 ? "exact" : "missing",
                        };
                    });

                    // Health scoring
                    resolvedColumns.forEach(col => {
                        if (col.name === "(semua kolom)") return;
                        totalChecks++;
                        if (actualHeaders.some(h => norm(h) === norm(col.name))) passedChecks++;
                    });

                    const missingColumns = resolvedColumns
                        .filter(col =>
                            col.name !== "(semua kolom)" &&
                            !actualHeaders.some(h => norm(h) === norm(col.name)),
                        )
                        .map(col => {
                            const matches = fuzzyMatch(col.name, actualHeaders);
                            const currentAtPos = col.pos ? actualHeaders[col.pos.charCodeAt(0) - 65] || null : null;
                            return {
                                name: col.name,
                                expectedPos: col.pos || null,
                                currentAtPos,
                                suggestion: matches.length > 0 && matches[0].score > 50 ? matches[0].name : null,
                            };
                        });

                    const routeHealth = apiHealth[shReg.route] || null;

                    // Hierarchy detection
                    const hierarchyConfig = getHierarchyConfig();
                    const hierarchy = hierarchyConfig.map(h => {
                        const matchedCol = matchHierarchyColumn(actualHeaders, h);
                        return { key: h.key, label: h.label, required: h.required, found: !!matchedCol, matchedAs: matchedCol };
                    });
                    const resolveLevel = hierarchy.find(h => h.key === "bay")?.found ? "bay" : "gi";

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
                    allSheetNames: meta.sheets.map(s => s.name), sheets,
                };
            });

            const healthScore = totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 100;
            return { page: pageReg.page, path: pageReg.path, icon: pageReg.icon, healthScore, totalChecks, passedChecks, spreadsheets };
        });

        /* ── Unlinked sidebar pages ── */
        const linkedPaths = new Set(pages.map(p => p.path));
        const allSidebarPages = getAllPages();
        const unlinkedPages: { page: string; path: string; section: string }[] = [];
        for (const sp of allSidebarPages) {
            if (!linkedPaths.has(sp.path) && !sp.path.startsWith("/maintenance/data-source") && !sp.path.startsWith("/maintenance/page-builder")) {
                unlinkedPages.push({ page: sp.label, path: sp.path, section: sp.section || "Lainnya" });
            }
        }

        const overallHealth = pages.length > 0 ? Math.round(pages.reduce((s, p) => s + p.healthScore, 0) / pages.length) : 100;

        // Include drift report + cache info
        const driftReport = getDriftReport();
        const result = {
            timestamp: new Date().toISOString(),
            source: "cache",  // marker: data dari cache, bukan fetch langsung
            cacheAge: cacheStatus.newestAge,
            overallHealth,
            apiHealth,
            driftSummary: driftReport ? {
                overallHealth: driftReport.overallHealth,
                issueCount: driftReport.summary.issues.length,
                issues: driftReport.summary.issues.slice(0, 10),
            } : null,
            pages,
            unlinkedPages,
        };

        emit({ type: "complete", data: result });
        return NextResponse.json(result);
    } catch (err: unknown) {
        return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
    }
}
