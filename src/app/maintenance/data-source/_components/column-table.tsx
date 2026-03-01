"use client";

import { useState } from "react";
import { CheckCircle2, XCircle, Lock, Pencil } from "lucide-react";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { ColumnMeta, MissingColumn, HierarchyCheck } from "../_types";
import { TYPE_LABELS } from "../_types";

/**
 * ColumnTable — Enterprise-grade column schema viewer.
 *
 * Full shadcn/ui: Table, Badge, Button, Select, Tooltip, Alert.
 * Displays all columns from a sheet with position, type, sample data,
 * config mapping, and status. Missing columns appear as red rows.
 * Supports inline column override editing.
 */
export function ColumnTable({ columns, missing, spreadsheetId, sheetName, onRefresh, hierarchy, resolveLevel }: {
    columns: ColumnMeta[];
    missing: MissingColumn[];
    spreadsheetId?: string;
    sheetName?: string;
    onRefresh?: () => void;
    hierarchy?: HierarchyCheck[];
    resolveLevel?: string;
}) {
    if (columns.length === 0 && missing.length === 0) return null;

    const usedCount = columns.filter((c) => c.isUsed).length;
    const [selections, setSelections] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);
    const [saveResult, setSaveResult] = useState<string | null>(null);
    const [editing, setEditing] = useState<string | null>(null);

    const saveOverride = async (configCol: string, sheetCol: string) => {
        if (!spreadsheetId || !sheetName) return;
        setSaving(true);
        setSaveResult(null);
        try {
            const res = await fetch("/api/data-sources", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ spreadsheetId, sheetName, configCol, sheetCol }),
            });
            if (res.ok) {
                setSaveResult(`✅ ${configCol} → ${sheetCol}`);
                setSelections((s) => { const n = { ...s }; delete n[configCol]; return n; });
                await new Promise((r) => setTimeout(r, 2000));
                onRefresh?.();
            } else {
                setSaveResult("❌ Gagal menyimpan");
            }
        } catch {
            setSaveResult("❌ Error");
        } finally {
            setSaving(false);
        }
    };

    return (
        <TooltipProvider delayDuration={200}>
            <div className="space-y-3">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <p className="text-[10px] font-semibold tracking-widest text-muted-foreground">
                            Schema Sheet — {usedCount} digunakan dari {columns.length} total
                        </p>
                        {resolveLevel && (
                            <Badge variant="outline" className={resolveLevel === "bay" ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-400 text-[9px]" : "border-cyan-500/30 bg-cyan-500/15 text-cyan-400 text-[9px]"}>
                                Level: {resolveLevel === "bay" ? "Bay" : "Gardu Induk"}
                            </Badge>
                        )}
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground/60">
                        {saveResult && (
                            <span className="mr-2 text-[10px] font-medium animate-pulse">{saveResult}</span>
                        )}
                        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-400" /> Digunakan</span>
                        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400" /> Hierarchy</span>
                        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-slate-700" /> Tidak digunakan</span>
                    </div>
                </div>

                {/* Hierarchy error alert */}
                {hierarchy && (() => {
                    const missingH = hierarchy.filter((h) => h.required && !h.found);
                    if (missingH.length === 0) return null;
                    return (
                        <Alert variant="destructive" className="bg-red-500/10 border-red-500/25 text-red-400">
                            <XCircle className="h-4 w-4" />
                            <AlertTitle className="text-red-400 text-[10px] font-bold">
                                Cross-filter & drill-down error
                            </AlertTitle>
                            <AlertDescription className="text-[10px] text-red-300/80">
                                Kolom hierarchy wajib tidak ditemukan:{" "}
                                {missingH.map((m) => (
                                    <Badge key={m.key} variant="outline" className="mx-0.5 border-red-500/20 bg-red-500/20 text-red-300 font-bold text-[10px]">
                                        {m.label}
                                    </Badge>
                                ))}
                                — sheet ini tidak bisa di-filter oleh dashboard.
                            </AlertDescription>
                        </Alert>
                    );
                })()}

                {/* Table (shadcn) */}
                <div className="overflow-hidden rounded-lg ring-1 ring-white/[0.06]">
                    <Table className="text-[11px]">
                        <TableHeader>
                            <TableRow className="bg-muted/30 border-border/30 hover:bg-muted/30">
                                <TableHead className="w-10 text-center text-[10px] tracking-wider text-muted-foreground">#</TableHead>
                                <TableHead className="w-12 text-center text-[10px] tracking-wider text-muted-foreground">Pos</TableHead>
                                <TableHead className="text-[10px] tracking-wider text-muted-foreground">Sheet Kolom</TableHead>
                                <TableHead className="text-[10px] tracking-wider text-muted-foreground">Mapping Dashboard</TableHead>
                                <TableHead className="w-16 text-center text-[10px] tracking-wider text-muted-foreground">Tipe</TableHead>
                                <TableHead className="w-14 text-center text-[10px] tracking-wider text-muted-foreground">Status</TableHead>
                                <TableHead className="text-[10px] tracking-wider text-muted-foreground">Sample</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {columns.map((col) => {
                                const isHierarchy = !!col.isHierarchy;
                                const rowBg = isHierarchy
                                    ? "bg-amber-500/[0.06] hover:bg-amber-500/[0.10]"
                                    : col.isUsed
                                        ? "bg-emerald-500/[0.03] hover:bg-emerald-500/[0.06]"
                                        : "hover:bg-muted/20";
                                const posBg = isHierarchy
                                    ? "border-amber-500/20 bg-amber-500/20 text-amber-400"
                                    : col.isUsed
                                        ? "border-emerald-500/20 bg-emerald-500/15 text-emerald-400"
                                        : "border-border bg-muted/30 text-muted-foreground/40";
                                return (
                                    <TableRow key={col.index} className={`border-border/30 ${rowBg}`}>
                                        <TableCell className="text-center text-muted-foreground/60">{col.index + 1}</TableCell>
                                        <TableCell className="text-center">
                                            <Badge variant="outline" className={`w-7 justify-center font-bold ${posBg}`}>
                                                {col.position}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className={`font-mono ${col.isUsed || isHierarchy ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                                            {col.name}
                                            {isHierarchy && (
                                                <Badge variant="outline" className="ml-1.5 border-amber-500/20 bg-amber-500/20 text-amber-400 text-[8px]">
                                                    {{ ultg: "ULTG", gi: "GI", bay: "Bay" }[col.hierarchyKey || ""] || ""}
                                                </Badge>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {isHierarchy ? (
                                                <span className="inline-flex items-center gap-1 text-[10px]">
                                                    <Lock className="h-3 w-3 text-amber-400" />
                                                    <code className="text-amber-300">{col.name.replace(/\s+/g, " ")}</code>
                                                    <Badge variant="outline" className="border-amber-500/20 bg-amber-500/10 text-amber-500/60 text-[8px]">auto</Badge>
                                                </span>
                                            ) : col.configName ? (
                                                editing === col.configName ? (
                                                    <div className="flex items-center gap-1">
                                                        <Select
                                                            value={selections[col.configName] || ""}
                                                            onValueChange={(v) => setSelections((s) => ({ ...s, [col.configName!]: v }))}
                                                        >
                                                            <SelectTrigger className="h-6 w-auto min-w-[140px] text-[10px] border-border bg-slate-900 text-foreground/80 focus:ring-cyan-500">
                                                                <SelectValue placeholder="Pilih kolom lain…" />
                                                            </SelectTrigger>
                                                            <SelectContent className="bg-popover border-border">
                                                                {columns.filter((c) => !c.isUsed || c.name === col.name).map((sc) => (
                                                                    <SelectItem key={sc.name} value={sc.name} className="text-[10px] text-foreground focus:bg-white/[0.06]">
                                                                        {sc.position}: {sc.name}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                        {selections[col.configName] && (
                                                            <Button
                                                                size="sm"
                                                                disabled={saving}
                                                                onClick={() => { saveOverride(col.configName!, selections[col.configName!]); setEditing(null); }}
                                                                className="h-6 px-2 text-[10px] bg-cyan-600 hover:bg-cyan-500"
                                                            >
                                                                {saving ? "…" : "✔"}
                                                            </Button>
                                                        )}
                                                        <Button
                                                            variant="ghost" size="sm"
                                                            onClick={() => setEditing(null)}
                                                            className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-foreground/80"
                                                        >
                                                            ✕
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 text-[10px]">
                                                        <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                                                        <code className="text-emerald-300">{col.configName}</code>
                                                        {spreadsheetId && (
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <Button
                                                                        variant="outline" size="sm"
                                                                        onClick={() => setEditing(col.configName)}
                                                                        className="h-5 w-5 p-0 border-border text-muted-foreground hover:border-cyan-500/40 hover:text-cyan-300"
                                                                    >
                                                                        <Pencil className="h-2.5 w-2.5" />
                                                                    </Button>
                                                                </TooltipTrigger>
                                                                <TooltipContent className="bg-popover border-border text-foreground">
                                                                    <p>Ubah mapping</p>
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        )}
                                                    </span>
                                                )
                                            ) : (
                                                <span className="text-muted-foreground/40 text-[10px]">—</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <span className={`text-[9px] font-bold tracking-wider ${TYPE_LABELS[col.type]?.color || "text-muted-foreground/60"}`}>
                                                {TYPE_LABELS[col.type]?.label || col.type}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {isHierarchy ? (
                                                <Tooltip>
                                                    <TooltipTrigger>
                                                        <Lock className="h-3.5 w-3.5 text-amber-400" />
                                                    </TooltipTrigger>
                                                    <TooltipContent className="bg-popover border-border text-foreground">
                                                        <p>Hierarchy — selalu aktif</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            ) : col.isUsed ? (
                                                <CheckCircle2 className="mx-auto h-3.5 w-3.5 text-emerald-400" />
                                            ) : (
                                                <span className="text-muted-foreground/40">—</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="max-w-[200px] truncate text-muted-foreground" title={col.sample}>
                                            {col.sample || <span className="text-muted-foreground/40 italic">kosong</span>}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}

                            {/* Missing columns */}
                            {missing.length > 0 && (
                                <>
                                    <TableRow className="border-t-2 border-red-500/20 hover:bg-transparent">
                                        <TableCell colSpan={7} className="bg-red-500/[0.03] text-[10px] font-medium text-red-400">
                                            <span className="flex items-center gap-1.5">
                                                <XCircle className="h-3 w-3" />
                                                {missing.length} kolom di config tidak ditemukan di sheet
                                            </span>
                                        </TableCell>
                                    </TableRow>
                                    {missing.map((col, i) => (
                                        <TableRow key={`miss-${col.name}`} className="border-red-500/10 bg-red-500/[0.02] hover:bg-red-500/[0.05]">
                                            <TableCell className="text-center text-red-500/40">{columns.length + i + 1}</TableCell>
                                            <TableCell className="text-center">
                                                <Badge variant="outline" className={`w-7 justify-center font-bold ${col.expectedPos ? "border-amber-500/20 bg-amber-500/15 text-amber-400" : "border-red-500/20 bg-red-500/10 text-red-500/50"}`}>
                                                    {col.expectedPos || "?"}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                {col.currentAtPos ? (
                                                    <span className="inline-flex items-center gap-1 text-[10px] text-amber-400">
                                                        ⚠ <code className="font-mono">{col.currentAtPos}</code>
                                                        <span className="text-amber-400/60">(renamed?)</span>
                                                    </span>
                                                ) : col.suggestion ? (
                                                    <span className="inline-flex items-center gap-1 text-[10px] text-violet-400">
                                                        💡 <code className="font-mono">{col.suggestion}</code>?
                                                    </span>
                                                ) : null}
                                            </TableCell>
                                            <TableCell>
                                                <span className="inline-flex items-center gap-1 text-[10px]">
                                                    <XCircle className="h-3 w-3 text-red-400" />
                                                    <code className="font-mono font-medium text-red-400">{col.name}</code>
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-center text-muted-foreground/40">—</TableCell>
                                            <TableCell className="text-center">
                                                <XCircle className="mx-auto h-3.5 w-3.5 text-red-400/60" />
                                            </TableCell>
                                            <TableCell className="text-[10px] italic text-red-400/40">tidak ditemukan</TableCell>
                                        </TableRow>
                                    ))}
                                </>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </TooltipProvider>
    );
}
