/**
 * Shared helpers for data-sources API
 *
 * Extracted from route.ts to enable reuse and reduce file size.
 */

import { google } from "googleapis";
import { getGoogleAuth, GOOGLE_SCOPES } from "@/lib/dashboard-config";

/* ── Dev-only logging ── */
export const isDev = process.env.NODE_ENV !== "production";
export const devLog = (...args: unknown[]) => { if (isDev) console.log(...args); };

/* ── Normalize string for case-insensitive comparison ── */
export const norm = (s: string) => s.toUpperCase().replace(/\s+/g, " ").trim();

/* ── Google Sheets client (lazy singleton) ── */
let _sheetsApi: ReturnType<typeof google.sheets> | null = null;

export async function getSheetsApi() {
    if (_sheetsApi) return _sheetsApi;
    const auth = getGoogleAuth(GOOGLE_SCOPES);
    _sheetsApi = google.sheets({ version: "v4", auth });
    return _sheetsApi;
}

/* ── Levenshtein distance ── */
export function levenshtein(a: string, b: string): number {
    const m = a.length, n = b.length;
    const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
        Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
    );
    for (let i = 1; i <= m; i++)
        for (let j = 1; j <= n; j++)
            dp[i][j] = a[i - 1] === b[j - 1]
                ? dp[i - 1][j - 1]
                : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    return dp[m][n];
}

/* ── Fuzzy match a target against candidates ── */
export function fuzzyMatch(target: string, candidates: string[]): { name: string; score: number }[] {
    const t = target.toUpperCase();
    return candidates
        .map((c) => {
            const cu = c.toUpperCase();
            const dist = levenshtein(t, cu);
            const maxLen = Math.max(t.length, cu.length);
            const score = maxLen > 0 ? Math.round((1 - dist / maxLen) * 100) : 0;
            return { name: c, score };
        })
        .filter((m) => m.score > 30)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);
}

/* ── Detect column data type from a sample value ── */
export function detectColumnType(sample: string): string {
    if (!sample || sample.trim() === "") return "empty";
    const s = sample.trim();
    if (/^-?\d{1,3}\.\d{3,}$/.test(s)) return "koordinat";
    if (/^\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4}$/.test(s)) return "tanggal";
    if (/^\d{4}[/\-]\d{1,2}[/\-]\d{1,2}$/.test(s)) return "tanggal";
    if (/^-?\d+([.,]\d+)?$/.test(s)) return "angka";
    if (/^(ya|tidak|yes|no|true|false|0|1)$/i.test(s)) return "boolean";
    if (/^https?:\/\//.test(s)) return "url";
    return "teks";
}

/* ── Convert column index (0-based) to letter (A, B, ..., AA, AB) ── */
export function colIndexToLetter(idx: number): string {
    if (idx < 26) return String.fromCharCode(65 + idx);
    return String.fromCharCode(65 + Math.floor(idx / 26) - 1) + String.fromCharCode(65 + (idx % 26));
}
