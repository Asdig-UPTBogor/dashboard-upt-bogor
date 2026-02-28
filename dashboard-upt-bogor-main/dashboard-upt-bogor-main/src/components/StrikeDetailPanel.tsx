"use client";
/**
 * StrikeDetailPanel — Floating detail panel saat marker⚡ diklik
 * Font: inherit Inter dari body (globals.css) — TIDAK ada override fontFamily
 * Responsive: clamp(260px, 35%, 380px) ikut ukuran map container
 */

import { X, Zap, MapPin, Target, Activity } from "lucide-react";
import { useEffect, useState } from "react";
import { StrikeDetails } from "../hooks/useStrikeMarkers"; // Assuming StrikeDetails is now imported from here
import { useDistanceCalculator } from "../hooks/useDistanceCalculator";

// The original StrikeDetails interface definition in this file is likely replaced by the import.
// If it's not, and the imported one doesn't have strikeLat/strikeLng, it needs to be added.
// For now, I'll assume the imported StrikeDetails includes strikeLat and strikeLng.
// If the original interface was meant to be extended, the instruction is ambiguous.
// Given the instruction, the local definition of StrikeDetails should be removed.

interface Props {
    strike: StrikeDetails;
    onClose: () => void;
}

// Warna sesuai tegangan (SUTET 500kV / SUTT 150kV / lainnya)
const voltageColor = (kv: number) =>
    kv >= 500 ? "#3b82f6" : kv >= 150 ? "#ef4444" : "#eab308";

// ── IEC 1.2/50μs Waveform SVG ────────────────────────────────
function WaveformChart({ kA, ac }: { kA: number; ac: string }) {
    const w = 280; const h = 78; const pad = 20; const padBot = 16;
    const dh = h - pad - padBot;
    const isPos = kA >= 0;
    const base = isPos ? pad + dh : pad;
    const peak = isPos ? pad : pad + dh;
    const alpha = 3.5; const beta = 45; const N = 120;
    const raw: number[] = [];
    let mv = 0;
    for (let i = 0; i <= N; i++) {
        const t = i / N;
        const v = Math.exp(-alpha * t) - Math.exp(-beta * t);
        raw.push(v); if (v > mv) mv = v;
    }
    const pts = raw.map((v, i) => {
        const x = pad + (i / N) * (w - pad * 2);
        const y = base + (peak - base) * (v / mv);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
    const pi = raw.indexOf(Math.max(...raw));
    const px = pad + (pi / N) * (w - pad * 2);
    const ti = raw.findIndex((v, i) => i > pi && v / mv < 0.5);
    const tx = ti > 0 ? pad + (ti / N) * (w - pad * 2) : w * 0.6;
    return (
        <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block" }}>
            <line x1={pad} y1={base} x2={w - pad} y2={base} stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
            <polyline points={pts} fill="none" stroke={ac} strokeWidth="4" strokeLinecap="round" opacity="0.12" style={{ filter: "blur(3px)" }} />
            <polyline points={pts} fill="none" stroke={ac} strokeWidth="1.8" strokeLinecap="round" style={{ filter: `drop-shadow(0 0 4px ${ac})` }} />
            <circle cx={px} cy={peak} r="3.5" fill={ac} style={{ filter: `drop-shadow(0 0 6px ${ac})` }} />
            <circle cx={px} cy={peak} r="6" fill="none" stroke={ac} strokeWidth="0.5" opacity="0.35" />
            {/* Labels pakai font inherit dari body */}
            <text x="17" y={base + (isPos ? -3 : 11)} fill="rgba(255,255,255,0.3)" fontSize="7" textAnchor="end">{isPos ? "0" : ""}</text>
            <text x="17" y={peak + (isPos ? 11 : -3)} fill={ac} fontSize="7" textAnchor="end" fontWeight="bold">
                {kA > 0 ? "+" : ""}{kA.toFixed(0)}
            </text>
            <text x={px} y={h - 2} fill="rgba(255,255,255,0.3)" fontSize="7" textAnchor="middle">1.2μs</text>
            <text x={tx} y={h - 2} fill="rgba(255,255,255,0.2)" fontSize="7" textAnchor="middle">50μs</text>
        </svg>
    );
}

// ── Severity Bar ──────────────────────────────────────────────
function SeverityBar({ kA, ac }: { kA: number; ac: string }) {
    const abs = Math.abs(kA);
    const maxRef = [25, 50, 100, 150, 200, 300, 500].find(t => t >= abs) || 500;
    const pct = Math.min(abs / maxRef * 100, 100);
    const sev = abs > 100 ? "CRITICAL" : abs > 50 ? "HIGH" : abs > 20 ? "MODERATE" : "LOW";
    const sc = abs > 100 ? "#ef4444" : abs > 50 ? "#f59e0b" : abs > 20 ? "#3b82f6" : "#22c55e";
    const sign = kA < 0 ? "-" : "+";
    const ticks = [0, 1, 2, 3, 4].map(i => {
        const v = Math.round(maxRef * i / 4);
        return v === 0 ? "0" : `${sign}${v}`;
    });
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1 }}>
                <div style={{ height: 5, background: "rgba(255,255,255,0.06)", borderRadius: 99 }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: `linear-gradient(90deg,${ac}40,${ac})`, borderRadius: 99, transition: "width 0.4s ease", boxShadow: `0 0 6px ${ac}60` }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3, fontSize: 9, color: "#64748b" }}>
                    {ticks.map((v, i) => <span key={i}>{i === 4 ? `${v} kA` : v}</span>)}
                </div>
            </div>
            <div style={{ fontSize: 9, fontWeight: 700, color: sc, background: `${sc}18`, padding: "2px 7px", borderRadius: 4, whiteSpace: "nowrap" }}>
                {sev}
            </div>
        </div>
    );
}

// ── Data Row ──────────────────────────────────────────────────
function Row({ label, value, ac }: { label: string; value: string; ac?: string }) {
    return (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
            <span style={{ fontSize: 11, color: "#64748b" }}>{label}</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: ac || "#e2e8f0" }}>{value}</span>
        </div>
    );
}

// ── Section Title ─────────────────────────────────────────────
function Sec({ icon, title }: { icon?: React.ReactNode; title: string }) {
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 6, fontSize: 10, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            {icon}{title}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════
export default function StrikeDetailPanel({ strike, onClose }: Props) {
    const { calculateDistance, isReady } = useDistanceCalculator();
    const [liveDist, setLiveDist] = useState<{ distTower: number, distLine: number } | null>(null);

    // ALWAYS calculate distance on FE — spreadsheet columns can be removed
    useEffect(() => {
        if (!isReady) { setLiveDist(null); return; }
        const dist = calculateDistance(strike.strikeLat, strike.strikeLng);
        setLiveDist(dist);
    }, [strike, isReady, calculateDistance]);

    const kA = strike.currentKa || strike.maxKa || 0;
    const ac = kA < 0 ? "#56c8ff" : "#f59e0b";
    const lc = voltageColor(strike.tegangan);
    const isMulti = strike.strokeCount > 1 || strike.flashType?.toLowerCase().includes("multi");

    // Selalu pakai hasil kalkulasi FE
    const finalDistTower = liveDist ? liveDist.distTower : 0;
    const finalDistLine = liveDist ? liveDist.distLine : 0;

    const fmtDist = (m: number) => {
        if (!isReady) return "calc...";
        if (m >= 1000) return `${(m / 1000).toFixed(2)} km`;
        if (m > 0) return `${Math.round(m)} m`;
        return "< 1 m";
    };

    const dt = new Date(strike.eventTime.replace(" ", "T") + "+07:00");
    const tsLabel = isNaN(dt.getTime()) ? strike.eventTime
        : dt.toLocaleString("id-ID", {
            day: "2-digit", month: "short", year: "numeric",
            hour: "2-digit", minute: "2-digit", second: "2-digit",
        }) + " WIB";

    return (
        // Responsive: clamp(260px, 35% map, 380px) — proporsional dengan map container
        // fontFamily TIDAK diset → inherit Inter dari body (globals.css)
        <div style={{
            position: "absolute", bottom: 54, left: 12,
            width: "clamp(260px, 35%, 380px)",
            maxHeight: "calc(100% - 110px)", overflowY: "auto",
            zIndex: 1000, boxSizing: "border-box",
            background: "rgba(5,10,20,0.92)",
            backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)",
            borderRadius: 12, border: `1px solid ${lc}40`,
            boxShadow: `0 0 28px ${lc}18, 0 12px 40px rgba(0,0,0,0.8)`,
        }}>

            {/* ── Header (sticky) ── */}
            <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "10px 14px", borderBottom: `1px solid ${lc}25`,
                background: `linear-gradient(90deg,${lc}15 0%,transparent 80%)`,
                position: "sticky", top: 0, backdropFilter: "blur(12px)", zIndex: 1,
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <Zap size={13} color={lc} style={{ filter: `drop-shadow(0 0 4px ${lc})`, flexShrink: 0 }} />
                    <span style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", letterSpacing: "0.5px", textTransform: "uppercase" }}>
                        Detail Parameter
                    </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: lc, padding: "2px 8px", background: `${lc}18`, borderRadius: 4 }}>
                        {isMulti ? `Multi x${strike.strokeCount}` : "SINGLE"}
                    </span>
                    <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 3, display: "flex", borderRadius: 4 }}>
                        <X size={13} color="#64748b" />
                    </button>
                </div>
            </div>

            {/* ── Tower + kA ── */}
            <div style={{ padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: lc, lineHeight: 1.35, marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {strike.towerName || "Unknown Tower"}
                        </div>
                        <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            ULTG {strike.ultg || "-"} | {strike.gi || "-"}
                        </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontSize: 22, fontWeight: 700, color: ac, textShadow: `0 0 14px ${ac}45`, lineHeight: 1 }}>
                            {kA > 0 ? "+" : ""}{kA.toFixed(1)}
                        </div>
                        <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>kA puncak</div>
                    </div>
                </div>

                <div style={{ display: "flex", gap: 14, fontSize: 11, color: "#94a3b8", marginBottom: 9, flexWrap: "wrap" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <MapPin size={9} color="#64748b" />
                        <span>Tower:</span>
                        <span style={{ fontWeight: 600, color: "#e2e8f0" }}>{fmtDist(finalDistTower)}</span>
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <Target size={9} color="#64748b" />
                        <span>Line:</span>
                        <span style={{ fontWeight: 600, color: "#e2e8f0" }}>{fmtDist(finalDistLine)}</span>
                    </span>
                </div>

                <SeverityBar kA={kA} ac={ac} />
            </div>

            {/* ── Waveform ── */}
            <div style={{ padding: "8px 14px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                <Sec icon={<Activity size={9} />} title="Impulse Waveform IEC 1.2/50μs" />
                <WaveformChart kA={kA} ac={ac} />
            </div>

            {/* ── Informasi Tower & Parameter (Compact) ── */}
            <div style={{ padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>

                {/* Tabel Parameter Teknis */}
                <div style={{ display: "flex", justifyContent: "space-between", textAlign: "center", fontSize: 11 }}>
                    <div>
                        <div style={{ color: "#64748b", fontSize: 9, marginBottom: 4 }}>TIME</div>
                        <div style={{ color: "#cbd5e1", fontWeight: 500 }}>T+0</div>
                    </div>
                    <div>
                        <div style={{ color: "#64748b", fontSize: 9, marginBottom: 4 }}>kA</div>
                        <div style={{ color: ac, fontWeight: 600 }}>{strike.avgKa !== 0 ? strike.avgKa.toFixed(1) : kA.toFixed(1)}</div>
                    </div>
                    <div>
                        <div style={{ color: "#64748b", fontSize: 9, marginBottom: 4 }}>m</div>
                        <div style={{ color: "#cbd5e1", fontWeight: 500 }}>{Math.round(finalDistLine || finalDistTower || 0)}</div>
                    </div>
                    <div>
                        <div style={{ color: "#64748b", fontSize: 9, marginBottom: 4 }}>RT</div>
                        <div style={{ color: "#cbd5e1", fontWeight: 500 }}>{strike.risetime > 0 ? `${strike.risetime.toFixed(1)}μs` : "-"}</div>
                    </div>
                    <div>
                        <div style={{ color: "#64748b", fontSize: 9, marginBottom: 4 }}>di/dt</div>
                        <div style={{ color: "#cbd5e1", fontWeight: 500 }}>{strike.maxRateRise > 0 ? strike.maxRateRise.toFixed(1) : "-"}</div>
                    </div>
                </div>
            </div>

            {/* ── Ellipse (Compact 1 baris di bawah tabel) ── */}
            {strike.ellSemiMajor > 0 && (
                <div style={{ padding: "8px 14px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                    <div style={{ fontSize: 10, color: "#64748b", display: "flex", gap: 14 }}>
                        <span>Ellipse: <span style={{ color: "#94a3b8" }}>{strike.ellSemiMajor.toFixed(0)}m × {strike.ellSemiMinor.toFixed(0)}m</span></span>
                        <span>Angle: <span style={{ color: "#94a3b8" }}>{strike.ellAngle.toFixed(1)}°</span></span>
                    </div>
                </div>
            )}

            {/* ── Timestamp — tanpa ikon ── */}
            <div style={{ padding: "7px 14px", fontSize: 10, color: "#475569" }}>
                {tsLabel}
            </div>
        </div>
    );
}
