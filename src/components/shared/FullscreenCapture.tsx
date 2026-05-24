"use client";

import { useEffect, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { Icon } from "@/components/designer/Icon";

const BTN_BASE: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 12px",
    fontSize: 12,
    fontWeight: 500,
    borderRadius: "var(--r-sm)",
    cursor: "pointer",
    transition: "all .15s ease",
    border: "1px solid var(--line)",
    background: "transparent",
    color: "var(--fg-1)",
};

const BTN_PRIMARY: React.CSSProperties = {
    ...BTN_BASE,
    background: "var(--accent-amber)",
    color: "#1a1300",
    borderColor: "var(--accent-amber)",
    fontWeight: 600,
};

/**
 * FullscreenCapture — overlay buat tampilan satu-layar yang siap di-screenshot
 * atau di-export sebagai PNG. Hide app chrome (sidebar/header), full viewport.
 *
 * Pemakaian:
 *   <FullscreenCapture title="Program Kerja Transmisi 2026" onClose={...}>
 *     <ProgramKerjaTransmisiContent fullscreen embedded ... />
 *   </FullscreenCapture>
 *
 * Tombol bawaan:
 * - Unduh PNG (toPng pixelRatio 2 → file tajam ~3MB landscape 16:9)
 * - Toggle tema light/dark (lewat next-themes — atau via prop kalau perlu custom)
 * - Keluar (Esc juga bisa)
 */

interface FullscreenCaptureProps {
    title: string;
    subtitle?: string;
    onClose: () => void;
    onToggleTheme?: () => void;
    currentTheme?: "light" | "dark";
    /** Nama file PNG (tanpa ext). Default = title slug. */
    fileName?: string;
    children: React.ReactNode;
}

export function FullscreenCapture({
    title,
    subtitle,
    onClose,
    onToggleTheme,
    currentTheme = "dark",
    fileName,
    children,
}: FullscreenCaptureProps) {
    const captureRef = useRef<HTMLDivElement>(null);
    const [isExporting, setIsExporting] = useState(false);

    /* Esc untuk close */
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", onKey);
        document.body.style.overflow = "hidden";
        return () => {
            window.removeEventListener("keydown", onKey);
            document.body.style.overflow = "";
        };
    }, [onClose]);

    async function downloadPng() {
        if (!captureRef.current || isExporting) return;
        setIsExporting(true);
        try {
            const dataUrl = await toPng(captureRef.current, {
                pixelRatio: 2,
                cacheBust: true,
                backgroundColor:
                    currentTheme === "dark" ? "#0b0b0b" : "#ffffff",
                /* skip elemen tombol kontrol biar ga kebawa di hasil */
                filter: (node) => {
                    if (!(node instanceof HTMLElement)) return true;
                    return !node.dataset.captureExclude;
                },
            });
            const slug = (fileName || title)
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-|-$/g, "");
            const a = document.createElement("a");
            a.href = dataUrl;
            a.download = `${slug}-${new Date().toISOString().slice(0, 10)}.png`;
            a.click();
        } catch (err) {
            console.error("[FullscreenCapture] export PNG gagal:", err);
            alert("Gagal export PNG. Cek console browser untuk detail.");
        } finally {
            setIsExporting(false);
        }
    }

    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                background: "var(--bg-0)",
                zIndex: 9999,
                overflow: "auto",
                display: "flex",
                flexDirection: "column",
            }}
            data-fullscreen-capture
        >
            {/* Toolbar — fixed top, exclude dari capture */}
            <div
                data-capture-exclude="true"
                style={{
                    position: "sticky",
                    top: 0,
                    zIndex: 10,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 20px",
                    background: "var(--bg-1)",
                    borderBottom: "1px solid var(--line)",
                    backdropFilter: "blur(8px)",
                }}
            >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span
                        style={{
                            fontSize: 11,
                            textTransform: "uppercase",
                            letterSpacing: "0.16em",
                            color: "var(--fg-3)",
                            fontWeight: 600,
                        }}
                    >
                        Tampilan Penuh
                    </span>
                    <span style={{ color: "var(--fg-3)" }}>·</span>
                    <span style={{ fontSize: 12, color: "var(--fg-1)", fontWeight: 500 }}>
                        {title}
                    </span>
                    {subtitle && (
                        <>
                            <span style={{ color: "var(--fg-3)" }}>·</span>
                            <span style={{ fontSize: 11, color: "var(--fg-2)" }}>{subtitle}</span>
                        </>
                    )}
                </div>

                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    {onToggleTheme && (
                        <button
                            type="button"
                            style={BTN_BASE}
                            onClick={onToggleTheme}
                            title="Ganti tema light/dark"
                        >
                            <Icon name={currentTheme === "dark" ? "sun" : "moon"} size={14} />
                            {currentTheme === "dark" ? "Light" : "Dark"}
                        </button>
                    )}
                    <button
                        type="button"
                        style={{ ...BTN_PRIMARY, opacity: isExporting ? 0.6 : 1 }}
                        onClick={downloadPng}
                        disabled={isExporting}
                    >
                        <Icon name="download" size={14} />
                        {isExporting ? "Mengekspor…" : "Unduh PNG"}
                    </button>
                    <button
                        type="button"
                        style={BTN_BASE}
                        onClick={onClose}
                        title="Esc untuk keluar"
                    >
                        <Icon name="x" size={14} />
                        <span>Keluar</span>
                    </button>
                </div>
            </div>

            {/* Capture canvas — children dirender di sini, akan ke-screenshot */}
            <div
                ref={captureRef}
                style={{
                    flex: 1,
                    padding: "24px 32px 32px",
                    background: "var(--bg-0)",
                    minHeight: 0,
                }}
            >
                {/* Header watermark untuk screenshot — terlihat di hasil PNG */}
                <div
                    style={{
                        marginBottom: 16,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "baseline",
                        paddingBottom: 12,
                        borderBottom: "1px solid var(--line)",
                    }}
                >
                    <div>
                        <div
                            style={{
                                fontSize: 11,
                                textTransform: "uppercase",
                                letterSpacing: "0.16em",
                                color: "var(--fg-3)",
                                marginBottom: 4,
                                fontWeight: 600,
                            }}
                        >
                            UPT Bogor · Monitoring
                        </div>
                        <div className="ds-heading">{title}</div>
                        {subtitle && (
                            <div className="ds-body" style={{ marginTop: 2 }}>
                                {subtitle}
                            </div>
                        )}
                    </div>
                    <div
                        style={{
                            fontSize: 11,
                            color: "var(--fg-3)",
                            textTransform: "uppercase",
                            letterSpacing: "0.12em",
                            textAlign: "right",
                        }}
                    >
                        <div>YGGDRASIL</div>
                        <div>
                            {new Date().toLocaleDateString("id-ID", {
                                day: "2-digit",
                                month: "long",
                                year: "numeric",
                            })}
                        </div>
                    </div>
                </div>

                {children}
            </div>
        </div>
    );
}
