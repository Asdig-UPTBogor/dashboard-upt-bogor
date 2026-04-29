/**
 * Data Level Config — constants (palette, required columns, level order).
 * Konsisten dengan SS_V5_SYSTEM.md badge color table.
 */
import { Building2, Network, Zap, Box, Layers } from "lucide-react";
import type { Level, LevelColumns } from "./types";

export const LEVEL_ORDER: Level[] = ["UPT", "ULTG", "GI", "BAY", "FLAT"];

export const LEVEL_META: Record<Level, {
    label: string;
    Icon: React.ComponentType<{ className?: string }>;
    color: string;
    bg: string;
    ring: string;
    description: string;
}> = {
    UPT:  { label: "UPT",  Icon: Building2, color: "text-indigo-400",  bg: "bg-indigo-500/10 border-indigo-500/30",  ring: "ring-indigo-500",  description: "Level 1 — unit paling atas" },
    ULTG: { label: "ULTG", Icon: Network,   color: "text-blue-400",    bg: "bg-blue-500/10 border-blue-500/30",      ring: "ring-blue-500",    description: "Level 2 — unit ULTG" },
    GI:   { label: "GI",   Icon: Zap,       color: "text-amber-400",   bg: "bg-amber-500/10 border-amber-500/30",    ring: "ring-amber-500",   description: "Level 3 — Gardu Induk" },
    BAY:  { label: "BAY",  Icon: Box,       color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/30",ring: "ring-emerald-500", description: "Level 4 — Bay (paling dalam)" },
    FLAT: { label: "FLAT", Icon: Layers,    color: "text-zinc-400",    bg: "bg-zinc-500/10 border-zinc-500/30",      ring: "ring-zinc-500",    description: "Raw data, no FK enrichment" },
};

/**
 * Required columns per level — MIRROR backend `validateLevelPayload`
 * di `/api/bq-table-levels/route.ts`. Wajib match supaya UI tidak block
 * payload yang valid di backend.
 *
 * Logika:
 * - UPT  → butuh `upt` (kolom nama UPT di tabel ini)
 * - ULTG → butuh `upt` + `ultg` (parent + diri)
 * - GI   → butuh `gi` (parent UPT/ULTG opsional, FE tetap tampilin)
 * - BAY  → butuh `gi` + `bay`
 */
export const REQUIRED_COLUMNS: Record<Level, Array<keyof LevelColumns>> = {
    UPT:  ["upt"],
    ULTG: ["upt", "ultg"],
    GI:   ["gi"],
    BAY:  ["gi", "bay"],
    FLAT: [],
};

/** Kolom yg DITAMPILKAN per level (required + optional). */
export const VISIBLE_COLUMNS: Record<Level, Array<keyof LevelColumns>> = {
    UPT:  ["upt"],
    ULTG: ["upt", "ultg"],
    GI:   ["upt", "ultg", "gi"],            // upt+ultg optional → user pilih kalau mau disambiguate
    BAY:  ["upt", "ultg", "gi", "bay"],     // upt+ultg+gi optional kalau bay name unique
    FLAT: [],
};

export const tableKey = (t: { dataset: string; table: string }) => `${t.dataset}__${t.table}`;

export function pct(n: number, total: number): string {
    if (total === 0) return "0";
    return ((n / total) * 100).toFixed(1);
}
