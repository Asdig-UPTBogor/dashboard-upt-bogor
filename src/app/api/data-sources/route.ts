/**
 * Data Sources API — /api/data-sources
 *
 * Thin dispatcher that delegates to focused modules in _lib/.
 * Refactored from 841-line god file (M1) into:
 *   _lib/helpers.ts      — shared utilities (norm, fuzzyMatch, devLog, etc.)
 *   _lib/explore.ts      — GET ?explore= (spreadsheet exploration)
 *   _lib/health-check.ts — GET default (health check + metadata)
 *   _lib/sheet-ops.ts    — PATCH actions (link, unlink, toggle, rename, remap)
 *
 * POST/DELETE handlers remain here — they are small enough (~40 + ~110 lines).
 */

import { NextResponse } from "next/server";
import { getAllPages } from "@/lib/sidebar-config";
import { loadRegistry, saveRegistry, SpreadsheetEntry } from "@/lib/data-source-registry";
import { norm } from "./_lib/helpers";
import { handleExplore } from "./_lib/explore";
import { handleHealthCheck } from "./_lib/health-check";
import { handlePatch } from "./_lib/sheet-ops";

/* ─────────────────────────────────────────────────
   GET — Dispatch to the correct handler
   ───────────────────────────────────────────────── */
export async function GET(req: Request) {
    const url = new URL(req.url);

    // Raw mode: return full registry JSON
    if (url.searchParams.get("raw") === "1") {
        const registry = loadRegistry();
        return NextResponse.json({ success: true, data: registry });
    }

    // Pages mode: return flat list of all dashboard pages
    if (url.searchParams.get("pages") === "1") {
        const pages = getAllPages();
        return NextResponse.json({ success: true, pages });
    }

    // Explore mode: fetch all sheets + headers for a spreadsheet
    const exploreId = url.searchParams.get("explore");
    if (exploreId) {
        const forceRefresh = url.searchParams.get("refresh") === "1";
        return handleExplore(exploreId, forceRefresh);
    }

    // Default: health check + metadata for Data Source Manager
    return handleHealthCheck(url);
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

        // Check for duplicate
        if (registry.some((r: SpreadsheetEntry) => r.spreadsheetId === spreadsheetId)) {
            return NextResponse.json(
                { success: false, error: `Spreadsheet "${spreadsheetId}" sudah terdaftar` },
                { status: 409 },
            );
        }

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
   DELETE — Remove spreadsheet or individual sheet
   ───────────────────────────────────────────────── */
export async function DELETE(request: Request) {
    try {
        const url = new URL(request.url);
        const id = url.searchParams.get("id");
        const sheetName = url.searchParams.get("sheet");

        if (!id) {
            return NextResponse.json(
                { success: false, error: "Missing query parameter: id" },
                { status: 400 },
            );
        }

        const registry = loadRegistry();
        const idx = registry.findIndex((r: SpreadsheetEntry) => r.id === id || r.spreadsheetId === id);

        if (idx === -1) {
            return NextResponse.json(
                { success: false, error: `Entry "${id}" tidak ditemukan` },
                { status: 404 },
            );
        }

        const entry = registry[idx];

        /* ── Sheet-level deletion ── */
        if (sheetName) {
            const sheetIdx = entry.sheets.findIndex((s) => norm(s.sheetName) === norm(sheetName));

            if (sheetIdx === -1) {
                return NextResponse.json(
                    { success: false, error: `Sheet "${sheetName}" tidak ditemukan di "${entry.title}"` },
                    { status: 404 },
                );
            }

            const sheet = entry.sheets[sheetIdx];

            if (sheet.usedBy.length > 0) {
                return NextResponse.json(
                    {
                        success: false,
                        error: `Sheet "${sheetName}" masih terhubung ke ${sheet.usedBy.length} halaman. Lepas (unlink) sheet dari semua halaman terlebih dahulu.`,
                        linkedPages: sheet.usedBy,
                    },
                    { status: 409 },
                );
            }

            const removedSheet = entry.sheets.splice(sheetIdx, 1)[0];
            let spreadsheetRemoved = false;
            if (entry.sheets.length === 0) {
                registry.splice(idx, 1);
                spreadsheetRemoved = true;
            }

            saveRegistry(registry);
            return NextResponse.json({
                success: true, type: "sheet", data: removedSheet, spreadsheetRemoved,
                message: spreadsheetRemoved
                    ? `Sheet "${sheetName}" dihapus. Spreadsheet "${entry.title}" juga dihapus karena tidak ada sheet tersisa.`
                    : `Sheet "${sheetName}" berhasil dihapus dari "${entry.title}"`,
            });
        }

        /* ── Spreadsheet-level deletion ── */
        const usedSheets = entry.sheets.filter((s) => s.usedBy.length > 0);
        if (usedSheets.length > 0) {
            const linkedInfo = usedSheets.map((s) => ({ sheetName: s.sheetName, pages: s.usedBy }));
            return NextResponse.json(
                {
                    success: false,
                    error: `Spreadsheet masih memiliki ${usedSheets.length} sheet yang terhubung ke halaman. Lepas (unlink) semua sheet terlebih dahulu.`,
                    linkedSheets: linkedInfo,
                },
                { status: 409 },
            );
        }

        const removed = registry.splice(idx, 1)[0];
        saveRegistry(registry);
        return NextResponse.json({
            success: true, type: "spreadsheet", data: removed,
            message: `"${removed.title}" berhasil dihapus (${removed.sheets.length} sheet)`,
        });
    } catch (err: unknown) {
        return NextResponse.json(
            { success: false, error: err instanceof Error ? err.message : "Failed to delete entry" },
            { status: 500 },
        );
    }
}

/* ─────────────────────────────────────────────────
   PATCH — Delegated to sheet-ops module
   ───────────────────────────────────────────────── */
export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        return handlePatch(body);
    } catch (err: unknown) {
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "Failed" },
            { status: 500 },
        );
    }
}
