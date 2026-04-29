/**
 * Master Data Config — constants (per-level meta + parent requirements).
 *
 * Meta here punya nama field berbeda dari `data-level-config/constants.ts`
 * (uppercase Level enum vs lowercase disini, plus nameHint/parentHints custom).
 * Jadi kita maintain lokal — tapi bisa share icon + color palette.
 */
import { Building2, Network, Zap, Box } from "lucide-react";
import type { Level, LevelConfig } from "./types";

export const LEVEL_ORDER: Level[] = ["upt", "ultg", "gi", "bay"];

export const LEVEL_META: Record<Level, {
    label: string;
    Icon: React.ComponentType<{ className?: string }>;
    color: string;
    bg: string;
    nameHint: string;
    parentHints: Record<string, string>;
}> = {
    upt: {
        label: "UPT",
        Icon: Building2,
        color: "text-indigo-400",
        bg: "bg-indigo-500/10 border-indigo-500/30",
        nameHint: "Kolom yang berisi nama UPT",
        parentHints: {},
    },
    ultg: {
        label: "ULTG",
        Icon: Network,
        color: "text-blue-400",
        bg: "bg-blue-500/10 border-blue-500/30",
        nameHint: "Kolom yang berisi nama ULTG",
        parentHints: { upt: "Kolom di tabel ini yang merujuk ke UPT" },
    },
    gi: {
        label: "GI (Gardu Induk)",
        Icon: Zap,
        color: "text-amber-400",
        bg: "bg-amber-500/10 border-amber-500/30",
        nameHint: "Kolom yang berisi nama Gardu Induk",
        parentHints: {
            upt: "Kolom di tabel ini yang merujuk ke UPT",
            ultg: "Kolom di tabel ini yang merujuk ke ULTG",
        },
    },
    bay: {
        label: "Bay",
        Icon: Box,
        color: "text-emerald-400",
        bg: "bg-emerald-500/10 border-emerald-500/30",
        nameHint: "Kolom yang berisi nama Bay",
        parentHints: {
            ultg: "Kolom di tabel ini yang merujuk ke ULTG",
            gi: "Kolom di tabel ini yang merujuk ke Gardu Induk",
        },
    },
};

export const PARENT_REQS: Record<Level, Array<"upt" | "ultg" | "gi">> = {
    upt: [],
    ultg: ["upt"],
    gi: ["upt", "ultg"],
    bay: ["ultg", "gi"],
};

export const EMPTY_LEVEL: LevelConfig = {
    dataset: "",
    table: "",
    columns: { name: "" },
};

export const colKey = (dataset: string, table: string) => `${dataset}|${table}`;

export function emptyConfig(): import("./types").MasterConfig {
    return {
        version: 2,
        source: "bigquery",
        levels: {
            upt: { ...EMPTY_LEVEL },
            ultg: { ...EMPTY_LEVEL, columns: { name: "", parentNames: {} } },
            gi: { ...EMPTY_LEVEL, columns: { name: "", parentNames: {}, attrs: {} } },
            bay: { ...EMPTY_LEVEL, columns: { name: "", parentNames: {}, attrs: {} } },
        },
    };
}
