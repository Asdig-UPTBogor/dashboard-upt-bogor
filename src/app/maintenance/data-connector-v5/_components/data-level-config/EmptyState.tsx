"use client";

import { MousePointer2 } from "lucide-react";
import { LEVEL_ORDER, LEVEL_META } from "./constants";

export function EmptyState() {
    return (
        <div className="flex h-full items-center justify-center p-8">
            <div className="max-w-md w-full text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full border border-border/60 bg-card mb-4">
                    <MousePointer2 className="w-5 h-5 opacity-50" />
                </div>
                <h2 className="ds-title mb-1.5">Pilih tabel untuk mulai config</h2>
                <p className="ds-body max-w-sm mx-auto">
                    Pilih salah satu tabel di daftar kiri.{" "}
                    <span className="ds-data text-foreground/80">FLAT</span> (default) = raw, no FK. Level
                    UPT/ULTG/GI/BAY = di-JOIN ke{" "}
                    <span className="ds-data text-foreground/80">dim_*</span> untuk enrich FK ID.
                </p>
                <div className="mt-5 grid grid-cols-5 gap-1.5">
                    {LEVEL_ORDER.map((lvl) => {
                        const meta = LEVEL_META[lvl];
                        const Icon = meta.Icon;
                        return (
                            <div
                                key={lvl}
                                className={`ds-transition rounded-md border py-2 px-1 flex flex-col items-center gap-1 ${meta.bg}`}
                                title={meta.description}
                            >
                                <Icon className={`w-3.5 h-3.5 ${meta.color}`} />
                                <div className={`ds-data ${meta.color}`}>{meta.label}</div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
