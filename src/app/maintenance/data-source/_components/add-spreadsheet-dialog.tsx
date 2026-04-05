"use client";

import { useState } from "react";
import { Plus, Search, Loader2, XCircle, CheckCircle2 } from "lucide-react";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import type { DetectedSheet } from "../_types";

/**
 * AddSpreadsheetDialog — Register a new Google Spreadsheet.
 *
 * 1. User pastes a Sheets URL or ID
 * 2. System detects sheets via API
 * 3. User picks which sheets to register
 * 4. System saves to registry via backend API
 */

export function AddSpreadsheetDialog({ open, onClose, onAdded }: {
    open: boolean;
    onClose: () => void;
    onAdded: () => void;
}) {
    const [url, setUrl] = useState("");
    const [detecting, setDetecting] = useState(false);
    const [detected, setDetected] = useState<{ spreadsheetId: string; title: string; sheets: DetectedSheet[] } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [progressText, setProgressText] = useState<string | null>(null);
    const [selectedSheets, setSelectedSheets] = useState<Set<string>>(new Set());

    const resetState = () => {
        setUrl(""); setDetecting(false); setDetected(null);
        setError(null); setSaving(false); setProgressText(null); setSelectedSheets(new Set());
    };

    const extractId = (input: string): string | null => {
        const m = input.match(/\/d\/([a-zA-Z0-9_-]+)/);
        if (m) return m[1];
        if (/^[a-zA-Z0-9_-]{20,}$/.test(input.trim())) return input.trim();
        return null;
    };

    const handleDetect = async () => {
        const id = extractId(url);
        if (!id) { setError("URL atau ID tidak valid"); return; }
        setDetecting(true); setError(null); setDetected(null);
        try {
            const res = await fetch(`/api/data-sources?explore=${id}`);
            const json = await res.json();
            if (!res.ok || !json.success) { setError(json.error || "Gagal mendeteksi via API"); return; }
            
            // Adapt API response to the expected format
            const sheetsData = json.sheets.map((s: any) => ({
                sheetName: s.name,
                headers: s.headers || [],
                rowCount: 0, // Not available in explore API
                colCount: s.headers?.length || 0
            }));
            
            setDetected({ spreadsheetId: id, title: json.title || `Spreadsheet ${id.substring(0, 8)}...`, sheets: sheetsData });
            setSelectedSheets(new Set(sheetsData.map((s: any) => s.sheetName)));
        } catch (err: any) { setError(err?.message || "Gagal mendeteksi koneksi API"); }
        finally { setDetecting(false); }
    };

    const handleAdd = async () => {
        if (!detected) return;
        setSaving(true);
        setError(null);
        try {
            setProgressText("Menyiapkan cetak biru Firestore...");
            const sheetsData = detected.sheets.filter((s) => selectedSheets.has(s.sheetName));

            // 1. SAVE to DB
            const resSave = await fetch("/api/data-sources", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    spreadsheetId: detected.spreadsheetId,
                    name: detected.title,
                    sheets: sheetsData
                })
            });

            const jsonSave = await resSave.json();
            if (!resSave.ok || !jsonSave.success) {
                throw new Error(jsonSave.error || "Gagal menyimpan cetak biru via API");
            }
            
            const targetDataset = jsonSave.dataset;

            // 2. SYNC to BQ via Bridge
            setProgressText(`Menyiapkan Dataset BigQuery...`);
            
            const resSync = await fetch("/api/data-sources/sync", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ dataset: targetDataset })
            });

            const jsonSync = await resSync.json();
            if (!resSync.ok || !jsonSync.success) {
               throw new Error(jsonSync.error || "Gagal memicu sinkronisasi Cloud Function");
            }

            setProgressText("Selesai!");
            // Short delay to let the user blink and see 'Selesai!' before closing
            setTimeout(() => {
                resetState(); onAdded(); onClose();
            }, 800);

        } catch (err: any) { 
            setError(err?.message || "Terjadi kesalahan internal"); 
            setSaving(false);
            setProgressText(null);
        }
    };

    const toggleSheet = (sheetName: string) => {
        setSelectedSheets((prev) => {
            const n = new Set(prev);
            n.has(sheetName) ? n.delete(sheetName) : n.add(sheetName);
            return n;
        });
    };

    return (
        <Dialog open={open} onOpenChange={(v) => { if (!v) { resetState(); onClose(); } }}>
            <DialogContent className="max-w-2xl bg-card border-border">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-foreground">
                        <Plus className="h-5 w-5 text-violet-400" /> Add Spreadsheet
                    </DialogTitle>
                </DialogHeader>

                {/* Step 1: URL Input */}
                <div className="flex gap-2">
                    <Input
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="Paste Google Sheets URL atau ID..."
                        className="flex-1 border-border bg-muted/40 text-foreground placeholder:text-muted-foreground/60 focus-visible:ring-violet-500"
                        onKeyDown={(e) => e.key === "Enter" && handleDetect()}
                    />
                    <Button
                        onClick={handleDetect}
                        disabled={detecting || !url.trim()}
                        className="bg-violet-600 hover:bg-violet-500"
                    >
                        {detecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                        <span className="ml-2">{detecting ? "Detecting..." : "Detect"}</span>
                    </Button>
                </div>

                {error && (
                    <p className="text-sm text-red-400 flex items-center gap-1">
                        <XCircle className="h-4 w-4" />{error}
                    </p>
                )}

                {/* Step 2: Detected sheets */}
                {detected && (
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                            <span className="text-sm font-medium text-foreground">{detected.title}</span>
                            <span className="text-xs text-muted-foreground">({detected.sheets.length} sheets)</span>
                        </div>

                        {/* Sheet list — plain div with overflow-y-auto for reliable scrolling */}
                        <div className="max-h-[400px] overflow-y-auto rounded-xl bg-muted/30 p-3 ring-1 ring-white/[0.06]">
                            <div className="space-y-0.5">
                                {detected.sheets.map((s) => (
                                    <label key={s.sheetName} className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-white/[0.04]">
                                        <Checkbox
                                            checked={selectedSheets.has(s.sheetName)}
                                            onCheckedChange={() => toggleSheet(s.sheetName)}
                                        />
                                        <span className="flex-1 font-mono text-sm text-foreground">{s.sheetName}</span>
                                        <span className="text-xs text-muted-foreground">{s.colCount} cols</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="flex flex-col gap-2">
                            {progressText && (
                                <div className="rounded-lg bg-violet-500/10 p-3 flex items-center gap-3 border border-violet-500/20">
                                    <Loader2 className="h-5 w-5 animate-spin text-violet-400 shrink-0" />
                                    <p className="text-sm font-medium text-violet-200">{progressText}</p>
                                </div>
                            )}
                            <Button
                                onClick={handleAdd}
                                disabled={saving || selectedSheets.size === 0}
                                className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 shadow-lg shadow-violet-500/20 hover:shadow-violet-500/40"
                            >
                                {saving ? "Sedang Memproses..." : `Add ${selectedSheets.size} Sheet${selectedSheets.size > 1 ? "s" : ""}`}
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
