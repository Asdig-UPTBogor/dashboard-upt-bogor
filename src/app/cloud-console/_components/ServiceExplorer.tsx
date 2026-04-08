"use client";

/**
 * ServiceExplorer — Card-based sidebar matching dashboard Card design.
 * Outer wrapper (rounded-xl border bg-card shadow-sm) is in layout.tsx.
 * 
 * READS FROM: Firestore registry via API (passed as props from layout)
 * NO MORE: hardcoded worker-registry.ts
 */

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Cloud, ChevronLeft, ChevronRight, LayoutDashboard } from "lucide-react";
import type { ServiceInfo } from "../layout";
import { resolveIcon } from "../_lib/service-icons";

function ic(n: string) { return resolveIcon(n); }

const DOT: Record<string, string> = {
    active: "bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.5)]",
    planned: "bg-blue-400/50",
    disabled: "bg-slate-500",
};

/** Get FE route from registry routePath (auto-discovery) */
function getServicePath(svc: ServiceInfo): string | null {
    return svc.routePath || null;
}

interface Props {
    services: ServiceInfo[];
    checkedServices: Set<string>;
    onToggleLog: (id: string) => void;
}

export function ServiceExplorer({ services, checkedServices, onToggleLog }: Props) {
    const path = usePathname();
    const router = useRouter();
    const [collapsed, setCollapsed] = useState(false);

    const toRoute = (svc: ServiceInfo) => {
        const p = getServicePath(svc);
        return p ? `/cloud-console/${p}` : null;
    };

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
                    <button onClick={() => router.push("/cloud-console/overview")} title="Overview"
                        className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                            path === "/cloud-console/overview" ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60"
                        }`}>
                        <LayoutDashboard className="h-4 w-4" />
                    </button>
                    <div className="w-5 border-t border-border my-1" />
                    {services.map(svc => {
                        const I = ic(svc.icon);
                        const route = toRoute(svc);
                        return (
                            <button key={svc.id}
                                onClick={() => route && router.push(route)}
                                title={svc.name}
                                className={`relative flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                                    route && path === route ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60"
                                }`}>
                                <I className={`h-4 w-4 ${svc.color}`} />
                                <span className={`absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full ${DOT[svc.status]}`} />
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
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-linear-to-br from-indigo-500 to-purple-600 shrink-0">
                        <Cloud className="h-4 w-4 text-white" />
                    </div>
                    <div>
                        <div className="text-sm font-semibold text-foreground leading-tight">Cloud Console</div>
                        <div className="text-xs text-muted-foreground">{services.length} services</div>
                    </div>
                </div>
                <button onClick={() => setCollapsed(true)}
                    className="flex h-6 w-6 items-center justify-center rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                    <ChevronLeft className="h-3.5 w-3.5" />
                </button>
            </div>

            {/* Nav list */}
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5">

                {/* Overview item */}
                <button onClick={() => router.push("/cloud-console/overview")}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all duration-150 text-left ${
                        path === "/cloud-console/overview"
                            ? "border-indigo-500/30 bg-indigo-500/10 text-foreground shadow-sm"
                            : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                    }`}>
                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg shrink-0 ${
                        path === "/cloud-console/overview" ? "bg-indigo-500/20" : "bg-muted/50"
                    }`}>
                        <LayoutDashboard className={`h-4 w-4 ${path === "/cloud-console/overview" ? "text-indigo-400" : ""}`} />
                    </div>
                    <div>
                        <div className="text-[12px] font-semibold leading-tight">Overview</div>
                        <div className="text-xs text-muted-foreground/60">All services</div>
                    </div>
                </button>

                {/* Service items — from Firestore registry via API */}
                {services.map(svc => {
                    const route = toRoute(svc);
                    const isActive = route ? path === route : false;
                    const isChecked = checkedServices.has(svc.id);
                    const I = ic(svc.icon);
                    return (
                        <div key={svc.id}
                            className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-all duration-150 ${
                                isActive
                                    ? "border-blue-500/30 bg-blue-500/10 text-foreground shadow-sm"
                                    : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                            }`}>
                            {/* Checkbox for log toggle */}
                            <button onClick={(e) => { e.stopPropagation(); onToggleLog(svc.id); }}
                                className={`flex h-4 w-4 items-center justify-center rounded shrink-0 border transition-colors ${
                                    isChecked
                                        ? "bg-blue-500 border-blue-500 text-white"
                                        : "border-muted-foreground/30 hover:border-muted-foreground/60"
                                }`}>
                                {isChecked && <span className="text-xs font-bold">✓</span>}
                            </button>

                            {/* Service info + nav */}
                            <button
                                onClick={() => route && router.push(route)}
                                className="flex items-center gap-2.5 flex-1 min-w-0 text-left"
                            >
                                <div className={`flex h-8 w-8 items-center justify-center rounded-lg shrink-0 ${
                                    isActive ? "bg-blue-500/20" : "bg-muted/50"
                                }`}>
                                    <I className={`h-4 w-4 ${svc.color}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className={`text-[12px] font-semibold truncate leading-tight ${isActive ? "text-foreground" : ""}`}>
                                        {svc.name}
                                    </div>
                                    <div className="text-xs text-muted-foreground/60 truncate">
                                        {svc.subtitle || svc.description || svc.id}
                                    </div>
                                </div>
                                <span className={`h-2 w-2 rounded-full shrink-0 ${DOT[svc.status]}`} />
                            </button>
                        </div>
                    );
                })}
            </div>

            {/* Footer */}
            <div className="px-4 py-2 border-t border-border text-xs text-muted-foreground/50 flex justify-between">
                <span>{services.filter(s => s.status === "active").length}/{services.length} online</span>
                {checkedServices.size > 0 && <span>{checkedServices.size} logs open</span>}
            </div>
        </div>
    );
}
