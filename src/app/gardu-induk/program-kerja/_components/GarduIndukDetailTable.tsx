"use client";
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/designer/Card";
import { Badge } from "@/components/designer/Badge";
import { Icon } from "@/components/designer/Icon";
import { IconBtn } from "@/components/designer/Button";
import {
  GRP_LABEL,
  GRP_ORDER,
  type GrpKey,
  type GarduIndukDetailRow,
} from "./gardu-induk-data";

const EM_DASH = "—";
const PAGE_SIZE = 50;

type StatusFilter = "all" | "selesai" | "belum";
type UltgFilter = "all" | "BOGOR" | "SUKABUMI";
type GrpFilter = "all" | GrpKey;
type SortKey = "grp" | "program" | "garduInduk" | "bay" | "ultg" | "status" | "realisasiDate";
type SortDir = "asc" | "desc";

interface GarduIndukDetailTableProps {
  rows: GarduIndukDetailRow[];
  /** Grup aktif dari Hero/bar filter (sinkron). */
  activeGrp?: GrpKey | null;
  /** Program aktif dari klik bar chart. */
  activeProgram?: string | null;
  onClearProgram?: () => void;
}

function ultgColor(ultg: GarduIndukDetailRow["ultg"]): string {
  if (ultg === "BOGOR") return "var(--color-ultg-bogor)";
  if (ultg === "SUKABUMI") return "var(--color-ultg-sukabumi)";
  return "var(--fg-3)";
}

export function GarduIndukDetailTable({
  rows,
  activeGrp,
  activeProgram,
  onClearProgram,
}: GarduIndukDetailTableProps) {
  const [search, setSearch] = useState("");
  const [filterGrp, setFilterGrp] = useState<GrpFilter>("all");
  const [filterStatus, setFilterStatus] = useState<StatusFilter>("all");
  const [filterUltg, setFilterUltg] = useState<UltgFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("grp");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(0);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  /* ── Filter + sort ── */
  const filtered = useMemo(() => {
    let r = rows;
    // Filter eksternal dari Hero/bar (grup + program aktif)
    if (activeGrp) r = r.filter((x) => x.grp === activeGrp);
    if (activeProgram) r = r.filter((x) => x.program === activeProgram);
    // Filter internal toolbar
    if (filterGrp !== "all") r = r.filter((x) => x.grp === filterGrp);
    if (filterStatus !== "all") r = r.filter((x) => (filterStatus === "selesai" ? x.isSelesai : !x.isSelesai));
    if (filterUltg !== "all") r = r.filter((x) => x.ultg === filterUltg);
    if (search) {
      const s = search.toLowerCase();
      r = r.filter(
        (x) =>
          x.program.toLowerCase().includes(s) ||
          x.garduInduk.toLowerCase().includes(s) ||
          x.bay.toLowerCase().includes(s) ||
          x.keterangan.toLowerCase().includes(s),
      );
    }
    const sorted = [...r].sort((a, b) => {
      let va: string;
      let vb: string;
      if (sortKey === "grp") {
        va = String(GRP_ORDER.indexOf(a.grp));
        vb = String(GRP_ORDER.indexOf(b.grp));
      } else if (sortKey === "status") {
        va = a.isSelesai ? "1" : "0";
        vb = b.isSelesai ? "1" : "0";
      } else {
        va = (a[sortKey] || "").toLowerCase();
        vb = (b[sortKey] || "").toLowerCase();
      }
      const cmp = va.localeCompare(vb, "id", { numeric: true });
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [rows, activeGrp, activeProgram, filterGrp, filterStatus, filterUltg, search, sortKey, sortDir]);

  /* ── Reset page kalau filter berubah ── */
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  useEffect(() => {
    setPage(0);
  }, [search, filterGrp, filterStatus, filterUltg, activeGrp, activeProgram]);
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = useMemo(
    () => filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE),
    [filtered, safePage],
  );

  const selesaiCount = useMemo(() => filtered.filter((r) => r.isSelesai).length, [filtered]);

  return (
    <Card style={{ gridColumn: "span 12" }} noPad>
      {/* Header */}
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
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
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
          <span style={{ fontSize: 11, color: "var(--fg-2)", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span className="ds-led-dot" style={{ color: "var(--cond-very-good)" }} />
            <span style={{ letterSpacing: "0.04em" }}>
              <span className="num" style={{ color: "var(--fg-0)" }}>{filtered.length}</span>
              {" / "}
              <span className="num">{rows.length}</span>
              {" item · "}
              <span className="num" style={{ color: "var(--cond-very-good)" }}>{selesaiCount}</span>
              {" selesai"}
            </span>
          </span>
          {activeProgram && (
            <button
              onClick={onClearProgram}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: 11,
                color: "var(--accent-amber)",
                background: "color-mix(in oklab, var(--accent-amber) 12%, transparent)",
                border: "1px solid color-mix(in oklab, var(--accent-amber) 30%, transparent)",
                borderRadius: 999,
                padding: "2px 8px",
                cursor: "pointer",
                maxWidth: 280,
              }}
              title={`Filter program: ${activeProgram}`}
            >
              <Icon name="x" size={11} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{activeProgram}</span>
            </button>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
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
              placeholder="Cari program, GI, bay, keterangan..."
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
          <select value={filterGrp} onChange={(e) => setFilterGrp(e.target.value as GrpFilter)} style={selectStyle}>
            <option value="all">Semua Grup</option>
            {GRP_ORDER.map((g) => (
              <option key={g} value={g}>{GRP_LABEL[g]}</option>
            ))}
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as StatusFilter)} style={selectStyle}>
            <option value="all">Semua Status</option>
            <option value="selesai">Selesai</option>
            <option value="belum">Belum</option>
          </select>
          <select value={filterUltg} onChange={(e) => setFilterUltg(e.target.value as UltgFilter)} style={selectStyle}>
            <option value="all">Semua ULTG</option>
            <option value="BOGOR">Bogor</option>
            <option value="SUKABUMI">Sukabumi</option>
          </select>
          <IconBtn icon="download" size={28} title="Ekspor" />
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: "var(--bg-2)" }}>
              <Th label="No" align="center" />
              <Th label="Grup" sortKey="grp" active={sortKey === "grp"} dir={sortDir} onSort={handleSort} />
              <Th label="Program" sortKey="program" active={sortKey === "program"} dir={sortDir} onSort={handleSort} align="left" minWidth={220} />
              <Th label="Gardu Induk" sortKey="garduInduk" active={sortKey === "garduInduk"} dir={sortDir} onSort={handleSort} align="left" />
              <Th label="Bay" sortKey="bay" active={sortKey === "bay"} dir={sortDir} onSort={handleSort} align="left" />
              <Th label="ULTG" sortKey="ultg" active={sortKey === "ultg"} dir={sortDir} onSort={handleSort} align="center" />
              <Th label="Status" sortKey="status" active={sortKey === "status"} dir={sortDir} onSort={handleSort} align="center" />
              <Th label="Tgl Realisasi" sortKey="realisasiDate" active={sortKey === "realisasiDate"} dir={sortDir} onSort={handleSort} align="center" />
              <Th label="Keterangan" align="left" lastCol />
            </tr>
          </thead>
          <tbody>
            {pageRows.map((r, i) => {
              const idx = safePage * PAGE_SIZE + i + 1;
              return (
                <tr
                  key={`${r.program}-${r.garduInduk}-${r.bay}-${idx}`}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLTableRowElement).style.background = "var(--bg-2)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLTableRowElement).style.background = "transparent";
                  }}
                  style={{
                    borderBottom: "1px solid var(--line)",
                    background: "transparent",
                    transition: "background .15s ease",
                  }}
                >
                  <td style={td("center", true, "var(--fg-2)")}>{idx}</td>
                  <td style={td("center")}>
                    <Badge tone="neutral" size="sm">{r.grpLabel}</Badge>
                  </td>
                  <td style={{ ...td("left"), maxWidth: 320, fontWeight: 500 }} title={r.program}>
                    <span style={ellipsis}>{r.program || EM_DASH}</span>
                  </td>
                  <td style={{ ...td("left", false, "var(--fg-1)"), maxWidth: 200 }} title={r.garduInduk}>
                    <span style={ellipsis}>{r.garduInduk || EM_DASH}</span>
                  </td>
                  <td style={{ ...td("left", false, "var(--fg-1)"), maxWidth: 180 }} title={r.bay}>
                    <span style={ellipsis}>{r.bay || EM_DASH}</span>
                  </td>
                  <td style={td("center")}>
                    {r.ultg ? (
                      <span style={{ color: ultgColor(r.ultg), fontWeight: 600, fontSize: 11.5 }}>
                        {r.ultg === "BOGOR" ? "Bogor" : "Sukabumi"}
                      </span>
                    ) : (
                      <span style={{ color: "var(--fg-3)" }}>{EM_DASH}</span>
                    )}
                  </td>
                  <td style={td("center")}>
                    {r.isSelesai ? (
                      <Badge tone="very-good" size="sm" dot>Selesai</Badge>
                    ) : (
                      <Badge tone="neutral" size="sm" dot>Belum</Badge>
                    )}
                  </td>
                  <td style={td("center", true, r.realisasiDate ? "var(--cond-very-good)" : "var(--fg-3)")}>
                    {r.realisasiDate || EM_DASH}
                  </td>
                  <td
                    style={{ ...td("left", false, "var(--fg-2)"), maxWidth: 220, borderRight: "none", whiteSpace: "normal" }}
                    title={r.keterangan}
                  >
                    <span
                      style={{
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {r.keterangan || EM_DASH}
                    </span>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} style={{ padding: 32, textAlign: "center", color: "var(--fg-2)", fontSize: 12 }}>
                  Tidak ada item yang cocok dengan filter aktif.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {filtered.length > PAGE_SIZE && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "10px 20px",
            borderTop: "1px solid var(--line)",
          }}
        >
          <span style={{ fontSize: 11.5, color: "var(--fg-2)" }}>
            Menampilkan{" "}
            <span className="num" style={{ color: "var(--fg-0)" }}>
              {safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, filtered.length)}
            </span>{" "}
            dari <span className="num">{filtered.length}</span> item
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={safePage === 0} style={pageBtnStyle(safePage === 0)}>
              <Icon name="chevronRight" size={13} className="rotate-180" />
              Sebelumnya
            </button>
            <span style={{ fontSize: 11.5, color: "var(--fg-2)" }}>
              <span className="num" style={{ color: "var(--fg-0)" }}>{safePage + 1}</span>
              {" / "}
              <span className="num">{pageCount}</span>
            </span>
            <button
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={safePage >= pageCount - 1}
              style={pageBtnStyle(safePage >= pageCount - 1)}
            >
              Berikutnya
              <Icon name="chevronRight" size={13} />
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}

/* ── Sortable header cell ── */
function Th({
  label,
  align = "center",
  minWidth,
  lastCol,
  sortKey,
  active,
  dir,
  onSort,
}: {
  label: string;
  align?: "left" | "center" | "right";
  minWidth?: number;
  lastCol?: boolean;
  sortKey?: SortKey;
  active?: boolean;
  dir?: SortDir;
  onSort?: (key: SortKey) => void;
}) {
  const sortable = !!sortKey && !!onSort;
  return (
    <th
      onClick={sortable ? () => onSort!(sortKey!) : undefined}
      style={{
        textAlign: align,
        padding: "10px 12px",
        fontSize: 11,
        fontWeight: 600,
        color: active ? "var(--fg-0)" : "var(--fg-2)",
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        borderBottom: "1px solid var(--line)",
        borderRight: lastCol ? "none" : "1px solid var(--line)",
        whiteSpace: "nowrap",
        userSelect: "none",
        cursor: sortable ? "pointer" : "default",
        minWidth,
      }}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, justifyContent: align === "center" ? "center" : "flex-start" }}>
        {label}
        {sortable && (
          <span style={{ opacity: active ? 1 : 0.3, fontSize: 9, lineHeight: 1 }}>
            {active ? (dir === "asc" ? "▲" : "▼") : "⇅"}
          </span>
        )}
      </span>
    </th>
  );
}

/* ── Style helpers ── */
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

function pageBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "4px 10px",
    background: "var(--bg-2)",
    border: "1px solid var(--line)",
    borderRadius: "var(--r-sm)",
    color: disabled ? "var(--fg-3)" : "var(--fg-1)",
    fontSize: 11.5,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
    fontFamily: "inherit",
  };
}

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
