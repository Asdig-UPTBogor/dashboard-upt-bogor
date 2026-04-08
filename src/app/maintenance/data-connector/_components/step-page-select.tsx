"use client";

import { Cable, Database, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AddSpreadsheetDialog } from "../../data-source/_components/add-spreadsheet-dialog";
import { useState } from "react";
import type { SidebarPage } from "../_lib/types";


interface StepPageSelectProps {
    loading: boolean;
    sidebarPages: SidebarPage[];
    onSelectPage: (pagePath: string) => void;
    onAdded: () => void;
}

export function StepPageSelect({ loading, sidebarPages, onSelectPage, onAdded }: StepPageSelectProps) {
    const [showAddDialog, setShowAddDialog] = useState(false);



    const sections = new Map<string, SidebarPage[]>();
    for (const p of sidebarPages) {
        const sec = p.section || "Lainnya";
        if (!sections.has(sec)) sections.set(sec, []);
        sections.get(sec)!.push(p);
    }

    return (
        <div className="flex h-screen flex-col bg-background">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-5 py-3 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/20">
                        <Cable className="h-5 w-5 text-foreground" />
                    </div>
                    <div>
                        <h1 className="text-base font-bold text-foreground">Data Connector</h1>
                        <p className="text-xs text-muted-foreground">Step 1 — Pilih halaman untuk mengatur sumber data</p>
                    </div>
                </div>
                <Button size="sm" onClick={() => setShowAddDialog(true)} className="bg-emerald-600 hover:bg-emerald-700">
                    <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Spreadsheet
                </Button>
            </div>

            {/* Page Grid */}
            <div className="flex-1 overflow-y-auto p-6">
                {loading ? (
                    <div className="flex items-center justify-center h-48">
                        <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
                    </div>
                ) : (
                    <div className="space-y-8 max-w-5xl mx-auto">
                        {[...sections.entries()].map(([section, pages]) => (
                            <div key={section}>
                                <h3 className="text-xs uppercase tracking-widest text-muted-foreground/60 font-bold mb-3">{section}</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {pages.map((p) => {
                                        return (
                                            <button
                                                key={p.path}
                                                onClick={() => onSelectPage(p.path)}
                                                className="group text-left rounded-xl border border-border bg-card p-4 hover:border-indigo-500/30 hover:bg-accent transition-all"
                                            >
                                                <div className="flex items-start justify-between mb-2">
                                                    <Database className="h-5 w-5 text-muted-foreground/60 group-hover:text-indigo-400 transition-colors" />
                                                    {p.hasConfig && (
                                                        <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/20 text-xs">
                                                            configured
                                                        </Badge>
                                                    )}
                                                </div>
                                                <p className="text-sm font-semibold text-foreground mb-0.5">{p.label}</p>
                                                <p className="text-xs text-muted-foreground/60 font-mono">{p.path}</p>
                                                {p.hasConfig && (
                                                    <p className="text-xs text-indigo-400/60 mt-2">{p.dataSourceCount} data source · {p.relationCount} relasi</p>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <AddSpreadsheetDialog open={showAddDialog} onClose={() => setShowAddDialog(false)} onAdded={onAdded} />
        </div>
    );
}
