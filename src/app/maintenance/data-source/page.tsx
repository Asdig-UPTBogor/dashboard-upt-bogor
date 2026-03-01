"use client";

/**
 * Data Source Manager — Health Monitor (Read-Only)
 *
 * Displays health diagnostics for all registered data sources.
 * Write operations (add, link, delete, relations) are in Data Connector.
 *
 * shadcn elements: Button, Badge, Tooltip, Card, Collapsible
 * ECharts: via HealthRing (gauge chart)
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
    Database, RefreshCw, CheckCircle2, XCircle, Activity, Loader2,
    FileSpreadsheet, ExternalLink, ChevronDown, Cable,
    Clock, AlertTriangle, Server, Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { PAGE_ICONS } from "@/lib/page-icons";
import { findPageByPath } from "@/lib/sidebar-config";
import type { DSResponse, PageResult } from "./_types";

/* ─── Components ──────────────────────────────────── */
import { HealthRing } from "./_components/health-ring";
import { HealthBar } from "./_components/health-bar";
import { ColumnTable } from "./_components/column-table";
import { SmartSuggestion } from "./_components/smart-suggestion";

/* ═══════════════════════════════════════════════════
   Main Page Component
   ═══════════════════════════════════════════════════ */
export default function DataSourceManagerPage() {
    /* ── State (read-only monitoring) ── */
    const [data, setData] = useState<DSResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [diagnosing, setDiagnosing] = useState(false);
    const [expandedPages, setExpandedPages] = useState<Record<string, boolean>>({});
    const [expandedSheets, setExpandedSheets] = useState<Record<string, boolean>>({});
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

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

    useEffect(() => { fetchData(); }, [fetchData]);

    /* ── Handlers ── */
    const runDiagnostics = () => { setDiagnosing(true); fetchData(true); };
    const togglePage = (p: string) => setExpandedPages((v) => ({ ...v, [p]: !v[p] }));
    const toggleSheet = (k: string) => setExpandedSheets((v) => ({ ...v, [k]: !v[k] }));



    /* ── Render ── */
    return (
        <TooltipProvider delayDuration={200}>
            <div className="min-h-screen bg-background p-6 md:p-8">

                {/* ═══════════ Header ═══════════ */}
                <div className="mb-6 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 opacity-25 blur-lg" />
                            <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600">
                                <Database className="h-6 w-6 text-foreground" />
                            </div>
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight text-foreground">Smart Data Source</h1>
                            <p className="text-sm text-muted-foreground">Monitor · Diagnose · Manage</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button asChild
                            className="bg-indigo-600 shadow-lg shadow-indigo-500/20 hover:bg-indigo-500 hover:shadow-indigo-500/40">
                            <Link href="/maintenance/data-connector">
                                <Cable className="mr-2 h-4 w-4" /> Data Connector
                            </Link>
                        </Button>
                        <Button onClick={runDiagnostics} disabled={diagnosing || loading}
                            className="bg-gradient-to-r from-violet-600 to-indigo-600 shadow-lg shadow-violet-500/20 hover:shadow-violet-500/40 disabled:opacity-50">
                            <Activity className={`mr-2 h-4 w-4 ${diagnosing ? "animate-pulse" : ""}`} />
                            {diagnosing ? "Diagnosing..." : "Run Diagnostics"}
                        </Button>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="outline" onClick={() => fetchData()} disabled={loading}
                                    className="border-border bg-muted/40 text-foreground/80 hover:bg-accent disabled:opacity-50">
                                    <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent className="bg-popover border-border text-foreground">Refresh Data</TooltipContent>
                        </Tooltip>
                    </div>
                </div>

                {/* ═══════════ Loading State ═══════════ */}
                {loading && !data && (
                    <div className="flex flex-col items-center justify-center py-24">
                        <Loader2 className="h-10 w-10 animate-spin text-violet-400" />
                        <p className="mt-6 text-sm text-muted-foreground">Checking data sources...</p>
                    </div>
                )}

                {data && (
                    <>
                        {/* ═══════════ Health Overview (Card) ═══════════ */}
                        <Card className="mb-6 border-border bg-muted/30">
                            <CardContent className="flex gap-5 p-6">
                                <div className="flex flex-col items-center gap-2">
                                    <HealthRing score={data.overallHealth} />
                                    <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">System Health</span>
                                </div>

                                <div className="ml-4 flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {data.pages.map((p) => (
                                        <Card key={p.page} className="border-border/50 bg-muted/20">
                                            <CardContent className="flex items-center gap-3 p-3">
                                                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${p.healthScore >= 90 ? "bg-emerald-500/15 text-emerald-400" : p.healthScore >= 60 ? "bg-amber-500/15 text-amber-400" : "bg-red-500/15 text-red-400"}`}>
                                                    {(() => { const I = PAGE_ICONS[p.path]; return I ? <I className="h-4 w-4" /> : <Database className="h-4 w-4" />; })()}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate text-sm font-medium text-foreground">{p.page}</p>
                                                    <HealthBar score={p.healthScore} />
                                                </div>
                                                <span className="text-[11px] text-muted-foreground/60">{p.passedChecks}/{p.totalChecks}</span>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>

                                {/* API Health Panel */}
                                <div className="ml-4 flex flex-col gap-2">
                                    <span className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">API Routes</span>
                                    {Object.entries(data.apiHealth).map(([route, h]) => (
                                        <div key={route} className="flex items-center gap-2">
                                            {h.ok ? <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-400" /> : <XCircle className="h-3 w-3 shrink-0 text-red-400" />}
                                            <code className="flex-1 text-[11px] text-muted-foreground">{route}</code>
                                            <Badge variant="outline" className="border-border bg-muted/20 text-muted-foreground text-[10px]">{h.time}ms</Badge>
                                            {h.ok && h.count !== undefined && (
                                                <Badge variant="outline" className="border-emerald-500/10 bg-emerald-500/10 text-emerald-400 text-[10px]">
                                                    {h.count} records
                                                </Badge>
                                            )}
                                            {!h.ok && (
                                                <Badge variant="destructive" className="text-[10px]">
                                                    {h.status || "Timeout"}
                                                </Badge>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        {/* ═══════════ Page Cards (grouped by sidebar section, using Collapsible) ═══════════ */}
                        {(() => {
                            const grouped = new Map<string, { sectionLabel: string; pages: typeof data.pages }>();
                            for (const page of data.pages) {
                                const pageInfo = findPageByPath(page.path);
                                const sectionKey = pageInfo?.section || "Lainnya";
                                if (!grouped.has(sectionKey)) {
                                    grouped.set(sectionKey, { sectionLabel: sectionKey, pages: [] });
                                }
                                grouped.get(sectionKey)!.pages.push(page);
                            }
                            return [...grouped.entries()].map(([sectionKey, group]) => {
                                const SectionIcon = PAGE_ICONS[group.pages[0]?.path] || Database;
                                const isSectionExpanded = expandedSections[sectionKey] !== false;
                                const totalSheets = group.pages.reduce((s, p) => s + p.spreadsheets.reduce((ss, sp) => ss + sp.sheets.length, 0), 0);
                                const avgHealth = Math.round(group.pages.reduce((s, p) => s + p.healthScore, 0) / group.pages.length);
                                // Only flatten (skip nested page card) when section name matches page name
                                const shouldFlatten = group.pages.length === 1 && group.pages[0].page === group.sectionLabel;
                                return (
                                    <Collapsible key={sectionKey} open={isSectionExpanded} onOpenChange={(v) => setExpandedSections((prev) => ({ ...prev, [sectionKey]: v }))} className="mb-4">
                                        <Card className="border-border bg-muted/30 overflow-hidden p-0 gap-0">
                                            {/* Section Header */}
                                            <CollapsibleTrigger asChild>
                                                <div className={`flex cursor-pointer items-center justify-between p-4 transition-colors hover:bg-accent ${isSectionExpanded ? 'rounded-t-xl' : 'rounded-xl'}`}>
                                                    <div className="flex items-center gap-3">
                                                        {isSectionExpanded ? <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform duration-300" /> : <ChevronDown className="h-5 w-5 text-muted-foreground -rotate-90 transition-transform duration-300" />}
                                                        {shouldFlatten ? (
                                                            <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${avgHealth >= 90 ? "bg-emerald-500/15 text-emerald-400" : avgHealth >= 60 ? "bg-amber-500/15 text-amber-400" : "bg-red-500/15 text-red-400"}`}>
                                                                <SectionIcon className="h-5 w-5" />
                                                            </div>
                                                        ) : (
                                                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.06] text-foreground/80">
                                                                <SectionIcon className="h-5 w-5" />
                                                            </div>
                                                        )}
                                                        <div>
                                                            <h2 className="text-base font-semibold text-foreground">{group.sectionLabel}</h2>
                                                            <p className="text-[11px] text-muted-foreground">
                                                                {shouldFlatten
                                                                    ? <><code>{group.pages[0].path}</code> · {group.pages[0].spreadsheets.length} spreadsheet · {totalSheets} sheet</>
                                                                    : <>{group.pages.length} page · {totalSheets} sheet</>}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <HealthBar score={avgHealth} />
                                                    </div>
                                                </div>
                                            </CollapsibleTrigger>

                                            {/* Section Content */}
                                            <CollapsibleContent>
                                                {shouldFlatten ? (
                                                    /* ── Single page with same label: directly show spreadsheets without extra nesting ── */
                                                    <div className="border-t border-border/50">
                                                        {group.pages[0].spreadsheets.map((sp, si) => (
                                                            <div key={sp.spreadsheetId} className={si > 0 ? "border-t border-border/50" : ""}>
                                                                {/* Spreadsheet Header */}
                                                                <div className="flex items-center justify-between bg-muted/15 px-5 py-2.5">
                                                                    <div className="flex items-center gap-3">
                                                                        <FileSpreadsheet className="h-4 w-4 text-blue-400" />
                                                                        <span className="text-sm font-medium text-foreground">{sp.title}</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        <Badge variant="outline" className="border-border bg-muted/20 text-muted-foreground/60 text-[10px]">
                                                                            <Clock className="mr-1 h-3 w-3" />{sp.responseTime}ms
                                                                        </Badge>
                                                                        <Button variant="outline" size="sm" asChild className="h-6 border-border bg-muted/40 text-muted-foreground hover:bg-accent hover:text-foreground">
                                                                            <a href={`https://docs.google.com/spreadsheets/d/${sp.spreadsheetId}`} target="_blank" rel="noopener noreferrer">
                                                                                <ExternalLink className="mr-1 h-3 w-3" /> Buka
                                                                            </a>
                                                                        </Button>

                                                                    </div>
                                                                </div>

                                                                {/* Sheets */}
                                                                {sp.sheets.map((sheet) => {
                                                                    const key = `${sp.spreadsheetId}-${sheet.configuredName}`;
                                                                    const isExp = expandedSheets[key];
                                                                    const rh = sheet.routeHealth;

                                                                    return (
                                                                        <div key={sheet.configuredName} className="border-t border-border/30">
                                                                            {/* Sheet Row */}
                                                                            <div className="flex cursor-pointer items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/20"
                                                                                onClick={() => toggleSheet(key)}>
                                                                                {isExp ? <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-300" /> : <ChevronDown className="h-4 w-4 text-muted-foreground -rotate-90 transition-transform duration-300" />}
                                                                                <div className="flex flex-1 items-center justify-between">
                                                                                    <span className={`font-mono text-sm font-medium ${sheet.status === "missing" ? "text-red-400 line-through" : "text-foreground"}`}>
                                                                                        {sheet.actualName || sheet.configuredName}
                                                                                    </span>
                                                                                    <div className="flex items-center gap-3">
                                                                                        {sheet.missingColumns.length > 0 && sheet.status !== "missing" && (
                                                                                            <Badge variant="outline" className="border-amber-500/20 bg-amber-500/10 text-amber-400 text-[10px]">
                                                                                                <AlertTriangle className="mr-1 h-2.5 w-2.5" /> {sheet.missingColumns.length} kolom
                                                                                            </Badge>
                                                                                        )}
                                                                                        {rh && (
                                                                                            <Tooltip>
                                                                                                <TooltipTrigger>
                                                                                                    <Badge variant="outline" className={`text-[10px] ${rh.ok ? "border-emerald-500/10 bg-emerald-500/5 text-emerald-400/70" : "border-red-500/20 bg-red-500/10 text-red-400"}`}>
                                                                                                        <Server className="mr-1 h-2.5 w-2.5" />
                                                                                                        {rh.ok ? `${rh.status} · ${rh.time}ms` : `${rh.status || "ERR"}`}
                                                                                                        {rh.count !== undefined && ` · ${rh.count}`}
                                                                                                    </Badge>
                                                                                                </TooltipTrigger>
                                                                                                <TooltipContent className="bg-popover border-border text-foreground">
                                                                                                    Route: <code>{sheet.route}</code>
                                                                                                </TooltipContent>
                                                                                            </Tooltip>
                                                                                        )}
                                                                                        <code className="text-[11px] text-muted-foreground">{sheet.route}</code>
                                                                                        {sheet.status !== "missing" && (
                                                                                            <>
                                                                                                <span className="text-[11px] text-muted-foreground/40">·</span>
                                                                                                <Badge variant="outline" className="border-border bg-muted/20 text-muted-foreground text-[11px]">
                                                                                                    <Layers className="mr-1 h-3 w-3" />{sheet.rowCount.toLocaleString()} rows
                                                                                                </Badge>
                                                                                                <span className="text-[11px] text-muted-foreground">{sheet.colCount} cols</span>
                                                                                            </>
                                                                                        )}
                                                                                        {sheet.status === "ok" ? (
                                                                                            <Badge variant="outline" className="border-emerald-500/20 bg-emerald-500/10 text-emerald-400 text-[10px] font-semibold">
                                                                                                <CheckCircle2 className="mr-1 h-2.5 w-2.5" /> Healthy
                                                                                            </Badge>
                                                                                        ) : (
                                                                                            <Badge variant="destructive" className="animate-pulse text-[10px] font-semibold">
                                                                                                <XCircle className="mr-1 h-2.5 w-2.5" /> MISSING
                                                                                            </Badge>
                                                                                        )}

                                                                                    </div>
                                                                                </div>
                                                                            </div>

                                                                            {/* Expanded: Sheet Details */}
                                                                            {isExp && (
                                                                                <div className="space-y-4 border-t border-border/30 bg-muted/10 px-9 py-4">
                                                                                    {sheet.status === "missing" && (
                                                                                        <SmartSuggestion
                                                                                            configuredName={sheet.configuredName}
                                                                                            suggestions={sheet.suggestions}
                                                                                            spreadsheetId={sp.spreadsheetId}
                                                                                            allSheetNames={sp.allSheetNames}
                                                                                            onRefresh={() => fetchData()}
                                                                                        />
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
                                                                                            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Kolom yang dibutuhkan</p>
                                                                                            <div className="flex flex-wrap gap-1.5">
                                                                                                {sheet.missingColumns.map((col) => (
                                                                                                    <Badge key={col.name} variant="destructive" className="font-mono text-[11px]">
                                                                                                        ✗ {col.name}
                                                                                                    </Badge>
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
                                                ) : (
                                                    /* ── Multiple pages: keep nested page cards ── */
                                                    <CardContent className="border-t border-border/50 p-3 space-y-3">
                                                        {group.pages.map((page) => {
                                                            const isExpanded = expandedPages[page.page];
                                                            return (
                                                                <Collapsible key={page.page} open={isExpanded} onOpenChange={() => togglePage(page.page)}>
                                                                    <Card className="border-border bg-muted/30 overflow-hidden p-0 gap-0">
                                                                        {/* Page Header */}
                                                                        <CollapsibleTrigger asChild>
                                                                            <div className={`flex cursor-pointer items-center justify-between p-4 transition-colors hover:bg-accent ${isExpanded ? 'rounded-t-xl' : 'rounded-xl'}`}>
                                                                                <div className="flex items-center gap-3">
                                                                                    {isExpanded ? <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform duration-300" /> : <ChevronDown className="h-5 w-5 text-muted-foreground -rotate-90 transition-transform duration-300" />}
                                                                                    <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${page.healthScore >= 90 ? "bg-emerald-500/15 text-emerald-400" : page.healthScore >= 60 ? "bg-amber-500/15 text-amber-400" : "bg-red-500/15 text-red-400"}`}>
                                                                                        {(() => { const I = PAGE_ICONS[page.path]; return I ? <I className="h-5 w-5" /> : <Database className="h-5 w-5" />; })()}
                                                                                    </div>
                                                                                    <div className="flex items-center gap-2">
                                                                                        <h2 className="text-base font-semibold text-foreground">{page.page}</h2>
                                                                                        <span className="text-[11px] text-muted-foreground">
                                                                                            <code>{page.path}</code> · {page.spreadsheets.length} spreadsheet · {page.spreadsheets.reduce((s, sp) => s + sp.sheets.length, 0)} sheet
                                                                                        </span>
                                                                                    </div>
                                                                                </div>
                                                                                <div className="flex items-center gap-2">
                                                                                    <HealthBar score={page.healthScore} />
                                                                                </div>
                                                                            </div>
                                                                        </CollapsibleTrigger>

                                                                        {/* Expanded: Spreadsheets & Sheets */}
                                                                        <CollapsibleContent>
                                                                            <div className="border-t border-border/50">
                                                                                {page.spreadsheets.map((sp, si) => (
                                                                                    <div key={sp.spreadsheetId} className={si > 0 ? "border-t border-border/50" : ""}>
                                                                                        {/* Spreadsheet Header */}
                                                                                        <div className="flex items-center justify-between bg-muted/15 px-5 py-2.5">
                                                                                            <div className="flex items-center gap-3">
                                                                                                <FileSpreadsheet className="h-4 w-4 text-blue-400" />
                                                                                                <span className="text-sm font-medium text-foreground">{sp.title}</span>
                                                                                            </div>
                                                                                            <div className="flex items-center gap-2">
                                                                                                <Badge variant="outline" className="border-border bg-muted/20 text-muted-foreground/60 text-[10px]">
                                                                                                    <Clock className="mr-1 h-3 w-3" />{sp.responseTime}ms
                                                                                                </Badge>
                                                                                                <Button variant="outline" size="sm" asChild className="h-6 border-border bg-muted/40 text-muted-foreground hover:bg-accent hover:text-foreground">
                                                                                                    <a href={`https://docs.google.com/spreadsheets/d/${sp.spreadsheetId}`} target="_blank" rel="noopener noreferrer">
                                                                                                        <ExternalLink className="mr-1 h-3 w-3" /> Buka
                                                                                                    </a>
                                                                                                </Button>

                                                                                            </div>
                                                                                        </div>

                                                                                        {/* Sheets */}
                                                                                        {sp.sheets.map((sheet) => {
                                                                                            const key = `${sp.spreadsheetId}-${sheet.configuredName}`;
                                                                                            const isExp = expandedSheets[key];
                                                                                            const rh = sheet.routeHealth;

                                                                                            return (
                                                                                                <div key={sheet.configuredName} className="border-t border-border/30">
                                                                                                    {/* Sheet Row */}
                                                                                                    <div className="flex cursor-pointer items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/20"
                                                                                                        onClick={() => toggleSheet(key)}>
                                                                                                        {isExp ? <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-300" /> : <ChevronDown className="h-4 w-4 text-muted-foreground -rotate-90 transition-transform duration-300" />}
                                                                                                        <div className="flex flex-1 items-center justify-between">
                                                                                                            <span className={`font-mono text-sm font-medium ${sheet.status === "missing" ? "text-red-400 line-through" : "text-foreground"}`}>
                                                                                                                {sheet.actualName || sheet.configuredName}
                                                                                                            </span>
                                                                                                            <div className="flex items-center gap-3">
                                                                                                                {sheet.missingColumns.length > 0 && sheet.status !== "missing" && (
                                                                                                                    <Badge variant="outline" className="border-amber-500/20 bg-amber-500/10 text-amber-400 text-[10px]">
                                                                                                                        <AlertTriangle className="mr-1 h-2.5 w-2.5" /> {sheet.missingColumns.length} kolom
                                                                                                                    </Badge>
                                                                                                                )}
                                                                                                                {rh && (
                                                                                                                    <Tooltip>
                                                                                                                        <TooltipTrigger>
                                                                                                                            <Badge variant="outline" className={`text-[10px] ${rh.ok ? "border-emerald-500/10 bg-emerald-500/5 text-emerald-400/70" : "border-red-500/20 bg-red-500/10 text-red-400"}`}>
                                                                                                                                <Server className="mr-1 h-2.5 w-2.5" />
                                                                                                                                {rh.ok ? `${rh.status} · ${rh.time}ms` : `${rh.status || "ERR"}`}
                                                                                                                                {rh.count !== undefined && ` · ${rh.count}`}
                                                                                                                            </Badge>
                                                                                                                        </TooltipTrigger>
                                                                                                                        <TooltipContent className="bg-popover border-border text-foreground">
                                                                                                                            Route: <code>{sheet.route}</code>
                                                                                                                        </TooltipContent>
                                                                                                                    </Tooltip>
                                                                                                                )}
                                                                                                                <code className="text-[11px] text-muted-foreground">{sheet.route}</code>
                                                                                                                {sheet.status !== "missing" && (
                                                                                                                    <>
                                                                                                                        <span className="text-[11px] text-muted-foreground/40">·</span>
                                                                                                                        <Badge variant="outline" className="border-border bg-muted/20 text-muted-foreground text-[11px]">
                                                                                                                            <Layers className="mr-1 h-3 w-3" />{sheet.rowCount.toLocaleString()} rows
                                                                                                                        </Badge>
                                                                                                                        <span className="text-[11px] text-muted-foreground">{sheet.colCount} cols</span>
                                                                                                                    </>
                                                                                                                )}
                                                                                                                {sheet.status === "ok" ? (
                                                                                                                    <Badge variant="outline" className="border-emerald-500/20 bg-emerald-500/10 text-emerald-400 text-[10px] font-semibold">
                                                                                                                        <CheckCircle2 className="mr-1 h-2.5 w-2.5" /> Healthy
                                                                                                                    </Badge>
                                                                                                                ) : (
                                                                                                                    <Badge variant="destructive" className="animate-pulse text-[10px] font-semibold">
                                                                                                                        <XCircle className="mr-1 h-2.5 w-2.5" /> MISSING
                                                                                                                    </Badge>
                                                                                                                )}

                                                                                                            </div>
                                                                                                        </div>
                                                                                                    </div>

                                                                                                    {/* Expanded: Sheet Details */}
                                                                                                    {isExp && (
                                                                                                        <div className="space-y-4 border-t border-border/30 bg-muted/10 px-9 py-4">
                                                                                                            {sheet.status === "missing" && (
                                                                                                                <SmartSuggestion
                                                                                                                    configuredName={sheet.configuredName}
                                                                                                                    suggestions={sheet.suggestions}
                                                                                                                    spreadsheetId={sp.spreadsheetId}
                                                                                                                    allSheetNames={sp.allSheetNames}
                                                                                                                    onRefresh={() => fetchData()}
                                                                                                                />
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
                                                                                                                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Kolom yang dibutuhkan</p>
                                                                                                                    <div className="flex flex-wrap gap-1.5">
                                                                                                                        {sheet.missingColumns.map((col) => (
                                                                                                                            <Badge key={col.name} variant="destructive" className="font-mono text-[11px]">
                                                                                                                                ✗ {col.name}
                                                                                                                            </Badge>
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
                                                                        </CollapsibleContent>
                                                                    </Card>
                                                                </Collapsible>
                                                            );
                                                        })}
                                                    </CardContent>
                                                )}
                                            </CollapsibleContent>
                                        </Card>
                                    </Collapsible>
                                );
                            });
                        })()}




                        {/* ═══════════ Timestamp ═══════════ */}
                        <p className="mt-6 text-center text-[11px] text-muted-foreground/60">
                            Last sync: {new Date(data.timestamp).toLocaleString("id-ID")}
                        </p>
                    </>
                )}
            </div>
        </TooltipProvider>
    );
}
