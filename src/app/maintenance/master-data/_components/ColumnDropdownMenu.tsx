"use client";

import React, { useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { ArrowUpAZ, ArrowDownAZ, Check, X } from "lucide-react";

/* ══════════════════════════════════════════════════════════════════════
   Props
   ══════════════════════════════════════════════════════════════════════ */
export interface ColumnDropdownMenuProps {
    columnKey: string;
    isSorted: boolean;
    sortDir: 'asc' | 'desc';
    isFiltered: boolean;
    uniqueVals: string[];
    currentFilter: Set<string>;
    setSortColumn: (c: string | null) => void;
    setSortDir: (d: 'asc' | 'desc') => void;
    setColumnFilters: React.Dispatch<React.SetStateAction<Record<string, Set<string>>>>;
    setOpenHeaderMenu: (h: string | null) => void;
    headerEl: HTMLElement | null;
}

/* ══════════════════════════════════════════════════════════════════════
   COMPONENT (Portal-based — renders at document.body level)
   ══════════════════════════════════════════════════════════════════════ */
export function ColumnDropdownMenu({
    columnKey: h, isSorted, sortDir, isFiltered, uniqueVals, currentFilter,
    setSortColumn, setSortDir, setColumnFilters, setOpenHeaderMenu, headerEl,
}: ColumnDropdownMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState({ top: 0, left: 0 });

    /* ── Position below the header cell ── */
    useEffect(() => {
        if (headerEl) {
            const rect = headerEl.getBoundingClientRect();
            setPos({ top: rect.bottom + 2, left: rect.left });
        }
    }, [headerEl]);

    /* ── Close on click outside ── */
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setOpenHeaderMenu(null);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [setOpenHeaderMenu]);

    /* ── Toggle a single filter value ── */
    const toggleFilter = (val: string) => {
        setColumnFilters(prev => {
            const current = prev[h] ? new Set(prev[h]) : new Set<string>();
            if (current.size === 0) {
                // First click → select only this value
                return { ...prev, [h]: new Set([val]) };
            }
            if (current.has(val)) {
                current.delete(val);
                if (current.size === 0) {
                    const next = { ...prev };
                    delete next[h];
                    return next;
                }
            } else {
                current.add(val);
                if (current.size === uniqueVals.length) {
                    const next = { ...prev };
                    delete next[h];
                    return next;
                }
            }
            return { ...prev, [h]: current };
        });
    };

    /* ── Clear filter for this column ── */
    const clearFilter = () => {
        setColumnFilters(prev => {
            const next = { ...prev };
            delete next[h];
            return next;
        });
    };

    return createPortal(
        <div
            ref={menuRef}
            className="fixed z-[9999] w-[220px] bg-slate-900 border border-slate-600/50 rounded-lg shadow-2xl shadow-black/60 overflow-hidden"
            style={{ top: pos.top, left: pos.left }}
        >
            {/* ── Sort Options ── */}
            <div className="p-1 border-b border-slate-700/50">
                <button
                    onClick={() => { setSortColumn(h); setSortDir('asc'); setOpenHeaderMenu(null); }}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-[11px] transition-colors cursor-pointer ${isSorted && sortDir === 'asc' ? 'bg-blue-500/15 text-blue-300' : 'text-slate-300 hover:bg-slate-700/50'
                        }`}
                >
                    <ArrowUpAZ className="w-3.5 h-3.5" />
                    Sort A → Z
                    {isSorted && sortDir === 'asc' && <Check className="w-3 h-3 ml-auto text-blue-400" />}
                </button>
                <button
                    onClick={() => { setSortColumn(h); setSortDir('desc'); setOpenHeaderMenu(null); }}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-[11px] transition-colors cursor-pointer ${isSorted && sortDir === 'desc' ? 'bg-blue-500/15 text-blue-300' : 'text-slate-300 hover:bg-slate-700/50'
                        }`}
                >
                    <ArrowDownAZ className="w-3.5 h-3.5" />
                    Sort Z → A
                    {isSorted && sortDir === 'desc' && <Check className="w-3 h-3 ml-auto text-blue-400" />}
                </button>
                {isSorted && (
                    <button
                        onClick={() => { setSortColumn(null); setOpenHeaderMenu(null); }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-[11px] text-slate-500 hover:bg-slate-700/50 hover:text-slate-300 transition-colors cursor-pointer"
                    >
                        <X className="w-3.5 h-3.5" />
                        Hapus Sort
                    </button>
                )}
            </div>

            {/* ── Filter Options ── */}
            <div className="p-1">
                <div className="flex items-center justify-between px-2.5 py-1">
                    <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Filter</span>
                    {isFiltered && (
                        <button
                            onClick={clearFilter}
                            className="text-[10px] text-red-400 hover:text-red-300 transition-colors cursor-pointer"
                        >
                            Clear
                        </button>
                    )}
                </div>
                <div className="max-h-[200px] overflow-y-auto">
                    {uniqueVals.map(val => {
                        const isChecked = currentFilter.size === 0 || currentFilter.has(val);
                        return (
                            <button
                                key={val}
                                onClick={() => toggleFilter(val)}
                                className={`w-full flex items-center gap-2 px-2.5 py-1 rounded text-[11px] transition-colors cursor-pointer ${isChecked && currentFilter.size > 0
                                        ? 'text-blue-300'
                                        : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-300'
                                    }`}
                            >
                                <div className={`w-3 h-3 rounded-sm border flex items-center justify-center shrink-0 ${isChecked && currentFilter.size > 0
                                        ? 'bg-blue-500 border-blue-500'
                                        : 'border-slate-600'
                                    }`}>
                                    {isChecked && currentFilter.size > 0 && <Check className="w-2 h-2 text-white" />}
                                </div>
                                <span className="truncate">{val}</span>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>,
        document.body
    );
}
