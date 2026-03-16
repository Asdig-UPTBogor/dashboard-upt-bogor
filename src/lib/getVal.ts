/**
 * getVal — Case-insensitive row value getter
 *
 * Handles BQ header case mismatches and null values.
 * Shared utility used by all page-level data parsers.
 *
 * Usage:
 *   import { getVal } from "@/lib/getVal";
 *   const name = getVal(row, "NAMA TOWER");
 */
export function getVal(row: Record<string, string>, key: string): string {
    // Fast path: exact match
    if (row[key] !== undefined) return row[key] ?? "";
    // Fallback: case-insensitive search
    const keyLower = key.toLowerCase();
    for (const k of Object.keys(row)) {
        if (k.toLowerCase() === keyLower) return row[k] ?? "";
    }
    return "";
}

/** Parse a numeric value from a BQ row, handling commas and non-numeric chars */
export function getNum(row: Record<string, string>, key: string): number {
    const v = getVal(row, key);
    const n = parseFloat(v.replace(",", ".").replace(/[^\d.-]/g, ""));
    return isNaN(n) ? 0 : n;
}
