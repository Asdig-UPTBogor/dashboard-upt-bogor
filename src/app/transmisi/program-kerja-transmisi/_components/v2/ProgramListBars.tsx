"use client";
import type { ProgramItem } from "../program-kerja-data";

interface ProgramListBarsProps {
  items: ProgramItem[];
  accent: string;
  maxVisible?: number;
}

const ROW_HEIGHT = 37; // 10 top + 10 bottom + 16 content + 1 border

/**
 * Color scheme per program panel — consistent dengan accent.
 * Excellent (≥75%) → green to highlight, low (0%) → red to alert,
 * normal (1-74%) → panel accent (biru ABO / amber PS) konsisten.
 */
function getPctColor(pct: number, accent: string): string {
  if (pct >= 75) return "var(--cond-very-good)"; // hijau highlight excellent
  if (pct > 0) return accent;                    // konsisten panel accent
  return "var(--cond-critical)";                 // merah — perlu perhatian
}

export function ProgramListBars({ items, accent, maxVisible = 5 }: ProgramListBarsProps) {
  const maxRowHeight = ROW_HEIGHT * maxVisible;
  if (items.length === 0) {
    return (
      <div
        style={{
          padding: 24,
          textAlign: "center",
          color: "var(--fg-2)",
          fontSize: 12,
        }}
      >
        Belum ada program.
      </div>
    );
  }

  // sort by pct DESC supaya progress tinggi di atas
  const sorted = [...items].sort((a, b) => {
    const pa = a.totalTarget === 0 ? -1 : (a.totalRealisasi / a.totalTarget) * 100;
    const pb = b.totalTarget === 0 ? -1 : (b.totalRealisasi / b.totalTarget) * 100;
    return pb - pa;
  });

  return (
    <div
      className="ds-scroll-accent @container"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 0,
        maxHeight: maxRowHeight,
        overflowY: "auto",
        paddingRight: 14,
        scrollbarGutter: "stable",
        // pakai --scroll-color buat thumb scrollbar
        ["--scroll-color" as string]: accent,
      }}
    >
      {sorted.map((it, i) => {
        const pct = it.totalTarget === 0 ? 0 : (it.totalRealisasi / it.totalTarget) * 100;
        const empty = it.totalTarget === 0;
        const color = getPctColor(pct, accent);
        return (
          <div
            key={it.no || i}
            className="flex flex-col @sm:flex-row @sm:items-center gap-2 @sm:gap-3"
            style={{
              padding: "10px 0",
              borderBottom: i < sorted.length - 1 ? "1px solid var(--line)" : "none",
            }}
          >
            {/* Program name — wrap kalau panjang */}
            <span
              title={it.namaProgram}
              data-program-name
              style={{
                fontSize: 12,
                color: "var(--fg-1)",
                lineHeight: 1.4,
                flex: 1,
                minWidth: 0,
                wordBreak: "break-word",
              }}
            >
              {it.namaProgram}
            </span>

            {/* Bar progress (single fill) */}
            {empty ? (
              <span
                style={{
                  textAlign: "right",
                  color: "var(--fg-3)",
                  fontSize: 10.5,
                  fontStyle: "italic",
                  whiteSpace: "nowrap",
                }}
              >
                Tidak ada target
              </span>
            ) : (
              <div data-program-bar-wrap style={{ display: "contents" }}>
                <div
                  data-program-bar
                  style={{
                    width: 100,
                    height: 6,
                    background: "var(--bg-2)",
                    borderRadius: 999,
                    overflow: "hidden",
                    flexShrink: 0,
                  }}
                  title={`${it.totalRealisasi.toLocaleString("id-ID")} / ${it.totalTarget.toLocaleString("id-ID")} (${pct.toFixed(1)}%)`}
                >
                  <div
                    style={{
                      width: `${Math.min(Math.max(pct, 2), 100)}%`,
                      height: "100%",
                      background: color,
                      borderRadius: 999,
                      transition: "width .4s ease",
                      boxShadow: `0 0 6px ${color}66`,
                    }}
                  />
                </div>
                <span
                  className="num"
                  style={{
                    fontSize: 12,
                    color: pct === 0 ? "var(--cond-poor)" : color,
                    fontWeight: 600,
                    width: 44,
                    textAlign: "right",
                    flexShrink: 0,
                  }}
                >
                  {pct.toFixed(0)}%
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
