"use client";

/**
 * Delete Confirmation Dialog — Registry Removal
 *
 * Confirms permanent deletion of a sheet/spreadsheet from the
 * registry. This dialog should ONLY be triggered when usedBy is
 * empty (no pages linked). The UI enforces this by disabling the
 * delete button when links exist.
 *
 * Features:
 *   - Clean confirmation UI for unlinked items
 *   - Loading state during API call
 *   - Indonesian language for user-facing text
 */

import { useState } from "react";
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Trash2, Loader2, FileSpreadsheet, Sheet } from "lucide-react";
import type { DeleteTarget } from "../_types";

/* ─── Props ─── */

interface DeleteConfirmDialogProps {
    target: DeleteTarget | null;
    onClose: () => void;
    onConfirm: (target: DeleteTarget) => Promise<void>;
}

/* ─── Component ─── */

export function DeleteConfirmDialog({ target, onClose, onConfirm }: DeleteConfirmDialogProps) {
    const [loading, setLoading] = useState(false);

    if (!target) return null;

    const isSheet = target.type === "sheet";

    const handleConfirm = async () => {
        setLoading(true);
        try {
            await onConfirm(target);
        } finally {
            setLoading(false);
        }
    };

    return (
        <AlertDialog open={!!target} onOpenChange={(open) => !open && onClose()}>
            <AlertDialogContent className="border-border bg-card text-foreground max-w-md">
                <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2 text-foreground">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-500/15 text-red-400">
                            <Trash2 className="h-5 w-5" />
                        </div>
                        Hapus {isSheet ? "Sheet" : "Spreadsheet"} dari Registry?
                    </AlertDialogTitle>

                    <AlertDialogDescription asChild>
                        <div className="space-y-3 text-sm text-muted-foreground">
                            {/* Target info */}
                            <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-3">
                                {isSheet
                                    ? <Sheet className="h-4 w-4 text-emerald-400 shrink-0" />
                                    : <FileSpreadsheet className="h-4 w-4 text-blue-400 shrink-0" />
                                }
                                <div>
                                    <p className="font-medium text-foreground">{target.title}</p>
                                    {isSheet && target.sheetName && (
                                        <p className="text-xs text-muted-foreground">Sheet: {target.sheetName}</p>
                                    )}
                                </div>
                            </div>

                            {/* Safety note */}
                            <p className="text-xs text-muted-foreground">
                                {isSheet ? "Sheet" : "Spreadsheet"} ini akan dihapus dari konfigurasi registry.
                                Data di Google Sheets <strong className="text-muted-foreground">tidak akan dihapus</strong>.
                            </p>
                        </div>
                    </AlertDialogDescription>
                </AlertDialogHeader>

                <AlertDialogFooter className="gap-2">
                    <AlertDialogCancel
                        className="border-border bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
                        disabled={loading}
                    >
                        Batal
                    </AlertDialogCancel>

                    <Button
                        variant="destructive"
                        onClick={handleConfirm}
                        disabled={loading}
                        className="bg-red-600 hover:bg-red-700"
                    >
                        {loading ? (
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Menghapus...</>
                        ) : (
                            <><Trash2 className="mr-2 h-4 w-4" /> Hapus</>
                        )}
                    </Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
