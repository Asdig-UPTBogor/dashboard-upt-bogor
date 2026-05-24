"use client";

import { useEffect, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { Maximize2, Minus, Plus, Download, Play, X, Settings, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/designer/Card";
import {
    IL2_ITEMS, PS_ITEMS, ABO_ITEMS, GI_KATEGORI_ACCENT, type GiItem,
} from "./_data/gi-items";
import { ProgramBarChartGi } from "./_components/ProgramBarChartGi";

const BIDANG = "Gardu Induk";
const PERIODE = "2026";

const C = {
    il2: GI_KATEGORI_ACCENT.il2,    // blue
    ps: GI_KATEGORI_ACCENT.ps,      // amber
    abo: GI_KATEGORI_ACCENT.abo,    // green
    bogor: "#5b8def",
    sukabumi: "#f08a3e",
};

function fmtNum(n: number): string {
    if (!Number.isFinite(n)) return "0";
    return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(n);
}

function pct(num: number, den: number): number {
    if (!den || den === 0) return 0;
    return (num / den) * 100;
}

function getISOWeek(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

export default function PresentationGiSlide() {
    const slideRef = useRef<HTMLElement>(null);
    const [isExporting, setIsExporting] = useState(false);
    const [zoomMode, setZoomMode] = useState<"fit" | "manual">("fit");
    const [manualZoom, setManualZoom] = useState(0.85);
    const [showControls, setShowControls] = useState(true);
    const [fitScale, setFitScale] = useState(1);
    const [scale, setScale] = useState(0.85);

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

    useEffect(() => {
        setScale(zoomMode === "fit" ? fitScale : manualZoom);
    }, [zoomMode, fitScale, manualZoom]);

    async function downloadPng(pixelRatio: number) {
        if (!slideRef.current || isExporting) return;
        setIsExporting(true);
        try {
            const computedBg = getComputedStyle(slideRef.current).backgroundColor;
            const dataUrl = await toPng(slideRef.current, {
                pixelRatio, cacheBust: true,
                backgroundColor: computedBg || undefined,
            });
            const stamp = new Date().toISOString().slice(0, 10);
            const a = document.createElement("a");
            a.href = dataUrl;
            a.download = `program-kerja-gardu-induk-${stamp}-${pixelRatio}x.png`;
            a.click();
        } finally {
            setIsExporting(false);
        }
    }

    function startPresentation() {
        const root = document.querySelector(".presentation-root");
        if (root && (root as HTMLElement).requestFullscreen) {
            (root as HTMLElement).requestFullscreen();
        }
    }

    /* Aggregate */
    const allItems = [...IL2_ITEMS, ...PS_ITEMS, ...ABO_ITEMS];
    const totalT = allItems.reduce((s, it) => s + it.totalTarget, 0);
    const totalR = allItems.reduce((s, it) => s + it.totalReal, 0);
    const il2T = IL2_ITEMS.reduce((s, it) => s + it.totalTarget, 0);
    const il2R = IL2_ITEMS.reduce((s, it) => s + it.totalReal, 0);
    const psT = PS_ITEMS.reduce((s, it) => s + it.totalTarget, 0);
    const psR = PS_ITEMS.reduce((s, it) => s + it.totalReal, 0);
    const aboT = ABO_ITEMS.reduce((s, it) => s + it.totalTarget, 0);
    const aboR = ABO_ITEMS.reduce((s, it) => s + it.totalReal, 0);
    const bogorT = allItems.reduce((s, it) => s + it.targetBogor, 0);
    const bogorR = allItems.reduce((s, it) => s + it.realBogor, 0);
    const skbmT = allItems.reduce((s, it) => s + it.targetSukabumi, 0);
    const skbmR = allItems.reduce((s, it) => s + it.realSukabumi, 0);

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
                        {/* Header row */}
                        <div className="flex justify-between items-end gap-3" style={{ marginBottom: 16 }}>
                            <h1 style={{
                                fontSize: 44,
                                fontWeight: 800,
                                letterSpacing: "-0.02em",
                                margin: 0,
                                color: "var(--fg-0)",
                            }}>
                                Program Kerja {BIDANG} <span style={{ color: C.ps }}>{PERIODE}</span>
                            </h1>
                            <SlideHeadCompact pageNo={1} total={1} section={`Program Kerja ${BIDANG}`} />
                        </div>

                        {/* Hero KPI: Total + IL2 + PS + ABO (4 panels) */}
                        <HeroSlim panels={[
                            { caption: "Program Kerja Gardu Induk", count: allItems.length, target: totalT, real: totalR, accent: "#a855f7", highlight: true },
                            { caption: "Anti Blackout", count: ABO_ITEMS.length, target: aboT, real: aboR, accent: C.abo },
                            { caption: "Program Strategis", count: PS_ITEMS.length, target: psT, real: psR, accent: C.ps },
                            { caption: "IL 2", count: IL2_ITEMS.length, target: il2T, real: il2R, accent: C.il2 },
                        ]} />

                        {/* ULTG section */}
                        <div style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: 16,
                            marginBottom: 16,
                        }}>
                            <UltgCard
                                name="ULTG Bogor" target={bogorT} real={bogorR} accent={C.bogor}
                                il2Count={IL2_ITEMS.filter((it) => it.targetBogor > 0).length}
                                psCount={PS_ITEMS.filter((it) => it.targetBogor > 0).length}
                                aboCount={ABO_ITEMS.filter((it) => it.targetBogor > 0).length}
                            />
                            <UltgCard
                                name="ULTG Sukabumi" target={skbmT} real={skbmR} accent={C.sukabumi}
                                il2Count={IL2_ITEMS.filter((it) => it.targetSukabumi > 0).length}
                                psCount={PS_ITEMS.filter((it) => it.targetSukabumi > 0).length}
                                aboCount={ABO_ITEMS.filter((it) => it.targetSukabumi > 0).length}
                            />
                        </div>

                        {/* 3-panel ABO + IL2 + PS bar list */}
                        <div style={{
                            display: "grid",
                            gridTemplateColumns: "3fr 5fr 4fr",
                            gap: 20,
                            flex: 1,
                            minHeight: 0,
                        }}>
                            <PanelCard title="Anti Blackout" count={ABO_ITEMS.length} accent={C.abo}>
                                <ProgramBarChartGi items={ABO_ITEMS} accent={C.abo} cols={1} />
                            </PanelCard>
                            <PanelCard title="Program Strategis" count={PS_ITEMS.length} accent={C.ps}>
                                <ProgramBarChartGi items={PS_ITEMS} accent={C.ps} cols={2} />
                            </PanelCard>
                            <PanelCard title="IL 2" count={IL2_ITEMS.length} accent={C.il2}>
                                <ProgramBarChartGi items={IL2_ITEMS} accent={C.il2} cols={1} />
                            </PanelCard>
                        </div>
                    </section>
                </div>
            </div>
        </>
    );
}

/* ─────────── shared sub components (copy pattern Transmisi) ─────────── */

function SlideHeadCompact({ pageNo, total, section }: { pageNo: number; total: number; section: string }) {
    const today = new Date();
    const dateStr = today.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
    const week = getISOWeek(today);
    return (
        <div style={{
            display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4,
            fontFamily: "var(--font-mono, monospace)", fontSize: 11,
            textTransform: "uppercase", letterSpacing: "0.16em",
            color: "var(--fg-1)", fontWeight: 600, lineHeight: 1.4,
        }}>
            <span>
                <span style={{ color: "var(--fg-0)", fontWeight: 700 }}>{String(pageNo).padStart(2, "0")}</span>
                <span style={{ margin: "0 6px", color: "var(--fg-2)" }}>/</span>
                {String(total).padStart(2, "0")}
                <span style={{ margin: "0 10px", color: "var(--fg-2)" }}>·</span>
                <span style={{ color: "var(--accent-amber)", fontWeight: 700 }}>{section}</span>
            </span>
            <span>UPT Bogor &middot; {dateStr} &middot; Minggu {week}</span>
        </div>
    );
}

interface HeroPanel {
    caption: string;
    count: number;
    target: number;
    real: number;
    accent: string;
    highlight?: boolean;
}

function HeroSlim({ panels }: { panels: HeroPanel[] }) {
    const cols = panels.map((p) => (p.highlight ? "1.4fr" : "1fr")).join(" ");
    return (
        <Card noPad style={{ marginBottom: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: cols }}>
                {panels.map((p, i) => (
                    <HeroSlimPanel key={p.caption} data={p} hasBorderRight={i < panels.length - 1} />
                ))}
            </div>
        </Card>
    );
}

function HeroSlimPanel({ data, hasBorderRight }: { data: HeroPanel; hasBorderRight: boolean }) {
    const p = pct(data.real, data.target);
    return (
        <div style={{
            padding: "20px 26px",
            background: data.highlight
                ? `linear-gradient(135deg, ${data.accent}14 0%, transparent 70%)`
                : "transparent",
            borderRight: hasBorderRight ? "1px solid var(--line)" : "none",
            display: "flex", flexDirection: "column", gap: 14,
            position: "relative", overflow: "hidden",
        }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <span style={{ width: 16, height: 1.5, background: data.accent, flexShrink: 0 }} />
                    <span style={{
                        fontSize: 13, fontWeight: 700, color: "var(--fg-0)",
                        textTransform: "uppercase", letterSpacing: "0.08em",
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }}>{data.caption}</span>
                </div>
                <span style={{
                    fontFamily: "var(--font-mono, monospace)",
                    fontSize: data.highlight ? 38 : 32, fontWeight: 700,
                    color: data.accent, letterSpacing: "-0.025em",
                    fontFeatureSettings: '"tnum"', lineHeight: 1, flexShrink: 0,
                }}>{p.toFixed(1)}%</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{
                    fontSize: 11, fontWeight: 600, color: "var(--fg-1)",
                    textTransform: "uppercase", letterSpacing: "0.1em",
                    whiteSpace: "nowrap", flexShrink: 0,
                }}>
                    <span style={{ color: "var(--fg-0)", fontFamily: "var(--font-mono, monospace)", fontWeight: 700, fontSize: 13, marginRight: 4, fontFeatureSettings: '"tnum"' }}>
                        {fmtNum(data.count)}
                    </span>
                    Program
                </span>
                <div style={{ flex: 1, height: 6, background: "var(--bg-2)", borderRadius: 3, overflow: "hidden", minWidth: 0 }}>
                    <div style={{
                        width: `${Math.min(100, p)}%`, height: "100%",
                        background: data.accent, borderRadius: 3,
                        boxShadow: `0 0 6px ${data.accent}66`,
                    }} />
                </div>
                <span style={{
                    fontSize: 11, fontWeight: 600, color: "var(--fg-1)",
                    textTransform: "uppercase", letterSpacing: "0.1em",
                    whiteSpace: "nowrap", flexShrink: 0,
                    fontFamily: "var(--font-mono, monospace)",
                }}>
                    <span style={{ color: "var(--fg-0)", fontWeight: 700, fontSize: 13, marginRight: 4 }}>{fmtNum(data.real)}</span>
                    /
                    <span style={{ marginLeft: 4 }}>{fmtNum(data.target)}</span>
                </span>
            </div>
        </div>
    );
}

function UltgCard({ name, target, real, accent, il2Count, psCount, aboCount }: {
    name: string; target: number; real: number; accent: string;
    il2Count: number; psCount: number; aboCount: number;
}) {
    const p = pct(real, target);
    return (
        <Card style={{ padding: "16px 22px", display: "flex", flexDirection: "column", gap: 10 }}>
            {/* Top: name + persen */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ width: 18, height: 2, background: accent, flexShrink: 0 }} />
                    <span style={{
                        fontSize: 18, fontWeight: 700, color: "var(--fg-0)",
                        letterSpacing: "-0.005em",
                    }}>{name}</span>
                </div>
                <span style={{
                    fontFamily: "var(--font-mono, monospace)",
                    fontSize: 40, fontWeight: 700, color: accent,
                    letterSpacing: "-0.03em", fontFeatureSettings: '"tnum"',
                    lineHeight: 1, flexShrink: 0,
                }}>{p.toFixed(1)}%</span>
            </div>

            {/* Bar */}
            <div style={{ height: 6, background: "var(--bg-2)", borderRadius: 3, overflow: "hidden" }}>
                <div style={{
                    width: `${Math.min(100, p)}%`, height: "100%",
                    background: accent, borderRadius: 3, boxShadow: `0 0 6px ${accent}66`,
                }} />
            </div>

            {/* Bottom 5-cell grid: Target | IL2 | PS | ABO | Realisasi */}
            <div style={{
                display: "grid",
                gridTemplateColumns: "1fr auto auto auto 1fr",
                alignItems: "center",
                gap: 14,
                fontSize: 11, fontWeight: 600, color: "var(--fg-1)",
                textTransform: "uppercase", letterSpacing: "0.12em",
            }}>
                <span style={{ justifySelf: "start" }}>
                    <span style={{ color: "var(--fg-0)", fontFamily: "var(--font-mono, monospace)", fontWeight: 700, fontSize: 14, marginRight: 6, fontFeatureSettings: '"tnum"' }}>
                        {fmtNum(target)}
                    </span>
                    Target
                </span>
                <span><span style={{ color: C.il2, fontFamily: "var(--font-mono, monospace)", fontWeight: 700, fontSize: 14, marginRight: 5, fontFeatureSettings: '"tnum"' }}>{il2Count}</span>IL 2</span>
                <span><span style={{ color: C.ps, fontFamily: "var(--font-mono, monospace)", fontWeight: 700, fontSize: 14, marginRight: 5, fontFeatureSettings: '"tnum"' }}>{psCount}</span>PS</span>
                <span><span style={{ color: C.abo, fontFamily: "var(--font-mono, monospace)", fontWeight: 700, fontSize: 14, marginRight: 5, fontFeatureSettings: '"tnum"' }}>{aboCount}</span>ABO</span>
                <span style={{ justifySelf: "end" }}>
                    <span style={{ color: accent, fontFamily: "var(--font-mono, monospace)", fontWeight: 700, fontSize: 14, marginRight: 6, fontFeatureSettings: '"tnum"' }}>
                        {fmtNum(real)}
                    </span>
                    Realisasi
                </span>
            </div>
        </Card>
    );
}

function PanelCard({ title, count, accent, children }: {
    title: string; count: number; accent: string; children: React.ReactNode;
}) {
    return (
        <Card noPad style={{ minHeight: 0 }}>
            <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "14px 18px", borderBottom: "1px solid var(--line)",
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 16, height: 1.5, background: accent, flexShrink: 0 }} />
                    <span style={{
                        fontSize: 11, color: "var(--fg-0)",
                        textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 600,
                    }}>{title}</span>
                </div>
                <span className="ds-small num">{count} program</span>
            </div>
            <div style={{ flex: 1, minHeight: 0, overflow: "hidden", padding: "12px 18px 16px" }}>
                {children}
            </div>
        </Card>
    );
}

/* UnifiedBar — sama dengan Transmisi */
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

            <Button variant="ghost" size="icon" className="size-7"
                onClick={() => { onSetMode("manual"); onSetManual(Math.max(0.25, manualZoom - 0.05)); }}>
                <Minus className="size-3.5" />
            </Button>

            <Slider
                value={[currentZoom]} min={0.25} max={1.5} step={0.05}
                onValueChange={([v]) => { onSetMode("manual"); onSetManual(v); }}
                className="w-28"
            />

            <Button variant="ghost" size="icon" className="size-7"
                onClick={() => { onSetMode("manual"); onSetManual(Math.min(1.5, manualZoom + 0.05)); }}>
                <Plus className="size-3.5" />
            </Button>

            <span className="min-w-12 text-center text-xs font-bold tabular-nums text-foreground">
                {Math.round(currentZoom * 100)}%
            </span>

            <Separator orientation="vertical" className="h-6" />

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="default" size="sm" disabled={isExporting} className="h-8 gap-1.5 text-xs font-bold">
                        <Download className="size-3.5" />
                        {isExporting ? "Export…" : "PNG"}
                        <ChevronDown className="size-3" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" side="top" className="min-w-56">
                    {qualities.map((q) => (
                        <DropdownMenuItem key={q.ratio} onClick={() => onDownload(q.ratio)} className="cursor-pointer">
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
