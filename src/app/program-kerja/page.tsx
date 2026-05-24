"use client";

import { useState } from "react";
import { CalendarDays, Radio, Shield, Building2, ArrowRight } from "lucide-react";
import { DataFreshness } from "@/components/DataFreshness";
import { Btn } from "@/components/designer/Button";
import ProgramKerjaTransmisiContent from "@/app/transmisi/program-kerja-transmisi/page";
import { ProgramKerjaGarduIndukContent } from "@/app/gardu-induk/program-kerja/_components/GarduIndukContent";
import dynamic from "next/dynamic";

const ProgramKerjaProteksiPage = dynamic(() => import("@/app/proteksi/program-kerja/page"), { ssr: false });

/* ── Module definitions ── */
const MODULES = [
    { key: "transmisi",   label: "Transmisi",   icon: Radio,      ready: true,
      bidang: "Transmisi",   color: "var(--color-bidang-transmisi)" },
    { key: "proteksi",    label: "Proteksi",    icon: Shield,     ready: true,
      bidang: "Proteksi",    color: "var(--color-bidang-proteksi)" },
    { key: "gardu-induk", label: "Gardu Induk", icon: Building2,  ready: true,
      bidang: "Gardu Induk", color: "var(--color-bidang-gardu-induk)" },
] as const;

type ModuleKey = (typeof MODULES)[number]["key"];

/* ━━━━━━━━━━━━━━━━━━ PAGE ━━━━━━━━━━━━━━━━━━ */

export default function ProgramKerjaHubPage() {
    const [active, setActive] = useState<ModuleKey>("transmisi");
    const activeModule = MODULES.find((m) => m.key === active)!;

    return (
        <div className="space-y-3">
            {/* ── Header row — title kiri, utility (Model + Ekspor + DataFreshness) kanan ── */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                    <h1 className="ds-heading flex items-center gap-2">
                        <CalendarDays className="h-5 w-5 text-primary" />
                        Program Kerja{" "}
                        <span style={{ color: activeModule.color }}>{activeModule.bidang}</span>
                    </h1>
                    <p className="ds-body mt-0.5">
                        Monitoring Program Kerja UPT Bogor{" "}
                        <span style={{ color: activeModule.color, fontWeight: 500 }}>
                            {activeModule.bidang}
                        </span>
                    </p>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                    <span
                        style={{
                            fontSize: 10.5,
                            color: "var(--fg-3)",
                            letterSpacing: "0.04em",
                        }}
                    >
                        Model: <span style={{ color: "var(--fg-2)" }}>Dashboard UPT Bogor</span>
                    </span>
                    <a href="/presentation/program-kerja" style={{ textDecoration: "none" }}>
                        <Btn icon="presentation" variant="primary" size="sm">
                            Slide Deck
                        </Btn>
                    </a>
                    <DataFreshness />
                </div>
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
            {active === "transmisi" && <ProgramKerjaTransmisiContent embedded />}

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
