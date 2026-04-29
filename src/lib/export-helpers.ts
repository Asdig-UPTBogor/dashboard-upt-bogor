"use client";

/**
 * Export helpers — xlsx (ExcelJS) + pdf (jspdf + autotable) untuk workspace grid.
 *
 * CSV ada di src/lib/csv.ts. Helper di sini fokus format binary.
 */

import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export interface ExportColumn {
    name: string;
    alias?: string;
}

function formatCellValue(v: unknown): string {
    if (v == null) return "";
    if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
    if (typeof v === "object") return JSON.stringify(v);
    return String(v);
}

function triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

/* ─── Excel (.xlsx) ──────────────────────────────────────────── */

export async function exportXlsx({
    filename, sheetName, columns, rows,
}: {
    filename: string;
    sheetName: string;
    columns: ExportColumn[];
    rows: Array<Record<string, unknown>>;
}): Promise<void> {
    const wb = new ExcelJS.Workbook();
    wb.creator = "Dashboard UPT Bogor · Data Input";
    wb.created = new Date();
    const ws = wb.addWorksheet(sheetName.slice(0, 31), {
        views: [{ state: "frozen", ySplit: 1 }],
    });
    ws.columns = columns.map((c) => ({
        header: c.alias ?? c.name,
        key: c.name,
        width: Math.min(32, Math.max(12, (c.alias ?? c.name).length + 4)),
    }));
    for (const row of rows) {
        const mapped: Record<string, unknown> = {};
        for (const c of columns) mapped[c.name] = row[c.name] ?? null;
        ws.addRow(mapped);
    }
    const header = ws.getRow(1);
    header.font = { bold: true, color: { argb: "FFFFFFFF" } };
    header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF172A3A" } };
    header.alignment = { vertical: "middle", horizontal: "left" };
    ws.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: columns.length },
    };
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf as ArrayBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    triggerDownload(blob, `${filename}.xlsx`);
}

/* ─── PDF (.pdf) via jspdf-autotable ─────────────────────────── */

export function exportPdf({
    filename, title, subtitle, columns, rows,
}: {
    filename: string;
    title: string;
    subtitle?: string;
    columns: ExportColumn[];
    rows: Array<Record<string, unknown>>;
}): void {
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const now = new Date().toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" });

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(title, 40, 36);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120);
    if (subtitle) doc.text(subtitle, 40, 52);
    doc.text(`Export: ${now} · ${rows.length} row`, 40, subtitle ? 66 : 52);
    doc.setTextColor(0);

    autoTable(doc, {
        startY: subtitle ? 80 : 66,
        head: [columns.map((c) => c.alias ?? c.name)],
        body: rows.map((r) => columns.map((c) => formatCellValue(r[c.name]))),
        styles: { fontSize: 7, cellPadding: 4, overflow: "linebreak" },
        headStyles: {
            fillColor: [23, 42, 58],
            textColor: [255, 255, 255],
            fontSize: 8,
            fontStyle: "bold",
        },
        alternateRowStyles: { fillColor: [247, 249, 252] },
        margin: { top: 36, right: 24, bottom: 36, left: 24 },
        theme: "grid",
    });

    doc.save(`${filename}.pdf`);
}
