"use client";

/**
 * Tab 2: Enrichment — Dynamic enrichment source manager + BFO Config.
 * Visual Standard: Spreadsheet Sync v2.0
 */

import { useState, useEffect, useRef } from "react";
import {
    Layers, Plus, Trash2, Search, Columns, Loader2, Save,
    FileSpreadsheet, CheckCircle2, Settings,
} from "lucide-react";
import type { ThorConfig, EnrichmentSource, BFOConfig } from "../_lib/types";
import { patchConfig, loadSheets, loadHeaders, fmtWIB } from "../_lib/api";
import { InputField, ServiceSection, ServiceStatCard } from "../../_components/service-ui";

interface Props {
    config: Partial<ThorConfig>;
    showFeedback: (msg: string, ok: boolean) => void;
}

interface SourceUIState extends EnrichmentSource {
    _sheets: string[];
    _headers: string[];
    _loadingSh: boolean;
    _loadingHd: boolean;
}

const EMPTY_SOURCE: SourceUIState = {
    name: "", spreadsheetId: "", sheetName: "", towerNameColumn: "",
    columnMap: {}, _sheets: [], _headers: [], _loadingSh: false, _loadingHd: false,
};

export default function TabEnrichment({ config, showFeedback }: Props) {
    const inited = useRef(false);
    const [saving, setSaving] = useState(false);
    const [sources, setSources] = useState<SourceUIState[]>([]);
    const [bfoConfig, setBfoConfig] = useState<BFOConfig>({
        grounding_source: "", grounding_key: "", insulator_source: "", insulator_key: "",
    });

    const c = config as Record<string, any>;

    useEffect(() => {
        if (inited.current) return;
        const existing = c.ENRICHMENT_SOURCES as EnrichmentSource[] | undefined;
        if (existing && Array.isArray(existing) && existing.length > 0) {
            inited.current = true;
            setSources(existing.map(s => {
                const uniqueHeaders = Array.from(new Set([s.towerNameColumn, ...Object.values(s.columnMap || {})].filter(Boolean)));
                return {
                    ...s, 
                    _sheets: s.sheetName ? [s.sheetName] : [], 
                    _headers: uniqueHeaders, 
                    _loadingSh: false, 
                    _loadingHd: false,
                };
            }));
        }
        const existingBfo = c.BFO_CONFIG as BFOConfig | null;
        if (existingBfo) setBfoConfig(existingBfo);
    }, [c]);

    const addSource = () => setSources(s => [...s, { ...EMPTY_SOURCE }]);
    const removeSource = (idx: number) => setSources(s => s.filter((_, i) => i !== idx));
    const updateSource = (idx: number, updates: Partial<SourceUIState>) => {
        setSources(s => s.map((src, i) => i === idx ? { ...src, ...updates } : src));
    };

    const handleSourceLoadSheets = async (idx: number) => {
        const src = sources[idx];
        if (!src.spreadsheetId.trim()) { showFeedback("Isi Spreadsheet ID dulu", false); return; }
        updateSource(idx, { _loadingSh: true });
        try {
            const data = await loadSheets(src.spreadsheetId.trim());
            updateSource(idx, { _sheets: data.sheets, _loadingSh: false, sheetName: data.sheets[0] || "" });
        } catch (err: any) {
            showFeedback(`Load sheets error: ${err.message}`, false);
            updateSource(idx, { _loadingSh: false });
        }
    };

    const handleSourceLoadHeaders = async (idx: number) => {
        const src = sources[idx];
        if (!src.spreadsheetId.trim() || !src.sheetName) { showFeedback("Pilih sheet dulu", false); return; }
        updateSource(idx, { _loadingHd: true });
        try {
            const data = await loadHeaders(src.spreadsheetId.trim(), src.sheetName);
            updateSource(idx, { _headers: data.headers, _loadingHd: false });
        } catch (err: any) {
            showFeedback(`Load headers error: ${err.message}`, false);
            updateSource(idx, { _loadingHd: false });
        }
    };

    const addColumnEntry = (idx: number) => {
        const src = sources[idx];
        updateSource(idx, { columnMap: { ...src.columnMap, [`field_${Object.keys(src.columnMap).length}`]: "" } });
    };
    const updateColumnKey = (srcIdx: number, oldKey: string, newKey: string) => {
        const src = sources[srcIdx];
        const newMap: Record<string, string> = {};
        for (const k of Object.keys(src.columnMap)) {
            if (k === oldKey) {
                newMap[newKey] = src.columnMap[k];
            } else {
                newMap[k] = src.columnMap[k];
            }
        }
        updateSource(srcIdx, { columnMap: newMap });
    };
    const updateColumnValue = (srcIdx: number, key: string, value: string) => {
        const src = sources[srcIdx];
        updateSource(srcIdx, { columnMap: { ...src.columnMap, [key]: value } });
    };
    const removeColumnEntry = (srcIdx: number, key: string) => {
        const src = sources[srcIdx];
        const { [key]: _, ...rest } = src.columnMap;
        updateSource(srcIdx, { columnMap: rest });
    };

    const handleSave = async () => {
        for (const src of sources) {
            if (!src.name || !src.spreadsheetId || !src.sheetName || !src.towerNameColumn) {
                showFeedback(`Source "${src.name || '(unnamed)'}" belum lengkap`, false);
                return;
            }
        }
        setSaving(true);
        const cleanSources: EnrichmentSource[] = sources.map(s => ({
            name: s.name, spreadsheetId: s.spreadsheetId, sheetName: s.sheetName,
            towerNameColumn: s.towerNameColumn, columnMap: s.columnMap,
        }));
        const ok = await patchConfig({
            ENRICHMENT_SOURCES: cleanSources,
            BFO_CONFIG: bfoConfig.grounding_source ? bfoConfig : null,
            CONFIG_STATUS: "need_validate",
            CONFIG_REASON: "User: enrichment config saved",
            ENRICHMENT_LAST_SYNCED: null,
            ENRICHMENT_COUNT: 0,
            ENRICHMENT_ERRORS: null
        });
        showFeedback(ok ? "Enrichment config saved — akan di-sync saat validasi berikutnya" : "Gagal save", ok);
        setSaving(false);
    };

    const sourceNames = sources.map(s => s.name).filter(Boolean);

    const selectCls = "w-full h-7 pl-2 pr-6 text-[11px] rounded border border-border/50 bg-background text-foreground focus-visible:outline-none focus-visible:border-blue-500/50 transition-[border-color] duration-150 [&>option]:bg-background [&>option]:text-foreground";
    const smallInputCls = "h-7 pl-2 pr-2 text-[11px] rounded border border-border/50 bg-background text-foreground font-mono focus-visible:outline-none focus-visible:border-blue-500/50 transition-[border-color] duration-150";

    return (
        <div className="space-y-6">
            {/* Sync Status */}
            <div className="grid grid-cols-3 gap-3">
                <ServiceStatCard label="Enrichment Rows" value={c.ENRICHMENT_COUNT ?? "—"} icon={<Layers className="h-4 w-4 text-purple-400/60" />} />
                <ServiceStatCard label="Last Synced" value={fmtWIB(c.ENRICHMENT_LAST_SYNCED)} icon={<CheckCircle2 className="h-4 w-4 text-emerald-400/60" />} />
                <ServiceStatCard label="Sources" value={sources.length} icon={<FileSpreadsheet className="h-4 w-4 text-blue-400/60" />} />
            </div>

            {c.ENRICHMENT_ERRORS && (
                <div className="text-[11px] text-red-400 bg-red-500/5 border border-red-500/20 rounded py-2 px-3">
                    {c.ENRICHMENT_ERRORS}
                </div>
            )}

            {/* BFO Configuration */}
            <ServiceSection title="BFO Risk Config" icon={<Settings className="h-3.5 w-3.5" />} defaultOpen={false}>
                <p className="text-[10px] text-muted-foreground/50 mb-3">
                    Pointer ke data grounding (R_grounding) dan insulator (n_keping) dari enrichment sources.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                    <div>
                        <label className="text-[10px] text-muted-foreground/70 mb-0.5 block">Grounding Source</label>
                        <select value={bfoConfig.grounding_source} onChange={e => setBfoConfig(b => ({ ...b, grounding_source: e.target.value }))} className={selectCls}>
                            <option value="">— Pilih —</option>
                            {sourceNames.map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                    </div>
                    <InputField label="Grounding Key" value={bfoConfig.grounding_key} onChange={v => setBfoConfig(b => ({ ...b, grounding_key: v }))} />
                    <div>
                        <label className="text-[10px] text-muted-foreground/70 mb-0.5 block">Insulator Source</label>
                        <select value={bfoConfig.insulator_source} onChange={e => setBfoConfig(b => ({ ...b, insulator_source: e.target.value }))} className={selectCls}>
                            <option value="">— Pilih —</option>
                            {sourceNames.map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                    </div>
                    <InputField label="Insulator Key" value={bfoConfig.insulator_key} onChange={v => setBfoConfig(b => ({ ...b, insulator_key: v }))} />
                </div>
            </ServiceSection>

            {/* Enrichment Source Cards */}
            {sources.map((src, idx) => (
                <ServiceSection key={idx}
                    title={src.name || `Source ${idx + 1}`}
                    icon={<FileSpreadsheet className="h-3.5 w-3.5" />}
                    badge={Object.keys(src.columnMap).length > 0 ? `${Object.keys(src.columnMap).length} cols` : undefined}
                    badgeColor="bg-indigo-500/10 text-indigo-400"
                >
                    <div className="space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                            <InputField label="Source Name" value={src.name} onChange={v => updateSource(idx, { name: v })} />
                            <div className="flex items-end gap-2">
                                <div className="flex-1">
                                    <InputField 
                                        label="Spreadsheet ID (Bisa Paste Full URL)" 
                                        value={src.spreadsheetId} 
                                        onChange={v => {
                                            let finalId = v;
                                            const match = v.match(/\/d\/([a-zA-Z0-9-_]+)/);
                                            if (match) finalId = match[1];
                                            updateSource(idx, { spreadsheetId: finalId });
                                        }} 
                                        mono 
                                    />
                                </div>
                                <button onClick={() => handleSourceLoadSheets(idx)} disabled={src._loadingSh}
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium border border-blue-500/30 text-blue-400 hover:bg-blue-500/10 transition-all disabled:opacity-50 h-8">
                                    {src._loadingSh ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
                                    Load
                                </button>
                            </div>
                        </div>

                        {src._sheets.length > 0 && (
                            <div className="flex items-end gap-2">
                                <div className="flex-1">
                                    <label className="text-[10px] text-muted-foreground/70 mb-0.5 block">Sheet</label>
                                    <select value={src.sheetName} onChange={e => updateSource(idx, { sheetName: e.target.value })} className={selectCls}>
                                        {src._sheets.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                                <button onClick={() => handleSourceLoadHeaders(idx)} disabled={src._loadingHd}
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium border border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10 transition-all disabled:opacity-50 h-8">
                                    {src._loadingHd ? <Loader2 className="h-3 w-3 animate-spin" /> : <Columns className="h-3 w-3" />}
                                    Headers
                                </button>
                            </div>
                        )}

                        {src._headers.length > 0 && (
                            <>
                                <div>
                                    <label className="text-[10px] text-muted-foreground/70 mb-0.5 block">Tower Name Column (join key)</label>
                                    <select value={src.towerNameColumn} onChange={e => updateSource(idx, { towerNameColumn: e.target.value })} className={selectCls}>
                                        <option value="">— Pilih —</option>
                                        {src._headers.map(h => <option key={h} value={h}>{h}</option>)}
                                    </select>
                                </div>

                                {/* Column Mapping */}
                                <div className="rounded border border-border/30 p-3 space-y-1.5">
                                    <div className="text-[10px] text-muted-foreground/50 uppercase tracking-wider font-semibold mb-2">Column Mapping</div>
                                    {Object.entries(src.columnMap).map(([key, val], i) => (
                                        <div key={i} className="flex items-center gap-1.5">
                                            <input value={key} onChange={e => updateColumnKey(idx, key, e.target.value)}
                                                className={`flex-1 ${smallInputCls}`} placeholder="json_key" />
                                            <span className="text-muted-foreground/30 text-[10px]">→</span>
                                            <select value={val} onChange={e => updateColumnValue(idx, key, e.target.value)} className={`flex-1 ${selectCls}`}>
                                                <option value="">—</option>
                                                {src._headers.map(h => <option key={h} value={h}>{h}</option>)}
                                            </select>
                                            <button onClick={() => removeColumnEntry(idx, key)} className="p-0.5 text-red-400/50 hover:text-red-400 transition-colors">
                                                <Trash2 className="h-3 w-3" />
                                            </button>
                                        </div>
                                    ))}
                                    <button onClick={() => addColumnEntry(idx)}
                                        className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium border border-border/30 text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-all w-full justify-center mt-1">
                                        <Plus className="h-3 w-3" /> Add Column
                                    </button>
                                </div>
                            </>
                        )}

                        <button onClick={() => removeSource(idx)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium border border-red-500/20 text-red-400/60 hover:text-red-400 hover:bg-red-500/5 transition-all">
                            <Trash2 className="h-3 w-3" /> Remove Source
                        </button>
                    </div>
                </ServiceSection>
            ))}

            {/* Actions */}
            <div className="flex items-center gap-3">
                <button onClick={addSource}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-border text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-all">
                    <Plus className="h-3.5 w-3.5" /> Add Source
                </button>
                <button onClick={handleSave} disabled={saving}
                    className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-medium transition-all disabled:opacity-50 ${
                        saving ? "bg-muted text-muted-foreground" : "bg-violet-600 text-white hover:bg-violet-500"
                    }`}>
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    Save Enrichment
                </button>
                <span className="text-[10px] text-muted-foreground/40">Changes require re-validation</span>
            </div>
        </div>
    );
}
