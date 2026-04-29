"use client";

/**
 * InfoHeader — domain explainer per tab (1 baris).
 * Konsisten di tiap tab supaya user paham "Tab ini buat apa + sourcenya mana".
 * Style: ds-small muted + hairline border, tidak grabby.
 */

import { Info } from 'lucide-react';

interface Props {
    title: string;
    domain: string;
}

export function InfoHeader({ title, domain }: Props) {
    return (
        <div className="flex items-start gap-2 rounded-md border border-border/30 bg-muted/5 p-3">
            <Info className="h-3.5 w-3.5 text-muted-foreground/60 mt-0.5 shrink-0" />
            <div className="ds-small text-muted-foreground/80 leading-relaxed">
                <strong className="text-foreground/90">{title}</strong> — {domain}
            </div>
        </div>
    );
}
