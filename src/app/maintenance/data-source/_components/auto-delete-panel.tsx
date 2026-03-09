"use client";

/**
 * AutoDeletePanel — Deteksi & hapus spreadsheet tidak terpakai
 *
 * Menampilkan spreadsheet yang tidak dipakai oleh page manapun,
 * dengan tombol untuk menghapus dari registry.
 */

import { useState } from "react";
import { Trash2, FileSpreadsheet, AlertTriangle, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface UnusedSpreadsheet {
    id: string;
    spreadsheetId: string;
    title: string;
    sheetCount: number;
}

interface AutoDeletePanelProps {
    unusedSpreadsheets: UnusedSpreadsheet[];
    onDelete: (ids: string[]) => Promise<void>;
}

export function AutoDeletePanel({ unusedSpreadsheets, onDelete }: AutoDeletePanelProps) {
    const [deleting, setDeleting] = useState(false);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [deleted, setDeleted] = useState<Set<string>>(new Set());

    if (unusedSpreadsheets.length === 0) return null;

    const remaining = unusedSpreadsheets.filter(s => !deleted.has(s.id));
    if (remaining.length === 0) return null;

    const toggleSelect = (id: string) => {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleDelete = async () => {
        if (selected.size === 0) return;
        setDeleting(true);
        try {
            await onDelete([...selected]);
            setDeleted(prev => new Set([...prev, ...selected]));
            setSelected(new Set());
        } catch (err) {
            console.error("Delete failed:", err);
        } finally {
            setDeleting(false);
        }
    };

    return (
        <Card className="mb-4 border-amber-500/20 bg-amber-500/5">
            <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-400" />
                    <div className="flex-1">
                        <p className="text-sm font-medium text-amber-300">
                            Spreadsheet Tidak Terpakai
                        </p>
                        <p className="text-xs text-muted-foreground">
                            {remaining.length} spreadsheet tidak dipakai oleh halaman manapun
                        </p>
                    </div>
                    {selected.size > 0 && (
                        <Button
                            size="sm"
                            variant="destructive"
                            onClick={handleDelete}
                            disabled={deleting}
                            className="text-xs"
                        >
                            {deleting
                                ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                : <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                            }
                            Hapus {selected.size} dari Registry
                        </Button>
                    )}
                </div>

                <div className="space-y-1.5 pl-8">
                    {remaining.map(ss => (
                        <label key={ss.id}
                            className="flex items-center gap-2.5 text-xs cursor-pointer group hover:bg-muted/20 rounded px-2 py-1.5 -mx-2 transition-colors">
                            <input
                                type="checkbox"
                                checked={selected.has(ss.id)}
                                onChange={() => toggleSelect(ss.id)}
                                className="rounded border-border"
                            />
                            <FileSpreadsheet className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                            <span className="font-medium text-foreground/80 flex-1 truncate">{ss.title}</span>
                            <Badge variant="outline" className="border-border/30 text-muted-foreground/50 text-[10px]">
                                {ss.sheetCount} sheet{ss.sheetCount > 1 ? "s" : ""}
                            </Badge>
                        </label>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
