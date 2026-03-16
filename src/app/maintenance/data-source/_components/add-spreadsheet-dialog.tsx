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
 * 4. System saves to registry
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
    const [selectedSheets, setSelectedSheets] = useState<Set<string>>(new Set());

    const resetState = () => {
        setUrl(""); setDetecting(false); setDetected(null);
        setError(null); setSaving(false); setSelectedSheets(new Set());
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
            const res = await fetch(`/api/registry/detect?spreadsheetId=${id}`);
            const json = await res.json();
            if (!res.ok || !json.success) { setError(json.error || "Gagal mendeteksi"); return; }
            setDetected(json.data);
            setSelectedSheets(new Set(json.data.sheets.filter((s: DetectedSheet) => s.rowCount > 1).map((s: DetectedSheet) => s.sheetName)));
        } catch { setError("Network error"); }
        finally { setDetecting(false); }
    };

    const handleAdd = async () => {
        if (!detected) return;
        setSaving(true);
        const sheets = detected.sheets
            .filter((s) => selectedSheets.has(s.sheetName))
            .map((s) => ({ sheetName: s.sheetName, label: s.sheetName, route: "", usedBy: [], columnsUsed: s.headers.map((h, i) => ({ name: h, pos: String.fromCharCode(65 + i) })) }));
        try {
            const res = await fetch("/api/data-sources", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ spreadsheetId: detected.spreadsheetId, title: detected.title, sheets }),
            });
            const json = await res.json();
            if (json.success) { resetState(); onAdded(); onClose(); }
            else { setError(json.error || "Gagal menambahkan"); }
        } catch { setError("Network error"); }
        finally { setSaving(false); }
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
                                        <span className="text-xs text-muted-foreground">{s.rowCount} rows · {s.colCount} cols</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <Button
                            onClick={handleAdd}
                            disabled={saving || selectedSheets.size === 0}
                            className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 shadow-lg shadow-violet-500/20 hover:shadow-violet-500/40"
                        >
                            {saving ? "Adding..." : `Add ${selectedSheets.size} Sheet${selectedSheets.size > 1 ? "s" : ""}`}
                        </Button>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
