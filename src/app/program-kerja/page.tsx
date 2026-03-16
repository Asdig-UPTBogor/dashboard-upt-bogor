"use client";

import { useState } from "react";
import { CalendarDays, Radio, Shield, Building2, ArrowRight } from "lucide-react";
import { DataFreshness } from "@/components/DataFreshness";
import { ProgramKerjaJaringanContent } from "@/app/transmisi/program-kerja/page";
import { ProgramKerjaGarduIndukContent } from "@/app/gardu-induk/program-kerja/_components/GarduIndukContent";
import dynamic from "next/dynamic";

const ProgramKerjaProteksiPage = dynamic(() => import("@/app/proteksi/program-kerja/page"), { ssr: false });

/* ── Module definitions ── */
const MODULES = [
    { key: "transmisi", label: "Transmisi", icon: Radio, ready: true },
    { key: "proteksi", label: "Proteksi", icon: Shield, ready: true },
    { key: "gardu-induk", label: "Gardu Induk", icon: Building2, ready: true },
] as const;

type ModuleKey = (typeof MODULES)[number]["key"];

/* ━━━━━━━━━━━━━━━━━━ PAGE ━━━━━━━━━━━━━━━━━━ */

export default function ProgramKerjaHubPage() {
    const [active, setActive] = useState<ModuleKey>("transmisi");

    return (
        <div className="space-y-4">
            {/* ── Header ── */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                    <h1 className="text-xl md:text-2xl font-bold tracking-tight flex items-center gap-2">
                        <CalendarDays className="h-5 w-5 text-primary" />
                        Monitoring Program Kerja
                    </h1>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        Transmisi · Proteksi · Gardu Induk
                    </p>
                </div>
                <DataFreshness />
            </div>

            {/* ── Tab Bar — Vercel-style underline tabs ── */}
            <div className="border-b border-border">
                <nav className="flex gap-0 -mb-px" aria-label="Module tabs">
                    {MODULES.map(({ key, label, icon: Icon }) => {
                        const isActive = active === key;
                        return (
                            <button
                                key={key}
                                onClick={() => setActive(key)}
                                className={[
                                    "relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors",
                                    "border-b-2 -mb-px outline-none",
                                    isActive
                                        ? "border-foreground text-foreground"
                                        : "border-transparent text-muted-foreground hover:text-foreground hover:border-border",
                                ].join(" ")}
                            >
                                <Icon className="h-3.5 w-3.5" />
                                {label}
                            </button>
                        );
                    })}
                </nav>
            </div>

            {/* ── Tab Content ── */}
            {active === "transmisi" && <ProgramKerjaJaringanContent />}

            {active === "proteksi" && <ProgramKerjaProteksiPage />}

            {active === "gardu-induk" && <ProgramKerjaGarduIndukContent />}
        </div>
    );
}

/* ── Empty state — clean, minimal placeholder ── */
function EmptyState({
    label,
    description,
    icon: Icon,
}: {
    label: string;
    description: string;
    icon: typeof Radio;
}) {
    return (
        <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="h-10 w-10 rounded-full border border-border flex items-center justify-center mb-4">
                <Icon className="h-4.5 w-4.5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">{label}</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">{description}</p>
        </div>
    );
}
