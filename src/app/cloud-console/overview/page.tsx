"use client";

/**
 * Cloud Console — Overview Page
 *
 * Aggregate dashboard showing health of all registered services.
 * Registry-driven from Firestore via API.
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
    Cloud, ArrowRight, Table2, Zap, Activity, CloudRain, Database,
    Signal, Cpu, Layers, MessageSquare, LayoutDashboard, Network, Server,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CLOUD_CONSOLE_API } from "@/lib/cloud-console-api";

/* ── Icon resolver ── */

const ICON_MAP: Record<string, typeof Zap> = {
    Table2, Zap, Activity, CloudRain, Database, Cloud,
    MessageSquare, LayoutDashboard, Network, Server,
};
function resolveIcon(name: string) { return ICON_MAP[name] || Cloud; }

/* ── Status colors ── */

const STATUS_STYLE: Record<string, { dot: string; text: string; border: string }> = {
    active:   { dot: "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]", text: "text-emerald-400", border: "border-emerald-500/30" },
    planned:  { dot: "bg-blue-400/50",   text: "text-blue-400",   border: "border-blue-500/30" },
    disabled: { dot: "bg-slate-500",     text: "text-slate-400",  border: "border-slate-500/30" },
};

/* ── Service path mapping ── */

const SERVICE_PATHS: Record<string, string> = {
    "spreadsheet-sync": "spreadsheet-sync",
    "thor-gen3": "thor-vaisala",
    "notifier": "wa-notifier",
};

interface ServiceDef {
    id: string;
    name: string;
    description?: string;
    subtitle?: string;
    icon: string;
    color: string;
    status: string;
    configCollection?: string;
    configDocument?: string;
    logServiceName?: string;
    schedulerJobId?: string;
}

export default function ServerlessHubOverview() {
    const router = useRouter();
    const [services, setServices] = useState<ServiceDef[]>([]);

    useEffect(() => {
        fetch(`${CLOUD_CONSOLE_API}/services`)
            .then((res) => res.json())
            .then((data) => {
                const registry = data.services || {};
                const list: ServiceDef[] = Object.entries(registry)
                    .map(([id, def]) => ({ id, ...(def as Omit<ServiceDef, 'id'>) }));
                setServices(list);
            })
            .catch(console.error);
    }, []);

    const activeCount = services.filter(s => s.status === "active").length;
    const plannedCount = services.filter(s => s.status === "planned").length;

    return (
        <div className="min-h-screen bg-background p-6 md:p-8">
            {/* Header */}
            <div className="mb-8 flex items-center gap-4">
                <div className="relative">
                    <div className="absolute -inset-1 rounded-2xl bg-linear-to-br from-indigo-500 to-purple-600 opacity-25 blur-lg" />
                    <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-linear-to-br from-indigo-500 to-purple-600">
                        <Cloud className="h-6 w-6 text-white" />
                    </div>
                </div>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">Cloud Console</h1>
                    <p className="text-sm text-muted-foreground">Monitor & control all cloud services</p>
                </div>
            </div>

            {/* Summary row */}
            <div className="grid grid-cols-3 gap-4 mb-8">
                <SummaryCard icon={<Layers className="h-5 w-5" />} label="Total Services" value={services.length} color="text-blue-400" />
                <SummaryCard icon={<Signal className="h-5 w-5" />} label="Active" value={activeCount} color="text-emerald-400" />
                <SummaryCard icon={<Cpu className="h-5 w-5" />} label="Planned" value={plannedCount} color="text-amber-400" />
            </div>

            {/* Service Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {services.map((svc) => {
                    const path = SERVICE_PATHS[svc.id];
                    return (
                        <ServiceCard
                            key={svc.id}
                            service={svc}
                            onClick={() => path ? router.push(`/cloud-console/${path}`) : undefined}
                            hasPage={!!path}
                        />
                    );
                })}
            </div>

            {/* Footer */}
            <p className="text-center mt-12 text-xs text-muted-foreground/40">
                Cloud Console · {services.length} services registered
            </p>
        </div>
    );
}

/* ── Service Card ── */

function ServiceCard({ service, onClick, hasPage }: { service: ServiceDef; onClick: () => void; hasPage: boolean }) {
    const Icon = resolveIcon(service.icon);
    const style = STATUS_STYLE[service.status] || STATUS_STYLE.disabled;

    return (
        <Card
            className={`border-border bg-muted/30 transition-all duration-200 group hover:shadow-md ${hasPage ? 'hover:bg-muted/50 cursor-pointer' : 'opacity-80'}`}
            onClick={hasPage ? onClick : undefined}
        >
            <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted/50 group-hover:bg-muted/80 transition-colors">
                        <Icon className={`h-5 w-5 ${service.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="text-foreground truncate">{service.name}</div>
                        <div className="text-xs text-muted-foreground font-normal">{service.subtitle || service.id}</div>
                    </div>
                    <Badge variant="outline" className={`h-5 text-xs ${style.text} ${style.border}`}>
                        <span className={`h-1.5 w-1.5 rounded-full mr-1 ${style.dot}`} />
                        {service.status}
                    </Badge>
                </CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-xs text-muted-foreground mb-3">{service.description}</p>
                <div className="space-y-1.5 text-xs text-muted-foreground">
                    {service.configCollection && (
                        <div className="flex justify-between">
                            <span>Config</span>
                            <span className="font-mono text-foreground/60">{service.configCollection}/{service.configDocument}</span>
                        </div>
                    )}
                    {service.logServiceName && (
                        <div className="flex justify-between">
                            <span>Logs</span>
                            <span className="font-mono text-foreground/60">{service.logServiceName}</span>
                        </div>
                    )}
                    {service.schedulerJobId && (
                        <div className="flex justify-between">
                            <span>Scheduler</span>
                            <span className="font-mono text-foreground/60">{service.schedulerJobId}</span>
                        </div>
                    )}
                </div>
                {hasPage && (
                    <div className="flex items-center justify-end mt-3 text-xs text-muted-foreground/40 group-hover:text-blue-400 transition-colors">
                        Open <ArrowRight className="h-3 w-3 ml-1" />
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

/* ── Summary Card ── */

function SummaryCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
    return (
        <div className="rounded-xl border border-border bg-muted/20 p-5 flex items-center gap-4">
            <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-muted/30 ${color}`}>
                {icon}
            </div>
            <div>
                <div className={`text-3xl font-bold tabular-nums ${color}`}>{value}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
            </div>
        </div>
    );
}
