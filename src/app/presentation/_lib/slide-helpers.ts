/**
 * Helper untuk render slide deck.
 *
 * Aturan layout (final):
 * - 1 kategori = 1 slide bar chart full width (single column)
 * - Threshold MAX_PER_SLIDE = 25 item per slide
 * - Kalau > MAX_PER_SLIDE → split jadi multi slide
 * - Label nama program muat full (no truncate) di width 1760px
 */

export const MAX_PER_SLIDE = 25;

export function chunk<T>(arr: T[], size: number): T[][] {
    if (size <= 0) return [arr];
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
        out.push(arr.slice(i, i + size));
    }
    return out;
}

export function fmtNum(n: number): string {
    if (!Number.isFinite(n)) return "0";
    return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(n);
}

export function pct(num: number, den: number): number {
    if (!den || den === 0) return 0;
    return (num / den) * 100;
}

export function fmtPct(num: number, den: number): string {
    return `${pct(num, den).toFixed(1)}%`;
}
