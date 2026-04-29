"use client";
import { useMemo, useState } from "react";
import { Card } from "@/components/designer/Card";
import { Badge } from "@/components/designer/Badge";
import { Icon } from "@/components/designer/Icon";
import { IconBtn } from "@/components/designer/Button";
import type { ProgramItem } from "../program-kerja-data";

interface DataTableProps {
  items: ProgramItem[];
  activeUltg?: "bogor" | "sukabumi" | null;
}

type UltgFilter = "ALL" | "BOGOR" | "SUKABUMI";
type ProgFilter = "all" | "lm" | "abo";

const EM_DASH = "—";

function fmtNum(n: number): string {
  if (n === 0) return EM_DASH;
  return n.toLocaleString("id-ID");
}

function fmtPct(pct: number, target: number): string {
  if (target === 0 || pct === 0) return EM_DASH;
  return `${pct.toFixed(0)}%`;
}

function pctColor(pct: number, target: number): string {
  if (target === 0 || pct === 0) return "var(--fg-3)";
  if (pct >= 75) return "#5b8def";
  if (pct >= 50) return "var(--cond-very-good)";
  if (pct >= 25) return "var(--cond-fair)";
  return "var(--cond-poor)";
}

export function DataTable({ items, activeUltg }: DataTableProps) {
  const [search, setSearch] = useState("");
  const [filterProgram, setFilterProgram] = useState<ProgFilter>("all");
  const [selectedNo, setSelectedNo] = useState<string | null>(null);

  const ultgFilter: UltgFilter = activeUltg === "bogor" ? "BOGOR" : activeUltg === "sukabumi" ? "SUKABUMI" : "ALL";

  const filtered = useMemo(() => {
    let rows = items;
    if (filterProgram !== "all") rows = rows.filter((r) => r.programKerja === filterProgram);
    if (search) {
      const s = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.namaProgram.toLowerCase().includes(s) ||
          (r.kategori || "").toLowerCase().includes(s) ||
          (r.pelaksana || "").toLowerCase().includes(s) ||
          (r.lokasi || "").toLowerCase().includes(s)
      );
    }
    return rows;
  }, [items, search, filterProgram]);

  // Compute total visible columns untuk empty state colSpan
  const colCount = useMemo(() => {
    let n = 5; // NO + NAMA + KATEGORI + RISIKO + PELAKSANA
    if (ultgFilter === "ALL") n += 9; // Bogor 3 + Sukabumi 3 + Total 3
    else n += 3; // single ULTG 3 cols
    return n;
  }, [ultgFilter]);

  return (
    <Card style={{ gridColumn: "span 12" }} noPad>
      {/* Header — match designer pattern (caption uppercase + LED dot subtitle) */}
      <div
        style={{
          padding: "16px 20px",
          borderBottom: "1px solid var(--line)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ width: 16, height: 1.5, background: "var(--fg-3)", flexShrink: 0 }} />
          <span
            style={{
              fontSize: 11,
              color: "var(--fg-0)",
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              fontWeight: 600,
            }}
          >
            Rincian Program Kerja
          </span>
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
            <span style={{ letterSpacing: "0.04em" }}>
              <span className="num" style={{ color: "var(--fg-0)" }}>{filtered.length}</span>
              {" / "}
              <span className="num">{items.length}</span>
              {" program"}
              {activeUltg && (
                <>
                  {" · ULTG "}
                  <span style={{ color: activeUltg === "bogor" ? "#5b8def" : "#f08a3e" }}>
                    {activeUltg === "bogor" ? "Bogor" : "Sukabumi"}
                  </span>
                </>
              )}
            </span>
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "5px 10px",
              background: "var(--bg-2)",
              border: "1px solid var(--line)",
              borderRadius: "var(--r-sm)",
            }}
          >
            <Icon name="search" size={12} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari program, kategori, pelaksana..."
              style={{
                background: "transparent",
                border: "none",
                outline: "none",
                color: "var(--fg-0)",
                fontSize: 12,
                width: 220,
                fontFamily: "inherit",
              }}
            />
          </div>
          <select
            value={filterProgram}
            onChange={(e) => setFilterProgram(e.target.value as ProgFilter)}
            style={selectStyle}
          >
            <option value="all">Semua Program</option>
            <option value="lm">Program Strategis</option>
            <option value="abo">Anti Blackout</option>
          </select>
          <IconBtn icon="download" size={28} title="Ekspor" />
        </div>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: "var(--bg-2)" }}>
              <th rowSpan={2} style={th("center")}>NO</th>
              <th rowSpan={2} style={{ ...th("left"), minWidth: 240 }}>Nama Program</th>
              <th rowSpan={2} style={th("center")}>Kategori</th>
              <th rowSpan={2} style={th("center")}>Risiko</th>
              {(ultgFilter === "ALL" || ultgFilter === "BOGOR") && (
                <th colSpan={3} style={thGroup}>ULTG Bogor</th>
              )}
              {(ultgFilter === "ALL" || ultgFilter === "SUKABUMI") && (
                <th colSpan={3} style={thGroup}>ULTG Sukabumi</th>
              )}
              {ultgFilter === "ALL" && (
                <th colSpan={3} style={thGroup}>Total</th>
              )}
              <th rowSpan={2} style={{ ...th("center"), borderRight: "none" }}>Pelaksana</th>
            </tr>
            <tr style={{ background: "var(--bg-2)" }}>
              {(ultgFilter === "ALL" || ultgFilter === "BOGOR") && (
                <>
                  <th style={thSub}>Target</th>
                  <th style={thSub}>Real</th>
                  <th style={thSub}>%</th>
                </>
              )}
              {(ultgFilter === "ALL" || ultgFilter === "SUKABUMI") && (
                <>
                  <th style={thSub}>Target</th>
                  <th style={thSub}>Real</th>
                  <th style={thSub}>%</th>
                </>
              )}
              {ultgFilter === "ALL" && (
                <>
                  <th style={thSub}>Target</th>
                  <th style={thSub}>Real</th>
                  <th style={thSub}>%</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {filtered.map((p, i) => {
              const rowKey = p.no || String(i);
              const isSelected = selectedNo === rowKey;
              return (
                <tr
                  key={rowKey}
                  onClick={() => setSelectedNo((prev) => (prev === rowKey ? null : rowKey))}
                  onMouseEnter={(e) => {
                    if (isSelected) return;
                    (e.currentTarget as HTMLTableRowElement).style.background = "var(--bg-2)";
                  }}
                  onMouseLeave={(e) => {
                    if (isSelected) return;
                    (e.currentTarget as HTMLTableRowElement).style.background = "transparent";
                  }}
                  style={{
                    cursor: "pointer",
                    borderBottom: "1px solid var(--line)",
                    background: isSelected ? "color-mix(in oklab, var(--accent-amber) 10%, transparent)" : "transparent",
                    boxShadow: isSelected ? "inset 2px 0 0 var(--accent-amber)" : "none",
                    transition: "background .15s ease, box-shadow .15s ease",
                  }}
                >
                  <td style={td("center", true, "var(--fg-2)")}>{i + 1}</td>
                  <td style={{ ...td("left"), maxWidth: 320, fontWeight: 500 }} title={p.namaProgram}>
                    <span style={ellipsis}>{p.namaProgram}</span>
                  </td>
                  <td style={td("center", false, "var(--fg-1)")}>{p.kategori || EM_DASH}</td>
                  <td style={td("center")}>
                    {p.risiko ? <Badge tone="neutral" size="sm">{p.risiko}</Badge> : <span style={{ color: "var(--fg-3)" }}>{EM_DASH}</span>}
                  </td>

                  {/* Bogor */}
                  {(ultgFilter === "ALL" || ultgFilter === "BOGOR") && (
                    <>
                      <td style={td("right", true)}>{fmtNum(p.targetBogor)}</td>
                      <td style={td("right", true, p.realisasiBogor > 0 ? "var(--cond-very-good)" : "var(--fg-3)")}>
                        {fmtNum(p.realisasiBogor)}
                      </td>
                      <td style={td("right", true, pctColor(p.presentaseBogor, p.targetBogor))}>
                        {fmtPct(p.presentaseBogor, p.targetBogor)}
                      </td>
                    </>
                  )}

                  {/* Sukabumi */}
                  {(ultgFilter === "ALL" || ultgFilter === "SUKABUMI") && (
                    <>
                      <td style={td("right", true)}>{fmtNum(p.targetSukabumi)}</td>
                      <td style={td("right", true, p.realisasiSukabumi > 0 ? "var(--cond-very-good)" : "var(--fg-3)")}>
                        {fmtNum(p.realisasiSukabumi)}
                      </td>
                      <td style={td("right", true, pctColor(p.presentaseSukabumi, p.targetSukabumi))}>
                        {fmtPct(p.presentaseSukabumi, p.targetSukabumi)}
                      </td>
                    </>
                  )}

                  {/* Total */}
                  {ultgFilter === "ALL" && (
                    <>
                      <td style={tdTotal("right")}>{fmtNum(p.totalTarget)}</td>
                      <td style={tdTotal("right", p.totalRealisasi > 0 ? "var(--cond-very-good)" : "var(--fg-3)")}>
                        {fmtNum(p.totalRealisasi)}
                      </td>
                      <td style={tdTotal("right", pctColor(p.presentase, p.totalTarget))}>
                        {fmtPct(p.presentase, p.totalTarget)}
                      </td>
                    </>
                  )}

                  <td style={{ ...td("center", false, "var(--fg-1)"), maxWidth: 140, borderRight: "none" }} title={p.pelaksana}>
                    <span style={ellipsis}>{p.pelaksana || EM_DASH}</span>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={colCount} style={{ padding: 32, textAlign: "center", color: "var(--fg-2)", fontSize: 12 }}>
                  Tidak ada program yang cocok dengan filter aktif.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ── Style helpers — designer pattern ── */
const selectStyle: React.CSSProperties = {
  background: "var(--bg-2)",
  border: "1px solid var(--line)",
  color: "var(--fg-1)",
  borderRadius: "var(--r-sm)",
  fontSize: 12,
  padding: "5px 8px",
  cursor: "pointer",
  fontFamily: "inherit",
};

const ellipsis: React.CSSProperties = {
  display: "block",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

function th(align: "left" | "center" | "right"): React.CSSProperties {
  return {
    textAlign: align,
    padding: "10px 12px",
    fontSize: 11,
    fontWeight: 600,
    color: "var(--fg-2)",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    borderBottom: "1px solid var(--line)",
    borderRight: "1px solid var(--line)",
    whiteSpace: "nowrap",
    userSelect: "none",
  };
}

const thGroup: React.CSSProperties = {
  textAlign: "center",
  padding: "8px 12px",
  fontSize: 11,
  fontWeight: 700,
  color: "var(--fg-1)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  borderBottom: "1px solid var(--line)",
  borderRight: "1px solid var(--line)",
  background: "color-mix(in oklab, var(--bg-3) 60%, var(--bg-2))",
  whiteSpace: "nowrap",
};

const thSub: React.CSSProperties = {
  textAlign: "center",
  padding: "6px 10px",
  fontSize: 10.5,
  fontWeight: 600,
  color: "var(--fg-2)",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  borderBottom: "1px solid var(--line)",
  borderRight: "1px solid var(--line)",
  whiteSpace: "nowrap",
};

function td(align: "left" | "center" | "right", mono?: boolean, color?: string): React.CSSProperties {
  return {
    padding: "10px 12px",
    textAlign: align,
    fontFamily: mono ? "var(--font-mono)" : "inherit",
    fontVariantNumeric: mono ? "tabular-nums" : "normal",
    color: color ?? "var(--fg-0)",
    borderRight: "1px solid var(--line)",
    verticalAlign: "middle",
    whiteSpace: "nowrap",
  };
}

function tdTotal(align: "left" | "center" | "right", color?: string): React.CSSProperties {
  return {
    ...td(align, true, color),
    background: "color-mix(in oklab, var(--bg-2) 50%, transparent)",
    fontWeight: 600,
  };
}
