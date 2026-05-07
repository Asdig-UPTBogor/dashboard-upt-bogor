"use client";

import { useState } from "react";
import { MapPin, AlertTriangle, ShieldAlert, Layers, Activity } from "lucide-react";
import MonitoringTowerKritisPage from "./_components/tower-kritis-tab";
import AnomaliTowerPage from "./_components/anomali-tab";
import HealthyIndexPage from "./_components/healthy-index-tab";
import KerawananTransmisiPage from "./_components/kerawanan-tab";

export default function TowerTransmisiPage() {
    const [activeTab, setActiveTab] = useState<"data" | "healthy" | "kritis" | "kerawanan" | "anomali">("data");

    return (
        <div className="space-y-6 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* ───── Title ───── */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b pb-4">
                <div>
                    <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-linear-to-r from-blue-400 to-indigo-400 flex items-center gap-2">
                        <MapPin className="h-6 w-6 text-blue-500" />
                        Tower Transmisi
                    </h1>
                    <p className="text-xs text-muted-foreground mt-1">
                        Informasi lengkap Data Tower, Monitoring Kritis, dan Anomali
                    </p>
                </div>
            </div>

            {/* ── Tab Bar — Vercel-style underline tabs ── */}
            <div className="border-b border-border">
                <nav className="flex gap-0 -mb-px" aria-label="Module tabs">
                    {[
                        { key: "data", label: "Data Tower", icon: Layers },
                        { key: "healthy", label: "Healthy Index Tower", icon: Activity },
                        { key: "kritis", label: "Tower Kritis", icon: AlertTriangle },
                        { key: "kerawanan", label: "Kerawanan Tower", icon: MapPin },
                        { key: "anomali", label: "Anomali Tower", icon: ShieldAlert }
                    ].map(({ key, label, icon: Icon }) => {
                        const isActive = activeTab === key;
                        return (
                            <button
                                key={key}
                                onClick={() => setActiveTab(key as any)}
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
            <div className="mt-4">
                {activeTab === "data" && (
                    <div className="p-12 text-center border rounded-lg bg-card/50">
                        <MapPin className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                        <h3 className="text-lg font-medium">Data Tower Belum Tersedia</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                            Integrasi data tower secara spesifik akan ditampilkan di sini.
                        </p>
                    </div>
                )}
                {activeTab === "healthy" && <HealthyIndexPage embedded={true} />}
                {activeTab === "kritis" && <MonitoringTowerKritisPage embedded={true} />}
                {activeTab === "kerawanan" && <KerawananTransmisiPage embedded={true} />}
                {activeTab === "anomali" && <AnomaliTowerPage embedded={true} />}
            </div>
        </div>
    );
}
