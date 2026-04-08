"use client";

/**
 * Tab 1: Config — All editable configuration + scheduler controls.
 * This is the single place for ALL actionable controls.
 * Visual Standard: Spreadsheet Sync v2.0 (compact, dense, no emoji)
 */

import { useState, useEffect, useRef, useCallback } from "react";
import {
    Globe, FileSpreadsheet, Loader2, Search, Columns,
    MessageSquare, Shield, Save, CheckCircle2, Info,
    Play, Pause, RefreshCw, Zap, Send, Timer, ChevronUp, ChevronDown, Power,
} from "lucide-react";
import type { ThorConfig, TowerColumnMap } from "../_lib/types";
import { TOWER_COLUMN_ROLES } from "../_lib/types";
import { patchConfig, loadSheets, loadHeaders, controlAction, ACTIONS_API } from "../_lib/api";
import { InputField, ServiceSection } from "../../_components/service-ui";
import { CLOUD_CONSOLE_API } from "@/lib/cloud-console-api";

interface Props {
    config: Partial<ThorConfig>;
    showFeedback: (msg: string, ok: boolean) => void;
}

export default function TabConfig({ config, showFeedback }: Props) {
    const draftsInitialized = useRef(false);
    const [saving, setSaving] = useState(false);
    const [runningOnce, setRunningOnce] = useState(false);
    const [schedSaving, setSchedSaving] = useState(false);
    const [testSending, setTestSending] = useState(false);
    const c = config as Record<string, any>;

    // Parse current interval minutes from cron expression
    const currentIntervalMin = (() => {
        const cron = String(c.scheduler_schedule || "");
        const m = cron.match(/^\*\/(\d+)\s/);
        return m ? parseInt(m[1]) : 15;
    })();
    const [intervalValue, setIntervalValue] = useState(currentIntervalMin);

    const [draft, setDraft] = useState({
        VAISALA_URL: "",
        VAISALA_COOKIE: "",
        UPT_FILTER: "",
        SOURCE_MODE: "live",
        BBOX_MARGIN: "0.09",
        NOTIFIER_MODE: "production",
        ALERT_ERROR_THRESHOLD: "5",
        ALERT_COOLDOWN_MIN: "60",
        ALERT_RECOVERY_MIN: "60",
    });

    /* Spreadsheet State */
    const [spreadsheetId, setSpreadsheetId] = useState("");
    const [sheets, setSheets] = useState<string[]>([]);
    const [selectedSheet, setSelectedSheet] = useState("");
    const [headers, setHeaders] = useState<string[]>([]);
    const [rowCount, setRowCount] = useState(0);
    const [loadingSh, setLoadingSh] = useState(false);
    const [loadingHd, setLoadingHd] = useState(false);

    /* Column map */
    const [colMap, setColMap] = useState<Record<string, string>>({
        tower: "", lat: "", lon: "", ultg: "", gi: "", tegangan: "", penghantar: "",
    });

    /* Scheduler state */
    const schedState = String(c.scheduler_state || "UNKNOWN");
    const isPaused = schedState === 'PAUSED' || schedState === '2';
    const isWorkerActive = c.IS_ACTIVE === true || String(c.IS_ACTIVE).toUpperCase() === 'TRUE';

    /* Bootstrap scheduler status on mount */
    const bootstrappedRef = useRef(false);
    useEffect(() => {
        if (bootstrappedRef.current) return;
        bootstrappedRef.current = true;
        if (!c.scheduler_state) controlAction({ action: 'status' }).catch(() => {});
    }, [c.scheduler_state]);

    /* Init from config */
    useEffect(() => {
        if (draftsInitialized.current || !config.VAISALA_URL) return;
        draftsInitialized.current = true;
        setDraft({
            VAISALA_URL: String(config.VAISALA_URL || ""),
            VAISALA_COOKIE: String(config.VAISALA_COOKIE || ""),
            UPT_FILTER: String(config.UPT_FILTER || ""),
            SOURCE_MODE: String(config.SOURCE_MODE || "live"),
            BBOX_MARGIN: String(config.BBOX_MARGIN ?? "0.09"),
            NOTIFIER_MODE: String(config.NOTIFIER_MODE || "production"),
            ALERT_ERROR_THRESHOLD: String(config.ALERT_ERROR_THRESHOLD ?? 5),
            ALERT_COOLDOWN_MIN: String(config.ALERT_COOLDOWN_MIN ?? 60),
            ALERT_RECOVERY_MIN: String(config.ALERT_RECOVERY_MIN ?? 60),
        });
        setSpreadsheetId(String(config.DATA_SPREADSHEET_ID || ""));
        setSelectedSheet(String(config.TOWER_SHEET_SOURCE || ""));
        const existingMap = config.TOWER_COLUMN_MAP as TowerColumnMap | null;
        if (existingMap) setColMap(existingMap as unknown as Record<string, string>);
    }, [config]);

    /* ── Scheduler Controls ── */
    const handleSchedulerAction = useCallback(async (action: string) => {
        setSchedSaving(true);
        try {
            const res = await controlAction({ action });
            const data = await res.json();
            showFeedback(data.ok ? `${action} OK` : `${action} failed: ${data.error}`, !!data.ok);
        } catch {
            showFeedback(`${action} request failed`, false);
        }
        setSchedSaving(false);
    }, [showFeedback]);

    const handleRunOnce = useCallback(async () => {
        setRunningOnce(true);
        try {
            const res = await controlAction({ action: "run_once" });
            const data = await res.json();
            if (data.status === "success") showFeedback(`Run Once OK — ${data.inserted ?? 0} strikes inserted`, true);
            else if (data.status === "no_new_data") showFeedback("Run Once OK — tidak ada data baru", true);
            else if (data.ok === false) showFeedback(`Run Once gagal: ${data.error || "Unknown"}`, false);
            else showFeedback(`Run Once: ${data.status} — ${data.reason || ""}`, false);
        } catch (err) {
            showFeedback(`Run Once gagal: ${err instanceof Error ? err.message : "Unknown"}`, false);
        }
        setRunningOnce(false);
    }, [showFeedback]);

    /* ── Test Send Notifier ── */
    const handleTestSend = useCallback(async () => {
        setTestSending(true);
        try {
            const mode = draft.NOTIFIER_MODE || "production";
            const res = await fetch(`${CLOUD_CONSOLE_API}/services/notifier/actions/test-send`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ mode, message: `[TEST] Thor Gen 3 test — mode: ${mode}` }),
            });
            const data = await res.json();
            showFeedback(data.ok ? `Test berhasil (mode: ${mode})` : `Test gagal: ${data.detail || "Unknown"}`, !!data.ok);
        } catch {
            showFeedback("Test send gagal: request error", false);
        }
        setTestSending(false);
    }, [draft.NOTIFIER_MODE, showFeedback]);

    /* ── Spreadsheet Loaders ── */
    const handleLoadSheets = async () => {
        if (!spreadsheetId.trim()) { showFeedback("Isi Spreadsheet ID dulu", false); return; }
        setLoadingSh(true);
        try {
            const data = await loadSheets(spreadsheetId.trim());
            setSheets(data.sheets);
            if (data.sheets.length > 0) {
                setSelectedSheet(data.sheets[0]);
                showFeedback(`${data.sheets.length} sheets ditemukan`, true);
            }
        } catch (err: any) {
            showFeedback(`Load sheets error: ${err.message}`, false);
        }
        setLoadingSh(false);
    };

    const handleLoadHeaders = async () => {
        if (!spreadsheetId.trim() || !selectedSheet) { showFeedback("Pilih sheet dulu", false); return; }
        setLoadingHd(true);
        try {
            const data = await loadHeaders(spreadsheetId.trim(), selectedSheet);
            setHeaders(data.headers);
            setRowCount(data.rowCount);
            showFeedback(`${data.headers.length} kolom, ${data.rowCount} baris`, true);
        } catch (err: any) {
            showFeedback(`Load headers error: ${err.message}`, false);
        }
        setLoadingHd(false);
    };

    const mappedCount = Object.values(colMap).filter(Boolean).length;
    const requiredCount = TOWER_COLUMN_ROLES.filter(r => r.required).length;
    const requiredMapped = TOWER_COLUMN_ROLES.filter(r => r.required && colMap[r.key]).length;
    const allRequiredMapped = requiredMapped === requiredCount;

    /* ── Save Config ── */
    const handleSave = async () => {
        if (!draft.VAISALA_URL) { showFeedback("VAISALA_URL wajib diisi", false); return; }
        if (!spreadsheetId.trim()) { showFeedback("Spreadsheet ID wajib diisi", false); return; }
        if (!selectedSheet) { showFeedback("Sheet Name belum dipilih", false); return; }
        if (!allRequiredMapped) { showFeedback(`Mapping kolom wajib belum lengkap (${requiredMapped}/${requiredCount})`, false); return; }

        setSaving(true);
        try {
            const testRes = await fetch(`${ACTIONS_API}/test-connection`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url: draft.VAISALA_URL, cookie: draft.VAISALA_COOKIE }),
            });
            const testData = await testRes.json();
            if (!testData.ok && draft.SOURCE_MODE === "live") {
                showFeedback(`Connection failed: ${testData.detail}`, false);
                setSaving(false);
                return;
            }
        } catch {
            if (draft.SOURCE_MODE === "live") {
                showFeedback("Connection test error", false);
                setSaving(false);
                return;
            }
        }

        const ok = await patchConfig({
            VAISALA_URL: draft.VAISALA_URL,
            VAISALA_COOKIE: draft.VAISALA_COOKIE,
            SOURCE_MODE: draft.SOURCE_MODE,
            UPT_FILTER: draft.UPT_FILTER,
            BBOX_MARGIN: parseFloat(draft.BBOX_MARGIN) || 0.09,
            DATA_SPREADSHEET_ID: spreadsheetId.trim(),
            TOWER_SHEET_SOURCE: selectedSheet,
            TOWER_COLUMN_MAP: colMap,
            ALERT_ERROR_THRESHOLD: parseInt(draft.ALERT_ERROR_THRESHOLD) || 5,
            ALERT_COOLDOWN_MIN: parseInt(draft.ALERT_COOLDOWN_MIN) || 60,
            ALERT_RECOVERY_MIN: parseInt(draft.ALERT_RECOVERY_MIN) || 60,
            CONFIG_STATUS: "need_validate",
            CONFIG_REASON: "User: config saved",
        });
        showFeedback(ok ? "Config saved — validasi akan berjalan saat run berikutnya" : "Gagal save config", ok);
        setSaving(false);
    };

    return (
        <div className="space-y-6">
            {/* ── Controls ── inline action bar */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <div className="flex items-center gap-2">
                    <button onClick={async () => {
                            setSaving(true);
                            const ok = await patchConfig({ IS_ACTIVE: !isWorkerActive });
                            showFeedback(ok ? `Worker ${isWorkerActive ? "disabled" : "enabled"}` : "Gagal update", ok);
                            setSaving(false);
                        }} disabled={saving}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all disabled:opacity-50 ${
                            isWorkerActive
                                ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
                                : "bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20"
                        }`}>
                        <Power className="h-3.5 w-3.5" />
                        {isWorkerActive ? "Enabled" : "Disabled"}
                    </button>
                    <button onClick={() => handleSchedulerAction(isPaused ? 'resume' : 'pause')} disabled={schedSaving}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all disabled:opacity-50 ${
                            isPaused
                                ? "bg-emerald-600 text-white hover:bg-emerald-500"
                                : "border border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                        }`}>
                        {isPaused ? <><Play className="h-3.5 w-3.5" />Resume</> : <><Pause className="h-3.5 w-3.5" />Pause</>}
                    </button>
                    <button onClick={() => handleSchedulerAction('trigger')} disabled={schedSaving}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-blue-500/30 text-blue-400 hover:bg-blue-500/10 transition-all disabled:opacity-50">
                        <RefreshCw className={`h-3.5 w-3.5 ${schedSaving ? "animate-spin" : ""}`} />
                        Trigger
                    </button>
                    <button onClick={handleRunOnce} disabled={runningOnce}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 transition-all disabled:opacity-50">
                        {runningOnce ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                        Run Once
                    </button>
                    <button onClick={handleTestSend} disabled={testSending}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-violet-500/30 text-violet-400 hover:bg-violet-500/10 transition-all disabled:opacity-50">
                        {testSending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                        Test Send
                    </button>
                    <button onClick={async () => {
                            setSaving(true);
                            const newMode = draft.NOTIFIER_MODE === 'production' ? 'maintenance' : 'production';
                            const ok = await patchConfig({ NOTIFIER_MODE: newMode });
                            if (ok) setDraft(d => ({ ...d, NOTIFIER_MODE: newMode }));
                            showFeedback(ok ? `Mode → ${newMode}` : "Gagal update mode", ok);
                            setSaving(false);
                        }} disabled={saving}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all disabled:opacity-50 ${
                            draft.NOTIFIER_MODE === 'maintenance'
                                ? "bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20"
                                : "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
                        }`}>
                        <MessageSquare className="h-3.5 w-3.5" />
                        {draft.NOTIFIER_MODE === 'maintenance' ? "Maintenance" : "Production"}
                    </button>
                </div>


                <div className="w-px h-6 bg-border" />

                {/* Interval card */}
                <div className="flex items-center gap-2 rounded-md border border-border/40 bg-muted/10 px-3 py-1.5">
                    <Timer className="h-3.5 w-3.5 text-blue-400/60 shrink-0" />
                    <span className="text-xs text-muted-foreground/60">Interval</span>
                    <div className="flex items-center rounded border border-border/50 bg-background overflow-hidden">
                        <input
                            type="number"
                            min={1}
                            max={60}
                            value={intervalValue}
                            onChange={(e) => setIntervalValue(Math.max(1, Math.min(60, parseInt(e.target.value) || 1)))}
                            className="w-8 h-5 text-xs font-mono bg-transparent text-foreground text-center focus-visible:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <span className="text-xs text-muted-foreground/50 pr-1.5">min</span>
                    </div>
                    <div className="flex flex-col -my-0.5">
                        <button onClick={() => setIntervalValue(v => Math.min(60, v + 1))} className="h-3 px-0.5 text-muted-foreground/40 hover:text-foreground transition-colors">
                            <ChevronUp className="h-2.5 w-2.5" />
                        </button>
                        <button onClick={() => setIntervalValue(v => Math.max(1, v - 1))} className="h-3 px-0.5 text-muted-foreground/40 hover:text-foreground transition-colors">
                            <ChevronDown className="h-2.5 w-2.5" />
                        </button>
                    </div>
                    <button
                        onClick={async () => {
                            setSchedSaving(true);
                            try {
                                const res = await controlAction({ action: 'interval', intervalSec: intervalValue * 60 });
                                const data = await res.json();
                                showFeedback(data.ok ? `Interval → ${intervalValue} min` : `Failed: ${data.error}`, !!data.ok);
                            } catch { showFeedback("Interval update failed", false); }
                            setSchedSaving(false);
                        }}
                        disabled={schedSaving || intervalValue === currentIntervalMin}
                        className="h-5 px-2 text-xs font-medium rounded bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-all disabled:opacity-30"
                    >
                        Set
                    </button>
                </div>
            </div>

            {/* ── Data Source ── */}
            <ServiceSection title="Data Source" icon={<Globe className="h-3.5 w-3.5" />} noCollapse>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                    <div>
                        <label className="text-xs text-muted-foreground/70 mb-0.5 block">Source Mode</label>
                        <select
                            value={draft.SOURCE_MODE}
                            onChange={(e) => setDraft(d => ({ ...d, SOURCE_MODE: e.target.value }))}
                            className="w-full h-8 pl-3 pr-8 text-[12px] rounded-md border border-border/50 bg-background text-foreground focus-visible:outline-none focus-visible:border-blue-500/50 focus-visible:ring-2 focus-visible:ring-blue-500/20 transition-[border-color,box-shadow] duration-150 [&>option]:bg-background [&>option]:text-foreground"
                        >
                            <option value="live">Live</option>
                            <option value="mock">Mock</option>
                        </select>
                    </div>
                    <InputField label="Vaisala URL" value={draft.VAISALA_URL} onChange={(v) => setDraft(d => ({ ...d, VAISALA_URL: v }))} />
                    <InputField label="Vaisala Cookie" value={draft.VAISALA_COOKIE} onChange={(v) => setDraft(d => ({ ...d, VAISALA_COOKIE: v }))} sensitive />
                    <InputField label="UPT Filter" value={draft.UPT_FILTER} onChange={(v) => setDraft(d => ({ ...d, UPT_FILTER: v }))} />
                    <InputField label="BBOX Margin (deg)" value={draft.BBOX_MARGIN} onChange={(v) => setDraft(d => ({ ...d, BBOX_MARGIN: v }))} />
                </div>
            </ServiceSection>

            {/* ── Tower Spreadsheet ── */}
            <ServiceSection title="Tower Spreadsheet" icon={<FileSpreadsheet className="h-3.5 w-3.5" />} noCollapse>
                <div className="space-y-3">
                    <div className="flex items-end gap-2">
                        <div className="flex-1">
                            <InputField 
                                label="Spreadsheet ID (Bisa Paste Full URL)" 
                                value={spreadsheetId} 
                                onChange={v => {
                                    let finalId = v;
                                    const match = v.match(/\/d\/([a-zA-Z0-9-_]+)/);
                                    if (match) finalId = match[1];
                                    setSpreadsheetId(finalId);
                                }} 
                            />
                        </div>
                        <div className="w-48 shrink-0">
                            <label className="text-xs text-muted-foreground/70 mb-0.5 block">Spreadsheet Name</label>
                            <div className="h-8 px-3 flex items-center text-[12px] rounded-md border border-border/30 bg-muted/30 text-muted-foreground truncate">
                                {c.DATA_SPREADSHEET_NAME || '—'}
                            </div>
                        </div>
                        <button onClick={handleLoadSheets} disabled={loadingSh}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-blue-500/30 text-blue-400 hover:bg-blue-500/10 transition-all disabled:opacity-50 h-8">
                            {loadingSh ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                            Load Sheets
                        </button>
                    </div>

                    {sheets.length > 0 && (
                        <div className="flex items-end gap-2">
                            <div className="flex-1">
                                <label className="text-xs text-muted-foreground/70 mb-0.5 block">Sheet Name</label>
                                <select value={selectedSheet} onChange={(e) => setSelectedSheet(e.target.value)}
                                    className="w-full h-8 pl-3 pr-8 text-[12px] rounded-md border border-border/50 bg-background text-foreground focus-visible:outline-none focus-visible:border-blue-500/50 focus-visible:ring-2 focus-visible:ring-blue-500/20 transition-[border-color,box-shadow] duration-150 [&>option]:bg-background [&>option]:text-foreground">
                                    {sheets.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                            <button onClick={handleLoadHeaders} disabled={loadingHd}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10 transition-all disabled:opacity-50 h-8">
                                {loadingHd ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Columns className="h-3.5 w-3.5" />}
                                Load Headers
                            </button>
                        </div>
                    )}
                </div>
            </ServiceSection>

            {/* ── Column Mapping ── */}
            {headers.length > 0 && (
                <ServiceSection title="Column Mapping" icon={<Columns className="h-3.5 w-3.5" />}
                    badge={allRequiredMapped ? `${mappedCount}/7 Mapped` : `${requiredMapped}/${requiredCount} wajib`}
                    badgeColor={allRequiredMapped ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"}
                    noCollapse>
                    <p className="text-xs text-muted-foreground/50 mb-3">
                        Map setiap role ke kolom spreadsheet · {rowCount} baris data · <span className="text-red-400">*</span> = wajib
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
                        {TOWER_COLUMN_ROLES.map(({ key, label, required }) => {
                            const tooltips: Record<string, string> = {
                                tegangan: 'Jika tidak diisi: sistem coba deteksi dari nama tower (regex, misal "SUTET 500kV" → 500). Jika regex juga gagal → tegangan = 0 → kalkulasi BFO tidak bisa dilakukan (return noData).',
                                penghantar: 'Jika tidak diisi: tower tidak bisa dikelompokkan per jalur transmisi → jarak petir ke konduktor (distance_to_conductor) = NULL. Hanya jarak ke tower yang tersedia.',
                            };
                            const tooltip = tooltips[key];
                            return (
                            <div key={key} className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground w-28 shrink-0">
                                    {label}
                                    {required
                                        ? <span className="text-red-400 ml-0.5">*</span>
                                        : <span className="text-muted-foreground/40 ml-1 text-xs">(opsional)</span>
                                    }
                                </span>
                                <select value={colMap[key] || ""} onChange={(e) => setColMap(m => ({ ...m, [key]: e.target.value }))}
                                    className="flex-1 h-7 pl-2 pr-6 text-xs rounded border border-border/50 bg-background text-foreground focus-visible:outline-none focus-visible:border-blue-500/50 transition-[border-color] duration-150 [&>option]:bg-background [&>option]:text-foreground">
                                    <option value="">— {required ? 'Pilih' : 'Tidak dipakai'} —</option>
                                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                                </select>
                                {tooltip && (
                                    <span className="relative group shrink-0">
                                        <Info className="h-3.5 w-3.5 text-amber-400/60 cursor-help" />
                                        <span className="absolute bottom-full right-0 mb-1.5 w-60 p-2.5 rounded-md bg-popover border border-border text-xs text-popover-foreground leading-relaxed shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity duration-150 z-50">
                                            ⚠️ {tooltip}
                                        </span>
                                    </span>
                                )}
                                {colMap[key] && <CheckCircle2 className="h-3 w-3 text-emerald-400/60 shrink-0" />}
                                {!colMap[key] && required && <span className="h-2 w-2 rounded-full bg-red-400/60 shrink-0" />}
                            </div>
                            );
                        })}
                    </div>
                </ServiceSection>
            )}

            {/* ── Alert Thresholds ── */}
            <ServiceSection title="Alert Thresholds" icon={<Shield className="h-3.5 w-3.5" />}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-3">
                    <InputField label="Error Threshold" value={draft.ALERT_ERROR_THRESHOLD} onChange={(v) => setDraft(d => ({ ...d, ALERT_ERROR_THRESHOLD: v }))} />
                    <InputField label="Cooldown (min)" value={draft.ALERT_COOLDOWN_MIN} onChange={(v) => setDraft(d => ({ ...d, ALERT_COOLDOWN_MIN: v }))} />
                    <InputField label="Recovery (min)" value={draft.ALERT_RECOVERY_MIN} onChange={(v) => setDraft(d => ({ ...d, ALERT_RECOVERY_MIN: v }))} />
                </div>
            </ServiceSection>

            {/* ── Save ── */}
            <div className="flex items-center gap-3">
                <button onClick={handleSave} disabled={saving}
                    className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-medium transition-all disabled:opacity-50 ${
                        saving ? "bg-muted text-muted-foreground" : "bg-violet-600 text-white hover:bg-violet-500"
                    }`}>
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    Save Config
                </button>
                <span className="text-xs text-muted-foreground/40">All changes require re-validation</span>
            </div>
        </div>
    );
}
