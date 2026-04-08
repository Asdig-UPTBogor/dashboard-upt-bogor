"use client";

import { useState } from "react";
import { Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

/**
 * SmartSuggestion — Missing sheet resolver.
 *
 * When a configured sheet is not found in the spreadsheet,
 * this component shows fuzzy-match suggestions and a shadcn Select
 * to pick the correct sheet name.
 */
export function SmartSuggestion({ configuredName, suggestions, spreadsheetId, allSheetNames, onRefresh }: {
    configuredName: string;
    suggestions: { name: string; score: number }[];
    spreadsheetId: string;
    allSheetNames: string[];
    onRefresh: () => void;
}) {
    const [selectedSheet, setSelectedSheet] = useState("");
    const [saving, setSaving] = useState(false);
    const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

    const handleSave = async () => {
        if (!selectedSheet) return;
        setSaving(true);
        setResult(null);
        try {
            const res = await fetch("/api/data-sources", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "sheet-rename",
                    spreadsheetId,
                    configuredSheetName: configuredName,
                    newSheetName: selectedSheet,
                }),
            });
            const data = await res.json();
            if (data.success) {
                setResult({ ok: true, msg: `✅ Tersimpan! Testing ulang...` });
                setTimeout(() => onRefresh(), 500);
            } else {
                setResult({ ok: false, msg: data.error || "Gagal menyimpan" });
            }
        } catch {
            setResult({ ok: false, msg: "Network error" });
        }
        setSaving(false);
    };

    return (
        <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
            <p className="flex items-center gap-2 text-sm font-medium text-violet-300">
                <Lightbulb className="h-4 w-4" /> Sheet tidak ditemukan
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
                Sheet &quot;{configuredName}&quot; tidak ada di spreadsheet. Pilih nama sheet yang benar:
            </p>

            <div className="mt-3 flex items-center gap-2">
                <Select value={selectedSheet} onValueChange={(v) => { setSelectedSheet(v); setResult(null); }}>
                    <SelectTrigger className="flex-1 border-border bg-slate-900 text-sm text-foreground focus:ring-violet-500">
                        <SelectValue placeholder="-- Pilih Sheet --" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                        {allSheetNames.map((name) => (
                            <SelectItem key={name} value={name} className="text-foreground focus:bg-white/[0.06] focus:text-white">
                                {name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Button
                    onClick={handleSave}
                    disabled={saving || !selectedSheet}
                    className="bg-violet-600 hover:bg-violet-500"
                >
                    {saving ? "..." : "Simpan & Test"}
                </Button>
            </div>

            {result && (
                <p className={`mt-2 text-xs ${result.ok ? "text-emerald-400" : "text-red-400"}`}>
                    {result.msg}
                </p>
            )}

            {suggestions.length > 0 && (
                <>
                    <p className="mt-3 text-xs uppercase tracking-wider text-muted-foreground/60">Saran (Klik untuk pilih):</p>
                    <div className="mt-1 flex flex-wrap gap-2">
                        {suggestions.map((s) => (
                            <button
                                key={s.name}
                                onClick={() => { setSelectedSheet(s.name); setResult(null); }}
                                className={`flex cursor-pointer items-center gap-2 rounded-lg px-3 py-1.5 text-sm ring-1 transition-colors ${selectedSheet === s.name
                                    ? "bg-violet-500 text-foreground ring-violet-500"
                                    : "bg-violet-500/10 text-violet-300 ring-violet-500/25 hover:bg-violet-500/20"
                                    }`}
                            >
                                <span className="font-mono font-medium">{s.name}</span>
                                <Badge variant="outline" className={`text-xs ${s.score >= 70 ? "border-emerald-500/20 bg-emerald-500/20 text-emerald-400" : "border-amber-500/20 bg-amber-500/20 text-amber-400"}`}>
                                    {s.score}%
                                </Badge>
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
