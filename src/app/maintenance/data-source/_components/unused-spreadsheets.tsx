"use client";

import { useMemo, useState } from "react";
import {
    FileSpreadsheet, ExternalLink, Loader2, Trash2, Link2,
    AlertTriangle, ArrowRight, CheckCircle2, Plus,
} from "lucide-react";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel,
    AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
    AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { getAllPages, SIDEBAR_SECTIONS } from "@/lib/sidebar-config";
import type { RegistryEntry, SheetLinkConfig } from "../_types";

/**
 * UnusedSpreadsheets — Manage spreadsheets not linked to any page.
 *
 * Features:
 * - List all unlinked spreadsheets
 * - Delete with shadcn AlertDialog confirmation
 * - Link to page with shadcn Dialog
 */
export function UnusedSpreadsheets({ entries, onDelete, onRefresh, onAdd }: {
    entries: RegistryEntry[];
    onDelete: (id: string) => void;
    onRefresh: () => void;
    onAdd?: () => void;
}) {
    const allPages = useMemo(() => getAllPages(), []);
    const [deleting, setDeleting] = useState<string | null>(null);
    const [confirmEntry, setConfirmEntry] = useState<RegistryEntry | null>(null);
    const [linkEntry, setLinkEntry] = useState<RegistryEntry | null>(null);
    const [sheetConfigs, setSheetConfigs] = useState<Record<string, SheetLinkConfig>>({});
    const [linking, setLinking] = useState(false);
    const unused = entries.filter((e) => e.sheets.every((s) => s.usedBy.length === 0));

    /* Empty State */
    if (unused.length === 0) {
        return (
            <div className="mt-6 overflow-hidden rounded-2xl bg-white/[0.03] ring-1 ring-white/[0.06]">
                <div className="flex items-center justify-between p-5">
                    <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
                            <CheckCircle2 className="h-5 w-5" />
                        </div>
                        <div>
                            <h2 className="text-base font-semibold text-slate-400">Unused Spreadsheets</h2>
                            <p className="text-[11px] text-emerald-500/60 flex items-center gap-1.5">
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Semua spreadsheet sudah terdaftar dan di-link ke page. Tidak ada unused.
                            </p>
                        </div>
                    </div>
                    {onAdd && (
                        <Button size="sm" onClick={onAdd}
                            className="bg-violet-600 hover:bg-violet-500 text-white">
                            <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Spreadsheet
                        </Button>
                    )}
                </div>
            </div>
        );
    }

    const handleDelete = async () => {
        if (!confirmEntry) return;
        setDeleting(confirmEntry.id);
        setConfirmEntry(null);
        try {
            const res = await fetch(`/api/data-sources?id=${confirmEntry.id}`, { method: "DELETE" });
            const json = await res.json();
            if (json.success) { onDelete(confirmEntry.id); onRefresh(); }
        } catch { /* ignore */ }
        finally { setDeleting(null); }
    };

    const handlePageSelect = (sheetName: string, pagePath: string) => {
        const pageInfo = allPages.find((p) => p.path === pagePath);
        setSheetConfigs((prev) => ({
            ...prev,
            [sheetName]: { page: pagePath, route: pageInfo?.recommendedRoute || "" },
        }));
    };

    const handleRouteEdit = (sheetName: string, route: string) => {
        setSheetConfigs((prev) => ({
            ...prev,
            [sheetName]: { ...prev[sheetName], route },
        }));
    };

    const handleLink = async () => {
        if (!linkEntry) return;
        const toLink = Object.entries(sheetConfigs).filter(([, cfg]) => cfg.page && cfg.route);
        if (toLink.length === 0) return;
        setLinking(true);
        try {
            for (const [sheetName, cfg] of toLink) {
                await fetch("/api/data-sources", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        action: "link-to-page",
                        spreadsheetId: linkEntry.spreadsheetId,
                        sheetName,
                        page: cfg.page,
                        route: cfg.route,
                    }),
                });
            }
            setLinkEntry(null);
            setSheetConfigs({});
            onRefresh();
        } catch { /* ignore */ }
        finally { setLinking(false); }
    };

    const linkedCount = Object.values(sheetConfigs).filter((c) => c.page && c.route).length;

    return (
        <>
            {/* ── Delete Confirmation (shadcn AlertDialog) ── */}
            <AlertDialog open={!!confirmEntry} onOpenChange={(v) => { if (!v) setConfirmEntry(null); }}>
                <AlertDialogContent className="max-w-md bg-zinc-900 border-white/10">
                    <AlertDialogHeader className="items-center text-center">
                        {/* Centered danger icon */}
                        <div className="mx-auto mb-1 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 ring-1 ring-red-500/20">
                            <AlertTriangle className="h-7 w-7 text-red-400" />
                        </div>
                        <AlertDialogTitle className="text-lg font-semibold text-white">
                            Hapus Spreadsheet?
                        </AlertDialogTitle>
                        <AlertDialogDescription asChild>
                            <div className="text-sm text-slate-400 leading-relaxed">
                                <p className="mt-1">
                                    <span className="font-medium text-slate-200">&quot;{confirmEntry?.title}&quot;</span>
                                    {" "}akan dihapus dari registry. Data di Google Sheets tidak akan terpengaruh.
                                </p>

                                {/* Sheet list */}
                                {confirmEntry && confirmEntry.sheets.length > 0 && (
                                    <div className="mt-3 rounded-lg bg-white/[0.03] ring-1 ring-white/[0.06] text-left">
                                        <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.04]">
                                            <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-600">
                                                Sheet terdaftar
                                            </span>
                                            <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-medium text-slate-500">
                                                {confirmEntry.sheets.length}
                                            </span>
                                        </div>
                                        <div className="max-h-[160px] overflow-y-auto p-1.5">
                                            {confirmEntry.sheets.map((s) => (
                                                <div key={s.sheetName} className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-slate-400 hover:bg-white/[0.02]">
                                                    <FileSpreadsheet className="h-3.5 w-3.5 shrink-0 text-slate-600" />
                                                    <span className="truncate">{s.sheetName}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    <AlertDialogFooter className="mt-2 flex-col gap-2 sm:flex-col">
                        <AlertDialogAction onClick={handleDelete}
                            className="w-full bg-red-500/15 text-red-400 ring-1 ring-red-500/25 hover:bg-red-500/25 hover:text-red-300">
                            <Trash2 className="mr-2 h-4 w-4" /> Hapus Spreadsheet
                        </AlertDialogAction>
                        <AlertDialogCancel className="w-full border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-300">
                            Batal
                        </AlertDialogCancel>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* ── Link-to-Page Dialog (shadcn Dialog) ── */}
            <Dialog open={!!linkEntry} onOpenChange={(v) => { if (!v) { setLinkEntry(null); setSheetConfigs({}); } }}>
                <DialogContent className="max-w-2xl bg-zinc-900 border-white/10">
                    <DialogHeader>
                        <div className="flex items-start gap-4">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
                                <Link2 className="h-6 w-6" />
                            </div>
                            <div className="flex-1">
                                <DialogTitle className="text-base font-semibold text-white">Link ke Page</DialogTitle>
                                <p className="mt-1 text-sm text-slate-400">
                                    Pilih page tujuan dan API route untuk setiap sheet dari <span className="font-medium text-slate-300">&quot;{linkEntry?.title}&quot;</span>
                                </p>
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="max-h-[55vh] overflow-y-auto pr-1">
                        <div className="space-y-3">
                            {linkEntry?.sheets.map((sheet) => {
                                const cfg = sheetConfigs[sheet.sheetName];
                                return (
                                    <div key={sheet.sheetName} className="rounded-xl bg-white/[0.03] px-4 py-3 ring-1 ring-white/[0.06] space-y-2">
                                        <div className="flex items-center gap-2">
                                            <FileSpreadsheet className="h-4 w-4 shrink-0 text-slate-500" />
                                            <span className="text-sm font-medium text-slate-300">{sheet.sheetName}</span>
                                        </div>
                                        <div className="flex gap-2">
                                            <div className="flex-1">
                                                <label className="text-[10px] uppercase tracking-wider text-slate-600 mb-1 block">Page</label>
                                                <Select value={cfg?.page || ""} onValueChange={(v) => handlePageSelect(sheet.sheetName, v)}>
                                                    <SelectTrigger className="w-full border-white/10 bg-zinc-800 text-xs text-slate-300 focus:ring-emerald-500/50">
                                                        <SelectValue placeholder="— Pilih page —" />
                                                    </SelectTrigger>
                                                    <SelectContent className="bg-zinc-900 border-white/10">
                                                        {SIDEBAR_SECTIONS.map((section) => (
                                                            <SelectGroup key={section.key}>
                                                                <SelectLabel className="text-slate-500">{section.label}</SelectLabel>
                                                                {section.items.map((item) => (
                                                                    <SelectItem key={item.href} value={item.href} className="text-slate-200 focus:bg-white/[0.06] focus:text-white">
                                                                        {item.label}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectGroup>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="flex-1">
                                                <label className="text-[10px] uppercase tracking-wider text-slate-600 mb-1 block">API Route</label>
                                                <Input
                                                    type="text"
                                                    value={cfg?.route || ""}
                                                    onChange={(e) => handleRouteEdit(sheet.sheetName, e.target.value)}
                                                    placeholder="/api/..."
                                                    disabled={!cfg?.page}
                                                    className="border-white/10 bg-zinc-800 text-xs text-slate-300 font-mono placeholder:text-slate-600 focus-visible:ring-emerald-500/50 disabled:opacity-40"
                                                />
                                            </div>
                                        </div>
                                        {cfg?.page && cfg?.route && (
                                            <p className="text-[10px] text-slate-600 flex items-center gap-1">
                                                <ArrowRight className="h-2.5 w-2.5" />
                                                Sheet &quot;{sheet.sheetName}&quot; → <span className="font-mono text-emerald-500/60">{cfg.route}</span> di page <span className="text-slate-400">{cfg.page}</span>
                                            </p>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <DialogFooter className="flex-row justify-between items-center sm:justify-between">
                        <p className="text-xs text-slate-600">{linkedCount} sheet siap di-link</p>
                        <div className="flex gap-2.5">
                            <Button variant="outline" onClick={() => { setLinkEntry(null); setSheetConfigs({}); }}
                                className="border-white/10 bg-white/5 text-slate-300 hover:bg-white/10">
                                Batal
                            </Button>
                            <Button onClick={handleLink} disabled={linking || linkedCount === 0}
                                className="bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30 hover:bg-emerald-500/30">
                                {linking ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Link2 className="mr-1.5 h-3.5 w-3.5" />}
                                Link {linkedCount > 0 && `(${linkedCount})`}
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Unused List ── */}
            <div className="mt-6 overflow-hidden rounded-2xl bg-white/[0.03] ring-1 ring-white/[0.06]">
                <div className="flex items-center justify-between border-b border-white/[0.04] p-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-500/15 text-slate-400">
                            <FileSpreadsheet className="h-5 w-5" />
                        </div>
                        <div>
                            <h2 className="text-base font-semibold text-slate-300">Unused Spreadsheets</h2>
                            <p className="text-xs text-slate-600">Tidak digunakan oleh page manapun — aman untuk dihapus atau di-link ke page</p>
                        </div>
                    </div>
                    {onAdd && (
                        <Button size="sm" onClick={onAdd}
                            className="bg-violet-600 hover:bg-violet-500 text-white">
                            <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Spreadsheet
                        </Button>
                    )}
                </div>
                <div className="divide-y divide-white/[0.04]">
                    {unused.map((entry) => (
                        <div key={entry.id} className="flex items-center justify-between px-5 py-3 hover:bg-white/[0.02]">
                            <div className="flex items-center gap-3">
                                <FileSpreadsheet className="h-4 w-4 text-slate-500" />
                                <div>
                                    <p className="text-sm font-medium text-slate-300">{entry.title}</p>
                                    <p className="text-xs text-slate-600">{entry.sheets.length} sheet{entry.sheets.length > 1 ? "s" : ""} · {entry.sheets.map((s) => s.sheetName).join(", ")}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button variant="outline" size="sm" asChild className="h-7 border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white">
                                    <a href={`https://docs.google.com/spreadsheets/d/${entry.spreadsheetId}`} target="_blank" rel="noopener noreferrer">
                                        <ExternalLink className="mr-1 h-3 w-3" /> Buka
                                    </a>
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => { setLinkEntry(entry); setSheetConfigs({}); }}
                                    className="h-7 border-emerald-500/20 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20">
                                    <Link2 className="mr-1 h-3 w-3" /> Link ke Page
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => setConfirmEntry(entry)} disabled={deleting === entry.id}
                                    className="h-7 border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20 disabled:opacity-40">
                                    {deleting === entry.id ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Trash2 className="mr-1 h-3 w-3" />}
                                    Hapus
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </>
    );
}
