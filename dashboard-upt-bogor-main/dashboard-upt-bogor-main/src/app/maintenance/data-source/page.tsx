"use client";

import { useCallback, useEffect, useState } from "react";
import {
    Database, RefreshCw, CheckCircle2, XCircle, Activity, Loader2,
    FileSpreadsheet, ExternalLink, ChevronDown, ChevronRight,
    Clock, ArrowRight, AlertTriangle, Server, Layers,
    Lightbulb, Lock, Plus, Trash2, Search, X,
} from "lucide-react";
import { PAGE_ICONS } from "@/lib/page-icons";

/* ─────────────────────────────────────────────────
   Registry Types (for Add/Delete)
   ───────────────────────────────────────────────── */
type RegistrySheet = { sheetName: string; label: string; route: string; usedBy: string[]; columnsUsed: unknown[] };
type RegistryEntry = { id: string; spreadsheetId: string; title: string; sheets: RegistrySheet[] };
type DetectedSheet = { sheetName: string; rowCount: number; colCount: number; headers: string[] };

/* ─────────────────────────────────────────────────
   Types
   ───────────────────────────────────────────────── */
type ColumnMeta = { position: string; index: number; name: string; type: string; sample: string; isUsed: boolean; configName: string | null; configPos: string | null; isOverride?: boolean; isHierarchy?: boolean; hierarchyKey?: string | null; isDisabled?: boolean };
type MissingColumn = { name: string; expectedPos: string | null; currentAtPos: string | null; suggestion: string | null };
type RouteHealth = { status: number; ok: boolean; time: number; count?: number } | null;
type HierarchyCheck = { key: string; label: string; required: boolean; found: boolean; matchedAs: string | null };

type SheetResult = {
    configuredName: string; actualName: string; label: string; route: string;
    status: "ok" | "missing"; rowCount: number; colCount: number;
    columnMeta: ColumnMeta[]; missingColumns: MissingColumn[];
    suggestions: { name: string; score: number }[];
    routeHealth: RouteHealth;
    hierarchy?: HierarchyCheck[]; resolveLevel?: string;
};

type SpreadsheetResult = {
    spreadsheetId: string; title: string; responseTime: number;
    error: string | null; allSheetNames: string[]; sheets: SheetResult[];
};

type PageResult = {
    page: string; path: string; icon: string;
    healthScore: number; totalChecks: number; passedChecks: number;
    spreadsheets: SpreadsheetResult[];
};

type DSResponse = {
    timestamp: string; overallHealth: number;
    apiHealth: Record<string, { status: number; ok: boolean; time: number; count?: number }>;
    pages: PageResult[];
};

/* ─────────────────────────────────────────────────
   Constants
   ───────────────────────────────────────────────── */


const TYPE_LABELS: Record<string, { label: string; color: string }> = {
    teks: { label: "Text", color: "text-blue-400/60" },
    angka: { label: "Number", color: "text-amber-400/60" },
    koordinat: { label: "Coord", color: "text-cyan-400/60" },
    tanggal: { label: "Date", color: "text-purple-400/60" },
    boolean: { label: "Bool", color: "text-green-400/60" },
    url: { label: "URL", color: "text-sky-400/60" },
    empty: { label: "Unknown", color: "text-slate-600" },
};

/* ─────────────────────────────────────────────────
   Component: Health Ring (SVG donut chart)
   ───────────────────────────────────────────────── */
function HealthRing({ score, size = 120 }: { score: number; size?: number }) {
    const r = (size - 12) / 2;
    const c = 2 * Math.PI * r;
    const offset = c - (score / 100) * c;
    const color = score >= 90 ? "#10b981" : score >= 60 ? "#f59e0b" : "#ef4444";

    return (
        <div className="relative" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="-rotate-90">
                <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.04)" strokeWidth={10} fill="none" />
                <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={10} fill="none"
                    strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-1000" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold text-white">{score}%</span>
            </div>
        </div>
    );
}

/* ─────────────────────────────────────────────────
   Component: Health Bar (compact progress bar)
   ───────────────────────────────────────────────── */
function HealthBar({ score }: { score: number }) {
    const color = score >= 90 ? "bg-emerald-400" : score >= 60 ? "bg-amber-400" : "bg-red-400";
    return (
        <div className="flex items-center gap-2">
            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/[0.06]">
                <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${score}%` }} />
            </div>
            <span className={`text-[11px] font-semibold ${score >= 90 ? "text-emerald-400" : score >= 60 ? "text-amber-400" : "text-red-400"}`}>
                {score}%
            </span>
        </div>
    );
}

/* ─────────────────────────────────────────────────
   Component: Column Table (enterprise-grade)
   Shows all columns with position, type, sample.
   Missing columns appear as red rows at the bottom.
   ───────────────────────────────────────────────── */
function ColumnTable({ columns, missing, spreadsheetId, sheetName, onRefresh, hierarchy, resolveLevel }: {
    columns: ColumnMeta[]; missing: MissingColumn[];
    spreadsheetId?: string; sheetName?: string; onRefresh?: () => void;
    hierarchy?: HierarchyCheck[]; resolveLevel?: string;
}) {
    if (columns.length === 0 && missing.length === 0) return null;

    const usedCount = columns.filter((c) => c.isUsed).length;
    // Track dropdown selections: { configColName: selectedSheetColName }
    const [selections, setSelections] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);
    const [saveResult, setSaveResult] = useState<string | null>(null);
    const [editing, setEditing] = useState<string | null>(null); // configName being edited

    // Available (unmatched) sheet columns for dropdown
    const unmappedSheetCols = columns.filter((c) => !c.isUsed);

    // Save a single override
    const saveOverride = async (configCol: string, sheetCol: string) => {
        if (!spreadsheetId || !sheetName) return;
        setSaving(true);
        setSaveResult(null);
        try {
            const res = await fetch("/api/data-sources", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ spreadsheetId, sheetName, configCol, sheetCol }),
            });
            if (res.ok) {
                setSaveResult(`✅ ${configCol} → ${sheetCol}`);
                setSelections((s) => { const n = { ...s }; delete n[configCol]; return n; });
                // Wait for dev server to hot-reload the registry change
                await new Promise((r) => setTimeout(r, 2000));
                onRefresh?.();
            } else {
                setSaveResult("❌ Gagal menyimpan");
            }
        } catch {
            setSaveResult("❌ Error");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <p className="text-[10px] font-semibold tracking-widest text-slate-500">
                        Schema Sheet — {usedCount} digunakan dari {columns.length} total
                    </p>
                    {resolveLevel && (
                        <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${resolveLevel === "bay" ? "bg-emerald-500/15 text-emerald-400" : "bg-cyan-500/15 text-cyan-400"}`}>
                            Level: {resolveLevel === "bay" ? "Bay" : "Gardu Induk"}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-3 text-[10px] text-slate-600">
                    {saveResult && (
                        <span className="mr-2 text-[10px] font-medium animate-pulse">{saveResult}</span>
                    )}
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-400" /> Digunakan</span>
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400" /> Hierarchy</span>
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-slate-700" /> Tidak digunakan</span>
                </div>
            </div>

            {/* Hierarchy error — mandatory columns missing */}
            {hierarchy && (() => {
                const missing = hierarchy.filter((h) => h.required && !h.found);
                if (missing.length === 0) return null;
                return (
                    <div className="rounded-lg bg-red-500/10 px-3 py-2 ring-1 ring-red-500/25">
                        <div className="flex items-center gap-2">
                            <span className="text-red-400 text-sm">⚠</span>
                            <span className="text-[10px] font-bold text-red-400">
                                Cross-filter & drill-down error
                            </span>
                        </div>
                        <p className="mt-1 text-[10px] text-red-300/80">
                            Kolom hierarchy wajib tidak ditemukan:{" "}
                            {missing.map((m) => (
                                <code key={m.key} className="mx-0.5 rounded bg-red-500/20 px-1.5 py-0.5 font-bold text-red-300">
                                    {m.label}
                                </code>
                            ))}
                            — sheet ini tidak bisa di-filter oleh dashboard.
                        </p>
                    </div>
                );
            })()}

            {/* Table */}
            <div className="overflow-hidden rounded-lg ring-1 ring-white/[0.06]">
                <table className="w-full text-[11px]">
                    <thead>
                        <tr className="bg-white/[0.03] text-left text-[10px] font-semibold tracking-wider text-slate-500">
                            <th className="w-10 px-3 py-2 text-center">#</th>
                            <th className="w-12 px-2 py-2 text-center">Pos</th>
                            <th className="px-3 py-2">Sheet Kolom</th>
                            <th className="px-3 py-2">Mapping Dashboard</th>
                            <th className="w-16 px-2 py-2 text-center">Tipe</th>
                            <th className="w-14 px-2 py-2 text-center">Status</th>
                            <th className="px-3 py-2">Sample</th>
                        </tr>
                    </thead>
                    <tbody>
                        {/* ── Actual columns from spreadsheet ── */}
                        {columns.map((col) => {
                            const isHierarchy = !!col.isHierarchy;
                            const rowBg = isHierarchy
                                ? "bg-amber-500/[0.06] hover:bg-amber-500/[0.10]"
                                : col.isUsed
                                    ? "bg-emerald-500/[0.03] hover:bg-emerald-500/[0.06]"
                                    : "hover:bg-white/[0.02]";
                            const posBg = isHierarchy
                                ? "bg-amber-500/20 text-amber-400"
                                : col.isUsed
                                    ? "bg-emerald-500/15 text-emerald-400"
                                    : "bg-white/[0.03] text-slate-700";
                            return (
                                <tr key={col.index}
                                    className={`border-t border-white/[0.03] transition-colors ${rowBg}`}>
                                    <td className="px-3 py-1.5 text-center text-slate-600">{col.index + 1}</td>
                                    <td className="px-2 py-1.5 text-center">
                                        <span className={`inline-block w-7 rounded px-1 py-0.5 text-center font-bold ${posBg}`}>
                                            {col.position}
                                        </span>
                                    </td>
                                    <td className={`px-3 py-1.5 font-mono ${col.isUsed || isHierarchy ? "text-white font-medium" : "text-slate-500"}`}>
                                        {col.name}
                                        {isHierarchy && (
                                            <span className="ml-1.5 rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[8px] font-bold text-amber-400 align-middle">
                                                {{ ultg: "ULTG", gi: "GI", bay: "Bay" }[col.hierarchyKey || ""] || ""}
                                            </span>
                                        )}
                                    </td>
                                    {/* Config Mapping */}
                                    <td className="px-3 py-1.5">
                                        {isHierarchy ? (
                                            /* Hierarchy = locked auto-mapping */
                                            <span className="inline-flex items-center gap-1 text-[10px]">
                                                <Lock className="h-3 w-3 text-amber-400" />
                                                <code className="text-amber-300">{col.name.replace(/\s+/g, " ")}</code>
                                                <span className="text-[8px] text-amber-500/60">auto</span>
                                            </span>
                                        ) : col.configName ? (
                                            editing === col.configName ? (
                                                /* Edit mode: dropdown to re-map */
                                                <div className="flex items-center gap-1">
                                                    <select
                                                        className="rounded border border-white/10 bg-slate-900 px-2 py-0.5 text-[10px] text-slate-300 focus:border-cyan-500 focus:outline-none"
                                                        value={selections[col.configName] || ""}
                                                        onChange={(e) => setSelections((s) => ({ ...s, [col.configName!]: e.target.value }))}
                                                    >
                                                        <option value="">Pilih kolom lain…</option>
                                                        {columns.filter((c) => !c.isUsed || c.name === col.name).map((sc) => (
                                                            <option key={sc.name} value={sc.name}>
                                                                {sc.position}: {sc.name}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    {selections[col.configName] && (
                                                        <button
                                                            disabled={saving}
                                                            onClick={() => { saveOverride(col.configName!, selections[col.configName!]); setEditing(null); }}
                                                            className="rounded bg-cyan-600 px-2 py-0.5 text-[10px] font-medium text-white hover:bg-cyan-500 disabled:opacity-50"
                                                        >
                                                            {saving ? "…" : "✔"}
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => setEditing(null)}
                                                        className="rounded px-1.5 py-0.5 text-[10px] text-slate-500 hover:bg-white/5 hover:text-slate-300"
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 text-[10px]">
                                                    <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                                                    <code className="text-emerald-300">{col.configName}</code>
                                                    {spreadsheetId && (
                                                        <button
                                                            onClick={() => setEditing(col.configName)}
                                                            className="ml-1 rounded border border-white/10 px-1 py-0.5 text-[10px] text-slate-500 transition-all hover:border-cyan-500/40 hover:text-cyan-300"
                                                            title="Ubah mapping"
                                                        >
                                                            ✏
                                                        </button>
                                                    )}
                                                </span>
                                            )
                                        ) : (
                                            <span className="text-slate-700 text-[10px]">—</span>
                                        )}
                                    </td>
                                    <td className="px-2 py-1.5 text-center">
                                        <span className={`text-[9px] font-bold tracking-wider ${TYPE_LABELS[col.type]?.color || "text-slate-600"}`}>
                                            {TYPE_LABELS[col.type]?.label || col.type}
                                        </span>
                                    </td>
                                    <td className="px-2 py-1.5 text-center">
                                        {isHierarchy ? (
                                            <span className="inline-flex items-center justify-center" title="Hierarchy — selalu aktif">
                                                <Lock className="h-3.5 w-3.5 text-amber-400" />
                                            </span>
                                        ) : col.isUsed ? (
                                            <CheckCircle2 className="mx-auto h-3.5 w-3.5 text-emerald-400" />
                                        ) : (
                                            <span className="text-slate-700">—</span>
                                        )}
                                    </td>
                                    <td className="max-w-[200px] truncate px-3 py-1.5 text-slate-500" title={col.sample}>
                                        {col.sample || <span className="text-slate-700 italic">kosong</span>}
                                    </td>
                                </tr>
                            );
                        })}

                        {/* ── Missing columns (config vs sheet mismatch) ── */}
                        {missing.length > 0 && (
                            <>
                                <tr className="border-t-2 border-red-500/20">
                                    <td colSpan={7} className="bg-red-500/[0.03] px-3 py-1.5 text-[10px] font-medium text-red-400">
                                        <span className="flex items-center gap-1.5">
                                            <XCircle className="h-3 w-3" />
                                            {missing.length} kolom di config tidak ditemukan di sheet
                                        </span>
                                    </td>
                                </tr>
                                {missing.map((col, i) => (
                                    <tr key={`miss-${col.name}`} className="border-t border-red-500/10 bg-red-500/[0.02] hover:bg-red-500/[0.05]">
                                        <td className="px-3 py-1.5 text-center text-red-500/40">{columns.length + i + 1}</td>
                                        <td className="px-2 py-1.5 text-center">
                                            <span className={`inline-block w-7 rounded px-1 py-0.5 text-center font-bold ${col.expectedPos ? "bg-amber-500/15 text-amber-400" : "bg-red-500/10 text-red-500/50"}`}>
                                                {col.expectedPos || "?"}
                                            </span>
                                        </td>
                                        {/* Kolom Sheet — show what's at expected pos now */}
                                        <td className="px-3 py-1.5">
                                            {col.currentAtPos ? (
                                                <span className="inline-flex items-center gap-1 text-[10px] text-amber-400">
                                                    <span className="text-amber-400">⚠</span> <code className="font-mono">{col.currentAtPos}</code>
                                                    <span className="text-amber-400/60">(renamed?)</span>
                                                </span>
                                            ) : col.suggestion ? (
                                                <span className="inline-flex items-center gap-1 text-[10px] text-violet-400">
                                                    💡 <code className="font-mono">{col.suggestion}</code>?
                                                </span>
                                            ) : null}
                                        </td>
                                        {/* Config Mapping — config name */}
                                        <td className="px-3 py-1.5">
                                            <span className="inline-flex items-center gap-1 text-[10px]">
                                                <XCircle className="h-3 w-3 text-red-400" />
                                                <code className="font-mono font-medium text-red-400">{col.name}</code>
                                            </span>
                                        </td>
                                        <td className="px-2 py-1.5 text-center text-slate-700">—</td>
                                        <td className="px-2 py-1.5 text-center">
                                            <XCircle className="mx-auto h-3.5 w-3.5 text-red-400/60" />
                                        </td>
                                        <td className="px-3 py-1.5 text-[10px] italic text-red-400/40">tidak ditemukan</td>
                                    </tr>
                                ))}
                            </>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

/* ─────────────────────────────────────────────────
   Component: Smart Suggestion (missing sheet)
   ───────────────────────────────────────────────── */
function SmartSuggestion({ configuredName, suggestions, spreadsheetId, allSheetNames, onRefresh }: {
    configuredName: string;
    suggestions: { name: string; score: number }[];
    spreadsheetId: string;
    allSheetNames: string[];
    onRefresh: () => void;
}) {
    const [selectedSheet, setSelectedSheet] = useState("");
    const [saving, setSaving] = useState(false);
    const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

    const handleSave = async () => {
        if (!selectedSheet) return;
        setSaving(true);
        setResult(null);
        try {
            const res = await fetch("/api/data-sources", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "sheet-rename",
                    spreadsheetId,
                    configuredSheetName: configuredName,
                    newSheetName: selectedSheet,
                }),
            });
            const data = await res.json();
            if (data.success) {
                setResult({ ok: true, msg: `✅ Tersimpan! Testing ulang...` });
                setTimeout(() => onRefresh(), 500);
            } else {
                setResult({ ok: false, msg: data.error || "Gagal menyimpan" });
            }
        } catch {
            setResult({ ok: false, msg: "Network error" });
        }
        setSaving(false);
    };

    return (
        <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
            <p className="flex items-center gap-2 text-sm font-medium text-violet-300">
                <Lightbulb className="h-4 w-4" /> Sheet tidak ditemukan
            </p>
            <p className="mt-1 text-xs text-slate-400">
                Sheet &quot;{configuredName}&quot; tidak ada di spreadsheet. Pilih nama sheet yang benar:
            </p>

            {/* Dropdown + Save */}
            <div className="mt-3 flex items-center gap-2">
                <select
                    value={selectedSheet}
                    onChange={(e) => { setSelectedSheet(e.target.value); setResult(null); }}
                    className="flex-1 rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
                >
                    <option value="">-- Pilih Sheet --</option>
                    {allSheetNames.map((name) => (
                        <option key={name} value={name}>{name}</option>
                    ))}
                </select>
                <button
                    onClick={handleSave}
                    disabled={saving || !selectedSheet}
                    className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-500 disabled:opacity-40"
                >
                    {saving ? "..." : "Simpan & Test"}
                </button>
            </div>

            {/* Result feedback */}
            {result && (
                <p className={`mt-2 text-xs ${result.ok ? "text-emerald-400" : "text-red-400"}`}>
                    {result.msg}
                </p>
            )}

            {/* Clickable suggestions */}
            {suggestions.length > 0 && (
                <>
                    <p className="mt-3 text-[10px] uppercase tracking-wider text-slate-600">Saran (Klik untuk pilih):</p>
                    <div className="mt-1 flex flex-wrap gap-2">
                        {suggestions.map((s) => (
                            <button
                                key={s.name}
                                onClick={() => { setSelectedSheet(s.name); setResult(null); }}
                                className={`flex cursor-pointer items-center gap-2 rounded-lg px-3 py-1.5 text-sm ring-1 transition-colors ${selectedSheet === s.name
                                    ? "bg-violet-500 tex-white ring-violet-500"
                                    : "bg-violet-500/10 text-violet-300 ring-violet-500/25 hover:bg-violet-500/20"
                                    }`}
                            >
                                <span className="font-mono font-medium">{s.name}</span>
                                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${s.score >= 70 ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"}`}>
                                    {s.score}%
                                </span>
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

/* ─────────────────────────────────────────────────
   Component: Add Spreadsheet Dialog
   ───────────────────────────────────────────────── */
function AddSpreadsheetDialog({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
    const [url, setUrl] = useState("");
    const [detecting, setDetecting] = useState(false);
    const [detected, setDetected] = useState<{ spreadsheetId: string; title: string; sheets: DetectedSheet[] } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [selectedSheets, setSelectedSheets] = useState<Set<string>>(new Set());

    const extractId = (input: string): string | null => {
        const m = input.match(/\/d\/([a-zA-Z0-9_-]+)/);
        if (m) return m[1];
        if (/^[a-zA-Z0-9_-]{20,}$/.test(input.trim())) return input.trim();
        return null;
    };

    const handleDetect = async () => {
        const id = extractId(url);
        if (!id) { setError("URL atau ID tidak valid"); return; }
        setDetecting(true); setError(null); setDetected(null);
        try {
            const res = await fetch(`/api/registry/detect?spreadsheetId=${id}`);
            const json = await res.json();
            if (!res.ok || !json.success) { setError(json.error || "Gagal mendeteksi"); return; }
            setDetected(json.data);
            setSelectedSheets(new Set(json.data.sheets.filter((s: DetectedSheet) => s.rowCount > 1).map((s: DetectedSheet) => s.sheetName)));
        } catch { setError("Network error"); }
        finally { setDetecting(false); }
    };

    const handleAdd = async () => {
        if (!detected) return;
        setSaving(true);
        const sheets = detected.sheets
            .filter((s) => selectedSheets.has(s.sheetName))
            .map((s) => ({ sheetName: s.sheetName, label: s.sheetName, route: "", usedBy: [], columnsUsed: s.headers.map((h, i) => ({ name: h, pos: String.fromCharCode(65 + i) })) }));
        try {
            const res = await fetch("/api/data-sources", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ spreadsheetId: detected.spreadsheetId, title: detected.title, sheets }),
            });
            const json = await res.json();
            if (json.success) { onAdded(); onClose(); }
            else { setError(json.error || "Gagal menambahkan"); }
        } catch { setError("Network error"); }
        finally { setSaving(false); }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div className="w-full max-w-2xl rounded-2xl bg-[#111827] p-6 ring-1 ring-white/10 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2"><Plus className="h-5 w-5 text-violet-400" /> Add Spreadsheet</h2>
                    <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"><X className="h-5 w-5" /></button>
                </div>

                {/* Step 1: URL Input */}
                <div className="flex gap-2">
                    <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Paste Google Sheets URL atau ID..."
                        className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-violet-500 focus:outline-none"
                        onKeyDown={(e) => e.key === "Enter" && handleDetect()} />
                    <button onClick={handleDetect} disabled={detecting || !url.trim()}
                        className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-40">
                        {detecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                        {detecting ? "Detecting..." : "Detect"}
                    </button>
                </div>

                {error && <p className="mt-3 text-sm text-red-400 flex items-center gap-1"><XCircle className="h-4 w-4" />{error}</p>}

                {/* Step 2: Detected sheets */}
                {detected && (
                    <div className="mt-4 space-y-3">
                        <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                            <span className="text-sm font-medium text-white">{detected.title}</span>
                            <span className="text-xs text-slate-500">({detected.sheets.length} sheets)</span>
                        </div>
                        <div className="max-h-60 space-y-1.5 overflow-y-auto rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/[0.06]">
                            {detected.sheets.map((s) => (
                                <label key={s.sheetName} className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-white/[0.04]">
                                    <input type="checkbox" checked={selectedSheets.has(s.sheetName)}
                                        onChange={() => setSelectedSheets((prev) => { const n = new Set(prev); n.has(s.sheetName) ? n.delete(s.sheetName) : n.add(s.sheetName); return n; })}
                                        className="h-4 w-4 rounded border-white/20 bg-white/5 accent-violet-500" />
                                    <span className="flex-1 font-mono text-sm text-slate-200">{s.sheetName}</span>
                                    <span className="text-xs text-slate-500">{s.rowCount} rows · {s.colCount} cols</span>
                                </label>
                            ))}
                        </div>
                        <button onClick={handleAdd} disabled={saving || selectedSheets.size === 0}
                            className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-violet-500/20 hover:shadow-violet-500/40 disabled:opacity-40">
                            {saving ? "Adding..." : `Add ${selectedSheets.size} Sheet${selectedSheets.size > 1 ? "s" : ""}`}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

/* ─────────────────────────────────────────────────
   Component: Unused Spreadsheets Section
   ───────────────────────────────────────────────── */
function UnusedSpreadsheets({ entries, onDelete, onRefresh }: {
    entries: RegistryEntry[]; onDelete: (id: string) => void; onRefresh: () => void;
}) {
    const [deleting, setDeleting] = useState<string | null>(null);
    const unused = entries.filter((e) => e.sheets.every((s) => s.usedBy.length === 0));
    if (unused.length === 0) return null;

    const handleDelete = async (entry: RegistryEntry) => {
        if (!confirm(`Hapus "${entry.title}"? Data spreadsheet tidak akan terhapus dari Google.`)) return;
        setDeleting(entry.id);
        try {
            const res = await fetch(`/api/data-sources?id=${entry.id}`, { method: "DELETE" });
            const json = await res.json();
            if (json.success) { onDelete(entry.id); onRefresh(); }
        } catch { /* ignore */ }
        finally { setDeleting(null); }
    };

    return (
        <div className="mt-6 overflow-hidden rounded-2xl bg-white/[0.03] ring-1 ring-white/[0.06]">
            <div className="flex items-center gap-3 border-b border-white/[0.04] p-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-500/15 text-slate-400">
                    <FileSpreadsheet className="h-5 w-5" />
                </div>
                <div>
                    <h2 className="text-base font-semibold text-slate-300">Unused Spreadsheets</h2>
                    <p className="text-xs text-slate-600">Tidak digunakan oleh page manapun — aman untuk dihapus</p>
                </div>
            </div>
            <div className="divide-y divide-white/[0.04]">
                {unused.map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between px-5 py-3 hover:bg-white/[0.02]">
                        <div className="flex items-center gap-3">
                            <FileSpreadsheet className="h-4 w-4 text-slate-500" />
                            <div>
                                <p className="text-sm font-medium text-slate-300">{entry.title}</p>
                                <p className="text-xs text-slate-600">{entry.sheets.length} sheet{entry.sheets.length > 1 ? "s" : ""} · {entry.sheets.map((s) => s.sheetName).join(", ")}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <a href={`https://docs.google.com/spreadsheets/d/${entry.spreadsheetId}`} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1 rounded-lg bg-white/5 px-2.5 py-1.5 text-[11px] text-slate-400 ring-1 ring-white/10 hover:bg-white/10 hover:text-white">
                                <ExternalLink className="h-3 w-3" /> Buka
                            </a>
                            <button onClick={() => handleDelete(entry)} disabled={deleting === entry.id}
                                className="flex items-center gap-1 rounded-lg bg-red-500/10 px-2.5 py-1.5 text-[11px] text-red-400 ring-1 ring-red-500/20 hover:bg-red-500/20 disabled:opacity-40">
                                {deleting === entry.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                                Hapus
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}


/* ─────────────────────────────────────────────────
   Main Page
   ───────────────────────────────────────────────── */
export default function DataSourceManagerPage() {
    const [data, setData] = useState<DSResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [diagnosing, setDiagnosing] = useState(false);
    const [expandedPages, setExpandedPages] = useState<Record<string, boolean>>({});
    const [expandedSheets, setExpandedSheets] = useState<Record<string, boolean>>({});
    const [showAddDialog, setShowAddDialog] = useState(false);
    const [registry, setRegistry] = useState<RegistryEntry[]>([]);

    /* ── Data Fetching ── */
    const fetchData = useCallback(async (withHealthCheck = false) => {
        setLoading(true);
        try {
            const url = `/api/data-sources${withHealthCheck ? "?healthcheck=1" : ""}`;
            const res = await fetch(url);
            const json = await res.json();
            setData(json);
            const exp: Record<string, boolean> = {};
            json.pages?.forEach((p: PageResult) => { exp[p.page] = true; });
            setExpandedPages(exp);
        } catch {
            console.error("Failed to fetch data sources");
        } finally {
            setLoading(false);
            setDiagnosing(false);
        }
    }, []);

    const fetchRegistry = useCallback(async () => {
        try {
            const res = await fetch("/api/data-sources?raw=1");
            const json = await res.json();
            if (json.success) setRegistry(json.data || []);
        } catch { /* ignore */ }
    }, []);

    useEffect(() => { fetchData(); fetchRegistry(); }, [fetchData, fetchRegistry]);

    const runDiagnostics = () => { setDiagnosing(true); fetchData(true); };
    const togglePage = (p: string) => setExpandedPages((v) => ({ ...v, [p]: !v[p] }));
    const toggleSheet = (k: string) => setExpandedSheets((v) => ({ ...v, [k]: !v[k] }));
    const handleAdded = () => { fetchData(); fetchRegistry(); };
    const handleDeleted = () => { fetchRegistry(); };

    /* ── Render ── */
    return (
        <div className="min-h-screen bg-[#0a0e1a] p-6 md:p-8">

            {/* ═══════════ Section: Header ═══════════ */}
            <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 opacity-25 blur-lg" />
                        <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600">
                            <Database className="h-6 w-6 text-white" />
                        </div>
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-white">Smart Data Source</h1>
                        <p className="text-sm text-slate-500">Monitor · Diagnose · Manage</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={() => setShowAddDialog(true)}
                        className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-500 hover:shadow-emerald-500/40">
                        <Plus className="h-4 w-4" /> Add Spreadsheet
                    </button>
                    <button onClick={runDiagnostics} disabled={diagnosing || loading}
                        className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-violet-500/20 transition-all hover:shadow-violet-500/40 disabled:opacity-50">
                        <Activity className={`h-4 w-4 ${diagnosing ? "animate-pulse" : ""}`} />
                        {diagnosing ? "Diagnosing..." : "Run Diagnostics"}
                    </button>
                    <button onClick={() => fetchData()} disabled={loading}
                        className="flex items-center gap-2 rounded-xl bg-white/5 px-4 py-2.5 text-sm text-slate-300 ring-1 ring-white/10 hover:bg-white/10 disabled:opacity-50">
                        <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                    </button>
                </div>
            </div>

            {/* ═══════════ Section: Loading ═══════════ */}
            {loading && !data && (
                <div className="flex flex-col items-center justify-center py-24">
                    <Loader2 className="h-10 w-10 animate-spin text-violet-400" />
                    <p className="mt-6 text-sm text-slate-500">Checking data sources...</p>
                </div>
            )}

            {data && (
                <>
                    {/* ═══════════ Section: Health Overview ═══════════ */}
                    <div className="mb-6 flex gap-5 overflow-hidden rounded-2xl bg-white/[0.03] p-6 ring-1 ring-white/[0.06]">
                        <div className="flex flex-col items-center gap-2">
                            <HealthRing score={data.overallHealth} />
                            <span className="text-[10px] font-medium uppercase tracking-widest text-slate-500">System Health</span>
                        </div>

                        <div className="ml-4 flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                            {data.pages.map((p) => (
                                <div key={p.page} className="flex items-center gap-3 rounded-xl bg-white/[0.02] p-3 ring-1 ring-white/[0.04]">
                                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${p.healthScore >= 90 ? "bg-emerald-500/15 text-emerald-400" : p.healthScore >= 60 ? "bg-amber-500/15 text-amber-400" : "bg-red-500/15 text-red-400"}`}>
                                        {(() => { const I = PAGE_ICONS[p.path]; return I ? <I className="h-4 w-4" /> : <Database className="h-4 w-4" />; })()}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-medium text-slate-200">{p.page}</p>
                                        <HealthBar score={p.healthScore} />
                                    </div>
                                    <span className="text-[11px] text-slate-600">{p.passedChecks}/{p.totalChecks}</span>
                                </div>
                            ))}
                        </div>

                        {/* API Health Panel */}
                        <div className="ml-4 flex flex-col gap-2">
                            <span className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500">API Routes</span>
                            {Object.entries(data.apiHealth).map(([route, h]) => (
                                <div key={route} className="flex items-center gap-2">
                                    {h.ok ? <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-400" /> : <XCircle className="h-3 w-3 shrink-0 text-red-400" />}
                                    <code className="flex-1 text-[11px] text-slate-400">{route}</code>
                                    <span className="text-[10px] text-slate-600">{h.time}ms</span>
                                    {h.ok && h.count !== undefined && (
                                        <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-400">{h.count} records</span>
                                    )}
                                    {!h.ok && (
                                        <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-[10px] text-red-400">{h.status || "Timeout"}</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* ═══════════ Section: Page Cards ═══════════ */}
                    {data.pages.map((page) => {
                        const isExpanded = expandedPages[page.page];
                        return (
                            <div key={page.page} className="mb-4 overflow-hidden rounded-2xl bg-white/[0.03] ring-1 ring-white/[0.06]">
                                {/* Page Header */}
                                <div className="flex cursor-pointer items-center justify-between p-4 transition-colors hover:bg-white/[0.02]"
                                    onClick={() => togglePage(page.page)}>
                                    <div className="flex items-center gap-3">
                                        {isExpanded ? <ChevronDown className="h-5 w-5 text-slate-400" /> : <ChevronRight className="h-5 w-5 text-slate-400" />}
                                        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${page.healthScore >= 90 ? "bg-emerald-500/15 text-emerald-400" : page.healthScore >= 60 ? "bg-amber-500/15 text-amber-400" : "bg-red-500/15 text-red-400"}`}>
                                            {(() => { const I = PAGE_ICONS[page.path]; return I ? <I className="h-5 w-5" /> : <Database className="h-5 w-5" />; })()}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <h2 className="text-base font-semibold text-white">{page.page}</h2>
                                            <span className="text-[11px] text-slate-500">
                                                <code>{page.path}</code> · {page.spreadsheets.length} spreadsheet · {page.spreadsheets.reduce((s, sp) => s + sp.sheets.length, 0)} sheet
                                            </span>
                                        </div>
                                    </div>
                                    <HealthBar score={page.healthScore} />
                                </div>

                                {/* Expanded: Spreadsheets & Sheets */}
                                {isExpanded && (
                                    <div className="border-t border-white/[0.04]">
                                        {page.spreadsheets.map((sp, si) => (
                                            <div key={sp.spreadsheetId} className={si > 0 ? "border-t border-white/[0.04]" : ""}>
                                                {/* Spreadsheet Header */}
                                                <div className="flex items-center justify-between bg-white/[0.015] px-5 py-2.5">
                                                    <div className="flex items-center gap-3">
                                                        <FileSpreadsheet className="h-4 w-4 text-blue-400" />
                                                        <span className="text-sm font-medium text-slate-200">{sp.title}</span>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <span className="flex items-center gap-1 text-[10px] text-slate-600">
                                                            <Clock className="h-3 w-3" />{sp.responseTime}ms
                                                        </span>
                                                        <a href={`https://docs.google.com/spreadsheets/d/${sp.spreadsheetId}`} target="_blank" rel="noopener noreferrer"
                                                            className="flex items-center gap-1 rounded-lg bg-white/5 px-2.5 py-1 text-[11px] text-slate-400 ring-1 ring-white/10 transition-all hover:bg-white/10 hover:text-white">
                                                            <ExternalLink className="h-3 w-3" /> Buka
                                                        </a>
                                                    </div>
                                                </div>

                                                {/* Sheets */}
                                                {sp.sheets.map((sheet) => {
                                                    const key = `${sp.spreadsheetId}-${sheet.configuredName}`;
                                                    const isExp = expandedSheets[key];
                                                    const rh = sheet.routeHealth;

                                                    return (
                                                        <div key={sheet.configuredName} className="border-t border-white/[0.03]">
                                                            {/* Sheet Row */}
                                                            <div className="flex cursor-pointer items-center gap-3 px-5 py-3 transition-colors hover:bg-white/[0.02]"
                                                                onClick={() => toggleSheet(key)}>
                                                                {isExp ? <ChevronDown className="h-4 w-4 text-slate-500" /> : <ChevronRight className="h-4 w-4 text-slate-500" />}
                                                                <div className="flex flex-1 items-center justify-between">
                                                                    <span className={`font-mono text-sm font-medium ${sheet.status === "missing" ? "text-red-400 line-through" : "text-white"}`}>
                                                                        {sheet.actualName || sheet.configuredName}
                                                                    </span>
                                                                    <div className="flex items-center gap-3">
                                                                        {sheet.missingColumns.length > 0 && sheet.status !== "missing" && (
                                                                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-400 ring-1 ring-amber-500/20">
                                                                                <AlertTriangle className="h-2.5 w-2.5" /> {sheet.missingColumns.length} kolom
                                                                            </span>
                                                                        )}
                                                                        {rh && (
                                                                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] ring-1 ${rh.ok ? "bg-emerald-500/5 text-emerald-400/70 ring-emerald-500/10" : "bg-red-500/10 text-red-400 ring-red-500/20"}`}>
                                                                                <Server className="h-2.5 w-2.5" />
                                                                                {rh.ok ? `${rh.status} · ${rh.time}ms` : `${rh.status || "ERR"}`}
                                                                                {rh.count !== undefined && ` · ${rh.count}`}
                                                                            </span>
                                                                        )}
                                                                        <code className="text-[11px] text-slate-500">{sheet.route}</code>
                                                                        {sheet.status !== "missing" && (
                                                                            <>
                                                                                <span className="text-[11px] text-slate-700">·</span>
                                                                                <span className="text-[11px] text-slate-500"><Layers className="mr-1 inline h-3 w-3" />{sheet.rowCount.toLocaleString()}</span>
                                                                                <span className="text-[11px] text-slate-500">{sheet.colCount} cols</span>
                                                                            </>
                                                                        )}
                                                                        {sheet.status === "ok" ? (
                                                                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 ring-1 ring-emerald-500/20">
                                                                                <CheckCircle2 className="h-2.5 w-2.5" /> Healthy
                                                                            </span>
                                                                        ) : (
                                                                            <span className="inline-flex animate-pulse items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-400 ring-1 ring-red-500/20">
                                                                                <XCircle className="h-2.5 w-2.5" /> MISSING
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Expanded: Sheet Details */}
                                                            {isExp && (
                                                                <div className="space-y-4 border-t border-white/[0.03] bg-white/[0.01] px-9 py-4">
                                                                    {sheet.status === "missing" && (
                                                                        <>
                                                                            <SmartSuggestion
                                                                                configuredName={sheet.configuredName}
                                                                                suggestions={sheet.suggestions}
                                                                                spreadsheetId={sp.spreadsheetId}
                                                                                allSheetNames={sp.allSheetNames}
                                                                                onRefresh={() => fetchData()}
                                                                            />

                                                                        </>
                                                                    )}
                                                                    <ColumnTable
                                                                        columns={sheet.columnMeta}
                                                                        missing={sheet.missingColumns}
                                                                        spreadsheetId={sp.spreadsheetId}
                                                                        sheetName={sheet.configuredName}
                                                                        onRefresh={() => fetchData()}
                                                                        hierarchy={sheet.hierarchy}
                                                                        resolveLevel={sheet.resolveLevel}
                                                                    />
                                                                    {sheet.status === "missing" && sheet.columnMeta.length === 0 && (
                                                                        <div>
                                                                            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Kolom yang dibutuhkan</p>
                                                                            <div className="flex flex-wrap gap-1.5">
                                                                                {sheet.missingColumns.map((col) => (
                                                                                    <span key={col.name} className="rounded-md bg-red-500/10 px-2 py-0.5 text-[11px] font-mono text-red-400 ring-1 ring-red-500/25">
                                                                                        ✗ {col.name}
                                                                                    </span>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {/* ═══════════ Section: Unused Spreadsheets ═══════════ */}
                    <UnusedSpreadsheets entries={registry} onDelete={handleDeleted} onRefresh={() => fetchData()} />

                    {/* ═══════════ Timestamp ═══════════ */}
                    <p className="mt-6 text-center text-[11px] text-slate-600">
                        Last sync: {new Date(data.timestamp).toLocaleString("id-ID")}
                    </p>
                </>
            )}

            {/* ═══════════ Add Spreadsheet Dialog ═══════════ */}
            {showAddDialog && <AddSpreadsheetDialog onClose={() => setShowAddDialog(false)} onAdded={handleAdded} />}
        </div>
    );
}
