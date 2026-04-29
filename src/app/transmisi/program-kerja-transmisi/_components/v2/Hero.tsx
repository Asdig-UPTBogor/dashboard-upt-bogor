"use client";
import { useState } from "react";
import { Card } from "@/components/designer/Card";

export interface KpiPanelData {
  key: string;          // unique key untuk active filter (e.g. "abo", "lm", "il2")
  caption: string;
  nickname?: string;
  totalItem: number;
  realisasi: number;
  programCount: number;
  accent: string;
  accent2: string;
  footerRight?: string;
  showSyncBadge?: boolean;
}

interface HeroProps {
  total: KpiPanelData;
  panels: KpiPanelData[];           // dynamic panels (1-N), bukan abo/strategis hardcoded
  activePanel?: string | null;       // panel.key yang aktif
  onPanelClick?: (key: string) => void;
}

/**
 * Generate Tailwind grid template arbitrary value untuk N panels.
 * Total panel: 1.618fr (golden ratio). Sub-panels: 1fr each.
 * Pattern: "1.618fr_1px_1fr_1px_1fr_..." dst.
 */
function gridTemplateForPanels(count: number): string {
  // 1: total + 1 panel = "1.618fr_1px_1fr"
  // 2: total + 2 panels = "1.618fr_1px_1fr_1px_1fr"
  // 3: total + 3 panels = "1.618fr_1px_1fr_1px_1fr_1px_1fr" dst
  const parts: string[] = ["1.618fr"];
  for (let i = 0; i < count; i++) {
    parts.push("1px", "1fr");
  }
  return parts.join("_");
}

export function Hero({ total, panels, activePanel, onPanelClick }: HeroProps) {
  const tpl = gridTemplateForPanels(panels.length).replace(/_/g, " ");
  return (
    <Card className="col-span-12" noPad>
      {/* Pakai inline gridTemplateColumns + data-attribute biar CSS responsive
       * di globals.css bisa override [data-hero-grid] jadi 1fr di < xl */}
      <div
        data-hero-grid
        style={{
          display: "grid",
          gridTemplateColumns: tpl,
        }}
      >
        <KpiPanel data={total} highlight />
        {panels.flatMap((p) => [
          <Divider key={`div-${p.key}`} />,
          <KpiPanel
            key={p.key}
            data={p}
            onClick={onPanelClick ? () => onPanelClick(p.key) : undefined}
            active={activePanel === p.key}
            dimmed={!!activePanel && activePanel !== p.key}
          />,
        ])}
      </div>
    </Card>
  );
}

function Divider() {
  return <div data-hero-divider style={{ background: "var(--line)" }} />;
}

/**
 * Skala warna persentase progress — semakin tinggi semakin ke arah biru/hijau,
 * semakin rendah semakin ke arah merah.
 */
function getPctColor(pct: number): string {
  if (pct >= 75) return "#5b8def";          // blue — excellent
  if (pct >= 50) return "var(--cond-very-good)"; // green — good
  if (pct >= 25) return "var(--cond-fair)";       // amber — fair
  if (pct > 0)  return "var(--cond-poor)";        // orange — poor
  return "var(--cond-critical)";                  // red — critical
}

function KpiPanel({
  data,
  highlight,
  onClick,
  active,
  dimmed,
}: {
  data: KpiPanelData;
  highlight?: boolean;
  onClick?: () => void;
  active?: boolean;
  dimmed?: boolean;
}) {
  const pct = data.totalItem === 0 ? 0 : (data.realisasi / data.totalItem) * 100;

  // Golden-ratio scaled sizes — Total = 1, ABO/Strategis = 1/1.618
  // Highlight panel: semua stack same size untuk visual balance
  const sizePrimary = highlight ? 64 : 40;
  const sizeSecondary = highlight ? 64 : 40;
  const padding = 24; // uniform padding biar bar align across panels
  const stackGap = highlight ? 36 : 22;
  const containerGap = 22; // uniform supaya stacks row top di Y yang sama

  const [hovered, setHovered] = useState(false);

  const baseBg = highlight
    ? "radial-gradient(ellipse 55% 80% at 0% 0%, color-mix(in oklab, var(--cond-very-good) 6%, transparent), transparent 60%)"
    : `radial-gradient(ellipse 60% 80% at 100% 0%, color-mix(in oklab, ${data.accent} 5%, transparent), transparent 65%)`;

  const activeBg = active
    ? `radial-gradient(ellipse 70% 100% at 50% 50%, color-mix(in oklab, ${data.accent} 14%, transparent), transparent 70%)`
    : baseBg;

  const showHint = hovered && onClick && !active;

  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onMouseEnter={(e) => {
        if (!onClick) return;
        setHovered(true);
        if (active) return;
        const el = e.currentTarget as HTMLDivElement;
        el.style.background = `radial-gradient(ellipse 70% 100% at 50% 50%, color-mix(in oklab, ${data.accent} 10%, transparent), transparent 70%)`;
        el.style.boxShadow = `inset 0 0 0 1px color-mix(in oklab, ${data.accent} 35%, transparent)`;
      }}
      onMouseLeave={(e) => {
        if (!onClick) return;
        setHovered(false);
        if (active) return;
        const el = e.currentTarget as HTMLDivElement;
        el.style.background = activeBg;
        el.style.boxShadow = "none";
      }}
      style={{
        padding,
        display: "flex",
        flexDirection: "column",
        gap: containerGap,
        position: "relative",
        background: activeBg,
        cursor: onClick ? "pointer" : "default",
        opacity: dimmed ? 0.55 : 1,
        boxShadow: active ? `inset 0 0 0 1px ${data.accent}` : "none",
        transition: "opacity .25s ease, box-shadow .25s ease, background .25s ease",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <Caption nickname={data.nickname} nicknameColor={data.accent}>{data.caption}</Caption>
        {data.showSyncBadge && (
          <span
            style={{
              fontSize: 11,
              color: "var(--fg-2)",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span className="ds-led-dot" style={{ color: "var(--cond-very-good)" }} />
            <span style={{ letterSpacing: "0.04em" }}>Real-time · BQ sync</span>
          </span>
        )}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: highlight ? "auto 1px auto 1px auto" : "auto 1px auto",
          gap: stackGap,
          alignItems: "end",
          marginTop: highlight ? 0 : 12,
        }}
      >
        <PrimaryStat
          value={data.totalItem.toLocaleString("id-ID")}
          label="Item Pekerjaan"
          size={sizePrimary}
        />
        <VDivider />
        {highlight && (
          <>
            <PrimaryStat
              value={data.programCount.toLocaleString("id-ID")}
              label="Program Kerja"
              size={sizeSecondary}
            />
            <VDivider />
          </>
        )}
        <PrimaryStat
          value={`${pct.toFixed(1)}%`}
          label="Selesai"
          size={highlight ? sizeSecondary : sizePrimary}
          valueColor={getPctColor(pct)}
        />
      </div>

      <div style={{ marginTop: "auto" }}>
        <SegmentedProgress
          done={data.realisasi}
          total={data.totalItem}
          accent={data.accent}
          accent2={data.accent2}
          footerRight={data.footerRight}
        />
      </div>

      {showHint && (
        <span
          style={{
            position: "absolute",
            bottom: 10,
            right: 14,
            fontSize: 9.5,
            color: data.accent,
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
}

function PrimaryStat({
  value,
  label,
  sublabel,
  size,
  valueColor,
}: {
  value: string;
  label: string;
  sublabel?: React.ReactNode;
  size: number;
  valueColor?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span
        className="num"
        data-kpi-primary={size >= 56 ? "" : undefined}
        data-kpi-secondary={size < 56 ? "" : undefined}
        style={{
          fontSize: size,
          fontWeight: 600,
          letterSpacing: "-0.04em",
          color: valueColor ?? "var(--fg-0)",
          lineHeight: 1,
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </span>
      <span
        style={{
          fontSize: 12.5,
          color: "var(--fg-1)",
          fontWeight: 500,
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
      {sublabel && (
        <span style={{ fontSize: 12, color: "var(--fg-2)", whiteSpace: "nowrap" }}>
          {sublabel}
        </span>
      )}
    </div>
  );
}

function VDivider() {
  return (
    <div
      style={{
        width: 1,
        alignSelf: "stretch",
        background: "linear-gradient(180deg, transparent 0%, var(--line) 35%, var(--line) 65%, transparent 100%)",
      }}
    />
  );
}

function SegmentedProgress({
  done,
  total,
  accent,
  accent2,
  footerRight,
  compact,
  hideLegend,
}: {
  done: number;
  total: number;
  accent: string;
  accent2: string;
  footerRight?: string;
  compact?: boolean;
  hideLegend?: boolean;
}) {
  const pct = total === 0 ? 0 : (done / total) * 100;
  const pctOpen = 100 - pct;
  const belum = Math.max(total - done, 0);
  const barHeight = compact ? 6 : 8;
  const fontSize = compact ? 11 : 11.5;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: compact ? 8 : 10 }}>
      <div style={{ display: "flex", height: barHeight, gap: 4 }}>
        {pct > 0 && (
          <div
            style={{
              flex: `${pct} 1 0`,
              minWidth: 0,
              background: `linear-gradient(90deg, ${accent} 0%, ${accent2} 100%)`,
              borderRadius: belum > 0 ? "999px 0 0 999px" : 999,
              boxShadow: `0 0 12px color-mix(in oklab, ${accent} 40%, transparent)`,
              transition: "flex .4s ease",
            }}
          />
        )}
        {belum > 0 && (
          <div
            style={{
              flex: `${pctOpen} 1 0`,
              minWidth: 0,
              background: "var(--cond-poor)",
              borderRadius: pct > 0 ? "0 999px 999px 0" : 999,
              transition: "flex .4s ease",
            }}
          />
        )}
      </div>
      {!hideLegend && (
        <div style={{ display: "flex", gap: 4, fontSize, color: "var(--fg-2)" }}>
          {pct > 0 && (
            <div
              style={{
                flex: `${pct} 1 0`,
                minWidth: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                whiteSpace: "nowrap",
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: 2, background: "var(--cond-very-good)", flexShrink: 0 }} />
              <span>Selesai</span>
              <span className="num" style={{ color: "var(--cond-very-good)", fontWeight: 600 }}>
                {done.toLocaleString("id-ID")}
              </span>
            </div>
          )}
          {belum > 0 && (
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
              <span style={{ width: 8, height: 8, borderRadius: 2, background: "var(--cond-poor)", flexShrink: 0 }} />
              <span>On Progress</span>
              <span className="num" style={{ color: "var(--cond-poor)", fontWeight: 600 }}>
                {belum.toLocaleString("id-ID")}
              </span>
            </div>
          )}
        </div>
      )}
      {footerRight && (
        <div style={{ fontSize, color: "var(--fg-3)", textAlign: "right" }}>{footerRight}</div>
      )}
    </div>
  );
}

function Caption({
  children,
  nickname,
  nicknameColor,
}: {
  children: React.ReactNode;
  nickname?: string;
  nicknameColor?: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ width: 16, height: 1.5, background: "var(--fg-3)" }} />
      <span
        style={{
          fontSize: 11,
          color: "var(--fg-2)",
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          fontWeight: 600,
        }}
      >
        {children}
      </span>
      {nickname && (
        <span
          className="num"
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.06em",
            padding: "2px 7px",
            borderRadius: 4,
            color: nicknameColor ?? "var(--fg-1)",
            background: `color-mix(in oklab, ${nicknameColor ?? "var(--fg-2)"} 14%, transparent)`,
            border: `1px solid color-mix(in oklab, ${nicknameColor ?? "var(--fg-2)"} 28%, transparent)`,
          }}
        >
          {nickname}
        </span>
      )}
    </div>
  );
}

function ProgressLine({ pct, accent, accent2 }: { pct: number; accent: string; accent2: string }) {
  const w = Math.min(Math.max(pct, 0), 100);
  return (
    <div
      style={{
        height: 4,
        background: "var(--bg-2)",
        borderRadius: 999,
        overflow: "hidden",
        position: "relative",
      }}
    >
      <div
        style={{
          width: `${w}%`,
          height: "100%",
          background: `linear-gradient(90deg, ${accent} 0%, ${accent2} 100%)`,
          borderRadius: 999,
          transition: "width .4s ease",
        }}
      />
    </div>
  );
}
