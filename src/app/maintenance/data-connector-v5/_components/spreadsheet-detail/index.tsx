"use client";

/**
 * SpreadsheetDetail — info per-spreadsheet (bukan per-sheet).
 *
 * Source data: Firestore `data_sources_v2/{datasetId}` (live via onSnapshot).
 * Show:
 *   - Spreadsheet metadata (driveId, nama, URL, master flag, sync status)
 *   - List sheet di dalamnya (sheetTabId, tabName, bqTable, syncState)
 *   - External link buka di Google Sheets
 */

import { useMemo } from "react";
import {
    FileSpreadsheet, ExternalLink, Database, Table2,
    CheckCircle2, AlertCircle, Calendar, Hash,
} from "lucide-react";
import { useFirestoreDataSourcesV2 } from "../shared/useFirestore";

export default function SpreadsheetDetail({ datasetId }: { datasetId: string }) {
    const { dataSources, loading } = useFirestoreDataSourcesV2();
    const ds = useMemo(
        () => dataSources.find((d) => d.id === datasetId),
        [dataSources, datasetId]
    );

    if (loading) {
        return (
            <div className="p-6 ds-small opacity-60">Loading dari Firestore…</div>
        );
    }
    if (!ds) {
        return (
            <div className="p-6">
                <Banner tone="red">
                    <strong>Spreadsheet ga ketemu.</strong> Dataset ID: <code className="font-mono">{datasetId}</code>
                </Banner>
            </div>
        );
    }

    const sheetEntries = Object.entries(ds.sheets || {});
    const totalRows = sheetEntries.reduce(
        (acc, [, c]) => acc + (c.syncState?.rowCount || 0),
        0
    );
    const url =
        ds.identity?.url ||
        (ds.identity?.driveId
            ? `https://docs.google.com/spreadsheets/d/${ds.identity.driveId}`
            : "#");

    const syncEnabled = ds.syncControl?.enabled ?? false;
    const spreadsheetName = ds.identity?.name || ds.id;
    const isMaster = ds.identity?.isMasterHierarchy ?? false;

    return (
        <div className="flex h-full w-full min-h-0 flex-col bg-background">
            {/* HEADER */}
            <header className="shrink-0 border-b border-border/60 bg-card/40 px-6 py-4">
                <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                            <FileSpreadsheet className="w-5 h-5 text-indigo-400 shrink-0" />
                            <h1 className="ds-heading truncate">{spreadsheetName}</h1>
                            {isMaster && (
                                <span className="ds-data rounded bg-violet-500/15 text-violet-300 px-2 py-0.5 text-[10px] inline-flex items-center gap-1 shrink-0">
                                    MASTER HIERARCHY
                                </span>
                            )}
                            <span
                                className={`ds-data rounded px-2 py-0.5 text-[10px] inline-flex items-center gap-1 shrink-0 ${
                                    syncEnabled
                                        ? "bg-emerald-500/15 text-emerald-300"
                                        : "bg-red-500/15 text-red-300"
                                }`}
                            >
                                <CheckCircle2 className="w-3 h-3" />
                                {syncEnabled ? "SYNC ENABLED" : "SYNC PAUSED"}
                            </span>
                        </div>
                        <div className="ds-small opacity-70 mt-1 font-mono">
                            BQ Dataset: {ds.id}
                        </div>
                    </div>
                    <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ds-transition cursor-pointer flex items-center gap-1.5 text-xs h-8 px-3 rounded-md border border-blue-500/40 bg-blue-500/10 hover:bg-blue-500/20 text-blue-200 shrink-0"
                    >
                        Buka di Google Sheets
                        <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                </div>
            </header>

            {/* BODY */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                {/* Stats */}
                <div className="grid grid-cols-4 gap-3">
                    <Stat label="Total Sheet" value={sheetEntries.length} icon={<Table2 className="w-4 h-4" />} />
                    <Stat
                        label="Total Row (sync)"
                        value={totalRows.toLocaleString("id-ID")}
                        icon={<Hash className="w-4 h-4" />}
                    />
                    <Stat
                        label="Status"
                        value={ds.syncControl?.status || "idle"}
                        icon={<Database className="w-4 h-4" />}
                    />
                    <Stat
                        label="Last Sync"
                        value={
                            ds.syncControl?.lastSyncAt
                                ? new Date(ds.syncControl.lastSyncAt).toLocaleDateString("id-ID")
                                : "—"
                        }
                        icon={<Calendar className="w-4 h-4" />}
                    />
                </div>

                {/* Spreadsheet Metadata */}
                <Section title="Spreadsheet Metadata" icon={<FileSpreadsheet className="w-3.5 h-3.5" />}>
                    <Row label="Drive File ID" value={ds.identity?.driveId || "—"} mono />
                    <Row label="Nama" value={ds.identity?.name || "—"} />
                    <Row label="URL" value={url} mono link />
                    <Row
                        label="Created"
                        value={
                            ds.audit?.createdAt
                                ? new Date(ds.audit.createdAt).toLocaleString("id-ID")
                                : "—"
                        }
                    />
                    <Row
                        label="Updated"
                        value={
                            ds.audit?.updatedAt
                                ? new Date(ds.audit.updatedAt).toLocaleString("id-ID")
                                : "—"
                        }
                    />
                    <Row
                        label="Configured"
                        value={
                            ds.audit?.configuredAt
                                ? new Date(ds.audit.configuredAt).toLocaleString("id-ID")
                                : "—"
                        }
                    />
                    <Row
                        label="Last Drive Modified"
                        value={
                            ds.syncControl?.lastDriveModified
                                ? new Date(ds.syncControl.lastDriveModified).toLocaleString("id-ID")
                                : "—"
                        }
                    />
                </Section>

                {/* Sheets List */}
                <Section title={`Sheets (${sheetEntries.length})`} icon={<Table2 className="w-3.5 h-3.5" />}>
                    <div className="rounded-md border border-border/40 bg-card/30 overflow-hidden">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border/40 bg-muted/20">
                                    <th className="text-left px-3 py-2 ds-label opacity-80">Tab Name</th>
                                    <th className="text-left px-3 py-2 ds-label opacity-80">BQ Table</th>
                                    <th className="text-left px-3 py-2 ds-label opacity-80">Sheet Tab ID</th>
                                    <th className="text-left px-3 py-2 ds-label opacity-80">Level Ref</th>
                                    <th className="text-right px-3 py-2 ds-label opacity-80">Rows</th>
                                    <th className="text-right px-3 py-2 ds-label opacity-80">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sheetEntries.map(([sheetTabId, c]) => (
                                    <tr
                                        key={sheetTabId}
                                        className="border-b border-border/30 last:border-0 hover:bg-white/[0.02] ds-transition"
                                    >
                                        <td className="px-3 py-2 truncate max-w-[200px]" title={c.tabName}>
                                            <span className="ds-body">{c.tabName || "—"}</span>
                                        </td>
                                        <td className="px-3 py-2">
                                            <span className="font-mono text-xs">{c.bqTable || "—"}</span>
                                        </td>
                                        <td className="px-3 py-2">
                                            <span className="font-mono text-xs opacity-70">{sheetTabId}</span>
                                        </td>
                                        <td className="px-3 py-2">
                                            {c.levelRef ? (
                                                <span className="font-mono text-xs opacity-70">{c.levelRef}</span>
                                            ) : (
                                                <span className="ds-small opacity-40 italic">unset</span>
                                            )}
                                        </td>
                                        <td className="px-3 py-2 text-right">
                                            <span className="ds-data">
                                                {(c.syncState?.rowCount || 0).toLocaleString("id-ID")}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2 text-right">
                                            <span className="ds-small opacity-70">
                                                {c.syncState?.syncStatus || "idle"}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Section>
            </div>
        </div>
    );
}

/* ─────────── Sub-components ─────────── */

function Stat({ label, value, icon }: { label: string; value: number | string; icon: React.ReactNode }) {
    return (
        <div className="rounded-md border border-border/60 bg-card/30 px-3 py-2.5">
            <div className="flex items-center gap-1.5 opacity-60">
                {icon}
                <span className="ds-small">{label}</span>
            </div>
            <div className="ds-kpi text-base mt-1">{value}</div>
        </div>
    );
}

function Section({
    title,
    icon,
    children,
}: {
    title: string;
    icon: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <section>
            <h3 className="ds-small uppercase tracking-widest opacity-70 mb-2 flex items-center gap-1.5">
                {icon}
                {title}
            </h3>
            {children}
        </section>
    );
}

function Row({
    label,
    value,
    mono,
    link,
}: {
    label: string;
    value: string;
    mono?: boolean;
    link?: boolean;
}) {
    return (
        <div className="flex items-center gap-3 px-3 py-1.5 border-b border-border/30 last:border-0 hover:bg-white/[0.02] ds-transition">
            <span className="ds-small opacity-70 w-32 shrink-0">{label}</span>
            {link && value !== "—" ? (
                <a
                    href={value}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex-1 truncate ${mono ? "font-mono text-xs" : "ds-body"} text-blue-300 hover:underline`}
                >
                    {value}
                </a>
            ) : (
                <span className={`flex-1 truncate ${mono ? "font-mono text-xs" : "ds-body"}`}>
                    {value}
                </span>
            )}
        </div>
    );
}

function Banner({ tone, children }: { tone: "red"; children: React.ReactNode }) {
    return (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-red-200 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <div className="ds-small">{children}</div>
        </div>
    );
}
