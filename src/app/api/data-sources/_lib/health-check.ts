/**
 * Health check + metadata — main GET handler for Data Source Manager
 *
 * Resolves per-page view from registry, fetches metadata/headers
 * from Google Sheets, runs API health checks, and returns enriched data.
 */

import { NextResponse } from "next/server";
import { getAllPages } from "@/lib/sidebar-config";
import {
    registryToPageView, loadRegistry, normalizeColumn, saveRegistry,
    SpreadsheetEntry, getHierarchyConfig, matchHierarchyColumn,
} from "@/lib/data-source-registry";
import { getSheetsApi, norm, fuzzyMatch, detectColumnType, colIndexToLetter } from "./helpers";

type SheetInfo = { name: string; rowCount: number; colCount: number };
type HeaderInfo = { headers: string[]; sampleRow: string[] };

export async function handleHealthCheck(url: URL) {
    const withHealthCheck = url.searchParams.get("healthcheck") === "1";

    // Convert per-spreadsheet registry → per-page view for Data Source Manager
    const pageView = registryToPageView();

    try {
        const sheetsApi = await getSheetsApi();

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
            const meta = metaMap[(entry as SpreadsheetEntry).spreadsheetId];
            if (meta && !meta.error && meta.title !== "Error" && meta.title !== (entry as SpreadsheetEntry).title) {
                (entry as SpreadsheetEntry).title = meta.title;
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
                        // Direct lookup
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

                    // Resolve columns
                    const resolvedColumns = shReg.columnsUsed.map(normalizeColumn);
                    const disabledSet = new Set(shReg.disabledColumns || []);

                    const columnMeta = actualHeaders.map((header, idx) => {
                        const sample = sampleRow[idx] || "";
                        const type = detectColumnType(sample);
                        const pos = colIndexToLetter(idx);
                        const matched = resolvedColumns.find((c) => norm(c.name) === norm(header));
                        const hierarchyLevels = getHierarchyConfig();
                        const hMatchByHeader = new Map<string, { key: string }>();
                        for (const level of hierarchyLevels) {
                            const matched = matchHierarchyColumn(actualHeaders, level);
                            if (matched) hMatchByHeader.set(norm(matched), { key: level.key });
                        }
                        const hMatch = hMatchByHeader.get(norm(header));
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

                    // Hierarchy detection
                    const hierarchyConfig = getHierarchyConfig();
                    const hierarchy = hierarchyConfig.map((h) => {
                        const matchedCol = matchHierarchyColumn(actualHeaders, h);
                        return { key: h.key, label: h.label, required: h.required, found: !!matchedCol, matchedAs: matchedCol };
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

        /* ── 6. Unlinked sidebar pages ── */
        const linkedPaths = new Set(pages.map((p) => p.path));
        const allSidebarPages = getAllPages();
        const unlinkedPages: { page: string; path: string; section: string }[] = [];
        for (const sp of allSidebarPages) {
            if (!linkedPaths.has(sp.path) && !sp.path.startsWith("/maintenance/data-source") && !sp.path.startsWith("/maintenance/page-builder")) {
                unlinkedPages.push({ page: sp.label, path: sp.path, section: sp.section || "Lainnya" });
            }
        }

        const overallHealth = pages.length > 0 ? Math.round(pages.reduce((s, p) => s + p.healthScore, 0) / pages.length) : 100;
        return NextResponse.json({ timestamp: new Date().toISOString(), overallHealth, apiHealth, pages, unlinkedPages });
    } catch (err: unknown) {
        return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
    }
}
