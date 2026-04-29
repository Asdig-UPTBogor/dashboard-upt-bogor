"use client";

/**
 * WorkspaceClock — WIB realtime clock di TopBar.
 *
 *  ▸ Update tiap detik (minimal render cost — tidak mempengaruhi tree)
 *  ▸ Hydration-safe: render kosong di SSR, populate at useEffect
 */

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

function formatWIB(d: Date): string {
    return new Intl.DateTimeFormat("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        timeZone: "Asia/Jakarta",
        hour12: false,
    }).format(d);
}

function formatDateWIB(d: Date): string {
    return new Intl.DateTimeFormat("id-ID", {
        weekday: "short",
        day: "numeric",
        month: "short",
        timeZone: "Asia/Jakarta",
    }).format(d);
}

export function WorkspaceClock() {
    const [now, setNow] = useState<Date | null>(null);

    useEffect(() => {
        setNow(new Date());
        const id = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(id);
    }, []);

    if (!now) return null;

    return (
        <div
            className="hidden md:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border border-border/40 bg-muted/20 ds-small shrink-0"
            title={`${formatDateWIB(now)} · WIB (Asia/Jakarta)`}
        >
            <Clock className="h-3 w-3 opacity-60" />
            <span className="font-mono tabular-nums">{formatWIB(now)}</span>
            <span className="opacity-50 text-[10px]">WIB</span>
        </div>
    );
}
