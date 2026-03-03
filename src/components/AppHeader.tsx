"use client";
import { useEffect, useState } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/ThemeToggle";

function useJakartaClock() {
    const [text, setText] = useState("");
    useEffect(() => {
        const fmt = () => {
            const now = new Date();
            const day = now.toLocaleDateString("id-ID", { weekday: "long", timeZone: "Asia/Jakarta" });
            const date = now.toLocaleDateString("id-ID", { day: "numeric", month: "long", timeZone: "Asia/Jakarta" });
            const time = now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Jakarta" });
            setText(`${day}, ${date} · ${time}`);
        };
        fmt();
        const id = setInterval(fmt, 1000);
        return () => clearInterval(id);
    }, []);
    return text;
}

export function AppHeader() {
    const clock = useJakartaClock();
    return (
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 !h-4" />
            <div className="flex-1" />

            {/* Clock — enterprise glow */}
            <div
                className="flex items-center rounded-lg border bg-muted/50 p-0.5 px-3 shadow-[0_0_8px_rgba(var(--primary-rgb,59,130,246),0.15)] transition-shadow hover:shadow-[0_0_12px_rgba(var(--primary-rgb,59,130,246),0.25)]"
            >
                <span className="text-[13px] font-medium tabular-nums whitespace-nowrap leading-7">
                    {clock}
                </span>
            </div>

            <ThemeToggle />
        </header>
    );
}
