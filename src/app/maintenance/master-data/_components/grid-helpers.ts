import type { RenderEditCellProps } from 'react-data-grid';

/* ── Types ── */
export interface EditableRow {
    id: string;
    isNew: boolean;
    isEdited: boolean;
    data: Record<string, string>;
}

/* ── ULTG Color Map ── */
export const ULTG_COLORS: Record<string, { bg: string; border: string; text: string; badge: string }> = {
    BOGOR: {
        bg: 'rgba(59, 130, 246, 0.06)',
        border: 'rgba(59, 130, 246, 0.15)',
        text: '#93c5fd',
        badge: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    },
    SUKABUMI: {
        bg: 'rgba(16, 185, 129, 0.06)',
        border: 'rgba(16, 185, 129, 0.15)',
        text: '#6ee7b7',
        badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    },
};

export const DEFAULT_ULTG_COLOR = {
    bg: 'rgba(168, 85, 247, 0.06)',
    border: 'rgba(168, 85, 247, 0.15)',
    text: '#c4b5fd',
    badge: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
};

export function getUltgColor(ultg: string) {
    return ULTG_COLORS[ultg?.toUpperCase()] || DEFAULT_ULTG_COLOR;
}

/* ── Smart column widths ── */
export function getColumnWidth(headerName: string, sampleValues: string[]): number {
    const name = headerName.toLowerCase();
    if (name === "id" || name === "no") return 50;
    if (name.includes("status")) return 80;
    if (name.includes("tegangan")) return 80;
    if (name.includes("type gardu") || name.includes("type bay")) return 110;
    if (name.includes("master ultg")) return 100;

    const maxLen = Math.max(headerName.length, ...sampleValues.slice(0, 20).map(v => (v || "").length));
    return Math.min(280, Math.max(70, maxLen * 7 + 16));
}

/* ── Column letter (A, B, C ... Z, AA, AB ...) ── */
export function colLetter(idx: number): string {
    let result = '';
    let n = idx;
    while (n >= 0) {
        result = String.fromCharCode(65 + (n % 26)) + result;
        n = Math.floor(n / 26) - 1;
    }
    return result;
}
