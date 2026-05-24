"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { Maximize2, Minus, Plus, Download, Play, X, Settings, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/designer/Card";
import { usePageData } from "@/hooks/usePageData";
import {
    normalizeItem,
    type ProgramItem,
} from "@/app/transmisi/program-kerja-transmisi/_components/program-kerja-data";
import { ProgramBarChart } from "@/app/transmisi/program-kerja-transmisi/_components/v2/ProgramBarChart";
import { Hero } from "@/app/transmisi/program-kerja-transmisi/_components/v2/Hero";
import { UltgProgressCard } from "@/app/transmisi/program-kerja-transmisi/_components/v2/UltgProgressCard";
import { fmtNum } from "../../_lib/slide-helpers";

const BIDANG = "Transmisi";
const PERIODE = "2026";
const SOURCE = "BigQuery · Master_Transmisi_UPT_Bogor";

const C = {
    abo: "#5b8def",
    lm: "#f3c14b",
    bogor: "#3b82f6",
    sukabumi: "#f97316",
    emerald: "#10b981",
};

/**
 * Slide presentasi mirror layout dashboard:
 * - Hero strip 4 KPI
 * - ULTG progress horizontal 2-col
 * - ABO (col-proporsional) + LM (col-proporsional, internal split 2 kolom)
 * - 1 slide saja, no chrome, full bleed 1920×1080
 */
export default function PresentationTransmisiSlide() {
    const { sheets, loading, error } = usePageData("/transmisi/program-kerja");
    const slideRef = useRef<HTMLElement>(null);
    const [isExporting, setIsExporting] = useState(false);
    const [zoomMode, setZoomMode] = useState<"fit" | "manual">("fit");
    const [manualZoom, setManualZoom] = useState(0.85); // default 85% per request
    const [showControls, setShowControls] = useState(true);
    const [fitScale, setFitScale] = useState(1);

    /* Fit-to-viewport scale calculation */
    useEffect(() => {
        function fit() {
            const padding = document.fullscreenElement ? 0 : 16;
            const w = (window.innerWidth - padding * 2) / 1920;
            const h = (window.innerHeight - padding * 2) / 1080;
            setFitScale(Math.min(w, h, 1));
        }
        fit();
        window.addEventListener("resize", fit);
        document.addEventListener("fullscreenchange", fit);
        return () => {
            window.removeEventListener("resize", fit);
            document.removeEventListener("fullscreenchange", fit);
        };
    }, []);

    /* Force fit saat fullscreen */
    useEffect(() => {
        function onFullscreenChange() {
            if (document.fullscreenElement) setZoomMode("fit");
        }
        document.addEventListener("fullscreenchange", onFullscreenChange);
        return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
    }, []);

    const scale = zoomMode === "fit" ? fitScale : manualZoom;

    function startPresentation() {
        const root = document.querySelector(".presentation-root");
        if (root && (root as HTMLElement).requestFullscreen) {
            (root as HTMLElement).requestFullscreen();
        }
    }

    async function downloadPng(pixelRatio: number) {
        if (!slideRef.current || isExporting) return;
        setIsExporting(true);
        try {
            /* Background ambil dari computed style — auto ngikut theme light/dark */
            const computedBg = getComputedStyle(slideRef.current).backgroundColor;
            const dataUrl = await toPng(slideRef.current, {
                pixelRatio,
                cacheBust: true,
                backgroundColor: computedBg || undefined,
            });
            const a = document.createElement("a");
            a.href = dataUrl;
            const stamp = new Date().toISOString().slice(0, 10);
            a.download = `program-kerja-transmisi-${stamp}-${pixelRatio}x.png`;
            a.click();
        } catch (err) {
            console.error("[downloadPng] gagal:", err);
            alert("Gagal export PNG. Cek console browser.");
        } finally {
            setIsExporting(false);
        }
    }

    const items: ProgramItem[] = useMemo(() => {
        const rows = sheets?.[0]?.rows || [];
        return rows.map(normalizeItem).filter((it) => it.namaProgram);
    }, [sheets]);

    if (loading) return <Loading text="Memuat data" />;
    if (error || items.length === 0) return <Loading text={error || "Belum ada data"} />;

    const totalT = items.reduce((s, it) => s + it.totalTarget, 0);
    const totalR = items.reduce((s, it) => s + it.totalRealisasi, 0);
    const aboItems = items.filter((it) => it.programKerja === "abo");
    const lmItems = items.filter((it) => it.programKerja === "lm");
    const aboTargetSum = aboItems.reduce((s, it) => s + it.totalTarget, 0);
    const aboRealSum = aboItems.reduce((s, it) => s + it.totalRealisasi, 0);
    const lmTargetSum = lmItems.reduce((s, it) => s + it.totalTarget, 0);
    const lmRealSum = lmItems.reduce((s, it) => s + it.totalRealisasi, 0);
    const bogorT = items.reduce((s, it) => s + it.targetBogor, 0);
    const bogorR = items.reduce((s, it) => s + it.realisasiBogor, 0);
    const skbmT = items.reduce((s, it) => s + it.targetSukabumi, 0);
    const skbmR = items.reduce((s, it) => s + it.realisasiSukabumi, 0);

    /* Pembagian col ABO:LM — Transmisi pakai 4:8 (1/3 vs 2/3) */
    const totalCount = aboItems.length + lmItems.length;
    const aboColSpanRaw = Math.round((aboItems.length / totalCount) * 12);
    const aboColSpan = Math.max(4, Math.min(7, aboColSpanRaw));
    const lmColSpan = 12 - aboColSpan;

    /* Dynamic internal cols — supaya muat tanpa overflow.
     * Rule: max 10 item per kolom internal. Kalau 23 item → 3 kolom (8/8/7). */
    const aboInnerCols = aboItems.length > 20 ? 2 : 1;     // ABO panel sempit (1/3) — max 2 col
    const lmInnerCols = Math.max(1, Math.ceil(lmItems.length / 10));  // LM panel lebar — adaptive

    /* Rows untuk UltgProgressCard — match dashboard shape */
    const ultgRows = [
        {
            key: "bogor",
            name: "ULTG Bogor",
            target: bogorT,
            realisasi: bogorR,
            accent: "#5b8def",
            aboCount: aboItems.filter((it) => it.targetBogor > 0).length,
            psCount: lmItems.filter((it) => it.targetBogor > 0).length,
        },
        {
            key: "sukabumi",
            name: "ULTG Sukabumi",
            target: skbmT,
            realisasi: skbmR,
            accent: "#f08a3e",
            aboCount: aboItems.filter((it) => it.targetSukabumi > 0).length,
            psCount: lmItems.filter((it) => it.targetSukabumi > 0).length,
        },
    ];

    return (
        <>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        variant="outline"
                        size="icon"
                        className="fixed bottom-4 right-4 z-[51] size-9 rounded-full shadow-lg"
                        onClick={() => setShowControls(!showControls)}
                    >
                        {showControls ? <X className="size-4" /> : <Settings className="size-4" />}
                    </Button>
                </TooltipTrigger>
                <TooltipContent side="left">{showControls ? "Hide controls" : "Show controls"}</TooltipContent>
            </Tooltip>

            <UnifiedBar
                hidden={!showControls}
                zoomMode={zoomMode}
                manualZoom={manualZoom}
                fitScale={fitScale}
                onSetMode={setZoomMode}
                onSetManual={setManualZoom}
                onDownload={downloadPng}
                isExporting={isExporting}
                onPresent={startPresentation}
            />

            <div className="slide-stage-outer" style={{ width: 1920 * scale, height: 1080 * scale }}>
            <div className="slide-stage" style={{ transform: `scale(${scale})` }}>
            <section ref={slideRef} className="slide" style={{ padding: "32px 64px 24px" }}>
                {/* Header row — title kiri, info rail kanan inline (layout template v1.0) */}
                <div className="flex justify-between items-end gap-3" style={{ marginBottom: 16 }}>
                    <h1 style={{
                        fontSize: 44,
                        fontWeight: 800,
                        letterSpacing: "-0.02em",
                        margin: 0,
                        color: "var(--fg-0)",
                    }}>
                        Program Kerja {BIDANG} <span style={{ color: C.lm }}>{PERIODE}</span>
                    </h1>
                    <SlideHeadCompact pageNo={1} total={1} section={`Program Kerja ${BIDANG}`} />
                </div>

                {/* Hero KPI — extra compact custom, single line per panel */}
                <HeroSlim
                    panels={[
                        { caption: "Program Kerja Transmisi", programCount: items.length, target: totalT, realisasi: totalR, accent: "#3ecf8e", highlight: true },
                        { caption: "Anti Blackout", programCount: aboItems.length, target: aboTargetSum, realisasi: aboRealSum, accent: "#5b8def" },
                        { caption: "Program Strategis", programCount: lmItems.length, target: lmTargetSum, realisasi: lmRealSum, accent: "#f3c14b" },
                    ]}
                />

                {/* ULTG section — name + bar + persen + Target/Realisasi + ABO/PS count */}
                <div style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 16,
                    marginBottom: 16,
                }}>
                    <UltgCard
                        name="ULTG Bogor"
                        target={bogorT} real={bogorR} accent={C.bogor}
                        aboCount={aboItems.filter((it) => it.targetBogor > 0).length}
                        psCount={lmItems.filter((it) => it.targetBogor > 0).length}
                    />
                    <UltgCard
                        name="ULTG Sukabumi"
                        target={skbmT} real={skbmR} accent={C.sukabumi}
                        aboCount={aboItems.filter((it) => it.targetSukabumi > 0).length}
                        psCount={lmItems.filter((it) => it.targetSukabumi > 0).length}
                    />
                </div>

                {/* ABO + LM proporsional, bar chart */}
                <div style={{
                    display: "grid",
                    gridTemplateColumns: `${aboColSpan}fr ${lmColSpan}fr`,
                    gap: 20,
                    flex: 1,
                    minHeight: 0,
                }}>
                    {/* ABO */}
                    <PanelCard title="Anti Blackout" count={aboItems.length} accent={C.abo}>
                        <ProgramBarChart items={aboItems} accent={C.abo} maxVisible={999} cols={aboInnerCols} />
                    </PanelCard>

                    {/* LM */}
                    <PanelCard title="Program Strategis" count={lmItems.length} accent={C.lm}>
                        <ProgramBarChart items={lmItems} accent={C.lm} maxVisible={999} cols={lmInnerCols} />
                    </PanelCard>
                </div>

            </section>
            </div>
            </div>
        </>
    );
}

function Toolbar({ onDownload, isExporting, onPresent, hidden }: { onDownload: (pixelRatio: number) => void; isExporting: boolean; onPresent: () => void; hidden?: boolean }) {
    const [showMenu, setShowMenu] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    /* Click outside untuk close menu */
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setShowMenu(false);
            }
        };
        if (showMenu) document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [showMenu]);

    /* Quality options: estimated dimension + file size */
    const qualities = [
        { ratio: 1, label: "Standar", dim: "1920×1080", size: "~500KB", desc: "Untuk WhatsApp / preview" },
        { ratio: 2, label: "HD", dim: "3840×2160", size: "~2 MB", desc: "Untuk Slides / cetak A4" },
        { ratio: 3, label: "High", dim: "5760×3240", size: "~5 MB", desc: "Untuk proyektor besar" },
        { ratio: 4, label: "Ultra 4K", dim: "7680×4320", size: "~12 MB", desc: "Print poster / cetak besar" },
    ];

    function selectQuality(ratio: number) {
        setShowMenu(false);
        onDownload(ratio);
    }

    return (
        <div className={`deck-toolbar${hidden ? " hidden" : ""}`}>
            <span className="hint">Transmisi · 1 Slide</span>

            <div ref={menuRef} style={{ position: "relative" }}>
                <button
                    onClick={() => setShowMenu((s) => !s)}
                    disabled={isExporting}
                    style={{
                        opacity: isExporting ? 0.6 : 1,
                        background: "var(--accent-amber)",
                        color: "#1a1300",
                        fontWeight: 700,
                    }}
                >
                    {isExporting ? "Mengekspor…" : "📥 Unduh PNG ▾"}
                </button>

                {/* Quality menu dropdown */}
                {showMenu && (
                    <div style={{
                        position: "absolute",
                        top: "calc(100% + 8px)",
                        right: 0,
                        zIndex: 100,
                        background: "var(--bg-1)",
                        border: "1px solid var(--line)",
                        borderRadius: 8,
                        padding: 6,
                        minWidth: 320,
                        boxShadow: "0 12px 40px -12px rgba(0,0,0,.6)",
                        display: "flex",
                        flexDirection: "column",
                        gap: 2,
                    }}>
                        <div style={{
                            padding: "8px 12px 6px",
                            fontSize: 10,
                            fontWeight: 700,
                            textTransform: "uppercase",
                            letterSpacing: "0.14em",
                            color: "var(--fg-1)",
                        }}>
                            Pilih Kualitas Export
                        </div>
                        {qualities.map((q) => (
                            <button
                                key={q.ratio}
                                onClick={() => selectQuality(q.ratio)}
                                style={{
                                    display: "grid",
                                    gridTemplateColumns: "auto 1fr auto",
                                    gap: 12,
                                    alignItems: "center",
                                    padding: "10px 12px",
                                    background: "transparent",
                                    color: "var(--fg-0)",
                                    border: "none",
                                    borderRadius: 6,
                                    cursor: "pointer",
                                    textAlign: "left",
                                    transition: "background .15s ease",
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-2)")}
                                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                            >
                                <span style={{
                                    fontFamily: "var(--font-mono, monospace)",
                                    fontSize: 13,
                                    fontWeight: 700,
                                    color: "var(--accent-amber)",
                                    minWidth: 32,
                                }}>
                                    {q.ratio}×
                                </span>
                                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                    <span style={{ fontSize: 13, fontWeight: 600 }}>
                                        {q.label}
                                        <span style={{ fontSize: 10, color: "var(--fg-1)", marginLeft: 8, fontFamily: "var(--font-mono, monospace)" }}>
                                            {q.dim}
                                        </span>
                                    </span>
                                    <span style={{ fontSize: 10.5, color: "var(--fg-1)" }}>
                                        {q.desc}
                                    </span>
                                </div>
                                <span style={{
                                    fontSize: 10.5,
                                    color: "var(--fg-2)",
                                    fontFamily: "var(--font-mono, monospace)",
                                }}>
                                    {q.size}
                                </span>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <button onClick={onPresent} style={{ background: "var(--bg-2)", color: "var(--fg-0)" }}
                title="Mode presentasi fullscreen — Esc untuk keluar">
                🎯 Presentasi
            </button>
        </div>
    );
}

/* UnifiedBar — bottom-center bar pakai shadcn/ui proper.
   Komponen: Button, Slider, DropdownMenu, Tooltip, Separator + lucide icons. */
function UnifiedBar({
    hidden, zoomMode, manualZoom, fitScale, onSetMode, onSetManual,
    onDownload, isExporting, onPresent,
}: {
    hidden: boolean;
    zoomMode: "fit" | "manual";
    manualZoom: number;
    fitScale: number;
    onSetMode: (m: "fit" | "manual") => void;
    onSetManual: (v: number) => void;
    onDownload: (px: number) => void;
    isExporting: boolean;
    onPresent: () => void;
}) {
    const currentZoom = zoomMode === "fit" ? fitScale : manualZoom;
    const qualities = [
        { ratio: 1, label: "Standar (1920×1080)" },
        { ratio: 2, label: "HD (3840×2160)" },
        { ratio: 3, label: "High (5760×3240)" },
        { ratio: 4, label: "Ultra 4K (7680×4320)" },
    ];

    return (
        <div
            data-hidden={hidden}
            className="fixed bottom-4 left-1/2 z-50 flex items-center gap-2 rounded-lg border bg-card px-3 py-2 shadow-lg transition-all data-[hidden=true]:pointer-events-none data-[hidden=true]:opacity-0"
            style={{ transform: hidden ? "translateX(-50%) translateY(20px)" : "translateX(-50%)" }}
        >
            {/* Fit toggle */}
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        variant={zoomMode === "fit" ? "default" : "outline"}
                        size="sm"
                        onClick={() => onSetMode("fit")}
                        className="h-8 px-3 text-xs font-bold uppercase tracking-wider"
                    >
                        <Maximize2 className="size-3.5" />
                        Fit
                    </Button>
                </TooltipTrigger>
                <TooltipContent>Auto-fit ke viewport</TooltipContent>
            </Tooltip>

            <Separator orientation="vertical" className="h-6" />

            {/* Zoom controls */}
            <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={() => { onSetMode("manual"); onSetManual(Math.max(0.25, manualZoom - 0.05)); }}
            >
                <Minus className="size-3.5" />
            </Button>

            <Slider
                value={[currentZoom]}
                min={0.25}
                max={1.5}
                step={0.05}
                onValueChange={([v]) => { onSetMode("manual"); onSetManual(v); }}
                className="w-28"
            />

            <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={() => { onSetMode("manual"); onSetManual(Math.min(1.5, manualZoom + 0.05)); }}
            >
                <Plus className="size-3.5" />
            </Button>

            <span className="min-w-12 text-center text-xs font-bold tabular-nums text-foreground">
                {Math.round(currentZoom * 100)}%
            </span>

            <Separator orientation="vertical" className="h-6" />

            {/* Export PNG dropdown */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="default"
                        size="sm"
                        disabled={isExporting}
                        className="h-8 gap-1.5 text-xs font-bold"
                    >
                        <Download className="size-3.5" />
                        {isExporting ? "Export…" : "PNG"}
                        <ChevronDown className="size-3" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" side="top" className="min-w-56">
                    {qualities.map((q) => (
                        <DropdownMenuItem
                            key={q.ratio}
                            onClick={() => onDownload(q.ratio)}
                            className="cursor-pointer"
                        >
                            <span className="font-mono font-bold text-amber-500">{q.ratio}×</span>
                            <span className="ml-2">{q.label}</span>
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>

            <Tooltip>
                <TooltipTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={onPresent}>
                        <Play className="size-3.5" />
                        Presentasi
                    </Button>
                </TooltipTrigger>
                <TooltipContent>Fullscreen — Esc untuk keluar</TooltipContent>
            </Tooltip>
        </div>
    );
}

/* ZoomBar — bottom-center Google Slides style zoom controls */
function ZoomBar({
    zoomMode, manualZoom, fitScale, onSetMode, onSetManual, hidden,
}: {
    zoomMode: "fit" | "manual";
    manualZoom: number;
    fitScale: number;
    onSetMode: (m: "fit" | "manual") => void;
    onSetManual: (v: number) => void;
    hidden?: boolean;
}) {
    const currentZoom = zoomMode === "fit" ? fitScale : manualZoom;
    const presets = [0.5, 0.75, 1, 1.25, 1.5];
    const btn: React.CSSProperties = {
        width: 24, height: 24,
        background: "var(--bg-2)",
        color: "var(--fg-0)",
        border: "1px solid var(--line)",
        borderRadius: 4,
        fontSize: 14, fontWeight: 700,
        cursor: "pointer",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
    };
    return (
        <div style={{
            position: "fixed",
            bottom: 16,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            gap: 12,
            background: "var(--bg-1)",
            border: "1px solid var(--line)",
            borderRadius: 10,
            padding: "8px 14px",
            boxShadow: "0 8px 24px -8px rgba(0,0,0,.4)",
            fontFamily: "var(--font-mono, monospace)",
            fontSize: 12,
        }}>
            <button
                onClick={() => onSetMode("fit")}
                style={{
                    padding: "5px 10px",
                    background: zoomMode === "fit" ? "var(--accent-amber)" : "transparent",
                    color: zoomMode === "fit" ? "#1a1300" : "var(--fg-1)",
                    border: "1px solid " + (zoomMode === "fit" ? "var(--accent-amber)" : "var(--line)"),
                    borderRadius: 4,
                    fontSize: 11, fontWeight: 700,
                    cursor: "pointer",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                }}
                title="Fit to viewport"
            >Fit</button>

            <div style={{ width: 1, height: 20, background: "var(--line)" }} />

            <button onClick={() => { onSetMode("manual"); onSetManual(Math.max(0.25, manualZoom - 0.05)); }} style={btn} title="Zoom out">−</button>
            <input
                type="range" min="0.25" max="1.5" step="0.05"
                value={currentZoom}
                onChange={(e) => { onSetMode("manual"); onSetManual(parseFloat(e.target.value)); }}
                style={{ width: 140, accentColor: "var(--accent-amber)", cursor: "pointer" }}
            />
            <button onClick={() => { onSetMode("manual"); onSetManual(Math.min(1.5, manualZoom + 0.05)); }} style={btn} title="Zoom in">+</button>

            <div style={{ minWidth: 48, textAlign: "center", color: "var(--fg-0)", fontWeight: 700 }}>
                {Math.round(currentZoom * 100)}%
            </div>

            <div style={{ width: 1, height: 20, background: "var(--line)" }} />

            {presets.map((p) => (
                <button
                    key={p}
                    onClick={() => { onSetMode("manual"); onSetManual(p); }}
                    style={{
                        padding: "4px 8px",
                        background: zoomMode === "manual" && Math.abs(currentZoom - p) < 0.01 ? "var(--bg-3)" : "transparent",
                        color: "var(--fg-1)",
                        border: "none",
                        borderRadius: 4,
                        fontSize: 10.5, fontWeight: 600,
                        cursor: "pointer",
                    }}
                    title={`Zoom ${Math.round(p * 100)}%`}
                >
                    {Math.round(p * 100)}%
                </button>
            ))}
        </div>
    );
}

function Loading({ text }: { text: string }) {
    return (
        <div className="slide" style={{ alignItems: "center", justifyContent: "center", gap: 16 }}>
            <Skeleton className="h-8 w-72" />
            <Skeleton className="h-32 w-full max-w-2xl rounded-md" />
            <p className="ds-body">{text}</p>
        </div>
    );
}

/* ═════════════════════════════════════════════════
   SlideFoot — footer rail (pindahan dari header)
   Format: [page/total] [section] [UPT Bogor · 7 Mei 2026 · Minggu 19]
   ═════════════════════════════════════════════════ */

function getISOWeek(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

/* HEADER rail — 3 kolom: page no kiri, SECTION center amber, tanggal+minggu kanan
 * Pakai CSS var theme-aware (var(--fg-*) / var(--line)) — ngikutin light/dark dashboard */
/* SlideHeadCompact — info rail kanan inline dengan title.
   Stack vertical: page no + section + tanggal/minggu. Pakai ds-* + tokens. */
function SlideHeadCompact({ pageNo, total, section }: { pageNo: number; total: number; section: string }) {
    const today = new Date();
    const dateStr = today.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
    const week = getISOWeek(today);

    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
                gap: 4,
                fontFamily: "var(--font-mono, monospace)",
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: "0.16em",
                color: "var(--fg-1)",
                fontWeight: 600,
                lineHeight: 1.4,
            }}
        >
            <span>
                <span style={{ color: "var(--fg-0)", fontWeight: 700 }}>{String(pageNo).padStart(2, "0")}</span>
                <span style={{ margin: "0 6px", color: "var(--fg-2)" }}>/</span>
                {String(total).padStart(2, "0")}
                <span style={{ margin: "0 10px", color: "var(--fg-2)" }}>·</span>
                <span style={{ color: "var(--accent-amber)", fontWeight: 700 }}>{section}</span>
            </span>
            <span style={{ color: "var(--fg-1)" }}>
                UPT Bogor &middot; {dateStr} &middot; Minggu {week}
            </span>
        </div>
    );
}

function SlideHead({ pageNo, total, section }: { pageNo: number; total: number; section: string }) {
    const today = new Date();
    const dateStr = today.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
    const week = getISOWeek(today);

    return (
        <div style={{
            display: "grid",
            gridTemplateColumns: "1fr auto 1fr",
            alignItems: "center",
            paddingBottom: 12,
            borderBottom: "1px solid var(--line)",
            fontSize: 12,
            textTransform: "uppercase",
            letterSpacing: "0.16em",
            color: "var(--fg-1)",
            fontFamily: "var(--font-mono, monospace)",
            fontWeight: 600,
            gap: 24,
        }}>
            <span style={{ justifySelf: "start" }}>
                <span style={{ color: "var(--fg-0)", fontWeight: 700 }}>{String(pageNo).padStart(2, "0")}</span>
                <span style={{ margin: "0 8px", color: "var(--fg-2)" }}>/</span>
                {String(total).padStart(2, "0")}
            </span>
            <span style={{
                justifySelf: "center",
                color: "var(--accent-amber)",
                fontWeight: 700,
                letterSpacing: "0.2em",
            }}>{section}</span>
            <span style={{ justifySelf: "end" }}>
                UPT Bogor &middot; {dateStr} &middot; Minggu {week}
            </span>
        </div>
    );
}

/* FOOTER rail — 3 kolom: page no kiri, SECTION center, tanggal kanan */
function SlideFoot({ pageNo, total, section }: { pageNo: number; total: number; section: string }) {
    const today = new Date();
    const dateStr = today.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
    const week = getISOWeek(today);

    return (
        <div style={{
            display: "grid",
            gridTemplateColumns: "1fr auto 1fr",
            alignItems: "center",
            marginTop: "auto",
            paddingTop: 12,
            borderTop: "1px solid var(--deck-line)",
            fontSize: 12,
            textTransform: "uppercase",
            letterSpacing: "0.16em",
            color: "var(--fg-1)",
            fontFamily: "var(--font-mono, monospace)",
            fontWeight: 600,
            gap: 24,
        }}>
            {/* KIRI: page no */}
            <span style={{ justifySelf: "start" }}>
                <span style={{ color: "var(--fg-0)", fontWeight: 700 }}>{String(pageNo).padStart(2, "0")}</span>
                <span style={{ margin: "0 8px", color: "var(--fg-2)" }}>/</span>
                {String(total).padStart(2, "0")}
            </span>

            {/* CENTER: section title (yang user mau di tengah) */}
            <span style={{
                justifySelf: "center",
                color: "var(--deck-amber)",
                fontWeight: 700,
                letterSpacing: "0.2em",
            }}>
                {section}
            </span>

            {/* KANAN: tanggal + minggu */}
            <span style={{ justifySelf: "end" }}>
                UPT Bogor &middot; {dateStr} &middot; Minggu {week}
            </span>
        </div>
    );
}

/* ═════════════════════════════════════════════════
   HeroSlide — KPI panel khusus slide presentasi
   Layout: Total panel (golden 1.618fr) + sub panels (1fr each)
   Karakter: dark, mono numbers, sans bold, color accent strong, no decoration
   ═════════════════════════════════════════════════ */

interface HeroPanel {
    caption: string;
    nickname?: string;
    programCount: number;
    target: number;
    realisasi: number;
    accent: string;
    highlight?: boolean;
}

function HeroSlide({ panels }: { panels: HeroPanel[] }) {
    const cols = panels.map((p) => (p.highlight ? "1.618fr" : "1fr")).join(" ");
    return (
        <div
            style={{
                display: "grid",
                gridTemplateColumns: cols,
                background: "var(--deck-bg-2)",
                border: "1px solid var(--deck-line)",
                borderRadius: 10,
                overflow: "hidden",
                marginBottom: 16,
            }}
        >
            {panels.map((p, i) => (
                <KpiSlidePanel
                    key={p.caption}
                    data={p}
                    hasBorderRight={i < panels.length - 1}
                />
            ))}
        </div>
    );
}

function KpiSlidePanel({ data, hasBorderRight }: { data: HeroPanel; hasBorderRight: boolean }) {
    const pct = data.target === 0 ? 0 : (data.realisasi / data.target) * 100;
    const isHighlight = !!data.highlight;
    const onProgress = Math.max(0, data.target - data.realisasi);

    return (
        <div
            style={{
                padding: "16px 24px",
                background: isHighlight
                    ? `linear-gradient(135deg, ${data.accent}14 0%, transparent 70%)`
                    : "transparent",
                borderRight: hasBorderRight ? "1px solid var(--deck-line)" : "none",
                display: "flex",
                flexDirection: "column",
                gap: 12,
                position: "relative",
                overflow: "hidden",
            }}
        >
            {/* Glow corner */}
            <div style={{
                position: "absolute",
                top: 0, right: 0,
                width: 240, height: 80,
                background: `radial-gradient(ellipse at top right, ${data.accent}22, transparent 70%)`,
                pointerEvents: "none",
            }} />

            {/* TOP: dash + caption */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, position: "relative" }}>
                <span style={{
                    width: 16, height: 1.5, background: data.accent,
                    flexShrink: 0,
                }} />
                <span style={{
                    fontSize: isHighlight ? 14 : 13,
                    fontWeight: 700,
                    color: "var(--fg-0)",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    whiteSpace: "nowrap",
                }}>{data.caption}</span>
            </div>

            {/* MIDDLE: mini metric inline (value FIRST, label after) */}
            <div style={{
                display: "flex",
                gap: 18,
                flexWrap: "wrap",
                fontSize: isHighlight ? 13 : 12,
                fontWeight: 600,
                color: "var(--fg-1)",
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                position: "relative",
            }}>
                <ValueLabel value={fmtNum(data.programCount)} label="Program" />
                <ValueLabel value={fmtNum(data.target)} label="Target" />
                <ValueLabel value={fmtNum(data.realisasi)} label="Selesai" valueColor={data.accent} />
                <ValueLabel value={fmtNum(onProgress)} label="On Progress" valueColor="#fbbf24" />
            </div>

            {/* BOTTOM: bar + persen inline (1 row, paling bawah) */}
            <div style={{
                display: "flex",
                alignItems: "center",
                gap: 18,
                marginTop: "auto",
                paddingTop: 4,
                position: "relative",
            }}>
                <div style={{
                    flex: 1,
                    height: isHighlight ? 14 : 12,
                    background: "var(--deck-bg-3)",
                    borderRadius: 7,
                    overflow: "hidden",
                    minWidth: 0,
                }}>
                    <div style={{
                        width: `${Math.min(100, pct)}%`,
                        height: "100%",
                        background: data.accent,
                        borderRadius: 7,
                        boxShadow: `0 0 10px ${data.accent}88`,
                    }} />
                </div>
                <span style={{
                    fontFamily: "var(--font-mono, monospace)",
                    fontSize: isHighlight ? 48 : 40,
                    fontWeight: 700,
                    color: data.accent,
                    letterSpacing: "-0.03em",
                    fontFeatureSettings: '"tnum"',
                    lineHeight: 1,
                    flexShrink: 0,
                }}>
                    {pct.toFixed(1)}%
                </span>
            </div>
        </div>
    );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
    return (
        <div className="cover-stat" style={{ padding: "18px 24px" }}>
            <div className="cover-stat-num" style={{
                fontSize: 44,
                fontWeight: 700,
                ...(accent ? { color: accent } : { color: "var(--fg-0)" }),
            }}>{value}</div>
            <div style={{
                fontSize: 14,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                color: "#e5e7eb",
                marginTop: 8,
            }}>{label}</div>
        </div>
    );
}

/* ═════════════════════════════════════════════════
   HeroSlim — extra compact KPI strip untuk slide
   Per panel: 2 row (top: caption+persen, bottom: program count + bar)
   Tinggi total ~80-90px
   ═════════════════════════════════════════════════ */
function HeroSlim({ panels }: { panels: HeroPanel[] }) {
    const cols = panels.map((p) => (p.highlight ? "1.4fr" : "1fr")).join(" ");
    return (
        <div style={{
            display: "grid",
            gridTemplateColumns: cols,
            background: "var(--deck-bg-2)",
            border: "1px solid var(--deck-line)",
            borderRadius: 10,
            overflow: "hidden",
            marginBottom: 16,
        }}>
            {panels.map((p, i) => (
                <HeroSlimPanel key={p.caption} data={p} hasBorderRight={i < panels.length - 1} />
            ))}
        </div>
    );
}

function HeroSlimPanel({ data, hasBorderRight }: { data: HeroPanel; hasBorderRight: boolean }) {
    const pct = data.target === 0 ? 0 : (data.realisasi / data.target) * 100;
    return (
        <div style={{
            padding: "20px 26px",
            background: data.highlight
                ? `linear-gradient(135deg, ${data.accent}12 0%, transparent 70%)`
                : "transparent",
            borderRight: hasBorderRight ? "1px solid var(--deck-line)" : "none",
            display: "flex",
            flexDirection: "column",
            gap: 14,
            position: "relative",
            overflow: "hidden",
        }}>
            {/* Top: dash + caption + persen kanan (BIG dominant) */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <span style={{
                        width: 16, height: 1.5, background: data.accent,
                        flexShrink: 0,
                    }} />
                    <span style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: "var(--fg-0)",
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        whiteSpace: "nowrap",
                    }}>{data.caption}</span>
                </div>
                <span style={{
                    fontFamily: "var(--font-mono, monospace)",
                    fontSize: data.highlight ? 44 : 38,
                    fontWeight: 700,
                    color: data.accent,
                    letterSpacing: "-0.03em",
                    fontFeatureSettings: '"tnum"',
                    lineHeight: 1,
                    flexShrink: 0,
                }}>
                    {pct.toFixed(1)}%
                </span>
            </div>

            {/* Bottom: program count mini + bar */}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "var(--fg-1)",
                    textTransform: "uppercase",
                    letterSpacing: "0.12em",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                }}>
                    <span style={{
                        color: "var(--fg-0)",
                        fontFamily: "var(--font-mono, monospace)",
                        fontWeight: 700,
                        fontSize: 13,
                        marginRight: 4,
                        fontFeatureSettings: '"tnum"',
                    }}>{fmtNum(data.programCount)}</span>
                    Program
                </span>
                <div style={{
                    flex: 1,
                    height: 6,
                    background: "var(--deck-bg-3)",
                    borderRadius: 3,
                    overflow: "hidden",
                    minWidth: 0,
                }}>
                    <div style={{
                        width: `${Math.min(100, pct)}%`,
                        height: "100%",
                        background: data.accent,
                        borderRadius: 3,
                        boxShadow: `0 0 6px ${data.accent}66`,
                    }} />
                </div>
                <span style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "var(--fg-1)",
                    textTransform: "uppercase",
                    letterSpacing: "0.12em",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                    fontFamily: "var(--font-mono, monospace)",
                }}>
                    <span style={{ color: "var(--fg-0)", fontWeight: 700, fontSize: 13, marginRight: 4 }}>{fmtNum(data.realisasi)}</span>
                    /
                    <span style={{ marginLeft: 4 }}>{fmtNum(data.target)}</span>
                </span>
            </div>
        </div>
    );
}

/* ═════════════════════════════════════════════════
   UltgCard — versi pertama clean: name + persen + bar + 2 metric inline
   ═════════════════════════════════════════════════ */
function UltgCard({ name, target, real, accent, aboCount, psCount }: {
    name: string; target: number; real: number; accent: string;
    aboCount?: number; psCount?: number;
}) {
    const p = target === 0 ? 0 : (real / target) * 100;
    return (
        <div style={{
            background: "var(--deck-bg-2)",
            border: "1px solid var(--deck-line)",
            borderRadius: 8,
            padding: "12px 18px",
            display: "flex",
            flexDirection: "column",
            gap: 8,
            position: "relative",
            overflow: "hidden",
        }}>
            {/* Top: [dash] name (kiri) | persen GEDE (kanan) */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{
                        width: 18, height: 2, background: accent,
                        flexShrink: 0,
                    }} />
                    <span style={{
                        fontSize: 18,
                        fontWeight: 700,
                        color: "var(--fg-0)",
                        letterSpacing: "-0.005em",
                    }}>{name}</span>
                </div>

                <span style={{
                    fontFamily: "var(--font-mono, monospace)",
                    fontSize: 40,
                    fontWeight: 700,
                    color: accent,
                    letterSpacing: "-0.03em",
                    fontFeatureSettings: '"tnum"',
                    lineHeight: 1,
                    flexShrink: 0,
                }}>
                    {p.toFixed(1)}%
                </span>
            </div>

            {/* Middle: bar progress */}
            <div style={{
                height: 6,
                background: "var(--deck-bg-3)",
                borderRadius: 3,
                overflow: "hidden",
            }}>
                <div style={{
                    width: `${Math.min(100, p)}%`,
                    height: "100%",
                    background: accent,
                    borderRadius: 3,
                    boxShadow: `0 0 6px ${accent}66`,
                }} />
            </div>

            {/* Bottom: 3 cell — Target (kiri) | ABO·PS (center) | Realisasi (kanan) */}
            <div style={{
                display: "grid",
                gridTemplateColumns: "1fr auto 1fr",
                alignItems: "center",
                gap: 16,
                fontSize: 11,
                fontWeight: 600,
                color: "var(--fg-1)",
                textTransform: "uppercase",
                letterSpacing: "0.12em",
            }}>
                <span style={{ justifySelf: "start" }}>
                    <span style={{
                        color: "var(--fg-0)",
                        fontFamily: "var(--font-mono, monospace)",
                        fontWeight: 700,
                        fontSize: 14,
                        marginRight: 6,
                        fontFeatureSettings: '"tnum"',
                    }}>{fmtNum(target)}</span>
                    Target
                </span>

                {/* CENTER: ABO + PS count, ukuran teks sama dengan label Target/Realisasi */}
                {(aboCount !== undefined || psCount !== undefined) && (
                    <span style={{ justifySelf: "center", display: "inline-flex", gap: 14 }}>
                        {aboCount !== undefined && (
                            <span>
                                <span style={{
                                    color: C.abo,
                                    fontFamily: "var(--font-mono, monospace)",
                                    fontWeight: 700,
                                    fontSize: 14,
                                    marginRight: 6,
                                    fontFeatureSettings: '"tnum"',
                                }}>{fmtNum(aboCount)}</span>
                                ABO
                            </span>
                        )}
                        {psCount !== undefined && (
                            <span>
                                <span style={{
                                    color: C.lm,
                                    fontFamily: "var(--font-mono, monospace)",
                                    fontWeight: 700,
                                    fontSize: 14,
                                    marginRight: 6,
                                    fontFeatureSettings: '"tnum"',
                                }}>{fmtNum(psCount)}</span>
                                PS
                            </span>
                        )}
                    </span>
                )}

                <span style={{ justifySelf: "end" }}>
                    <span style={{
                        color: accent,
                        fontFamily: "var(--font-mono, monospace)",
                        fontWeight: 700,
                        fontSize: 14,
                        marginRight: 6,
                        fontFeatureSettings: '"tnum"',
                    }}>{fmtNum(real)}</span>
                    Realisasi
                </span>
            </div>

        </div>
    );
}

/* ValueLabel — inline format "<value> <label>" — number first, label after */
function ValueLabel({ value, label, valueColor }: { value: string; label: string; valueColor?: string }) {
    return (
        <span style={{ display: "inline-flex", alignItems: "baseline", gap: 6 }}>
            <span style={{
                color: valueColor || "#ffffff",
                fontFamily: "var(--font-mono, monospace)",
                fontFeatureSettings: '"tnum"',
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: "-0.01em",
            }}>{value}</span>
            <span>{label}</span>
        </span>
    );
}

function Metric({ label, value, accent, muted }: { label: string; value: string; accent?: string; muted?: boolean }) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 3, alignItems: "flex-start" }}>
            <span style={{
                fontSize: 10.5,
                fontWeight: 700,
                color: "var(--fg-1)",
                textTransform: "uppercase",
                letterSpacing: "0.14em",
            }}>{label}</span>
            <span style={{
                fontFamily: "var(--font-mono, monospace)",
                fontSize: 22,
                fontWeight: 700,
                color: accent || (muted ? "#a1a1aa" : "#ffffff"),
                letterSpacing: "-0.015em",
                fontFeatureSettings: '"tnum"',
                lineHeight: 1,
            }}>{value}</span>
        </div>
    );
}

function PanelCard({ title, count, accent, children }: {
    title: string; count: number; accent: string; children: React.ReactNode;
}) {
    return (
        <Card noPad style={{ minHeight: 0 }}>
            {/* Caption pattern v1.0: dash 16x1.5px + uppercase label */}
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "16px 20px",
                    borderBottom: "1px solid var(--line)",
                }}
            >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 16, height: 1.5, background: accent, flexShrink: 0 }} />
                    <span
                        style={{
                            fontSize: 11,
                            color: "var(--fg-0)",
                            textTransform: "uppercase",
                            letterSpacing: "0.12em",
                            fontWeight: 600,
                        }}
                    >
                        {title}
                    </span>
                </div>
                <span className="ds-small num">{count} program</span>
            </div>
            <div style={{ flex: 1, minHeight: 0, overflow: "hidden", padding: "12px 20px 16px" }}>
                {children}
            </div>
        </Card>
    );
}
