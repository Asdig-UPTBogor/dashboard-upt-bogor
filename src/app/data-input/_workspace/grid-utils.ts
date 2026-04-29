/**
 * grid-utils — pure utility functions untuk MasterGrid workspace.
 *
 * Extracted dari MasterGrid.tsx monolith supaya:
 *  1. Grid component ga bloat dengan helper
 *  2. Util bisa di-unit-test tanpa render React
 *  3. Reusable lintas workspace (nanti kalau ada grid lain)
 */

import type { ColumnMeta } from "./types";

/** Estimate default width per column berdasar tipe data.
 *  Width persistable via Firestore overlay (field `width`) — helper ini
 *  jadi fallback kalau overlay belum set. */
export function estimateWidth(col: ColumnMeta): number {
    switch (col.type) {
        case "STRING":
        case "RICH_TEXT":
        case "URL":
            return 200;
        case "INT64":
        case "FLOAT64":
        case "NUMERIC":
            return 120;
        case "BOOL":
            return 80;
        case "DATE":
            return 130;
        case "TIMESTAMP":
            return 170;
        case "CHOICE":
            return 140;
        case "REFERENCE":
            return 220;
        case "FILE":
            return 140;
        default:
            return 160;
    }
}

/** Format relative time untuk tooltip "last refreshed" (senior UX pattern).
 *  <5s → "just now", <1min → "Xs ago", <1h → "Xm ago", <1d → "Xh ago",
 *  else → full time. */
export function formatRelativeTime(d: Date | null): string {
    if (!d) return "never";
    const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diffSec < 5) return "just now";
    if (diffSec < 60) return `${diffSec}s ago`;
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

/** Format BQ TIMESTAMP / DATE string ke display lokal (WIB).
 *  dateOnly=true → "DD MMM YY" (no time). */
export function formatDate(v: unknown, dateOnly = false): string {
    const s = typeof v === "string" ? v : String(v);
    try {
        const d = new Date(s);
        if (dateOnly) {
            return d.toLocaleDateString("id-ID", {
                timeZone: "Asia/Jakarta",
                day: "2-digit",
                month: "short",
                year: "2-digit",
            });
        }
        return d.toLocaleString("id-ID", {
            timeZone: "Asia/Jakarta",
            day: "2-digit",
            month: "short",
            year: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
        });
    } catch {
        return s;
    }
}
