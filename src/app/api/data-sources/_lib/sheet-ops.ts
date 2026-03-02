/**
 * Sheet operations — PATCH actions for Data Source Manager
 *
 * Handles: link-to-page, unlink-from-page, toggle column, sheet-rename,
 * column-remap, save-relations, get-relations.
 */

import { NextResponse } from "next/server";
import {
    loadRegistry, saveRegistry,
    loadRegistryRoot, saveRegistryRoot, DataRelation,
    getHierarchyConfig, matchHierarchyColumn,
} from "@/lib/data-source-registry";
import { norm, getSheetsApi } from "./helpers";
import { GOOGLE_CREDS_PATH, GOOGLE_SCOPES } from "@/lib/dashboard-config";
import { google } from "googleapis";

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function handlePatch(body: any) {
    const { action } = body;
    const registry = loadRegistry();

    /* ── Save relations (xyflow data) ── */
    if (action === "save-relations") {
        const { relations } = body as { relations: DataRelation[] };
        if (!Array.isArray(relations)) {
            return NextResponse.json({ error: "relations must be an array" }, { status: 400 });
        }
        const root = loadRegistryRoot();
        root.relations = relations;
        saveRegistryRoot(root);
        return NextResponse.json({ success: true, count: relations.length });
    }

    /* ── Get relations ── */
    if (action === "get-relations") {
        const root = loadRegistryRoot();
        return NextResponse.json({ success: true, relations: root.relations || [] });
    }

    /* ── Link sheet to a dashboard page ── */
    if (action === "link-to-page") {
        const { spreadsheetId, sheetName, page, route } = body;
        if (!spreadsheetId || !sheetName || !page) {
            return NextResponse.json({ error: "Missing required fields for link-to-page" }, { status: 400 });
        }

        /* ── Auto-detect hierarchy columns ── */
        let detectedRole: "hierarchy" | "custom" = "custom";
        let hierarchyMapping: Record<string, string> = {};
        const hierarchyPresent: string[] = [];

        try {
            const auth = new google.auth.GoogleAuth({ keyFile: GOOGLE_CREDS_PATH, scopes: [...GOOGLE_SCOPES] });
            const sheets = google.sheets({ version: "v4", auth });
            const headerRes = await sheets.spreadsheets.values.get({
                spreadsheetId,
                range: `'${sheetName}'!1:1`,
            });
            const headerRow = (headerRes.data.values?.[0] || []) as string[];

            const hierarchyConfig = getHierarchyConfig();
            for (const level of hierarchyConfig) {
                const matchedCol = matchHierarchyColumn(headerRow, level);
                if (matchedCol) {
                    hierarchyPresent.push(level.key);
                    hierarchyMapping[level.key] = matchedCol;
                }
            }

            const hasUltg = hierarchyPresent.includes("ultg");
            const hasGi = hierarchyPresent.includes("gi");
            if (hasUltg && hasGi) {
                detectedRole = "hierarchy";
            }
        } catch (err) {
            console.warn("[link-to-page] Hierarchy detection failed, defaulting to custom:", err);
        }

        let linked = false;
        for (const entry of registry) {
            if (entry.spreadsheetId !== spreadsheetId) continue;
            for (const sh of entry.sheets) {
                if (norm(sh.sheetName) !== norm(sheetName)) continue;
                if (!sh.usedBy.includes(page)) {
                    sh.usedBy.push(page);
                }
                if (route) sh.route = route;
                sh.role = detectedRole;
                sh.hierarchyPresent = hierarchyPresent;
                sh.hierarchyMapping = Object.keys(hierarchyMapping).length > 0 ? hierarchyMapping : undefined;
                linked = true;
            }
        }

        if (!linked) {
            return NextResponse.json({ error: `Sheet "${sheetName}" not found` }, { status: 404 });
        }

        saveRegistry(registry);
        return NextResponse.json({
            success: true,
            message: `Sheet "${sheetName}" linked to ${page}`,
            role: detectedRole,
            hierarchyPresent,
            hierarchyMapping: Object.keys(hierarchyMapping).length > 0 ? hierarchyMapping : null,
        });
    }

    /* ── Unlink sheet from a dashboard page ── */
    if (action === "unlink-from-page") {
        const { spreadsheetId, sheetName, page } = body;
        if (!spreadsheetId || !sheetName || !page) {
            return NextResponse.json({ error: "Missing required fields for unlink-from-page" }, { status: 400 });
        }

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

    /* ── Column remap (default action) ── */
    const { spreadsheetId, sheetName, configCol, sheetCol } = body;
    if (!spreadsheetId || !sheetName || !configCol || !sheetCol) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    let updated = false;
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
}
