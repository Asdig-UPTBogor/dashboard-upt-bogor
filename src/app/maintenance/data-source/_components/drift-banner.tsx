"use client";

/**
 * DriftBanner — Menampilkan status drift dari worker SSE
 *
 * Komponen read-only yang menampilkan:
 * - Health score keseluruhan
 * - Daftar issue (warning/error)
 * - Tombol "Perbaiki di DC" untuk navigasi
 */

import Link from "next/link";
import {
    AlertTriangle, CheckCircle2, XCircle, Cable,
    ChevronDown, Shield, ShieldAlert,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { DriftSnapshotSummary, DriftIssueSSE } from "@/hooks/useWorkerSSE";

interface DriftBannerProps {
    drift: DriftSnapshotSummary | null;
}

export function DriftBanner({ drift }: DriftBannerProps) {
    const [showAll, setShowAll] = useState(false);

    if (!drift) return null;

    const { overallHealth, issueCount, timestamp, issues: rawIssues } = drift;
    const issues = rawIssues || [];
    const hasIssues = issueCount > 0;
    const errors = issues.filter((i: DriftIssueSSE) => i.severity === "error");
    const warnings = issues.filter((i: DriftIssueSSE) => i.severity === "warning");
    const infos = issues.filter((i: DriftIssueSSE) => i.severity === "info");

    const displayIssues = showAll ? [...errors, ...warnings] : [...errors, ...warnings].slice(0, 3);
    const hiddenCount = [...errors, ...warnings].length - displayIssues.length;

    const timeAgo = (() => {
        const diff = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
        if (diff < 60) return `${diff}s lalu`;
        if (diff < 3600) return `${Math.floor(diff / 60)}m lalu`;
        return `${Math.floor(diff / 3600)}h lalu`;
    })();

    /* ── Semua OK ── */
    if (!hasIssues) {
        return (
            <Card className="mb-4 border-emerald-500/20 bg-emerald-500/5">
                <CardContent className="flex items-center gap-3 p-4">
                    <Shield className="h-5 w-5 text-emerald-400" />
                    <div className="flex-1">
                        <p className="text-sm font-medium text-emerald-300">
                            Semua Data Source OK
                        </p>
                        <p className="text-xs text-emerald-400/60">
                            Health {overallHealth}% · Audit terakhir {timeAgo}
                        </p>
                    </div>
                    <Badge variant="outline" className="border-emerald-500/20 text-emerald-400 text-[10px]">
                        ✓ Konsisten
                    </Badge>
                </CardContent>
            </Card>
        );
    }

    /* ── Ada issue ── */
    const borderColor = errors.length > 0 ? "border-red-500/30" : "border-amber-500/30";
    const bgColor = errors.length > 0 ? "bg-red-500/5" : "bg-amber-500/5";

    return (
        <Card className={`mb-4 ${borderColor} ${bgColor}`}>
            <CardContent className="p-4 space-y-3">
                {/* Header row */}
                <div className="flex items-center gap-3">
                    <ShieldAlert className={`h-5 w-5 ${errors.length > 0 ? "text-red-400" : "text-amber-400"}`} />
                    <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${errors.length > 0 ? "text-red-300" : "text-amber-300"}`}>
                            {errors.length > 0 ? "Drift Terdeteksi" : "Perhatian Diperlukan"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                            Health {overallHealth}% · {issueCount} masalah · Audit {timeAgo}
                        </p>
                    </div>
                    <Button asChild size="sm"
                        className="bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-500/20 text-xs">
                        <Link href="/maintenance/data-connector">
                            <Cable className="mr-1.5 h-3.5 w-3.5" /> Perbaiki di DC
                        </Link>
                    </Button>
                </div>

                {/* Issue list */}
                {displayIssues.length > 0 && (
                    <div className="space-y-1.5 pl-8">
                        {displayIssues.map((issue, idx) => (
                            <div key={idx} className="flex items-start gap-2 text-xs">
                                {issue.severity === "error"
                                    ? <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />
                                    : <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
                                }
                                <span className="text-muted-foreground">
                                    <span className="font-medium text-foreground/80">
                                        {issue.spreadsheetTitle}
                                    </span>
                                    {issue.sheetName && (
                                        <span className="text-muted-foreground/60"> / {issue.sheetName}</span>
                                    )}
                                    {issue.columnName && (
                                        <span className="text-muted-foreground/60"> / {issue.columnName}</span>
                                    )}
                                    <span className="text-muted-foreground/80"> — {issue.message}</span>
                                </span>
                            </div>
                        ))}
                        {hiddenCount > 0 && (
                            <button
                                onClick={() => setShowAll(!showAll)}
                                className="flex items-center gap-1 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors pl-5"
                            >
                                <ChevronDown className={`h-3 w-3 transition-transform ${showAll ? "rotate-180" : ""}`} />
                                {showAll ? "Sembunyikan" : `+${hiddenCount} masalah lainnya`}
                            </button>
                        )}
                    </div>
                )}

                {/* Info items (kolom pindah posisi) */}
                {infos.length > 0 && (
                    <div className="pl-8 pt-1 border-t border-border/30">
                        <p className="text-[10px] text-muted-foreground/50 mb-1">Perubahan posisi (auto-fix):</p>
                        <div className="flex flex-wrap gap-1.5">
                            {infos.slice(0, 5).map((info, idx) => (
                                <Badge key={idx} variant="outline"
                                    className="border-blue-500/20 bg-blue-500/5 text-blue-400/70 text-[10px]">
                                    {info.columnName}: {info.message}
                                </Badge>
                            ))}
                            {infos.length > 5 && (
                                <Badge variant="outline" className="border-border/30 text-muted-foreground/40 text-[10px]">
                                    +{infos.length - 5} lainnya
                                </Badge>
                            )}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
