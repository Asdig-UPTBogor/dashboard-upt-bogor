"use client";

/**
 * Thor Vaisala — Worker Config Display + Validation + Log
 *
 * Runtime config from Firestore via dashboard API.
 * Smart validation: each field shows ✅ / ❌ from backend.
 * Flow: View runtime config → adjust supported toggles → Restart Worker → re-validate
 */

import { useState, useEffect, useCallback } from "react";
import {
    Zap, RefreshCw, Shield, Radio,
    Globe, MapPin, MessageSquare, Settings, Database,
    Eye, EyeOff, ToggleRight, ToggleLeft,
    AlertTriangle, CheckCircle2, XCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/* ── Types ── */
interface ConfigValidation {
    field: string;
    status: 'ok' | 'warning' | 'error';
    message: string;
}

interface ThorConfigData {
    IS_ACTIVE: boolean;
    LAST_FETCH_TS: string;
    MAXCHAT_MODE: string;
    VAISALA_SOURCE_MODE: string;
    VAISALA_EFFECTIVE_URL: string;
    VAISALA_MOCK_URL: string;
    UPT_FILTER: string;
    VAISALA_URL: string;
    VAISALA_COOKIE: string;
    BBOX_MIN_LON: number;
    BBOX_MAX_LON: number;
    BBOX_MIN_LAT: number;
    BBOX_MAX_LAT: number;
    MAXCHAT_URL: string;
    MAXCHAT_TOKEN: string;
    MAXCHAT_GROUP_ID_THOR: string;
    MAXCHAT_GROUP_MAINTENANCE: string;
    DATA_SPREADSHEET_ID: string;
    DATA_SPREADSHEET_NAME: string;
    DATA_SHEET_OUTPUT: string;
    TOWER_SHEET_SOURCE: string;
    COL_ULTG: string;
    COL_GI: string;
    COL_TOWER_NAME: string;
    COL_LAT: string;
    COL_LONG: string;
}

interface ApiResponse {
    status: string;
    config: ThorConfigData | null;
    validations: ConfigValidation[];
    towerCount: number;
    consecutiveErrors: number;
    isFirstRun: boolean;
    lastSyncResult: Record<string, unknown> | null;
}

/* ── Display field with validation marker ── */
function ConfigField({
    label, value, sensitive = false, validation,
}: {
    label: string;
    value: string;
    sensitive?: boolean;
    validation?: ConfigValidation;
}) {
    const [visible, setVisible] = useState(!sensitive);
    const isEmpty = !value;
    const display = isEmpty
        ? "(belum diisi)"
        : sensitive && !visible
            ? "••••••••••"
            : value;

    const borderClass = validation?.status === 'error'
        ? "border-red-500/40 bg-red-500/5"
        : validation?.status === 'warning'
            ? "border-amber-500/40 bg-amber-500/5"
            : validation?.status === 'ok'
                ? "border-emerald-500/20 bg-emerald-500/3"
                : isEmpty
                    ? "border-red-500/20 bg-red-500/5"
                    : "border-border/40 bg-muted/20";

    return (
        <div>
            <label className="text-[10px] text-muted-foreground/70 mb-0.5 block">{label}</label>
            <div className="relative group">
                <div className={`w-full h-8 pl-3 pr-12 flex items-center text-[12px] font-mono rounded-md border select-none overflow-hidden transition-colors ${borderClass} ${isEmpty ? "text-red-400/60" : "text-foreground/80"}`}>
                    <span className="truncate">{display}</span>
                    {validation && (
                        <span className="absolute right-8 top-1/2 -translate-y-1/2">
                            {validation.status === 'ok' && <CheckCircle2 className="h-3 w-3 text-emerald-400" />}
                            {validation.status === 'error' && <XCircle className="h-3 w-3 text-red-400" />}
                            {validation.status === 'warning' && <AlertTriangle className="h-3 w-3 text-amber-400" />}
                        </span>
                    )}
                </div>
                {sensitive && value && (
                    <button
                        type="button"
                        onClick={() => setVisible(!visible)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 opacity-40 hover:opacity-100 transition-opacity"
                    >
                        {visible
                            ? <EyeOff className="h-3 w-3 text-muted-foreground" />
                            : <Eye className="h-3 w-3 text-muted-foreground" />
                        }
                    </button>
                )}
            </div>
            {validation && validation.status !== 'ok' && (
                <p className={`text-[10px] mt-0.5 ${validation.status === 'error' ? 'text-red-400' : 'text-amber-400'}`}>
                    {validation.message}
                </p>
            )}
        </div>
    );
}

/* ═══════════════════════════════════════════════════
   Main Page
   ═══════════════════════════════════════════════════ */
export default function ThorVaisalaPage() {
    const [config, setConfig] = useState<ThorConfigData | null>(null);
    const [validations, setValidations] = useState<ConfigValidation[]>([]);
    const [towerCount, setTowerCount] = useState(0);
    const [consecutiveErrors, setConsecutiveErrors] = useState(0);
    const [lastSync, setLastSync] = useState<Record<string, unknown> | null>(null);
    const [loading, setLoading] = useState(false);
    const [configLoading, setConfigLoading] = useState(true);
    const [statusMsg, setStatusMsg] = useState<string | null>(null);
    const [logs, setLogs] = useState<string[]>([]);
    const [towerStats, setTowerStats] = useState<{ totalRows: number; valid: number; noName: number; noCoords: number; invalidCoords: number; outOfBbox: number; samples: { row: number; name: string; issue: string }[] } | null>(null);

    const addLog = (msg: string) => {
        const ts = new Date().toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour12: false });
        setLogs(prev => [`[${ts}] ${msg}`, ...prev].slice(0, 50));
    };

    const isActive = config?.IS_ACTIVE ?? false;

    // Helper to find validation for a field
    const v = (field: string): ConfigValidation | undefined =>
        validations.find(val => val.field === field);

    // Fetch config + validations from API
    const fetchConfig = useCallback(async () => {
        try {
            setConfigLoading(true);
            addLog('Fetching runtime config dari Firestore...');
            const res = await fetch('/api/cron/thor-sync/config');
            const data = await res.json();

            // New API returns flat config object: { IS_ACTIVE: "TRUE", VAISALA_URL: "...", ... }
            // Convert to typed ThorConfigData
            if (data && !data.error) {
                const cfg: ThorConfigData = {
                    IS_ACTIVE: data.IS_ACTIVE === 'TRUE',
                    LAST_FETCH_TS: data.LAST_FETCH_TS || '',
                    MAXCHAT_MODE: data.MAXCHAT_MODE || '',
                    VAISALA_SOURCE_MODE: data.VAISALA_SOURCE_MODE || 'live',
                    VAISALA_EFFECTIVE_URL: data.VAISALA_EFFECTIVE_URL || data.VAISALA_URL || '',
                    VAISALA_MOCK_URL: data.VAISALA_MOCK_URL || '',
                    UPT_FILTER: data.UPT_FILTER || '',
                    VAISALA_URL: data.VAISALA_URL || '',
                    VAISALA_COOKIE: data.VAISALA_COOKIE || '',
                    BBOX_MIN_LON: parseFloat(data.BBOX_MIN_LON) || 0,
                    BBOX_MAX_LON: parseFloat(data.BBOX_MAX_LON) || 0,
                    BBOX_MIN_LAT: parseFloat(data.BBOX_MIN_LAT) || 0,
                    BBOX_MAX_LAT: parseFloat(data.BBOX_MAX_LAT) || 0,
                    MAXCHAT_URL: data.MAXCHAT_URL || '',
                    MAXCHAT_TOKEN: data.MAXCHAT_TOKEN || '',
                    MAXCHAT_GROUP_ID_THOR: data.MAXCHAT_GROUP_ID_THOR || '',
                    MAXCHAT_GROUP_MAINTENANCE: data.MAXCHAT_GROUP_MAINTENANCE || '',
                    DATA_SPREADSHEET_ID: data.DATA_SPREADSHEET_ID || '',
                    DATA_SPREADSHEET_NAME: data.DATA_SPREADSHEET_NAME || '',
                    DATA_SHEET_OUTPUT: data.DATA_SHEET_OUTPUT || '',
                    TOWER_SHEET_SOURCE: data.TOWER_SHEET_SOURCE || '',
                    COL_ULTG: data.COL_ULTG || '',
                    COL_GI: data.COL_GI || '',
                    COL_TOWER_NAME: data.COL_TOWER_NAME || '',
                    COL_LAT: data.COL_LAT || '',
                    COL_LONG: data.COL_LONG || '',
                };
                setConfig(cfg);
                addLog(`Runtime config loaded: IS_ACTIVE=${cfg.IS_ACTIVE}, MODE=${cfg.MAXCHAT_MODE}, SOURCE=${cfg.VAISALA_SOURCE_MODE}`);

                // Validate config via Thor CR
                addLog('Validating config via Thor CR...');
                try {
                    const vRes = await fetch('/api/cron/thor-sync/validate');
                    const vData = await vRes.json();
                    if (vData.validations) {
                        setValidations(vData.validations);
                        const errors = vData.validations.filter((vi: ConfigValidation) => vi.status === 'error');
                        const ok = vData.validations.filter((vi: ConfigValidation) => vi.status === 'ok');
                        addLog(`Validasi: ${ok.length} OK, ${errors.length} error`);
                        errors.forEach((e: ConfigValidation) => addLog(`❌ ${e.field}: ${e.message}`));
                    }
                    if (vData.towerCount !== undefined) {
                        setTowerCount(vData.towerCount);
                        addLog(`Towers valid: ${vData.towerCount}`);
                    }
                    if (vData.towerStats) {
                        setTowerStats(vData.towerStats);
                        const ts = vData.towerStats;
                        if (ts.noCoords || ts.invalidCoords || ts.outOfBbox) {
                            addLog(`⚠️ Tower issues: ${ts.noCoords} tanpa koordinat, ${ts.invalidCoords} invalid, ${ts.outOfBbox} luar BBOX`);
                        }
                    }
                } catch (vErr) {
                    addLog(`⚠️ Validasi gagal: ${(vErr as Error).message}`);
                }
            } else {
                addLog(`❌ Config error: ${data.error || 'unknown'}`);
            }
        } catch (err) {
            addLog(`❌ Fetch config gagal: ${(err as Error).message}`);
        } finally {
            setConfigLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => { fetchConfig(); }, [fetchConfig]);

    const handleRestart = async () => {
        setLoading(true);
        addLog('Restarting worker (clear cache)...');
        try {
            await fetch('/api/cron/thor-sync/restart', { method: 'POST' });
            addLog('✅ Cache cleared — reloading config...');
            setStatusMsg('Cache cleared — reloading...');
            await fetchConfig();
            addLog('✅ Config reloaded + re-validasi selesai');
        } catch { addLog('❌ Restart gagal'); setStatusMsg('Restart gagal'); }
        finally { setLoading(false); setTimeout(() => setStatusMsg(null), 3000); }
    };

    const toggleActive = async () => {
        const newValue = !isActive;
        setConfig(prev => prev ? { ...prev, IS_ACTIVE: newValue } : prev);
        addLog(`Toggling IS_ACTIVE → ${newValue}`);
        try {
            const res = await fetch('/api/cron/thor-sync/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: 'IS_ACTIVE', value: newValue ? 'TRUE' : 'FALSE' }),
            });
            const data = await res.json();
            if (data.validations) setValidations(data.validations);
            addLog(`✅ IS_ACTIVE → ${newValue}`);
            setStatusMsg(`Worker ${newValue ? 'diaktifkan' : 'dinonaktifkan'}`);
        } catch { addLog('❌ Gagal update IS_ACTIVE'); setStatusMsg('Gagal update'); }
        finally { setTimeout(() => setStatusMsg(null), 3000); }
    };

    const toggleMode = async () => {
        const newMode = config?.MAXCHAT_MODE === 'production' ? 'maintenance' : 'production';
        setConfig(prev => prev ? { ...prev, MAXCHAT_MODE: newMode } : prev);
        addLog(`Toggling MAXCHAT_MODE → ${newMode}`);
        try {
            const res = await fetch('/api/cron/thor-sync/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: 'MAXCHAT_MODE', value: newMode }),
            });
            const data = await res.json();
            if (data.validations) setValidations(data.validations);
            addLog(`✅ MAXCHAT_MODE → ${newMode}`);
            setStatusMsg(`Mode diubah ke ${newMode}`);
        } catch { addLog('❌ Gagal update mode'); setStatusMsg('Gagal update mode'); }
        finally { setTimeout(() => setStatusMsg(null), 3000); }
    };

    const errorCount = validations.filter(val => val.status === 'error').length;
    const warnCount = validations.filter(val => val.status === 'warning').length;

    if (configLoading) {
        return (
            <div className="p-6 max-w-5xl mx-auto flex items-center justify-center gap-3 py-20">
                <RefreshCw className="h-5 w-5 animate-spin text-amber-400" />
                <span className="text-sm text-muted-foreground">Loading runtime config dari Firestore...</span>
            </div>
        );
    }

    return (
            <div className="p-6 max-w-5xl mx-auto space-y-3.5">
                {/* ── Header ── */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15">
                            <Zap className="h-5 w-5 text-amber-400" />
                        </div>
                        <div>
                            <h1 className="text-lg font-semibold text-foreground">Thor Vaisala Cloud Run</h1>
                            <p className="text-[12px] text-muted-foreground">Lightning monitor · Firestore runtime config · Realtime worker</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Badge
                            variant={isActive ? "default" : "secondary"}
                            className={`text-[10px] ${isActive ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" : ""}`}
                        >
                            {isActive ? "Active" : "Disabled"}
                        </Badge>
                        {errorCount > 0 && (
                            <Badge variant="destructive" className="text-[10px]">
                                {errorCount} Error
                            </Badge>
                        )}
                        {warnCount > 0 && (
                            <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-400">
                                {warnCount} Warning
                            </Badge>
                        )}
                        <Badge
                            variant="outline"
                            className={`text-[10px] ${
                                config?.VAISALA_SOURCE_MODE === "mock"
                                    ? "border-fuchsia-500/30 text-fuchsia-400"
                                    : "border-sky-500/30 text-sky-400"
                            }`}
                        >
                            Source: {config?.VAISALA_SOURCE_MODE === "mock" ? "Mock" : "Live"}
                        </Badge>
                        <Button
                            size="sm" variant="outline"
                            onClick={handleRestart} disabled={loading}
                            className="text-[11px] h-7"
                        >
                            <RefreshCw className={`h-3 w-3 mr-1 ${loading ? "animate-spin" : ""}`} /> Restart Worker
                        </Button>
                    </div>
                </div>

                {/* ── Status Message ── */}
                {statusMsg && (
                    <div className="rounded-md border border-blue-500/20 bg-blue-500/5 px-3 py-2 text-[11px] text-blue-400">
                        {statusMsg}
                    </div>
                )}

                {/* ── Validation Summary Banner ── */}
                {errorCount > 0 && (
                    <div className="rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2.5">
                        <div className="flex items-center gap-2 text-[11px] text-red-400 font-medium mb-1">
                            <XCircle className="h-3.5 w-3.5" />
                            Config Error — Worker tidak bisa jalan
                        </div>
                        <ul className="text-[10px] text-red-400/80 space-y-0.5 ml-5">
                            {validations.filter(val => val.status === 'error').map((val, i) => (
                                <li key={i}>• <strong>{val.field}</strong>: {val.message}</li>
                            ))}
                        </ul>
                        <p className="text-[10px] text-red-400/60 mt-1.5 ml-5">
                            Fix di Firestore runtime config → Restart Worker → Re-validasi otomatis
                        </p>
                    </div>
                )}

                {/* ── Config Card ── */}
                <Card className="gap-3">
                    <CardHeader className="pb-1">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-sm flex items-center gap-2">
                                <Settings className="h-4 w-4 text-muted-foreground" />
                                Thor Vaisala Cloud Run Config
                            </CardTitle>
                            <span className="text-[9px] text-muted-foreground/40">
                                Dynamic · runtime Firestore
                            </span>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-3.5">
                        {/* Status + Mode */}
                        <div className="flex flex-wrap items-end gap-3">
                            <div>
                                <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block">Worker Status</label>
                                <button
                                    onClick={toggleActive}
                                    className={`inline-flex items-center gap-1.5 h-7 px-3 rounded-md border text-[11px] font-medium cursor-pointer transition-all hover:opacity-80
                                        ${isActive
                                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                                            : "bg-red-500/10 border-red-500/30 text-red-400"
                                        }`}
                                >
                                    {isActive ? <><ToggleRight className="h-3.5 w-3.5" /> ON</> : <><ToggleLeft className="h-3.5 w-3.5" /> OFF</>}
                                </button>
                            </div>
                            <div>
                                <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block">Mode</label>
                                <button
                                    onClick={toggleMode}
                                    className={`inline-flex items-center gap-1.5 h-7 px-3 rounded-md border text-[11px] font-medium cursor-pointer transition-all hover:opacity-80
                                        ${config?.MAXCHAT_MODE === "production"
                                            ? "bg-blue-500/10 border-blue-500/30 text-blue-400"
                                            : "bg-amber-500/10 border-amber-500/30 text-amber-400"
                                        }`}
                                >
                                    {config?.MAXCHAT_MODE === "production"
                                        ? <><Radio className="h-3 w-3" /> Production</>
                                        : <><Radio className="h-3 w-3" /> Maintenance</>
                                    }
                                </button>
                            </div>
                            <div>
                                <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block">Vaisala Source</label>
                                <div
                                    className={`inline-flex items-center gap-1.5 h-7 px-3 rounded-md border text-[11px] font-medium ${
                                        config?.VAISALA_SOURCE_MODE === "mock"
                                            ? "bg-fuchsia-500/10 border-fuchsia-500/30 text-fuchsia-400"
                                            : "bg-sky-500/10 border-sky-500/30 text-sky-400"
                                    }`}
                                >
                                    <Globe className="h-3 w-3" />
                                    {config?.VAISALA_SOURCE_MODE === "mock" ? "Mock CR" : "Live Vaisala"}
                                </div>
                            </div>
                        </div>

                        <div className="border-t border-border" />

                        {/* Data Storage */}
                        <div>
                            <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                                <Database className="h-3 w-3" /> Data Storage
                            </h3>
                            <div className="grid grid-cols-1 gap-2.5">
                                <div className="grid grid-cols-2 gap-2.5">
                                    <ConfigField label="Spreadsheet" value={config?.DATA_SPREADSHEET_NAME || ''} validation={v('DATA_SPREADSHEET_ID')} />
                                    <ConfigField label="Spreadsheet ID" value={config?.DATA_SPREADSHEET_ID || ''} sensitive validation={v('DATA_SPREADSHEET_ID')} />
                                </div>
                                <div className="grid grid-cols-2 gap-2.5">
                                    <ConfigField label="Sheet Output (Append)" value={config?.DATA_SHEET_OUTPUT || ''} validation={v('DATA_SHEET_OUTPUT')} />
                                    <ConfigField label="Sheet Tower Source (Read)" value={config?.TOWER_SHEET_SOURCE || ''} validation={v('TOWER_SHEET_SOURCE')} />
                                </div>
                                <div className="grid grid-cols-5 gap-2.5">
                                    <ConfigField label="Kolom ULTG" value={config?.COL_ULTG || ''} />
                                    <ConfigField label="Kolom GI" value={config?.COL_GI || ''} />
                                    <ConfigField label="Kolom Tower" value={config?.COL_TOWER_NAME || ''} />
                                    <ConfigField label="Kolom LAT" value={config?.COL_LAT || ''} />
                                    <ConfigField label="Kolom LONG" value={config?.COL_LONG || ''} />
                                </div>
                            </div>
                        </div>

                        <div className="border-t border-border" />

                        {/* Vaisala API */}
                        <div>
                            <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                                <Globe className="h-3 w-3" /> Vaisala API
                            </h3>
                            <div className="grid grid-cols-1 gap-2.5">
                                <div className="grid grid-cols-2 gap-2.5">
                                    <ConfigField label="Source Mode" value={config?.VAISALA_SOURCE_MODE || 'live'} validation={v('VAISALA_SOURCE_MODE')} />
                                    <ConfigField label="UPT Filter" value={config?.UPT_FILTER || ''} validation={v('UPT_FILTER')} />
                                </div>
                                <div className="grid grid-cols-2 gap-2.5">
                                    <ConfigField label="Live API URL" value={config?.VAISALA_URL || ''} validation={v('VAISALA_URL')} />
                                    <ConfigField label="Mock API URL" value={config?.VAISALA_MOCK_URL || ''} validation={v('VAISALA_MOCK_URL')} />
                                </div>
                                <div className="grid grid-cols-1 gap-2.5">
                                    <ConfigField label="Effective URL" value={config?.VAISALA_EFFECTIVE_URL || ''} />
                                </div>
                                <ConfigField label="Cookie" value={config?.VAISALA_COOKIE || ''} sensitive validation={v('VAISALA_COOKIE')} />
                            </div>
                        </div>

                        <div className="border-t border-border" />

                        {/* Bounding Box */}
                        <div>
                            <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                                <MapPin className="h-3 w-3" /> Bounding Box
                            </h3>
                            <div className="grid grid-cols-4 gap-2.5">
                                <ConfigField label="Min Lon" value={String(config?.BBOX_MIN_LON ?? '')} validation={v('BBOX_LON') || v('BBOX')} />
                                <ConfigField label="Max Lon" value={String(config?.BBOX_MAX_LON ?? '')} validation={v('BBOX_LON') || v('BBOX')} />
                                <ConfigField label="Min Lat" value={String(config?.BBOX_MIN_LAT ?? '')} validation={v('BBOX_LAT') || v('BBOX')} />
                                <ConfigField label="Max Lat" value={String(config?.BBOX_MAX_LAT ?? '')} validation={v('BBOX_LAT') || v('BBOX')} />
                            </div>
                        </div>

                        <div className="border-t border-border" />

                        {/* WhatsApp */}
                        <div>
                            <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                                <MessageSquare className="h-3 w-3" /> WhatsApp (MaxChat)
                            </h3>
                            <div className="grid grid-cols-1 gap-2.5">
                                <ConfigField label="API URL" value={config?.MAXCHAT_URL || ''} />
                                <ConfigField label="Token" value={config?.MAXCHAT_TOKEN || ''} sensitive />
                                <div className="grid grid-cols-2 gap-2.5">
                                    <ConfigField label="Group ID (Production)" value={config?.MAXCHAT_GROUP_ID_THOR || ''} sensitive validation={v('MAXCHAT_GROUP_ID_THOR')} />
                                    <ConfigField label="Group ID (Maintenance)" value={config?.MAXCHAT_GROUP_MAINTENANCE || ''} sensitive />
                                </div>
                            </div>
                        </div>

                        <div className="border-t border-border" />

                        {/* Tower Monitoring */}
                        <div>
                            <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                                <Shield className="h-3 w-3" /> Tower Monitoring
                            </h3>
                            <div className="grid grid-cols-1 gap-2.5">
                                <div className="grid grid-cols-3 gap-2.5">
                                    <ConfigField
                                        label="Total Tower (Sheet)"
                                        value={towerStats ? String(towerStats.totalRows) : '—'}
                                    />
                                    <ConfigField
                                        label="Tower Valid (Monitored)"
                                        value={towerStats ? String(towerStats.valid) : String(towerCount || '—')}
                                        validation={v('TOWER_DATA')}
                                    />
                                    <ConfigField
                                        label="Tower Excluded"
                                        value={towerStats ? String(towerStats.totalRows - towerStats.valid) : '—'}
                                        validation={towerStats && (towerStats.totalRows - towerStats.valid) > 0
                                            ? { field: 'excluded', status: 'warning', message: `${towerStats.outOfBbox} luar BBOX${towerStats.noCoords ? `, ${towerStats.noCoords} tanpa koordinat` : ''}${towerStats.invalidCoords ? `, ${towerStats.invalidCoords} invalid` : ''}` }
                                            : undefined
                                        }
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-2.5">
                                    <ConfigField
                                        label="Last Fetch"
                                        value={config?.LAST_FETCH_TS || '—'}
                                    />
                                    <ConfigField
                                        label="Last Sync Status"
                                        value={validations.some(vi => vi.status === 'error') ? 'Config Error' : towerStats ? `${towerStats.valid} towers ready` : '—'}
                                        validation={validations.some(vi => vi.status === 'error')
                                            ? { field: 'status', status: 'error', message: 'Fix config errors sebelum sync' }
                                            : towerStats ? { field: 'status', status: 'ok', message: 'Siap monitoring' } : undefined
                                        }
                                    />
                                </div>
                            </div>

                            {/* Tower quality detail */}
                            {towerStats && (towerStats.noCoords > 0 || towerStats.invalidCoords > 0 || towerStats.outOfBbox > 0) && (
                                <div className="rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2 mt-2.5">
                                    <p className="text-[10px] text-amber-400 font-medium mb-1">⚠️ Tower Excluded Detail</p>
                                    <div className="flex gap-4 text-[10px] text-amber-400/70">
                                        {towerStats.outOfBbox > 0 && <span>{towerStats.outOfBbox} di luar BBOX</span>}
                                        {towerStats.noCoords > 0 && <span>{towerStats.noCoords} tanpa koordinat</span>}
                                        {towerStats.invalidCoords > 0 && <span>{towerStats.invalidCoords} koordinat invalid</span>}
                                        {towerStats.noName > 0 && <span>{towerStats.noName} tanpa nama</span>}
                                    </div>
                                    {towerStats.samples.length > 0 && (
                                        <ul className="text-[9px] text-amber-400/50 mt-1 space-y-0.5">
                                            {towerStats.samples.map((s, i) => (
                                                <li key={i}>Row {s.row}: {s.name} — {s.issue}</li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
                {/* ── Info Card ── */}
                <Card>
                    <CardContent className="py-4">
                        <div className="flex items-start gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 shrink-0 mt-0.5">
                                <Shield className="h-4 w-4 text-blue-400" />
                            </div>
                            <div>
                                <h3 className="text-[12px] font-semibold text-foreground mb-1">Cara Kerja</h3>
                                <ul className="text-[11px] text-muted-foreground space-y-1">
                                    <li>• Config di atas = <strong className="text-foreground/80">runtime value</strong> yang sedang digunakan worker</li>
                                    <li>• Toggle <strong className="text-foreground/80">Worker Status</strong> dan <strong className="text-foreground/80">Mode</strong> akan update runtime config langsung</li>
                                    <li>• Setelah ada perubahan → klik <strong className="text-foreground/80">Restart Worker</strong> agar cache config ter-reload</li>
                                    <li>• Data petir di-append ke sheet <strong className="text-foreground/80">{config?.DATA_SHEET_OUTPUT || '1.DATA PETIR'}</strong>, tower dibaca dari <strong className="text-foreground/80">{config?.TOWER_SHEET_SOURCE || 'MASTER ASSET TOWER'}</strong></li>
                                </ul>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <p className="text-center text-[10px] text-muted-foreground/40">
                    Thor Vaisala Sync · Runtime config stored in Firestore
                </p>
            </div>
    );
}
