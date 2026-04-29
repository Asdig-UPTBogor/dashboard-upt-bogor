/**
 * Pure-JS CSV parse + stringify (zero deps).
 *
 * Spec: RFC 4180 subset
 *  - Comma delimiter default, configurable
 *  - Fields containing comma/quote/newline di-quote dengan double quote
 *  - Double quote di-escape jadi ""
 *  - Header row assumed at line 0
 *  - Empty cell → "" (string)
 */

export interface CsvParseOptions {
    delimiter?: string;   // default ","
    hasHeader?: boolean;  // default true
}

export interface CsvParseResult {
    headers: string[];
    rows: Array<Record<string, string>>;
    rawMatrix: string[][];
}

export function parseCsv(text: string, opts: CsvParseOptions = {}): CsvParseResult {
    const delim = opts.delimiter ?? ",";
    const hasHeader = opts.hasHeader ?? true;

    const matrix: string[][] = [];
    let row: string[] = [];
    let field = "";
    let i = 0;
    let inQuotes = false;

    while (i < text.length) {
        const c = text[i];

        if (inQuotes) {
            if (c === '"') {
                if (text[i + 1] === '"') {
                    field += '"';
                    i += 2;
                } else {
                    inQuotes = false;
                    i++;
                }
            } else {
                field += c;
                i++;
            }
        } else {
            if (c === '"') {
                inQuotes = true;
                i++;
            } else if (c === delim) {
                row.push(field);
                field = "";
                i++;
            } else if (c === "\r") {
                i++; // ignore — expect \n next
            } else if (c === "\n") {
                row.push(field);
                matrix.push(row);
                row = [];
                field = "";
                i++;
            } else {
                field += c;
                i++;
            }
        }
    }
    // Last field
    if (field.length > 0 || row.length > 0) {
        row.push(field);
        matrix.push(row);
    }

    if (!hasHeader || matrix.length === 0) {
        return { headers: [], rows: [], rawMatrix: matrix };
    }

    const headers = matrix[0].map((h) => h.trim());
    const dataRows = matrix.slice(1).map((r) => {
        const obj: Record<string, string> = {};
        headers.forEach((h, idx) => {
            obj[h] = r[idx] ?? "";
        });
        return obj;
    });

    return { headers, rows: dataRows, rawMatrix: matrix };
}

export function stringifyCsv(headers: string[], rows: Array<Record<string, unknown>>, delim = ","): string {
    const escape = (v: unknown): string => {
        if (v == null) return "";
        const s = String(v);
        if (s.includes(delim) || s.includes('"') || s.includes("\n") || s.includes("\r")) {
            return `"${s.replace(/"/g, '""')}"`;
        }
        return s;
    };

    const lines: string[] = [];
    lines.push(headers.map(escape).join(delim));
    for (const row of rows) {
        lines.push(headers.map((h) => escape(row[h])).join(delim));
    }
    return lines.join("\n");
}

/** Download CSV file ke user's browser — pure client-side blob. */
export function downloadCsv(filename: string, csv: string): void {
    const blob = new Blob(["﻿", csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
