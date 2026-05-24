"use client";

/**
 * /presentation/program-kerja
 *
 * 1 URL container untuk SEMUA slide deck Program Kerja UPT Bogor.
 * - Multi-slide deck dengan keyboard navigation (← →)
 * - URL sync via ?slide=N (deep link)
 * - Slide counter di UnifiedBar
 * - Auto-scale + fullscreen presenter mode
 *
 * Pattern reusable untuk page slide deck lain (CE Next Level dll) — tinggal swap _slides/.
 */

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toPng } from "html-to-image";
import { Maximize2, Minus, Plus, Download, Play, X, Settings, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { CoverSlide } from "./_slides/CoverSlide";
import { RingkasanSlide } from "./_slides/RingkasanSlide";
import { TransmisiSlide } from "./_slides/TransmisiSlide";
import { ProteksiSlide } from "./_slides/ProteksiSlide";
import { GarduIndukSlide } from "./_slides/GarduIndukSlide";

interface SlideDef {
    key: string;
    title: string;
    component: React.ComponentType<{ slideNo: number; total: number }>;
}

const SLIDES: SlideDef[] = [
    { key: "cover", title: "Cover", component: CoverSlide },
    { key: "ringkasan", title: "Ringkasan UPT Bogor", component: RingkasanSlide },
    { key: "transmisi", title: "Transmisi", component: TransmisiSlide },
    { key: "gardu-induk", title: "Gardu Induk", component: GarduIndukSlide },
    { key: "proteksi", title: "Proteksi", component: ProteksiSlide },
    // TODO: ULTG Bogor breakdown × 3 bidang
    // TODO: ULTG Sukabumi breakdown × 3 bidang
];

export default function DeckPage() {
    return (
        <Suspense fallback={<DeckLoading />}>
            <DeckContent />
        </Suspense>
    );
}

function DeckContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const slideRef = useRef<HTMLDivElement>(null);

    /* Slide state, sync with URL ?slide=N (1-based) */
    const initial = parseInt(searchParams.get("slide") || "1", 10) - 1;
    const [idx, setIdx] = useState(Math.max(0, Math.min(SLIDES.length - 1, initial)));

    /* Sync URL when idx changes */
    useEffect(() => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("slide", String(idx + 1));
        router.replace(`?${params.toString()}`, { scroll: false });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [idx]);

    /* Keyboard navigation: ← → Space PgUp PgDn Home End */
    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            const target = e.target as HTMLElement;
            if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
            if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") {
                e.preventDefault();
                setIdx((i) => Math.min(SLIDES.length - 1, i + 1));
            } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
                e.preventDefault();
                setIdx((i) => Math.max(0, i - 1));
            } else if (e.key === "Home") {
                e.preventDefault();
                setIdx(0);
            } else if (e.key === "End") {
                e.preventDefault();
                setIdx(SLIDES.length - 1);
            }
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    /* Auto-scale slide canvas */
    const [zoomMode, setZoomMode] = useState<"fit" | "manual">("fit");
    const [manualZoom, setManualZoom] = useState(0.85);
    const [fitScale, setFitScale] = useState(1);
    const [showControls, setShowControls] = useState(true);
    const [isExporting, setIsExporting] = useState(false);

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

    const scale = zoomMode === "fit" ? fitScale : manualZoom;
    const Slide = SLIDES[idx].component;

    async function downloadPng(pixelRatio: number) {
        if (!slideRef.current || isExporting) return;
        setIsExporting(true);
        try {
            const computedBg = getComputedStyle(slideRef.current).backgroundColor;
            const dataUrl = await toPng(slideRef.current, {
                pixelRatio,
                cacheBust: true,
                backgroundColor: computedBg || undefined,
            });
            const stamp = new Date().toISOString().slice(0, 10);
            const a = document.createElement("a");
            a.href = dataUrl;
            a.download = `deck-${SLIDES[idx].key}-${stamp}-${pixelRatio}x.png`;
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

    return (
        <>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        variant="outline" size="icon"
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
                idx={idx}
                total={SLIDES.length}
                slides={SLIDES}
                onPrev={() => setIdx((i) => Math.max(0, i - 1))}
                onNext={() => setIdx((i) => Math.min(SLIDES.length - 1, i + 1))}
                onJump={setIdx}
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
                    <div ref={slideRef}>
                        <Slide slideNo={idx + 1} total={SLIDES.length} />
                    </div>
                </div>
            </div>
        </>
    );
}

function DeckLoading() {
    return (
        <div className="slide" style={{ alignItems: "center", justifyContent: "center", gap: 16 }}>
            <Skeleton className="h-8 w-72" />
            <Skeleton className="h-32 w-full max-w-2xl rounded-md" />
            <p className="ds-body">Memuat deck…</p>
        </div>
    );
}

/* ─────────── UnifiedBar (with slide nav) ─────────── */

interface UnifiedBarProps {
    hidden: boolean;
    idx: number;
    total: number;
    slides: SlideDef[];
    onPrev: () => void;
    onNext: () => void;
    onJump: (idx: number) => void;
    zoomMode: "fit" | "manual";
    manualZoom: number;
    fitScale: number;
    onSetMode: (m: "fit" | "manual") => void;
    onSetManual: (v: number) => void;
    onDownload: (px: number) => void;
    isExporting: boolean;
    onPresent: () => void;
}

function UnifiedBar({
    hidden, idx, total, slides, onPrev, onNext, onJump,
    zoomMode, manualZoom, fitScale, onSetMode, onSetManual,
    onDownload, isExporting, onPresent,
}: UnifiedBarProps) {
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
            {/* === Slide navigation === */}
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-7" onClick={onPrev} disabled={idx === 0}>
                        <ChevronLeft className="size-4" />
                    </Button>
                </TooltipTrigger>
                <TooltipContent>Slide sebelumnya (←)</TooltipContent>
            </Tooltip>

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs font-mono tabular-nums">
                        <span className="font-bold">{String(idx + 1).padStart(2, "0")}</span>
                        <span className="text-muted-foreground">/{String(total).padStart(2, "0")}</span>
                        <ChevronDown className="size-3" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" side="top" className="min-w-56">
                    {slides.map((s, i) => (
                        <DropdownMenuItem key={s.key} onClick={() => onJump(i)}
                            className={`cursor-pointer ${i === idx ? "bg-accent" : ""}`}>
                            <span className="font-mono text-xs text-muted-foreground mr-2">{String(i + 1).padStart(2, "0")}</span>
                            <span>{s.title}</span>
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>

            <Tooltip>
                <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-7" onClick={onNext} disabled={idx === total - 1}>
                        <ChevronRight className="size-4" />
                    </Button>
                </TooltipTrigger>
                <TooltipContent>Slide berikutnya (→)</TooltipContent>
            </Tooltip>

            <Separator orientation="vertical" className="h-6" />

            {/* === Zoom === */}
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
                <TooltipContent>Auto-fit</TooltipContent>
            </Tooltip>

            <Button variant="ghost" size="icon" className="size-7"
                onClick={() => { onSetMode("manual"); onSetManual(Math.max(0.25, manualZoom - 0.05)); }}>
                <Minus className="size-3.5" />
            </Button>
            <Slider value={[currentZoom]} min={0.25} max={1.5} step={0.05}
                onValueChange={([v]) => { onSetMode("manual"); onSetManual(v); }}
                className="w-24" />
            <Button variant="ghost" size="icon" className="size-7"
                onClick={() => { onSetMode("manual"); onSetManual(Math.min(1.5, manualZoom + 0.05)); }}>
                <Plus className="size-3.5" />
            </Button>
            <span className="min-w-12 text-center text-xs font-bold tabular-nums text-foreground">
                {Math.round(currentZoom * 100)}%
            </span>

            <Separator orientation="vertical" className="h-6" />

            {/* === Export === */}
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
                <TooltipContent>Fullscreen — Esc keluar</TooltipContent>
            </Tooltip>
        </div>
    );
}
