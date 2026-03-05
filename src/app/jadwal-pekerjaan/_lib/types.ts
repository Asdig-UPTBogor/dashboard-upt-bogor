/**
 * Shared types and helpers for Overview page
 */

/* ── Colors (consistent with rest of dashboard) ── */
export const C = {
    indigo: "#818cf8", teal: "#2dd4bf", amber: "#fbbf24",
    purple: "#c084fc", pink: "#f472b6", emerald: "#34d399",
    rose: "#fb7185", blue: "#60a5fa", cyan: "#22d3ee", orange: "#fb923c",
};

/* ── Types ── */
export interface GIPoint {
    name: string; lat: number; lng: number;
    ultg: string; voltage: string; giType: string;
}

export interface JadwalEvent {
    id: string; ultg: string; garduInduk: string; bay: string;
    jenis: string; deskripsi: string; start: string; end: string;
    status: string; gi: GIPoint | null;
    daysTotal: number; daysCurrent: number; progressPct: number;
}

/* ── Helpers ── */
export const norm = (s: string) => s.trim().toUpperCase().replace(/\s+/g, " ");

export function parseDate(s: string): Date | null {
    if (!s) return null;
    const p = s.split("/");
    if (p.length === 3) return new Date(+p[2], +p[1] - 1, +p[0]);
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
}

export function inRange(target: Date, startS: string, endS: string) {
    const s = parseDate(startS);
    if (!s) return false;
    const e = parseDate(endS) || s;
    const t = new Date(target.getFullYear(), target.getMonth(), target.getDate());
    const s0 = new Date(s.getFullYear(), s.getMonth(), s.getDate());
    const e0 = new Date(e.getFullYear(), e.getMonth(), e.getDate());
    return t >= s0 && t <= e0;
}

export function daysBetween(a: Date, b: Date) {
    return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export function fmtDate(s: string) {
    const d = parseDate(s);
    if (!d) return "—";
    return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}
