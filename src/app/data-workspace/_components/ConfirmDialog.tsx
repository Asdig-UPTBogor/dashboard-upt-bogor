"use client";

/**
 * ConfirmDialog — wrapper di atas shadcn `AlertDialog`.
 *
 * Versi lama (custom backdrop + Escape/Enter handler + body lock) sudah
 * dihapus — Radix AlertDialog bawaan handle semua: focus trap, Escape,
 * scroll lock, ARIA roles. Promise resolve via callback `onResolve`.
 *
 *  Usage via WorkspaceContext:
 *    const { confirm } = useWorkspace();
 *    const ok = await confirm({ title, description, destructive });
 *    if (ok) { ... }
 */

import { AlertTriangle } from "lucide-react";
import {
    AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
    AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel,
} from "@/components/ui/alert-dialog";

export interface ConfirmOptions {
    title: string;
    description?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    destructive?: boolean;
}

export function ConfirmDialog({
    open, options, onResolve,
}: {
    open: boolean;
    options: ConfirmOptions | null;
    onResolve: (ok: boolean) => void;
}) {
    if (!options) return null;
    const {
        title, description,
        confirmLabel = "Konfirmasi", cancelLabel = "Batal",
        destructive = false,
    } = options;

    return (
        <AlertDialog open={open} onOpenChange={(o) => { if (!o) onResolve(false); }}>
            <AlertDialogContent className="max-w-sm">
                <AlertDialogHeader>
                    <div className="flex items-start gap-3">
                        {destructive && (
                            <div className="h-8 w-8 rounded-lg bg-destructive/10 border border-destructive/30 flex items-center justify-center shrink-0">
                                <AlertTriangle className="h-4 w-4 text-destructive" />
                            </div>
                        )}
                        <div className="flex-1 min-w-0 space-y-1">
                            <AlertDialogTitle className="ds-title">{title}</AlertDialogTitle>
                            {description && (
                                <AlertDialogDescription className="ds-small opacity-80 leading-relaxed whitespace-pre-line">
                                    {description}
                                </AlertDialogDescription>
                            )}
                        </div>
                    </div>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => onResolve(false)}>
                        {cancelLabel}
                    </AlertDialogCancel>
                    <AlertDialogAction
                        onClick={() => onResolve(true)}
                        className={destructive ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : undefined}
                    >
                        {confirmLabel}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
