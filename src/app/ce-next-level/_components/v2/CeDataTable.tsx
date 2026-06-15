"use client";
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/designer/Card";
import { Badge } from "@/components/designer/Badge";
import { Icon } from "@/components/designer/Icon";
import { type CeDetailRow, str, programMatch } from "../ce-types";

interface Props {
    rows: CeDetailRow[];
    accent: string;
    /** Filter status eksternal (dari donut / hero) — sinkron. */
    statusFilter: "ALL" | "CLOSE" | "OPEN";
    onStatusFilter: (s: "ALL" | "CLOSE" | "OPEN") => void;
    /** Filter program eksternal (dari klik program bar). */
    programFilter?: string | null;
    onClearProgram?: () => void;
}

type SortKey = "no" | "program" | "gardu_induk" | "bay" | "status" | "tgl_rencana" | "tgl_realisasi";
type SortDir = "asc" | "desc";

const EM_DASH = "—";
const PAGE_SIZE = 50;

function dash(v: string): string {
    const s = str(v);
    return s === "" ? EM_DASH : s;
}

/** Normalisasi status mentah → CLOSE | OPEN (robust, data belum disanitize). */
function normStatus(r: CeDetailRow): "CLOSE" | "OPEN" {
    if (r.is_close) return "CLOSE";
    const s = str(r.status).toUpperCase();
    if (s === "CLOSE" || s === "CLOSED" || s === "SELESAI") return "CLOSE";
    return "OPEN";
}

export function CeDataTable({
    rows,
    accent,
    statusFilter,
    onStatusFilter,
    programFilter,
    onClearProgram,
}: Props) {
    const [search, setSearch] = useState("");
    const [sortKey, setSortKey] = useState<SortKey>("no");
    const [sortDir, setSortDir] = useState<SortDir>("asc");
    const [page, setPage] = useState(0);

    const filtered = useMemo(() => {
        let r = rows;
        if (statusFilter !== "ALL") r = r.filter((x) => normStatus(x) === statusFilter);
        if (programFilter) r = r.filter((x) => programMatch(str(x.program), programFilter));
        if (search) {
            const s = search.toLowerCase();
            r = r.filter(
                (x) =>
                    str(x.program).toLowerCase().includes(s) ||
                    str(x.gardu_induk).toLowerCase().includes(s) ||
                    str(x.bay).toLowerCase().includes(s) ||
                    str(x.peralatan).toLowerCase().includes(s) ||
                    str(x.deskripsi).toLowerCase().includes(s) ||
                    str(x.keterangan).toLowerCase().includes(s) ||
                    str(x.ultg).toLowerCase().includes(s),
            );
        }
        return r;
    }, [rows, statusFilter, programFilter, search]);

    const sorted = useMemo(() => {
        const arr = [...filtered];
        const dir = sortDir === "asc" ? 1 : -1;
        arr.sort((a, b) => {
            let va: string | number;
            let vb: string | number;
            if (sortKey === "no") {
                va = Number(a.no) || 0;
                vb = Number(b.no) || 0;
            } else if (sortKey === "status") {
                va = normStatus(a);
                vb = normStatus(b);
            } else {
                va = str(a[sortKey]).toLowerCase();
                vb = str(b[sortKey]).toLowerCase();
            }
            if (va < vb) return -1 * dir;
            if (va > vb) return 1 * dir;
            return 0;
        });
        return arr;
    }, [filtered, sortKey, sortDir]);

    const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
    // Reset / clamp halaman kalau filter berubah
    useEffect(() => {
        setPage(0);
    }, [statusFilter, programFilter, search, sortKey, sortDir]);
    const safePage = Math.min(page, pageCount - 1);
    const pageRows = useMemo(
        () => sorted.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE),
        [sorted, safePage],
    );

    const toggleSort = (k: SortKey) => {
        if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        else {
            setSortKey(k);
            setSortDir("asc");
        }
    };

    return (
        <Card style={{ gridColumn: "span 12" }} noPad>
            {/* Header — caption + LED counter + toolbar */}
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
                        Rincian Anomali
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
                            <span className="num" style={{ color: "var(--fg-0)" }}>
                                {sorted.length.toLocaleString("id-ID")}
                            </span>
                            {" / "}
                            <span className="num">{rows.length.toLocaleString("id-ID")}</span>
                            {" anomali"}
                        </span>
                    </span>
                    {programFilter && (
                        <button
                            onClick={onClearProgram}
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 5,
                                fontSize: 11,
                                padding: "3px 8px 3px 10px",
                                borderRadius: 999,
                                cursor: "pointer",
                                color: accent,
                                background: `color-mix(in oklab, ${accent} 12%, transparent)`,
                                border: `1px solid color-mix(in oklab, ${accent} 30%, transparent)`,
                            }}
                            title="Hapus filter program"
                        >
                            <span style={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {programFilter}
                            </span>
                            <Icon name="x" size={11} />
                        </button>
                    )}
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
                            placeholder="Cari GI, bay, peralatan, deskripsi..."
                            style={{
                                background: "transparent",
                                border: "none",
                                outline: "none",
                                color: "var(--fg-0)",
                                fontSize: 12,
                                width: 230,
                                fontFamily: "inherit",
                            }}
                        />
                    </div>
                    <select
                        value={statusFilter}
                        onChange={(e) => onStatusFilter(e.target.value as "ALL" | "CLOSE" | "OPEN")}
                        style={selectStyle}
                    >
                        <option value="ALL">Semua Status</option>
                        <option value="CLOSE">Close</option>
                        <option value="OPEN">Open</option>
                    </select>
                </div>
            </div>

            <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                    <thead>
                        <tr style={{ background: "var(--bg-2)" }}>
                            <Th label="No" col="no" align="center" {...{ sortKey, sortDir, toggleSort }} />
                            <Th label="Program" col="program" align="left" minWidth={200} {...{ sortKey, sortDir, toggleSort }} />
                            <Th label="GI" col="gardu_induk" align="left" minWidth={150} {...{ sortKey, sortDir, toggleSort }} />
                            <Th label="Bay" col="bay" align="left" minWidth={120} {...{ sortKey, sortDir, toggleSort }} />
                            <Th label="Status" col="status" align="center" {...{ sortKey, sortDir, toggleSort }} />
                            <Th label="Tgl Rencana" col="tgl_rencana" align="center" {...{ sortKey, sortDir, toggleSort }} />
                            <Th label="Tgl Realisasi" col="tgl_realisasi" align="center" {...{ sortKey, sortDir, toggleSort }} />
                            <th style={{ ...thBase("left"), borderRight: "none", minWidth: 200 }}>Keterangan</th>
                        </tr>
                    </thead>
                    <tbody>
                        {pageRows.map((r, i) => {
                            const st = normStatus(r);
                            return (
                                <tr
                                    key={`${str(r.no)}-${safePage}-${i}`}
                                    style={{ borderBottom: "1px solid var(--line)", transition: "background .15s ease" }}
                                    onMouseEnter={(e) => {
                                        (e.currentTarget as HTMLTableRowElement).style.background = "var(--bg-2)";
                                    }}
                                    onMouseLeave={(e) => {
                                        (e.currentTarget as HTMLTableRowElement).style.background = "transparent";
                                    }}
                                >
                                    <td style={td("center", true, "var(--fg-2)")}>{dash(String(r.no))}</td>
                                    <td style={{ ...td("left"), maxWidth: 280, fontWeight: 500 }} title={str(r.program)}>
                                        <span style={ellipsis}>{dash(str(r.program))}</span>
                                    </td>
                                    <td style={{ ...td("left"), maxWidth: 200 }} title={str(r.gardu_induk)}>
                                        <span style={ellipsis}>{dash(str(r.gardu_induk))}</span>
                                    </td>
                                    <td style={{ ...td("left"), maxWidth: 160 }} title={str(r.bay)}>
                                        <span style={ellipsis}>{dash(str(r.bay))}</span>
                                    </td>
                                    <td style={td("center")}>
                                        <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                                            {st === "CLOSE" ? (
                                                <Badge tone="very-good" size="sm" dot>
                                                    CLOSE
                                                </Badge>
                                            ) : (
                                                <Badge tone="poor" size="sm" dot>
                                                    OPEN
                                                </Badge>
                                            )}
                                            {r.is_target === false && (
                                                <Badge tone="fair" size="sm">
                                                    Non-Target
                                                </Badge>
                                            )}
                                        </div>
                                    </td>
                                    <td style={td("center", true, "var(--fg-1)")}>{dash(str(r.tgl_rencana))}</td>
                                    <td style={td("center", true, r.is_close ? "var(--cond-very-good)" : "var(--fg-3)")}>
                                        {dash(str(r.tgl_realisasi))}
                                    </td>
                                    <td
                                        style={{ ...td("left", false, "var(--fg-1)"), maxWidth: 280, borderRight: "none", whiteSpace: "normal" }}
                                        title={str(r.keterangan)}
                                    >
                                        <span style={clamp2}>{dash(str(r.keterangan))}</span>
                                    </td>
                                </tr>
                            );
                        })}
                        {pageRows.length === 0 && (
                            <tr>
                                <td colSpan={8} style={{ padding: 32, textAlign: "center", color: "var(--fg-2)", fontSize: 12 }}>
                                    Tidak ada anomali yang cocok dengan filter aktif.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination footer */}
            {sorted.length > PAGE_SIZE && (
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "12px 20px",
                        borderTop: "1px solid var(--line)",
                        gap: 12,
                        flexWrap: "wrap",
                    }}
                >
                    <span className="ds-small" style={{ color: "var(--fg-2)" }}>
                        Menampilkan{" "}
                        <span className="num" style={{ color: "var(--fg-0)" }}>
                            {(safePage * PAGE_SIZE + 1).toLocaleString("id-ID")}
                        </span>
                        {"–"}
                        <span className="num" style={{ color: "var(--fg-0)" }}>
                            {Math.min((safePage + 1) * PAGE_SIZE, sorted.length).toLocaleString("id-ID")}
                        </span>{" "}
                        dari{" "}
                        <span className="num" style={{ color: "var(--fg-0)" }}>
                            {sorted.length.toLocaleString("id-ID")}
                        </span>
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <PageBtn disabled={safePage === 0} onClick={() => setPage(safePage - 1)} label="Sebelumnya" />
                        <span className="num" style={{ fontSize: 12, color: "var(--fg-1)", padding: "0 6px" }}>
                            {safePage + 1} / {pageCount}
                        </span>
                        <PageBtn disabled={safePage >= pageCount - 1} onClick={() => setPage(safePage + 1)} label="Berikutnya" />
                    </div>
                </div>
            )}
        </Card>
    );
}

/* ── Sub-components & styles ── */

function Th({
    label,
    col,
    align,
    minWidth,
    sortKey,
    sortDir,
    toggleSort,
}: {
    label: string;
    col: SortKey;
    align: "left" | "center" | "right";
    minWidth?: number;
    sortKey: SortKey;
    sortDir: SortDir;
    toggleSort: (k: SortKey) => void;
}) {
    const active = sortKey === col;
    return (
        <th
            onClick={() => toggleSort(col)}
            style={{ ...thBase(align), minWidth, cursor: "pointer" }}
        >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                {label}
                <span style={{ opacity: active ? 1 : 0.3, display: "inline-flex" }}>
                    <Icon name={active && sortDir === "desc" ? "arrowDown" : "arrowUp"} size={10} />
                </span>
            </span>
        </th>
    );
}

function PageBtn({ disabled, onClick, label }: { disabled: boolean; onClick: () => void; label: string }) {
    return (
        <button
            disabled={disabled}
            onClick={onClick}
            style={{
                fontSize: 12,
                padding: "5px 12px",
                borderRadius: "var(--r-sm)",
                border: "1px solid var(--line)",
                background: "var(--bg-2)",
                color: disabled ? "var(--fg-3)" : "var(--fg-1)",
                cursor: disabled ? "default" : "pointer",
                opacity: disabled ? 0.5 : 1,
                fontFamily: "inherit",
            }}
        >
            {label}
        </button>
    );
}

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

const clamp2: React.CSSProperties = {
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
    textOverflow: "ellipsis",
};

function thBase(align: "left" | "center" | "right"): React.CSSProperties {
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
