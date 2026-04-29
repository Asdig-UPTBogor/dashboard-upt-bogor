"use client";

/**
 * AttrsEditor — free key + column pick (dinamis, bukan hardcode).
 * Dipakai di level GI & Bay untuk simpan kolom ekstra (voltage, type, status, dll).
 *
 * Layout compact: row grid [key|arrow|col|del], tambah di bawah via input+btn.
 */

import { useState } from "react";
import { Plus, X, ArrowRight, Tag } from "lucide-react";

const SMALL_INPUT =
    "ds-body h-8 rounded-md border border-border bg-background px-2 text-xs outline-none " +
    "focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/60 ds-transition " +
    "disabled:opacity-50 disabled:cursor-not-allowed";

export function AttrsEditor({
    attrs,
    columnOptions,
    disabled,
    onAdd,
    onChangeCol,
    onRenameKey,
    onRemove,
}: {
    attrs: Record<string, string>;
    columnOptions: string[];
    disabled: boolean;
    onAdd: (key: string) => void;
    onChangeCol: (key: string, colName: string) => void;
    onRenameKey: (oldKey: string, newKey: string) => void;
    onRemove: (key: string) => void;
}) {
    const [newKey, setNewKey] = useState("");
    const entries = Object.entries(attrs);

    const submitNew = () => {
        const k = newKey.trim().replace(/\s+/g, "_");
        if (!k || k in attrs) return;
        onAdd(k);
        setNewKey("");
    };

    return (
        <div className="border-t border-border/40 pt-2.5">
            <div className="flex items-center gap-1.5 mb-1.5">
                <Tag className="w-3 h-3 opacity-60" />
                <span className="ds-label opacity-80">Atribut tambahan</span>
                <span className="ds-small opacity-50">(opsional)</span>
                {entries.length > 0 && (
                    <span className="ds-data rounded bg-white/[0.04] px-1.5 py-0.5 opacity-70 ml-auto">
                        {entries.length}
                    </span>
                )}
            </div>

            {/* List rows */}
            {entries.length > 0 && (
                <div className="space-y-1 mb-1.5">
                    {entries.map(([k, v]) => (
                        <div
                            key={k}
                            className="group grid grid-cols-[1fr_auto_1fr_auto] items-center gap-1.5 ds-transition"
                        >
                            <input
                                type="text"
                                defaultValue={k}
                                onBlur={(e) => {
                                    const next = e.target.value.trim().replace(/\s+/g, "_");
                                    if (next && next !== k) onRenameKey(k, next);
                                }}
                                className={`${SMALL_INPUT} w-full min-w-0`}
                                title="Nama attr (snake_case)"
                            />
                            <ArrowRight className="w-3 h-3 opacity-30 shrink-0" />
                            <select
                                value={v}
                                onChange={(e) => onChangeCol(k, e.target.value)}
                                disabled={disabled}
                                className={`${SMALL_INPUT} w-full min-w-0 cursor-pointer`}
                                title="Pilih kolom BQ"
                            >
                                <option value="">— pilih kolom —</option>
                                {columnOptions.map((c) => (
                                    <option key={c} value={c}>
                                        {c}
                                    </option>
                                ))}
                            </select>
                            <button
                                onClick={() => onRemove(k)}
                                className="ds-transition cursor-pointer p-1 rounded border border-transparent opacity-40 hover:opacity-100 hover:bg-red-500/15 hover:text-red-300 hover:border-red-500/40 shrink-0"
                                title="Hapus attr"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Add new row */}
            <div className="grid grid-cols-[1fr_auto] gap-1.5">
                <input
                    type="text"
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            e.preventDefault();
                            submitNew();
                        }
                    }}
                    placeholder="tambah attr baru (cth: voltage_kv)"
                    disabled={disabled}
                    className={`${SMALL_INPUT} w-full min-w-0 placeholder:opacity-40`}
                />
                <button
                    onClick={submitNew}
                    disabled={disabled || !newKey.trim()}
                    className="ds-transition cursor-pointer flex items-center gap-1 text-xs h-8 px-2.5 rounded-md border border-border bg-background hover:bg-white/5 hover:border-emerald-500/40 hover:text-emerald-300 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                    title="Tambah atribut"
                >
                    <Plus className="w-3 h-3" /> Add
                </button>
            </div>
        </div>
    );
}
