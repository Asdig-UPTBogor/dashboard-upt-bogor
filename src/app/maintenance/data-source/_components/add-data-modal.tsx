"use client";

import { useMemo, useState } from "react";
import { Plus, Loader2, CheckCircle2, Link2, FileSpreadsheet } from "lucide-react";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { RegistryEntry } from "../_types";

/**
 * AddDataModal — Link sheets to a specific page.
 *
 * Shows all registered spreadsheets with per-sheet status
 * (already linked, linked elsewhere, available). Users can
 * select available sheets to link to the target page.
 */
export function AddDataModal({ open, targetPage, registry, onClose, onRefresh }: {
    open: boolean;
    targetPage: { page: string; path: string };
    registry: RegistryEntry[];
    onClose: () => void;
    onRefresh: () => void;
}) {
    const [selectedSheets, setSelectedSheets] = useState<Record<string, { spreadsheetId: string; route: string }>>({});
    const [linking, setLinking] = useState(false);
    const recommendedRoute = `/api${targetPage.path}`;

    const sheetStatusMap = useMemo(() => {
        const map: Record<string, { status: "here" | "elsewhere" | "available"; linkedTo: string[] }> = {};
        for (const entry of registry) {
            for (const sheet of entry.sheets) {
                const key = `${entry.spreadsheetId}::${sheet.sheetName}`;
                if (sheet.usedBy.includes(targetPage.path)) {
                    map[key] = { status: "here", linkedTo: sheet.usedBy };
                } else if (sheet.usedBy.length > 0) {
                    map[key] = { status: "elsewhere", linkedTo: sheet.usedBy };
                } else {
                    map[key] = { status: "available", linkedTo: [] };
                }
            }
        }
        return map;
    }, [registry, targetPage.path]);

    const toggleSheet = (spreadsheetId: string, sheetName: string) => {
        const key = `${spreadsheetId}::${sheetName}`;
        setSelectedSheets((prev) => {
            if (prev[key]) {
                const next = { ...prev };
                delete next[key];
                return next;
            }
            return { ...prev, [key]: { spreadsheetId, route: recommendedRoute } };
        });
    };

    const handleLink = async () => {
        const toLink = Object.entries(selectedSheets);
        if (toLink.length === 0) return;
        setLinking(true);
        try {
            for (const [key, cfg] of toLink) {
                const [spreadsheetId, sheetName] = key.split("::");
                await fetch("/api/data-sources", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        action: "link-to-page",
                        spreadsheetId,
                        sheetName,
                        page: targetPage.path,
                        route: cfg.route,
                    }),
                });
            }
            onClose();
            onRefresh();
        } catch { /* ignore */ }
        finally { setLinking(false); }
    };

    const selectedCount = Object.keys(selectedSheets).length;

    return (
        <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
            <DialogContent className="max-w-2xl bg-zinc-900 border-white/10">
                <DialogHeader>
                    <div className="flex items-start gap-4">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-500/15 text-blue-400">
                            <Plus className="h-6 w-6" />
                        </div>
                        <div className="flex-1">
                            <DialogTitle className="text-base font-semibold text-white">
                                Add Data ke {targetPage.page}
                            </DialogTitle>
                            <p className="mt-1 text-sm text-slate-400">
                                Pilih sheet dari spreadsheet terdaftar untuk ditambahkan ke <code className="text-xs text-slate-300">{targetPage.path}</code>
                            </p>
                        </div>
                    </div>
                </DialogHeader>

                {/* Spreadsheet List */}
                <ScrollArea className="max-h-[55vh] pr-1">
                    <div className="space-y-3">
                        {registry.map((entry) => (
                            <div key={entry.spreadsheetId} className="rounded-xl bg-white/[0.03] ring-1 ring-white/[0.06] overflow-hidden">
                                <div className="flex items-center gap-2 px-4 py-2.5 bg-white/[0.02]">
                                    <FileSpreadsheet className="h-4 w-4 text-blue-400" />
                                    <span className="text-sm font-medium text-slate-200">{entry.title}</span>
                                    <span className="text-[10px] text-slate-600 ml-auto">{entry.sheets.length} sheet</span>
                                </div>
                                <div className="divide-y divide-white/[0.04]">
                                    {entry.sheets.map((sheet) => {
                                        const key = `${entry.spreadsheetId}::${sheet.sheetName}`;
                                        const info = sheetStatusMap[key];
                                        const isHere = info?.status === "here";
                                        const isSelected = !!selectedSheets[key];

                                        return (
                                            <label
                                                key={sheet.sheetName}
                                                className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${isHere ? "opacity-40 cursor-not-allowed" : "hover:bg-white/[0.03]"}`}
                                            >
                                                <Checkbox
                                                    checked={isHere || isSelected}
                                                    disabled={isHere}
                                                    onCheckedChange={() => toggleSheet(entry.spreadsheetId, sheet.sheetName)}
                                                />
                                                <span className="text-sm text-slate-300 flex-1">{sheet.sheetName}</span>
                                                {isHere && (
                                                    <span className="text-[10px] text-emerald-500/70 flex items-center gap-1">
                                                        <CheckCircle2 className="h-3 w-3" /> Sudah di page ini
                                                    </span>
                                                )}
                                                {info?.status === "elsewhere" && (
                                                    <span className="text-[10px] text-amber-500/70 flex items-center gap-1">
                                                        <Link2 className="h-3 w-3" /> {info.linkedTo.join(", ")}
                                                    </span>
                                                )}
                                                {info?.status === "available" && (
                                                    <span className="text-[10px] text-slate-600">Available</span>
                                                )}
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </ScrollArea>

                {/* Footer */}
                <DialogFooter className="flex-row justify-between items-center sm:justify-between">
                    <div>
                        <p className="text-xs text-slate-600">{selectedCount} sheet dipilih</p>
                        {selectedCount > 0 && (
                            <p className="text-[10px] text-slate-600 mt-0.5">
                                Route: <code className="text-emerald-500/60">{recommendedRoute}</code>
                            </p>
                        )}
                    </div>
                    <div className="flex gap-2.5">
                        <Button variant="outline" onClick={onClose} className="border-white/10 bg-white/5 text-slate-300 hover:bg-white/10">
                            Batal
                        </Button>
                        <Button onClick={handleLink} disabled={linking || selectedCount === 0}
                            className="bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/30 hover:bg-blue-500/30">
                            {linking ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-1.5 h-3.5 w-3.5" />}
                            Add {selectedCount > 0 && `(${selectedCount})`}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
