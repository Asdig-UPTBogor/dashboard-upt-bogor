"use client";

/**
 * Modal — wrapper di atas shadcn `Dialog`.
 *
 * Versi lama (custom backdrop + Escape handler + body scroll lock) sudah
 * dihapus — semua itu di-handle Radix Dialog bawaan. Wrapper ini cuma
 * menjaga API existing (`open` / `onClose` / `title` / `subtitle` / `icon`
 * / `size`) supaya consumer tidak perlu di-refactor satu-satu.
 *
 *  ▸ ESC tutup       — handled by Radix
 *  ▸ Click backdrop  — handled by Radix
 *  ▸ Body scroll lock — handled by Radix
 *  ▸ Focus trap      — handled by Radix
 */

import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";

const SIZE: Record<NonNullable<ModalProps["size"]>, string> = {
    sm: "sm:max-w-md",
    md: "sm:max-w-2xl",
    lg: "sm:max-w-3xl",
    xl: "sm:max-w-5xl",
};

export interface ModalProps {
    open: boolean;
    onClose: () => void;
    title: string;
    subtitle?: string;
    icon?: React.ComponentType<{ className?: string }>;
    size?: "sm" | "md" | "lg" | "xl";
    children: React.ReactNode;
}

export function Modal({ open, onClose, title, subtitle, icon: Icon, size = "md", children }: ModalProps) {
    return (
        <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
            <DialogContent className={`p-0 ${SIZE[size]}`} showCloseButton>
                <DialogHeader className="flex flex-row items-center gap-3 px-5 py-3 border-b border-border/60 space-y-0">
                    {Icon && (
                        <div className="h-8 w-8 rounded-lg bg-muted/30 border border-border/50 flex items-center justify-center shrink-0">
                            <Icon className="h-4 w-4 text-muted-foreground" />
                        </div>
                    )}
                    <div className="flex-1 min-w-0">
                        <DialogTitle className="ds-title truncate">{title}</DialogTitle>
                        {subtitle && (
                            <DialogDescription className="ds-small opacity-70 truncate">
                                {subtitle}
                            </DialogDescription>
                        )}
                    </div>
                </DialogHeader>
                <div className="p-5">
                    {children}
                </div>
            </DialogContent>
        </Dialog>
    );
}
