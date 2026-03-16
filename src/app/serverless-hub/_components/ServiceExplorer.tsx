"use client";

/**
 * ServiceExplorer — Card-based sidebar matching dashboard Card design.
 * Outer wrapper (rounded-xl border bg-card shadow-sm) is in layout.tsx.
 * Inside: clean header + unified nav list with Overview + Services.
 */

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
    Cloud, ChevronLeft, ChevronRight,
    Table2, Zap, Activity, CloudRain, Database,
    LayoutDashboard,
} from "lucide-react";
import { getActiveWorkers, type WorkerDefinition } from "@/lib/worker-registry";

const ICONS: Record<string, typeof Zap> = { Table2, Zap, Activity, CloudRain, Database, Cloud };
function ic(n: string) { return ICONS[n] || Cloud; }

const DOT: Record<string, string> = {
    active: "bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.5)]",
    planned: "bg-blue-400/50",
    disabled: "bg-slate-500",
};

interface Props { checkedServices: Set<string>; onToggleLog: (id: string) => void }

export function ServiceExplorer({ checkedServices, onToggleLog }: Props) {
    const path = usePathname();
    const router = useRouter();
    const [collapsed, setCollapsed] = useState(false);
    const workers = getActiveWorkers();
    const to = (w: WorkerDefinition) => `/serverless-hub/${w.id}`;

    /* ═══ Collapsed ═══ */
    if (collapsed) {
        return (
            <div className="h-full flex flex-col" style={{ width: 48 }}>
                <div className="flex items-center justify-center py-3 border-b border-border">
                    <button onClick={() => setCollapsed(false)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                        <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                </div>
                <div className="flex-1 flex flex-col items-center gap-1 py-3">
                    <button onClick={() => router.push("/serverless-hub/overview")} title="Overview"
                        className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                            path === "/serverless-hub/overview" ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60"
                        }`}>
                        <LayoutDashboard className="h-4 w-4" />
                    </button>
                    <div className="w-5 border-t border-border my-1" />
                    {workers.map(w => {
                        const I = ic(w.icon);
                        return (
                            <button key={w.id} onClick={() => router.push(to(w))} title={w.name}
                                className={`relative flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                                    path === to(w) ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60"
                                }`}>
                                <I className={`h-4 w-4 ${w.color}`} />
                                <span className={`absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full ${DOT[w.status]}`} />
                            </button>
                        );
                    })}
                </div>
            </div>
        );
    }

    /* ═══ Expanded ═══ */
    return (
        <div className="h-full flex flex-col" style={{ width: 240 }}>

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shrink-0">
                        <Cloud className="h-4 w-4 text-white" />
                    </div>
                    <div>
                        <div className="text-sm font-semibold text-foreground leading-tight">Serverless Hub</div>
                        <div className="text-[10px] text-muted-foreground">{workers.length} services</div>
                    </div>
                </div>
                <button onClick={() => setCollapsed(true)}
                    className="flex h-6 w-6 items-center justify-center rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                    <ChevronLeft className="h-3.5 w-3.5" />
                </button>
            </div>

            {/* Nav list — Overview + Services in one unified card section */}
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5">

                {/* Overview item */}
                <button onClick={() => router.push("/serverless-hub/overview")}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all duration-150 text-left ${
                        path === "/serverless-hub/overview"
                            ? "border-indigo-500/30 bg-indigo-500/10 text-foreground shadow-sm"
                            : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                    }`}>
                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg shrink-0 ${
                        path === "/serverless-hub/overview" ? "bg-indigo-500/20" : "bg-muted/50"
                    }`}>
                        <LayoutDashboard className={`h-4 w-4 ${path === "/serverless-hub/overview" ? "text-indigo-400" : ""}`} />
                    </div>
                    <div>
                        <div className="text-[12px] font-semibold leading-tight">Overview</div>
                        <div className="text-[10px] text-muted-foreground/60">All services</div>
                    </div>
                </button>

                {/* Service items */}
                {workers.map(worker => {
                    const isActive = path === to(worker);
                    const isChecked = checkedServices.has(worker.id);
                    const I = ic(worker.icon);
                    return (
                        <div key={worker.id}
                            className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-all duration-150 ${
                                isActive
                                    ? "border-blue-500/30 bg-blue-500/10 text-foreground shadow-sm"
                                    : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                            }`}>
                            {/* Checkbox */}
                            <button onClick={(e) => { e.stopPropagation(); onToggleLog(worker.id); }}
                                className={`flex h-4 w-4 items-center justify-center rounded shrink-0 border transition-colors ${
                                    isChecked
                                        ? "bg-blue-500 border-blue-500 text-white"
                                        : "border-muted-foreground/30 hover:border-muted-foreground/60"
                                }`}>
                                {isChecked && <span className="text-[9px] font-bold">✓</span>}
                            </button>

                            {/* Service info */}
                            <button onClick={() => router.push(to(worker))} className="flex items-center gap-2.5 flex-1 min-w-0 text-left">
                                <div className={`flex h-8 w-8 items-center justify-center rounded-lg shrink-0 ${
                                    isActive ? "bg-blue-500/20" : "bg-muted/50"
                                }`}>
                                    <I className={`h-4 w-4 ${worker.color}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className={`text-[12px] font-semibold truncate leading-tight ${isActive ? "text-foreground" : ""}`}>
                                        {worker.name}
                                    </div>
                                    <div className="text-[10px] text-muted-foreground/60 truncate">{worker.subtitle}</div>
                                </div>
                                <span className={`h-2 w-2 rounded-full shrink-0 ${DOT[worker.status]}`} />
                            </button>
                        </div>
                    );
                })}
            </div>

            {/* Footer */}
            <div className="px-4 py-2 border-t border-border text-[10px] text-muted-foreground/50 flex justify-between">
                <span>{workers.filter(w => w.status === "active").length}/{workers.length} online</span>
                {checkedServices.size > 0 && <span>{checkedServices.size} logs open</span>}
            </div>
        </div>
    );
}
