"use client";

/**
 * Serverless Hub — Overview Page
 *
 * Aggregate dashboard showing health of all registered services.
 * Registry-driven, zero hardcoded values.
 */

import { useRouter } from "next/navigation";
import {
    Cloud, ArrowRight, Table2, Zap, Activity, CloudRain, Database,
    Signal, Cpu, Layers,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getActiveWorkers, type WorkerDefinition } from "@/lib/worker-registry";

/* ── Icon resolver ── */

const ICON_MAP: Record<string, typeof Zap> = { Table2, Zap, Activity, CloudRain, Database, Cloud };
function resolveIcon(name: string) { return ICON_MAP[name] || Cloud; }

/* ── Status colors ── */

const STATUS_STYLE: Record<string, { dot: string; text: string; border: string }> = {
    active:   { dot: "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]", text: "text-emerald-400", border: "border-emerald-500/30" },
    planned:  { dot: "bg-blue-400/50",   text: "text-blue-400",   border: "border-blue-500/30" },
    disabled: { dot: "bg-slate-500",     text: "text-slate-400",  border: "border-slate-500/30" },
};

export default function ServerlessHubOverview() {
    const router = useRouter();
    const workers = getActiveWorkers();

    return (
        <div className="min-h-screen bg-background p-6 md:p-8">
            {/* Header */}
            <div className="mb-8 flex items-center gap-4">
                <div className="relative">
                    <div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 opacity-25 blur-lg" />
                    <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600">
                        <Cloud className="h-6 w-6 text-white" />
                    </div>
                </div>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">Serverless Hub</h1>
                    <p className="text-sm text-muted-foreground">Monitor & control all serverless services</p>
                </div>
            </div>

            {/* Summary row */}
            <div className="grid grid-cols-3 gap-4 mb-8">
                <SummaryCard icon={<Layers className="h-5 w-5" />} label="Total Services" value={workers.length} color="text-blue-400" />
                <SummaryCard icon={<Signal className="h-5 w-5" />} label="Active" value={workers.filter(w => w.status === "active").length} color="text-emerald-400" />
                <SummaryCard icon={<Cpu className="h-5 w-5" />} label="Planned" value={workers.filter(w => w.status === "planned").length} color="text-amber-400" />
            </div>

            {/* Service Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {workers.map((worker) => (
                    <ServiceCard key={worker.id} worker={worker} onClick={() => router.push(`/serverless-hub/${worker.id}`)} />
                ))}
            </div>

            {/* Footer */}
            <p className="text-center mt-12 text-[11px] text-muted-foreground/40">
                Serverless Hub · {workers.length} services registered
            </p>
        </div>
    );
}

/* ── Service Card ── */

function ServiceCard({ worker, onClick }: { worker: WorkerDefinition; onClick: () => void }) {
    const Icon = resolveIcon(worker.icon);
    const style = STATUS_STYLE[worker.status] || STATUS_STYLE.disabled;

    return (
        <Card className="border-border bg-muted/30 hover:bg-muted/50 cursor-pointer transition-all duration-200 group hover:shadow-md" onClick={onClick}>
            <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted/50 group-hover:bg-muted/80 transition-colors">
                        <Icon className={`h-5 w-5 ${worker.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="text-foreground truncate">{worker.name}</div>
                        <div className="text-[10px] text-muted-foreground font-normal">{worker.subtitle}</div>
                    </div>
                    <Badge variant="outline" className={`h-5 text-[10px] ${style.text} ${style.border}`}>
                        <span className={`h-1.5 w-1.5 rounded-full mr-1 ${style.dot}`} />
                        {worker.status}
                    </Badge>
                </CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-[11px] text-muted-foreground mb-3">{worker.description}</p>
                <div className="space-y-1.5 text-[10px] text-muted-foreground">
                    <div className="flex justify-between">
                        <span>Config</span>
                        <span className="font-mono text-foreground/60">{worker.configCollection}/{worker.configDocument}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Logs</span>
                        <span className="font-mono text-foreground/60">{worker.logServiceName}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Scheduler</span>
                        <span className="font-mono text-foreground/60">{worker.schedulerJobId}</span>
                    </div>
                </div>
                <div className="flex items-center justify-end mt-3 text-[10px] text-muted-foreground/40 group-hover:text-blue-400 transition-colors">
                    Open <ArrowRight className="h-3 w-3 ml-1" />
                </div>
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
                <div className="text-[10px] text-muted-foreground mt-0.5">{label}</div>
            </div>
        </div>
    );
}
