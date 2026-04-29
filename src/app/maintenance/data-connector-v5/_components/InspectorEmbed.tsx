/**
 * Data Source Manager V5 — Read-Only Inspector (V2 shape, 2026-04-23)
 *
 * Source of truth: Firestore `data_sources_v2/` + BigQuery `ss_platform.*`.
 *
 * Layout:
 *   [Sidebar: list Spreadsheet] | [Detail Pane: 4 tabs — Overview / Sheets / Rejected / Drift]
 *
 * Zero mutation — all actions di Cloud Console /cloud-console/spreadsheet-sync.
 */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import {
    FileSpreadsheet, Layers, AlertTriangle, Clock, ExternalLink,
    Database, Loader2, CheckCircle2, Activity, Zap, AlertCircle,
} from "lucide-react";

type Tab = "overview" | "sheets" | "rejected" | "drift";

interface SpreadsheetSummary {
    id: string;
    driveId: string;
    name: string;
    url: string;
    bqDataset: string;
    isMasterHierarchy: boolean;
    syncEnabled: boolean;
    syncStatus: string;
    sheetCount: number;
    lastSyncAt: string | null;
    updatedAt: string | null;
}

interface SheetDetail {
    sheetTabId: string;
    tabName: string;
    bqTable: string;
    levelRef: string | null;
    schema: {
        columns: string[];
        skippedColumns: string[];
    };
    syncState: {
        contentHash: string | null;
        lastSyncAt: string | null;
        rowCount: number;
        rowCountValid: number;
        rowCountRejected: number;
        syncStatus: string;
        driftEventId: string | null;
        lastSyncStatus: string | null;
    };
    recentHistory: Array<{
        run_id: string;
        started_at: string;
        status: string;
        skipped_reason?: string;
        rows_read: number;
        rows_written: number;
        rows_rejected: number;
        duration_ms: number;
        error_message?: string;
    }>;
    rejectedSample: Array<{
        rejection_key: string;
        row_pk_value: string;
        row_number: number;
        column_name: string;
        cell_value: string | null;
        reason_code: string;
        reason_message: string | null;
        first_seen_at: string;
        last_seen_at: string;
    }>;
    bqTableMeta: {
        exists: boolean;
        rowCount: number;
        sizeBytes: number;
        updatedAt: string | null;
        schemaFieldCount: number;
    };
}

interface DriftAlert {
    level: "high" | "medium" | "low";
    sheet: string;
    kind: string;
    detail: string;
}

interface InspectorDataV2 {
    spreadsheet: {
        id: string;
        driveId: string;
        name: string;
        url: string;
        bqDataset: string;
        isMasterHierarchy: boolean;
        syncEnabled: boolean;
        syncStatus: string;
        lastDriveModified: string | null;
        lastSyncAt: string | null;
        sheetCount: number;
        createdAt: string | null;
        updatedAt: string | null;
        configuredAt: string | null;
    };
    sheets: SheetDetail[];
    driftAlerts: DriftAlert[];
    driveMeta: any;
}

function fmtNum(n: number): string {
    return Number(n).toLocaleString("id-ID");
}

function fmtWIB(iso: string | null | undefined): string {
    if (!iso) return "—";
    try {
        return new Date(iso).toLocaleString("id-ID", {
            timeZone: "Asia/Jakarta",
            hour12: false,
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
        });
    } catch {
        return String(iso);
    }
}

function fmtAgo(iso: string | null | undefined): string {
    if (!iso) return "—";
    const d = Date.now() - new Date(iso).getTime();
    if (d < 0) return "—";
    if (d < 60_000) return `${Math.floor(d / 1000)}s`;
    if (d < 3_600_000) return `${Math.floor(d / 60_000)}m`;
    if (d < 86_400_000) return `${Math.floor(d / 3_600_000)}h`;
    return `${Math.floor(d / 86_400_000)}d`;
}

function fmtBytes(b: number): string {
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

export function InspectorEmbed() {
    return (
        <ErrorBoundary label="DataSourceManagerPage">
            <DataSourceManagerPage />
        </ErrorBoundary>
    );
}

function DataSourceManagerPage() {
    const [summaries, setSummaries] = useState<SpreadsheetSummary[]>([]);
    const [loadingList, setLoadingList] = useState(true);
    const [selectedDriveId, setSelectedDriveId] = useState<string | null>(null);
    const [inspector, setInspector] = useState<InspectorDataV2 | null>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [tab, setTab] = useState<Tab>("overview");
    const [activeSheetTabId, setActiveSheetTabId] = useState<string | null>(null);

    // Load list
    useEffect(() => {
        setLoadingList(true);
        fetch("/api/dsm-v5/inspector")
            .then((r) => r.json())
            .then((j) => {
                if (j.ok && Array.isArray(j.spreadsheets)) {
                    setSummaries(j.spreadsheets);
                } else {
                    console.error("[DSM] list API returned unexpected shape:", j);
                    setSummaries([]);
                }
            })
            .catch((e) => {
                console.error("[DSM] list fetch failed:", e);
                setSummaries([]);
            })
            .finally(() => setLoadingList(false));
    }, []);

    // Load detail on select
    const loadDetail = useCallback(async (driveId: string) => {
        setLoadingDetail(true);
        setInspector(null);
        try {
            const r = await fetch(`/api/dsm-v5/inspector?spreadsheetId=${encodeURIComponent(driveId)}`);
            const j = await r.json();
            if (j.ok && j.spreadsheet && Array.isArray(j.sheets)) {
                const normalized: InspectorDataV2 = {
                    spreadsheet: j.spreadsheet,
                    sheets: j.sheets,
                    driftAlerts: Array.isArray(j.driftAlerts) ? j.driftAlerts : [],
                    driveMeta: j.driveMeta ?? null,
                };
                setInspector(normalized);
                setActiveSheetTabId(normalized.sheets[0]?.sheetTabId ?? null);
            } else {
                console.error("[DSM] detail API returned unexpected shape:", j);
            }
        } catch (e) {
            console.error("[DSM] detail fetch failed:", e);
        } finally {
            setLoadingDetail(false);
        }
    }, []);

    useEffect(() => {
        if (selectedDriveId) loadDetail(selectedDriveId);
    }, [selectedDriveId, loadDetail]);

    const activeSheetData = useMemo(
        () => (inspector?.sheets ?? []).find((s) => s.sheetTabId === activeSheetTabId) ?? null,
        [inspector, activeSheetTabId]
    );

    const insp = inspector;
    const inspSheets = insp?.sheets ?? [];
    const inspDriftAlerts = insp?.driftAlerts ?? [];
    const inspSpreadsheet = insp?.spreadsheet;

    return (
        <div className="mx-auto max-w-7xl p-6">
            <header className="mb-6">
                <h1 className="ds-heading">Data Source Manager (V2)</h1>
                <p className="ds-small mt-1">
                    Read-only inspector — audit BQ state, rejected rows, drift, sync history per spreadsheet.
                </p>
                <p className="ds-small opacity-80 mt-1">
                    <AlertCircle className="inline h-3 w-3 mr-1 text-amber-400" />
                    Untuk kontrol (pause/resume/trigger) buka{" "}
                    <a href="/cloud-console/spreadsheet-sync" className="text-blue-400 hover:text-blue-300">
                        Cloud Console
                    </a>
                </p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
                {/* ═══════════ Sidebar: Spreadsheet List ═══════════ */}
                <Card className="self-start">
                    <h2 className="ds-title mb-3">Spreadsheet ({summaries.length})</h2>
                    {loadingList ? (
                        <div className="flex items-center justify-center py-6 ds-body">
                            <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading…
                        </div>
                    ) : summaries.length === 0 ? (
                        <p className="ds-small opacity-60 italic">Belum ada Spreadsheet di data_sources_v2</p>
                    ) : (
                        <div className="space-y-1 max-h-[70vh] overflow-y-auto">
                            {summaries.map((s) => {
                                const isActive = selectedDriveId === s.driveId;
                                return (
                                    <button
                                        key={s.id}
                                        type="button"
                                        onClick={() => setSelectedDriveId(s.driveId)}
                                        className={`ds-transition cursor-pointer w-full text-left rounded-md px-3 py-2 border ${
                                            isActive
                                                ? "bg-blue-500/15 border-blue-500/40"
                                                : "border-border/40 bg-muted/5 hover:bg-muted/20"
                                        }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <FileSpreadsheet className="h-3.5 w-3.5 text-blue-400/70 shrink-0" />
                                            <span className="ds-label truncate">{s.name}</span>
                                            {s.isMasterHierarchy && (
                                                <span className="ds-label rounded bg-indigo-500/15 text-indigo-400 px-1.5 py-0.5 uppercase tracking-wider ml-auto">
                                                    M
                                                </span>
                                            )}
                                        </div>
                                        <div className="ds-small font-mono opacity-70 truncate mt-0.5">{s.bqDataset}</div>
                                        <div className="ds-small opacity-60 mt-0.5">{s.sheetCount} Lembar · {s.syncStatus}</div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </Card>

                {/* ═══════════ Detail Pane ═══════════ */}
                <div>
                    {!selectedDriveId && (
                        <Card>
                            <div className="text-center py-12 ds-body opacity-60">
                                <Database className="h-10 w-10 mx-auto mb-3 opacity-30" />
                                Pilih Spreadsheet dari sidebar untuk inspect detail.
                            </div>
                        </Card>
                    )}

                    {selectedDriveId && loadingDetail && (
                        <Card>
                            <div className="flex items-center justify-center py-12 ds-body">
                                <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading inspector…
                            </div>
                        </Card>
                    )}

                    {selectedDriveId && insp && !loadingDetail && (
                        <>
                            {/* Header card */}
                            <Card className="mb-4">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="min-w-0 flex-1">
                                        <h2 className="ds-title truncate">{inspSpreadsheet?.name}</h2>
                                        <p className="ds-small font-mono opacity-70 mt-0.5 truncate">
                                            {inspSpreadsheet?.bqDataset}
                                        </p>
                                        <div className="flex flex-wrap items-center gap-2 mt-2">
                                            <Badge color={inspSpreadsheet?.syncEnabled ? "emerald" : "amber"}>
                                                {inspSpreadsheet?.syncEnabled ? "Sync ON" : "Sync OFF"}
                                            </Badge>
                                            <Badge color={statusBadgeColor(inspSpreadsheet?.syncStatus)}>
                                                {inspSpreadsheet?.syncStatus ?? "idle"}
                                            </Badge>
                                            {inspSpreadsheet?.isMasterHierarchy && (
                                                <Badge color="indigo">Master Hierarchy</Badge>
                                            )}
                                            <Badge color="slate">{inspSpreadsheet?.sheetCount} Lembar</Badge>
                                            {inspDriftAlerts.length > 0 && (
                                                <Badge color="red">{inspDriftAlerts.length} Alert</Badge>
                                            )}
                                        </div>
                                    </div>
                                    {inspSpreadsheet?.url && (
                                        <a
                                            href={inspSpreadsheet?.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="ds-label ds-transition cursor-pointer inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 hover:bg-muted/20"
                                        >
                                            <ExternalLink className="h-3.5 w-3.5" /> Buka Sheet
                                        </a>
                                    )}
                                </div>
                            </Card>

                            {/* Tabs */}
                            <div className="flex gap-1 mb-3 border-b border-border/40">
                                {[
                                    { id: "overview", label: "Overview", icon: Activity },
                                    { id: "sheets", label: `Lembar (${inspSheets.length})`, icon: Layers },
                                    { id: "rejected", label: "Rejected", icon: AlertTriangle },
                                    { id: "drift", label: `Drift & History ${inspDriftAlerts.length > 0 ? `(${inspDriftAlerts.length})` : ""}`, icon: Zap },
                                ].map((t) => {
                                    const Icon = t.icon;
                                    return (
                                        <button
                                            key={t.id}
                                            type="button"
                                            onClick={() => setTab(t.id as Tab)}
                                            className={`ds-label ds-transition cursor-pointer inline-flex items-center gap-1.5 rounded-t-md px-3 py-2 border-b-2 ${
                                                tab === t.id
                                                    ? "border-blue-400 text-blue-400"
                                                    : "border-transparent opacity-70 hover:opacity-100"
                                            }`}
                                        >
                                            <Icon className="h-3.5 w-3.5" />
                                            {t.label}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Tab content */}
                            {tab === "overview" && <OverviewTab inspector={insp} />}
                            {tab === "sheets" && (
                                <SheetsTab
                                    sheets={inspSheets}
                                    activeSheetTabId={activeSheetTabId}
                                    onChangeActive={setActiveSheetTabId}
                                    activeSheetData={activeSheetData}
                                />
                            )}
                            {tab === "rejected" && <RejectedTab sheets={inspSheets} driveId={inspSpreadsheet?.driveId ?? ""} />}
                            {tab === "drift" && <DriftTab alerts={inspDriftAlerts} sheets={inspSheets} />}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

/* ════════════════ TABS ════════════════ */

function OverviewTab({ inspector }: { inspector: InspectorDataV2 }) {
    const totals = inspector.sheets.reduce(
        (acc, s) => ({
            totalRows: acc.totalRows + (s.syncState.rowCount ?? 0),
            validRows: acc.validRows + (s.syncState.rowCountValid ?? 0),
            rejectedRows: acc.rejectedRows + (s.syncState.rowCountRejected ?? 0),
            bqBytes: acc.bqBytes + s.bqTableMeta.sizeBytes,
        }),
        { totalRows: 0, validRows: 0, rejectedRows: 0, bqBytes: 0 }
    );

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <Stat label="Lembar" value={inspector.sheets.length} />
                <Stat label="Total Row" value={fmtNum(totals.totalRows)} />
                <Stat label="Valid" value={fmtNum(totals.validRows)} color="emerald" />
                <Stat label="Rejected" value={fmtNum(totals.rejectedRows)} color="amber" alert={totals.rejectedRows > 0} />
            </div>

            <Card>
                <h3 className="ds-title mb-3">Ringkasan Lembar</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-border/40">
                                <th className="ds-small uppercase tracking-wider px-3 py-2">Lembar</th>
                                <th className="ds-small uppercase tracking-wider px-3 py-2">BQ Table</th>
                                <th className="ds-small uppercase tracking-wider px-3 py-2">Level Ref</th>
                                <th className="ds-small uppercase tracking-wider px-3 py-2 text-right">Row</th>
                                <th className="ds-small uppercase tracking-wider px-3 py-2 text-right">Valid</th>
                                <th className="ds-small uppercase tracking-wider px-3 py-2 text-right">Rejected</th>
                                <th className="ds-small uppercase tracking-wider px-3 py-2">Last Sync</th>
                                <th className="ds-small uppercase tracking-wider px-3 py-2">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {inspector.sheets.map((s) => (
                                <tr key={s.sheetTabId} className="border-b border-border/20 hover:bg-muted/10">
                                    <td className="ds-label px-3 py-2 truncate max-w-[200px]">{s.tabName}</td>
                                    <td className="ds-data opacity-80 px-3 py-2 truncate max-w-[180px]">{s.bqTable}</td>
                                    <td className="ds-data px-3 py-2">
                                        {s.levelRef ? (
                                            <span className="ds-small font-mono opacity-80 truncate">{s.levelRef}</span>
                                        ) : (
                                            <span className="ds-small opacity-40 italic">unset</span>
                                        )}
                                    </td>
                                    <td className="ds-data text-right px-3 py-2 opacity-80">
                                        {fmtNum(s.syncState.rowCount)}
                                    </td>
                                    <td className="ds-data text-right px-3 py-2 text-emerald-400">
                                        {fmtNum(s.syncState.rowCountValid)}
                                    </td>
                                    <td className="ds-data text-right px-3 py-2 text-amber-400">
                                        {fmtNum(s.syncState.rowCountRejected)}
                                    </td>
                                    <td className="ds-small px-3 py-2 opacity-80">
                                        {s.syncState.lastSyncAt ? `${fmtAgo(s.syncState.lastSyncAt)} ago` : "—"}
                                    </td>
                                    <td className="ds-data px-3 py-2">
                                        <Badge color={statusBadgeColor(s.syncState.lastSyncStatus ?? s.syncState.syncStatus)}>
                                            {s.syncState.lastSyncStatus ?? s.syncState.syncStatus}
                                        </Badge>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>

            {inspector.driveMeta && (
                <Card>
                    <h3 className="ds-title mb-3">Drive Metadata (last scan)</h3>
                    <dl className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        <Field label="Modified" value={fmtWIB(inspector.driveMeta.modified_time?.value ?? inspector.driveMeta.modified_time)} />
                        <Field label="Owner" value={inspector.driveMeta.owner_email ?? "—"} />
                        <Field label="Last Editor" value={inspector.driveMeta.last_modified_by ?? "—"} />
                    </dl>
                </Card>
            )}

            <Card>
                <h3 className="ds-title mb-3">BQ Storage</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <Stat label="Total Storage" value={fmtBytes(totals.bqBytes)} />
                    <Stat label="Avg per Sheet" value={fmtBytes(totals.bqBytes / Math.max(1, inspector.sheets.length))} />
                    <Stat label="Dataset" value={inspector.spreadsheet?.bqDataset} mono />
                    <Stat label="Tables" value={inspector.sheets.filter((s) => s.bqTableMeta.exists).length} />
                </div>
            </Card>
        </div>
    );
}

function SheetsTab({
    sheets,
    activeSheetTabId,
    onChangeActive,
    activeSheetData,
}: {
    sheets: SheetDetail[];
    activeSheetTabId: string | null;
    onChangeActive: (s: string) => void;
    activeSheetData: SheetDetail | null;
}) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-4">
            <Card>
                <h3 className="ds-label uppercase tracking-wider mb-2">Pilih Lembar</h3>
                <div className="space-y-1 max-h-[60vh] overflow-y-auto">
                    {sheets.map((s) => (
                        <button
                            key={s.sheetTabId}
                            type="button"
                            onClick={() => onChangeActive(s.sheetTabId)}
                            className={`ds-transition cursor-pointer w-full text-left rounded px-2 py-1.5 ${
                                activeSheetTabId === s.sheetTabId
                                    ? "bg-blue-500/15 text-blue-400"
                                    : "hover:bg-muted/20"
                            }`}
                        >
                            <div className="ds-label truncate">{s.tabName}</div>
                            <div className="ds-small opacity-70">
                                {fmtNum(s.syncState.rowCount)} row · {s.levelRef ? "level set" : "no level"}
                            </div>
                        </button>
                    ))}
                </div>
            </Card>

            {activeSheetData ? (
                <Card>
                    <h3 className="ds-title mb-3">{activeSheetData.tabName}</h3>
                    <dl className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                        <Field label="Sheet Tab ID" value={activeSheetData.sheetTabId} mono />
                        <Field label="BQ Table" value={activeSheetData.bqTable} mono />
                        <Field label="Level Ref" value={activeSheetData.levelRef ?? "unset"} mono />
                        <Field label="BQ Row Count" value={fmtNum(activeSheetData.bqTableMeta.rowCount)} />
                        <Field label="BQ Size" value={fmtBytes(activeSheetData.bqTableMeta.sizeBytes)} />
                        <Field label="BQ Columns" value={String(activeSheetData.bqTableMeta.schemaFieldCount)} />
                    </dl>

                    {activeSheetData.schema?.skippedColumns?.length > 0 && (
                        <div className="mb-4">
                            <h4 className="ds-label uppercase tracking-wider mb-2">Skipped Columns (header kosong, G10)</h4>
                            <div className="flex flex-wrap gap-1">
                                {activeSheetData.schema.skippedColumns.map((col) => (
                                    <span
                                        key={col}
                                        className="ds-data rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 px-2 py-0.5"
                                    >
                                        {col}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    <h4 className="ds-label uppercase tracking-wider mb-2">Recent Sync (10 terakhir)</h4>
                    {activeSheetData.recentHistory.length === 0 ? (
                        <p className="ds-small opacity-60 italic">Belum ada sync history</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b border-border/40">
                                        <th className="ds-small uppercase tracking-wider px-3 py-1.5">Started</th>
                                        <th className="ds-small uppercase tracking-wider px-3 py-1.5">Status</th>
                                        <th className="ds-small uppercase tracking-wider px-3 py-1.5 text-right">Read</th>
                                        <th className="ds-small uppercase tracking-wider px-3 py-1.5 text-right">Written</th>
                                        <th className="ds-small uppercase tracking-wider px-3 py-1.5 text-right">Rejected</th>
                                        <th className="ds-small uppercase tracking-wider px-3 py-1.5 text-right">Duration</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {activeSheetData.recentHistory.map((h) => (
                                        <tr key={h.run_id} className="border-b border-border/20">
                                            <td className="ds-small px-3 py-1.5">{fmtWIB(h.started_at)}</td>
                                            <td className="ds-data px-3 py-1.5">
                                                <Badge color={statusBadgeColor(h.status)}>
                                                    {h.status}
                                                    {h.skipped_reason && ` · ${h.skipped_reason}`}
                                                </Badge>
                                            </td>
                                            <td className="ds-data text-right px-3 py-1.5 opacity-80">{fmtNum(h.rows_read)}</td>
                                            <td className="ds-data text-right px-3 py-1.5 text-emerald-400">{fmtNum(h.rows_written)}</td>
                                            <td className="ds-data text-right px-3 py-1.5 text-amber-400">{fmtNum(h.rows_rejected)}</td>
                                            <td className="ds-data text-right px-3 py-1.5 opacity-80">{h.duration_ms}ms</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Card>
            ) : (
                <Card>
                    <p className="ds-body opacity-60 italic">Pilih lembar dari daftar.</p>
                </Card>
            )}
        </div>
    );
}

function RejectedTab({ sheets, driveId }: { sheets: SheetDetail[]; driveId: string }) {
    const allRejected = sheets.flatMap((s) =>
        s.rejectedSample.map((r) => ({ ...r, tabName: s.tabName }))
    );
    if (allRejected.length === 0) {
        return (
            <Card>
                <div className="text-center py-12 text-emerald-400/60">
                    <CheckCircle2 className="h-8 w-8 mx-auto mb-2" />
                    <p className="ds-label">Tidak ada rejected row tertunda</p>
                </div>
            </Card>
        );
    }
    return (
        <Card>
            <h3 className="ds-title mb-3">Rejected Rows ({allRejected.length})</h3>
            <p className="ds-small opacity-80 mb-3">
                Klik cell URL → buka Google Sheet di row yang bermasalah.
            </p>
            <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
                <table className="w-full text-left">
                    <thead className="sticky top-0 bg-background z-10">
                        <tr className="border-b border-border/40">
                            <th className="ds-small uppercase tracking-wider px-3 py-1.5">Lembar</th>
                            <th className="ds-small uppercase tracking-wider px-3 py-1.5">Alasan</th>
                            <th className="ds-small uppercase tracking-wider px-3 py-1.5 text-right">Row</th>
                            <th className="ds-small uppercase tracking-wider px-3 py-1.5">Kolom</th>
                            <th className="ds-small uppercase tracking-wider px-3 py-1.5">Value</th>
                            <th className="ds-small uppercase tracking-wider px-3 py-1.5">Since</th>
                            <th className="ds-small uppercase tracking-wider px-3 py-1.5"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {allRejected.map((r) => (
                            <tr key={r.rejection_key} className="border-b border-border/20 hover:bg-muted/10">
                                <td className="ds-data opacity-80 px-3 py-1.5 truncate max-w-[150px]">{r.tabName}</td>
                                <td className="ds-data px-3 py-1.5">
                                    <Badge color="red">{r.reason_code}</Badge>
                                </td>
                                <td className="ds-data text-right px-3 py-1.5 opacity-80">{r.row_number}</td>
                                <td className="ds-data px-3 py-1.5 truncate max-w-[140px]">{r.column_name || "—"}</td>
                                <td className="ds-small font-mono px-3 py-1.5 truncate max-w-[180px]" title={r.cell_value ?? ""}>
                                    {r.cell_value ?? <span className="italic opacity-50">kosong</span>}
                                </td>
                                <td className="ds-small opacity-80 px-3 py-1.5">{fmtAgo(r.last_seen_at)}</td>
                                <td className="px-3 py-1.5">
                                    <a
                                        href={`https://docs.google.com/spreadsheets/d/${driveId}/edit?range=A${r.row_number}:Z${r.row_number}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="ds-label ds-transition cursor-pointer inline-flex items-center gap-1 rounded border border-border px-2 py-0.5 text-blue-400 hover:bg-blue-500/10"
                                    >
                                        <ExternalLink className="h-3 w-3" /> Cell
                                    </a>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </Card>
    );
}

function DriftTab({ alerts, sheets }: { alerts: DriftAlert[]; sheets: SheetDetail[] }) {
    const levelColor: Record<string, "red" | "amber" | "blue"> = {
        high: "red",
        medium: "amber",
        low: "blue",
    };
    return (
        <div className="space-y-4">
            <Card>
                <h3 className="ds-title mb-3 flex items-center gap-2">
                    <Zap className="h-4 w-4 text-amber-400" />
                    Drift Alerts
                </h3>
                {alerts.length === 0 ? (
                    <div className="text-center py-6 text-emerald-400/60">
                        <CheckCircle2 className="h-6 w-6 mx-auto mb-1" />
                        <p className="ds-label">Tidak ada drift terdeteksi</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {alerts.map((a, i) => (
                            <div
                                key={i}
                                className="rounded-lg border border-border/40 bg-muted/5 p-3"
                            >
                                <div className="flex items-center gap-2 mb-1">
                                    <Badge color={levelColor[a.level]}>{a.level.toUpperCase()}</Badge>
                                    <span className="ds-data opacity-80">{a.sheet}</span>
                                    <span className="ml-auto ds-small uppercase tracking-wider opacity-70">{a.kind}</span>
                                </div>
                                <p className="ds-small">{a.detail}</p>
                            </div>
                        ))}
                    </div>
                )}
            </Card>

            <Card>
                <h3 className="ds-title mb-3 flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Aggregate Sync History (7 hari terakhir)
                </h3>
                <div className="space-y-2">
                    {sheets.map((s) => {
                        const success = s.recentHistory.filter((h) => h.status === "success").length;
                        const errors = s.recentHistory.filter((h) => h.status === "error").length;
                        const skipped = s.recentHistory.filter((h) => h.status === "skipped").length;
                        return (
                            <div key={s.sheetTabId} className="flex items-center gap-3 rounded-md border border-border/40 bg-muted/5 px-3 py-2">
                                <span className="ds-label truncate flex-1">{s.tabName}</span>
                                <span className="ds-data text-emerald-400">{success}</span>
                                <span className="ds-small opacity-60">·</span>
                                <span className="ds-data text-red-400">{errors}</span>
                                <span className="ds-small opacity-60">·</span>
                                <span className="ds-data opacity-70">{skipped} skip</span>
                            </div>
                        );
                    })}
                </div>
            </Card>
        </div>
    );
}

/* ════════════════ SMALL COMPONENTS ════════════════ */

function Card({ children, className }: { children: any; className?: string }) {
    return <div className={`rounded-lg border border-border/40 bg-card/30 p-5 ${className ?? ""}`}>{children}</div>;
}

function Stat({
    label,
    value,
    color,
    alert,
    mono,
}: {
    label: string;
    value: string | number;
    color?: "emerald" | "amber";
    alert?: boolean;
    mono?: boolean;
}) {
    const colorClass =
        color === "emerald"
            ? "text-emerald-400"
            : color === "amber" || alert
                ? "text-amber-400"
                : "";
    return (
        <div className={`rounded-lg border px-3 py-2 ${alert ? "border-amber-500/40 bg-amber-500/5" : "border-border/40 bg-muted/10"}`}>
            <div className="ds-small uppercase tracking-wider opacity-80">{label}</div>
            <div className={`${mono ? "ds-data" : "ds-kpi"} mt-1 ${colorClass}`}>{value}</div>
        </div>
    );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
    return (
        <div>
            <dt className="ds-small uppercase tracking-wider opacity-80">{label}</dt>
            <dd className={`${mono ? "ds-data" : "ds-label"} mt-0.5 truncate`} title={value}>
                {value}
            </dd>
        </div>
    );
}

type BadgeColor = "emerald" | "red" | "amber" | "blue" | "indigo" | "slate";

function Badge({ color, children }: { color: BadgeColor; children: any }) {
    const classes: Record<BadgeColor, string> = {
        emerald: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
        red: "bg-red-500/15 text-red-400 border-red-500/20",
        amber: "bg-amber-500/15 text-amber-400 border-amber-500/20",
        blue: "bg-blue-500/15 text-blue-400 border-blue-500/20",
        indigo: "bg-indigo-500/15 text-indigo-400 border-indigo-500/20",
        slate: "bg-muted/40 opacity-80",
    };
    return (
        <span className={`ds-label rounded border px-1.5 py-0.5 ${classes[color]}`}>
            {children}
        </span>
    );
}

function statusBadgeColor(status: string | null | undefined): BadgeColor {
    if (status === "success" || status === "idle") return "emerald";
    if (status === "error" || status === "halted") return "red";
    if (status === "skipped") return "slate";
    if (status === "partial" || status === "syncing" || status === "running") return "amber";
    return "slate";
}
