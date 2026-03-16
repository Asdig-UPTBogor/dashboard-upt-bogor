"use client";
import { useCallback, useEffect, useState } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/ThemeToggle";
import { RefreshCw, Check } from "lucide-react";


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

/** Global Sync button — triggers CF sheet-bq-sync (fire-and-forget) */
function SyncButton() {
    const [state, setState] = useState<"idle" | "syncing" | "done">("idle");

    const handleSync = useCallback(async () => {
        if (state !== "idle") return;
        setState("syncing");
        try {
            const res = await fetch("/api/serverless-hub/spreadsheet-sync/sync-now", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
            });
            const data = await res.json();
            if (data.ok) {
                setState("done");
                setTimeout(() => setState("idle"), 3000);
            } else {
                setState("idle");
            }
        } catch {
            setState("idle");
        }
    }, [state]);

    return (
        <button
            onClick={handleSync}
            disabled={state !== "idle"}
            title="Sync Sheets → BigQuery"
            className={`flex h-8 w-8 items-center justify-center rounded-md border transition-all ${
                state === "done"
                    ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
                    : state === "syncing"
                    ? "border-blue-500/30 text-blue-400 bg-blue-500/10"
                    : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
        >
            {state === "done" ? (
                <Check className="h-3.5 w-3.5" />
            ) : (
                <RefreshCw className={`h-3.5 w-3.5 ${state === "syncing" ? "animate-spin" : ""}`} />
            )}
        </button>
    );
}

export function AppHeader() {
    const clock = useJakartaClock();

    return (
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 !h-4" />
            <div className="flex-1" />

            {/* Clock */}
            <div className="flex items-center rounded-lg border bg-muted/50 p-0.5 px-3 shadow-[0_0_8px_rgba(var(--primary-rgb,59,130,246),0.15)] transition-shadow hover:shadow-[0_0_12px_rgba(var(--primary-rgb,59,130,246),0.25)]">
                <span className="text-[13px] font-medium tabular-nums whitespace-nowrap leading-7">
                    {clock}
                </span>
            </div>

            <ThemeToggle />
            <SyncButton />
        </header>
    );
}
