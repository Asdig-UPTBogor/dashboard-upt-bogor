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
    listPageConfigs, cascadeSheetRename, cascadeColumnRemap,
} from "@/lib/data-source-registry";
import { getSheetsApi, norm, fuzzyMatch, detectColumnType, colIndexToLetter } from "./helpers";

type SheetInfo = { name: string; rowCount: number; colCount: number };
type HeaderInfo = { headers: string[]; sampleRow: string[] };

export async function handleHealthCheck(url: URL) {
    const withHealthCheck = url.searchParams.get("healthcheck") === "1";

    // Convert per-spreadsheet registry → per-page view for Data Source Manager
    const pageView = registryToPageView();

    // Build columnsUsed lookup from per-page JSON configs (source of truth)
    // Key: "spreadsheetId::sheetName" → columnsUsed array
    const pageConfigColumnsMap = new Map<string, { name: string; pos: string }[]>();
    try {
        const allPageConfigs = listPageConfigs();
        for (const pc of allPageConfigs) {
            for (const ds of pc.dataSources || []) {
                const key = `${ds.spreadsheetId}::${ds.sheetName}`;
                const cols = (ds.columnsUsed || []).map((c: { name: string; pos: string }) => ({ name: c.name, pos: c.pos }));
                pageConfigColumnsMap.set(key, cols);
            }
        }
    } catch { /* per-page configs not available, fall back to registry */ }

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

        /* ── 3. Fetch metadata + headers (SERIAL to avoid Google rate-limiting) ── */
        const metaMap: Record<string, {
            title: string;
            sheets: SheetInfo[];
            headers: Record<string, HeaderInfo>;
            responseTime: number;
            error: string | null;
        }> = {};

        const allIdsList = [...allIds];
        for (let idIdx = 0; idIdx < allIdsList.length; idIdx++) {
            const id = allIdsList[idIdx];
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

                // Serial header fetch per sheet (avoids burst of API calls)
                const sheetsToFetch = sheets.filter((s) => needed.has(s.name) || needed.has(""));
                for (const s of sheetsToFetch) {
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
                }

                metaMap[id] = { title, sheets, headers: headerResults, responseTime: Date.now() - start, error: null };
            } catch (err: unknown) {
                metaMap[id] = {
                    title: "Error", sheets: [], headers: {},
                    responseTime: Date.now() - start,
                    error: err instanceof Error ? err.message : "Unknown",
                };
            }

        }

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

        /* ── Track POS auto-corrections across all sheets ── */
        let posAutoFixed = false;
        const posFixLog: { sheet: string; col: string; oldPos: string; newPos: string }[] = [];

        /* ── 4. (Legacy API health check removed — all legacy routes deleted) ── */
        const apiHealth: Record<string, { status: number; ok: boolean; time: number; count?: number }> = {};

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

                    // Resolve columns — prefer per-page JSON config, fall back to registry
                    const pageConfigKey = `${spReg.spreadsheetId}::${shReg.sheetName}`;
                    const pageConfigCols = pageConfigColumnsMap.get(pageConfigKey);
                    const resolvedColumns = pageConfigCols
                        ? pageConfigCols.map(c => ({ name: c.name, pos: c.pos }))
                        : shReg.columnsUsed.map(normalizeColumn);
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

                    // ═══════════════════════════════════════════════
                    // Auto-correct POS: if column name found in live sheet
                    // but at different POS → update POS in registry + cascade
                    // ═══════════════════════════════════════════════
                    let localPosFixed = false;
                    for (const col of resolvedColumns) {
                        if (col.name === "(semua kolom)" || !col.pos) continue;
                        const actualIdx = actualHeaders.findIndex(h => norm(h) === norm(col.name));
                        if (actualIdx < 0) continue; // column not found → leave as MISSING
                        const actualPos = colIndexToLetter(actualIdx);
                        if (col.pos !== actualPos) {
                            console.log(`[DSM AutoPOS] ${shReg.sheetName}: "${col.name}" POS ${col.pos} → ${actualPos}`);
                            posFixLog.push({ sheet: shReg.sheetName, col: col.name, oldPos: col.pos, newPos: actualPos });
                            // Update in registry
                            for (const regEntry of registry) {
                                if ((regEntry as SpreadsheetEntry).spreadsheetId !== spReg.spreadsheetId) continue;
                                for (const regSheet of (regEntry as SpreadsheetEntry).sheets) {
                                    if (norm(regSheet.sheetName) !== norm(shReg.sheetName)) continue;
                                    for (const regCol of regSheet.columnsUsed) {
                                        const rcName = typeof regCol === "string" ? regCol : regCol.name;
                                        if (norm(rcName) === norm(col.name) && typeof regCol !== "string") {
                                            regCol.pos = actualPos;
                                            localPosFixed = true;
                                            posAutoFixed = true;
                                        }
                                    }
                                }
                            }
                            col.pos = actualPos; // update local ref for this health check cycle
                        }
                    }

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

        /* ── 6. Save registry & cascade POS fixes to page-configs ── */
        if (posAutoFixed) {
            saveRegistry(registry);
            console.log(`[DSM AutoPOS] Saved ${posFixLog.length} POS fix(es) to registry`);
        }

        // Always sync page-config POS against registry (handles both auto-fixed + already-correct-but-desynced)
        {
            const allPageConfigs = listPageConfigs();
            const fs = require("fs");
            const path = require("path");
            const PAGE_CONFIGS_DIR = path.join(process.cwd(), "src", "lib", "page-configs");
            for (const pc of allPageConfigs) {
                let changed = false;
                for (const ds of pc.dataSources) {
                    // Find matching registry entry
                    const regEntry = registry.find(
                        (e: unknown) => (e as SpreadsheetEntry).spreadsheetId === ds.spreadsheetId
                    ) as SpreadsheetEntry | undefined;
                    if (!regEntry) continue;
                    const regSheet = regEntry.sheets.find(
                        sh => norm(sh.sheetName) === norm(ds.sheetName)
                    );
                    if (!regSheet) continue;

                    for (const col of (ds.columnsUsed || [])) {
                        if (typeof col === "string") continue;
                        const regCol = regSheet.columnsUsed.find(rc => {
                            const rcName = typeof rc === "string" ? rc : rc.name;
                            return norm(rcName) === norm(col.name);
                        });
                        if (!regCol || typeof regCol === "string") continue;
                        if (regCol.pos && col.pos !== regCol.pos) {
                            console.log(`[DSM SyncPOS] ${pc.page}/${ds.sheetName}: "${col.name}" POS ${col.pos} → ${regCol.pos}`);
                            col.pos = regCol.pos;
                            changed = true;
                        }
                    }
                }
                if (changed) {
                    pc.updatedAt = new Date().toISOString();
                    const slug = pc.page.replace(/^\//, "").replace(/\//g, "--");
                    const filePath = path.join(PAGE_CONFIGS_DIR, `${slug}.json`);
                    fs.writeFileSync(filePath, JSON.stringify(pc, null, 2), "utf-8");
                    console.log(`[DSM SyncPOS] Saved ${slug}.json`);
                }
            }
        }

        /* ── 7. Unlinked sidebar pages ── */
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
