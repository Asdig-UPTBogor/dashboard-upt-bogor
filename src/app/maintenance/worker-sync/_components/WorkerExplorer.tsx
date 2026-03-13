"use client";

/**
 * WorkerExplorer — Sidebar navigation for all background workers.
 *
 * Interaction:
 * - Click worker name → navigate to config page
 * - Click checkbox → toggle log panel (side-by-side)
 * - Status dot: green=active, gray=disabled, red=error
 *
 * Design: Glassmorphism panel matching SpreadsheetExplorer
 */

import { usePathname, useRouter } from "next/navigation";
import {
    Activity, Zap, ChevronRight, Radio,
    FileSpreadsheet, Database,
} from "lucide-react";

/* ── Worker Registry ── */
export interface WorkerDef {
    id: string;
    name: string;
    subtitle: string;
    href: string;
    icon: typeof Zap;
    color: { bg: string; text: string; border: string; dot: string };
    status: "active" | "disabled" | "error" | "unknown";
}

export const WORKERS: WorkerDef[] = [
    {
        id: "spreadsheet-sync",
        name: "Spreadsheet Sync",
        subtitle: "Sheets · QC · BigQuery",
        href: "/maintenance/worker-sync/spreadsheet-sync",
        icon: FileSpreadsheet,
        color: {
            bg: "bg-blue-500/15",
            text: "text-blue-400",
            border: "border-blue-500/20",
            dot: "bg-emerald-400",
        },
        status: "active",
    },
    {
        id: "thor-vaisala",
        name: "Thor Vaisala",
        subtitle: "Lightning Monitor",
        href: "/maintenance/worker-sync/thor-vaisala",
        icon: Zap,
        color: {
            bg: "bg-amber-500/15",
            text: "text-amber-400",
            border: "border-amber-500/20",
            dot: "bg-emerald-400",
        },
        status: "active",
    },
];

/* ── Status dot colors ── */
const DOT_COLORS: Record<string, string> = {
    active: "bg-emerald-400",
    disabled: "bg-slate-500",
    error: "bg-red-400",
    unknown: "bg-slate-600",
};

/* ── Props ── */
interface WorkerExplorerProps {
    checkedWorkers: Set<string>;
    onToggleLog: (workerId: string) => void;
}

/* ── Component ── */
export function WorkerExplorer({ checkedWorkers, onToggleLog }: WorkerExplorerProps) {
    const pathname = usePathname();
    const router = useRouter();

    return (
        <div
            className="h-full flex flex-col border-r border-border bg-gradient-to-b from-card/95 to-card/80 backdrop-blur-sm"
            style={{ width: 220, minWidth: 220 }}
        >
            {/* ── Header ── */}
            <div className="flex-none px-3 py-2.5 border-b border-border">
                <div className="flex items-center gap-2">
                    <div className="flex h-5 w-5 items-center justify-center rounded bg-primary/15">
                        <Activity className="h-3 w-3 text-primary" />
                    </div>
                    <span className="text-[11px] font-semibold text-foreground/80 uppercase tracking-wider">
                        Workers
                    </span>
                    <span className="text-[9px] text-muted-foreground font-mono tabular-nums">
                        {WORKERS.length}
                    </span>
                </div>
            </div>

            {/* ── Worker List ── */}
            <div className="flex-1 overflow-y-auto py-1">
                {WORKERS.map((worker) => {
                    const isActive = pathname === worker.href;
                    const isChecked = checkedWorkers.has(worker.id);
                    const Icon = worker.icon;

                    return (
                        <div key={worker.id} className="mb-0.5">
                            <div
                                className={`flex items-center gap-2 px-2.5 py-[7px] transition-all duration-150 group cursor-pointer
                                    ${isActive
                                        ? "bg-accent"
                                        : "hover:bg-accent/50"
                                    }`}
                            >
                                {/* Checkbox for log panel */}
                                <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={(e) => {
                                        e.stopPropagation();
                                        onToggleLog(worker.id);
                                    }}
                                    className="h-3.5 w-3.5 rounded border-border accent-primary shrink-0 cursor-pointer"
                                    title="Toggle log panel"
                                />

                                {/* Clickable area → navigate to config */}
                                <button
                                    onClick={() => router.push(worker.href)}
                                    className="flex items-center gap-2 flex-1 min-w-0 text-left"
                                >
                                    <div className={`flex h-5 w-5 items-center justify-center rounded ${worker.color.bg} shrink-0`}>
                                        <Icon className={`h-3 w-3 ${worker.color.text}`} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className={`text-[11.5px] font-medium truncate transition-colors
                                            ${isActive ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"}`}>
                                            {worker.name}
                                        </div>
                                        <div className="text-[9px] text-muted-foreground/60 truncate">
                                            {worker.subtitle}
                                        </div>
                                    </div>

                                    {/* Status dot */}
                                    <div className="shrink-0">
                                        <div
                                            className={`h-2 w-2 rounded-full ${DOT_COLORS[worker.status]} ${worker.status === "active" ? "pulse-dot" : ""}`}
                                            title={worker.status}
                                        />
                                    </div>
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* ── Footer ── */}
            <div className="flex-none px-3 py-2 border-t border-border">
                <span className="text-[9px] text-muted-foreground/50 font-mono">
                    {WORKERS.filter(w => w.status === "active").length} active · {checkedWorkers.size} logs open
                </span>
            </div>
        </div>
    );
}
