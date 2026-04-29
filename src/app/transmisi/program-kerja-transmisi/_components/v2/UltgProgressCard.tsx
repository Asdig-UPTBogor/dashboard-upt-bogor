"use client";
import { useState } from "react";

interface UltgRow {
  key: string;
  name: string;
  target: number;
  realisasi: number;
  accent: string;
  aboCount?: number;
  psCount?: number;
}

interface UltgProgressCardProps {
  rows: UltgRow[];
  activeUltg?: string | null;
  onUltgClick?: (key: string) => void;
}

const COLOR_DONE = "var(--cond-very-good)";
const COLOR_OPEN = "var(--cond-poor)";

export function UltgProgressCard({ rows, activeUltg, onUltgClick }: UltgProgressCardProps) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
      {rows.map((r) => {
        const belum = Math.max(r.target - r.realisasi, 0);
        const pctDone = r.target === 0 ? 0 : (r.realisasi / r.target) * 100;
        const pctOpen = 100 - pctDone;
        const isActive = activeUltg === r.key;
        const isDimmed = activeUltg !== null && activeUltg !== undefined && activeUltg !== r.key;
        const showHint = hoveredKey === r.key && !!onUltgClick && !isActive;
        return (
          <div
            key={r.key}
            onClick={onUltgClick ? () => onUltgClick(r.key) : undefined}
            role={onUltgClick ? "button" : undefined}
            tabIndex={onUltgClick ? 0 : undefined}
            onMouseEnter={(e) => {
              if (!onUltgClick) return;
              setHoveredKey(r.key);
              if (isActive) return;
              const el = e.currentTarget as HTMLDivElement;
              el.style.background = `color-mix(in oklab, ${r.accent} 6%, transparent)`;
              el.style.boxShadow = `inset 0 0 0 1px color-mix(in oklab, ${r.accent} 30%, transparent)`;
            }}
            onMouseLeave={(e) => {
              if (!onUltgClick) return;
              setHoveredKey(null);
              if (isActive) return;
              const el = e.currentTarget as HTMLDivElement;
              el.style.background = "transparent";
              el.style.boxShadow = "none";
            }}
            style={{
              position: "relative",
              cursor: onUltgClick ? "pointer" : "default",
              padding: 10,
              margin: -10,
              borderRadius: "var(--r-md)",
              opacity: isDimmed ? 0.5 : 1,
              background: isActive ? `color-mix(in oklab, ${r.accent} 10%, transparent)` : "transparent",
              boxShadow: isActive ? `inset 0 0 0 1px ${r.accent}` : "none",
              transition: "opacity .25s ease, background .25s ease, box-shadow .25s ease",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                marginBottom: 8,
              }}
            >
              <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--fg-0)" }}>{r.name}</span>
              <span style={{ fontSize: 11.5, color: "var(--fg-2)", display: "inline-flex", alignItems: "baseline", gap: 8 }}>
                {r.aboCount != null && (
                  <span data-ultg-breakdown>
                    <span style={{ color: "#5b8def" }}>ABO:</span>{" "}
                    <span className="num" style={{ color: "var(--fg-1)" }}>{r.aboCount}</span>
                    <span style={{ marginLeft: 4 }}>Item</span>
                  </span>
                )}
                {r.psCount != null && (
                  <>
                    <span data-ultg-breakdown style={{ color: "var(--fg-3)" }}>·</span>
                    <span data-ultg-breakdown>
                      <span style={{ color: "#f3c14b" }}>PS:</span>{" "}
                      <span className="num" style={{ color: "var(--fg-1)" }}>{r.psCount}</span>
                      <span style={{ marginLeft: 4 }}>Item</span>
                    </span>
                  </>
                )}
                <span data-ultg-breakdown style={{ color: "var(--fg-3)" }}>·</span>
                <span className="num">
                  <span style={{ color: "var(--fg-1)" }}>
                    {r.realisasi.toLocaleString("id-ID")}
                  </span>
                  {" / "}
                  {r.target.toLocaleString("id-ID")} item
                </span>
              </span>
            </div>

            {/* Bar — match reference: 2 segment, gap, rounded outer corners only */}
            <div style={{ display: "flex", height: 32, gap: 4 }}>
              {pctDone > 0 && (
                <div
                  title={`${r.name} · Selesai: ${r.realisasi.toLocaleString("id-ID")} (${pctDone.toFixed(1)}%)`}
                  style={{
                    flex: `${pctDone} 1 0`,
                    minWidth: 0,
                    background: COLOR_DONE,
                    borderRadius: pctOpen > 0 ? "6px 0 0 6px" : "6px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#0b1a10",
                    fontWeight: 700,
                    fontSize: 12.5,
                    fontFamily: "var(--font-mono)",
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                  }}
                >
                  {pctDone >= 10 ? `${pctDone.toFixed(1)}%` : ""}
                </div>
              )}
              {pctOpen > 0 && (
                <div
                  title={`${r.name} · On Progress: ${belum.toLocaleString("id-ID")} (${pctOpen.toFixed(1)}%)`}
                  style={{
                    flex: `${pctOpen} 1 0`,
                    minWidth: 0,
                    background: COLOR_OPEN,
                    borderRadius: pctDone > 0 ? "0 6px 6px 0" : "6px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#1a0e00",
                    fontWeight: 700,
                    fontSize: 12.5,
                    fontFamily: "var(--font-mono)",
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                  }}
                >
                  {pctOpen >= 10 ? `${pctOpen.toFixed(1)}%` : ""}
                </div>
              )}
            </div>

            <div
              style={{
                display: "flex",
                gap: 4,
                marginTop: 8,
                fontSize: 11.5,
                color: "var(--fg-1)",
              }}
            >
              {pctDone > 0 && (
                <div
                  style={{
                    flex: `${pctDone} 1 0`,
                    minWidth: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    whiteSpace: "nowrap",
                  }}
                >
                  <span style={{ width: 8, height: 8, background: COLOR_DONE, borderRadius: 2, flexShrink: 0 }} />
                  <span style={{ color: "var(--fg-2)" }}>Selesai</span>
                  <span className="num" style={{ color: COLOR_DONE, fontWeight: 600 }}>
                    {r.realisasi.toLocaleString("id-ID")}
                  </span>
                </div>
              )}
              {pctOpen > 0 && (
                <div
                  style={{
                    flex: `${pctOpen} 1 0`,
                    minWidth: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    whiteSpace: "nowrap",
                  }}
                >
                  <span style={{ width: 8, height: 8, background: COLOR_OPEN, borderRadius: 2, flexShrink: 0 }} />
                  <span style={{ color: "var(--fg-2)" }}>On Progress</span>
                  <span className="num" style={{ color: COLOR_OPEN, fontWeight: 600 }}>
                    {belum.toLocaleString("id-ID")}
                  </span>
                </div>
              )}
            </div>

            {showHint && (
              <span
                style={{
                  position: "absolute",
                  bottom: 6,
                  right: 12,
                  fontSize: 9.5,
                  color: r.accent,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  letterSpacing: "0.04em",
                  pointerEvents: "none",
                  opacity: 0.85,
                }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="6" y="3" width="12" height="18" rx="6" />
                  <line x1="12" y1="7" x2="12" y2="11" />
                </svg>
                Click to filter
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
