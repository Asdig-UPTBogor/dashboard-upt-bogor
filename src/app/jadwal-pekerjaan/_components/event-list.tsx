"use client";

import {
    Zap, MapPin, ArrowRight, Timer,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2 } from "lucide-react";
import type { JadwalEvent } from "../_lib/types";
import { C, fmtDate } from "../_lib/types";

/* ── Single Event Card ── */
function EventCard({ ev, onFly }: { ev: JadwalEvent; onFly: (ev: JadwalEvent) => void }) {
    const statusOk = ev.status.toLowerCase().includes("ok");
    const statusColor = statusOk ? C.emerald : C.amber;
    const jenisColor = ev.jenis === "External" ? C.purple : ev.jenis === "Internal" ? C.blue : C.orange;
    const progressColor = ev.progressPct > 80 ? C.emerald : ev.progressPct > 40 ? C.amber : C.blue;

    return (
        <Card
            className="cursor-pointer hover:shadow-lg transition-all duration-300"
            onClick={() => onFly(ev)}
        >
            <CardContent className="p-5">
                {/* Row 1: GI Name + Status */}
                <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2 min-w-0">
                        <Badge variant="outline" className="text-xs font-bold shrink-0">
                            ULTG {ev.ultg}
                        </Badge>
                        <h3 className="text-base font-bold truncate">
                            {ev.garduInduk || "—"}
                        </h3>
                    </div>
                    <Badge
                        className="text-xs font-bold shrink-0"
                        style={{ backgroundColor: `${statusColor}20`, color: statusColor }}
                    >
                        {ev.status || "—"}
                    </Badge>
                </div>

                {/* Row 2: Bay */}
                <div className="flex items-center gap-2 mb-2">
                    <Zap className="h-3.5 w-3.5 shrink-0" style={{ color: C.amber }} />
                    <span className="text-sm font-medium">{ev.bay || "—"}</span>
                </div>

                {/* Row 3: Description */}
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                    {ev.deskripsi || "Tidak ada deskripsi pekerjaan"}
                </p>

                <Separator className="mb-4" />

                {/* Row 4: Duration Progress */}
                <div className="mb-3">
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Timer className="h-3 w-3" />
                            Hari ke-{ev.daysCurrent} dari {ev.daysTotal} hari
                        </span>
                        <span className="text-xs font-mono font-medium" style={{ color: progressColor }}>
                            {Math.round(ev.progressPct)}%
                        </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${ev.progressPct}%`, backgroundColor: progressColor }}
                        />
                    </div>
                    <div className="flex items-center justify-between mt-1.5">
                        <span className="text-xs text-muted-foreground font-mono">{fmtDate(ev.start)}</span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground/30" />
                        <span className="text-xs text-muted-foreground font-mono">{fmtDate(ev.end)}</span>
                    </div>
                </div>

                {/* Row 5: Metadata tags */}
                <div className="flex items-center gap-2 flex-wrap">
                    <Badge
                        className="text-xs"
                        style={{ backgroundColor: `${jenisColor}20`, color: jenisColor }}
                    >
                        {ev.jenis || "—"}
                    </Badge>
                    {ev.gi && (
                        <>
                            <Badge variant="outline" className="text-xs text-muted-foreground">
                                {ev.gi.voltage} kV
                            </Badge>
                            <Badge variant="outline" className="text-xs text-muted-foreground">
                                {ev.gi.giType}
                            </Badge>
                            <span className="text-xs text-muted-foreground/50 flex items-center gap-0.5 ml-auto">
                                <MapPin className="h-3 w-3" /> Klik untuk lihat di peta
                            </span>
                        </>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

/* ── Event List (loading / empty / list) ── */
interface EventListProps {
    loading: boolean;
    events: JadwalEvent[];
    searchTerm: string;
    onFly: (ev: JadwalEvent) => void;
}

export function EventList({ loading, events, searchTerm, onFly }: EventListProps) {
    if (loading) {
        return (
            <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                    <Card key={i}>
                        <CardContent className="p-5 space-y-3">
                            <Skeleton className="h-5 w-2/5" />
                            <Skeleton className="h-4 w-3/5" />
                            <Skeleton className="h-3 w-full" />
                            <Skeleton className="h-2 w-full" />
                            <Skeleton className="h-3 w-1/3" />
                        </CardContent>
                    </Card>
                ))}
            </div>
        );
    }

    if (events.length === 0) {
        return (
            <Card>
                <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                    <CheckCircle2 className="h-12 w-12 text-emerald-400/20 mb-3" />
                    <p className="text-sm font-medium text-muted-foreground">
                        {searchTerm ? "Tidak ditemukan" : "Tidak ada event hari ini"}
                    </p>
                    <p className="text-xs text-muted-foreground/50 mt-1">
                        {searchTerm ? "Coba kata kunci lain" : "Semua operasi berjalan normal"}
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-3">
            {events.map((ev) => (
                <EventCard key={ev.id} ev={ev} onFly={onFly} />
            ))}
        </div>
    );
}
