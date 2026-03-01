"use client";

/**
 * Unlink Confirmation Dialog
 *
 * Confirms unlinking a sheet from a single dashboard page.
 * Uses amber/warning styling (not destructive red) since the
 * sheet still exists in the registry — only the page association
 * is removed.
 *
 * Features:
 *   - Shows which sheet is being unlinked from which page
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
import { Unlink, Loader2, Sheet } from "lucide-react";
import type { UnlinkTarget } from "../_types";

/* ─── Props ─── */

interface UnlinkConfirmDialogProps {
    target: UnlinkTarget | null;
    onClose: () => void;
    onConfirm: (target: UnlinkTarget) => Promise<void>;
}

/* ─── Component ─── */

export function UnlinkConfirmDialog({ target, onClose, onConfirm }: UnlinkConfirmDialogProps) {
    const [loading, setLoading] = useState(false);

    if (!target) return null;

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
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400">
                            <Unlink className="h-5 w-5" />
                        </div>
                        Lepas Sheet dari Halaman?
                    </AlertDialogTitle>

                    <AlertDialogDescription asChild>
                        <div className="space-y-3 text-sm text-muted-foreground">
                            {/* Target info */}
                            <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-3">
                                <Sheet className="h-4 w-4 text-emerald-400 shrink-0" />
                                <div>
                                    <p className="font-medium text-foreground">{target.title}</p>
                                    <p className="text-xs text-muted-foreground">Sheet: {target.sheetName}</p>
                                </div>
                            </div>

                            {/* Page being unlinked from */}
                            <div className="flex gap-2 rounded-lg border border-amber-500/20 bg-amber-500/[0.06] p-3">
                                <Unlink className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
                                <div>
                                    <p className="font-medium text-amber-300">
                                        Akan dilepas dari halaman:{" "}
                                        <span className="font-mono">{target.pageLabel}</span>
                                    </p>
                                    <p className="text-xs text-amber-400/70 mt-1">
                                        Sheet tetap ada di registry dan halaman lain yang menggunakannya tidak terpengaruh.
                                    </p>
                                </div>
                            </div>

                            {/* Safety note */}
                            <p className="text-xs text-muted-foreground">
                                Data di Google Sheets <strong className="text-muted-foreground">tidak terpengaruh</strong>.
                                Hanya hubungan sheet dengan halaman ini yang dihapus.
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
                        onClick={handleConfirm}
                        disabled={loading}
                        className="bg-amber-600 hover:bg-amber-700 text-foreground"
                    >
                        {loading ? (
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Melepas...</>
                        ) : (
                            <><Unlink className="mr-2 h-4 w-4" /> Lepas</>
                        )}
                    </Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
