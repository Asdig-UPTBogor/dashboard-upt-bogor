/**
 * SS V5 — Drift Detector (pure function, TDD)
 *
 * Compare previous vs current snapshot of a Spreadsheet + Sheet + Columns
 * to detect drift events yang perlu di-resolve (auto atau manual).
 *
 * Snapshot shape di-persist di:
 *   BQ `ss_platform.sheet_sync_state.columns_snapshot` (per-sheet)
 *   Firestore `data_sources/{id}.sheets[].sheetId` (permanent numeric ID)
 *
 * Event classification:
 *   SPREADSHEET_RENAMED | SHEET_RENAMED | COLUMN_ADDED = AUTO_RESOLVED (log only)
 *   COLUMN_RENAMED | COLUMN_REMOVED = NEEDS_ACTION kalau kolom FK
 *
 * Severity escalation (CRITICAL) ditentukan oleh caller (bukan di sini) —
 * caller tau mana kolom FK vs non-FK via data_sources.sheets[].columns mapping.
 */

export interface ColumnSnapshot {
    /** Sheet column letter: A, B, C, ..., AA, AB, ... */
    letter: string;
    /** Raw header text di row 1 (trimmed). Empty string = placeholder (G10 skip). */
    header: string;
    /** 0-based column index untuk traceability. */
    idx: number;
}

export interface SheetSnapshot {
    /** Google Sheets numeric sheetId (permanent, ga berubah saat rename tab). */
    sheetId: number;
    /** Sheet tab title (mutable — bisa berubah saat user rename). */
    title: string;
    /** Column snapshot per letter. Kolom dengan header kosong tetap dimasukkan
     * (biar COLUMN_ADDED detectable — kolom jadi pakai = header muncul). */
    columns: ColumnSnapshot[];
}

export interface SpreadsheetSnapshot {
    /** Permanent Drive file ID (ga pernah berubah selama file hidup). */
    spreadsheetId: string;
    /** Spreadsheet file title (mutable — bisa berubah saat user rename file). */
    title: string;
    sheets: SheetSnapshot[];
}

export type DriftEventType =
    | 'SPREADSHEET_RENAMED'
    | 'SHEET_RENAMED'
    | 'COLUMN_ADDED'
    | 'COLUMN_REMOVED'
    | 'COLUMN_RENAMED';

export type DriftSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export interface DriftEvent {
    type: DriftEventType;
    severity: DriftSeverity;
    spreadsheetId: string;
    sheetId?: number;
    sheetTitle?: string;
    payload: Record<string, unknown>;
}

/**
 * Pure compare function — zero I/O, fully testable.
 *
 * Auto-resolved events (INFO):
 *   - SPREADSHEET_RENAMED: file title berubah (ID permanent match)
 *   - SHEET_RENAMED: tab title berubah (sheetId match)
 *   - COLUMN_ADDED: kolom baru muncul (G10 rule auto-include saat sync berikutnya)
 *
 * Needs-action events (WARNING default, CRITICAL kalau caller flag FK):
 *   - COLUMN_RENAMED: letter sama, header beda
 *   - COLUMN_REMOVED: letter hilang dari current
 *
 * Events TIDAK di-emit:
 *   - Sheet added (sheetId baru di current) — registration concern, bukan drift
 *   - Sheet deleted (sheetId hilang dari current) — out of scope (butuh handling khusus sync stuck)
 */
export function compareSnapshots(
    previous: SpreadsheetSnapshot,
    current: SpreadsheetSnapshot
): DriftEvent[] {
    const events: DriftEvent[] = [];

    // ─── Spreadsheet-level: title change ───
    if (previous.title !== current.title) {
        events.push({
            type: 'SPREADSHEET_RENAMED',
            severity: 'INFO',
            spreadsheetId: current.spreadsheetId,
            payload: { from: previous.title, to: current.title },
        });
    }

    // ─── Sheet-level: match by sheetId (permanent) ───
    const prevSheetMap = new Map(previous.sheets.map((s) => [s.sheetId, s]));
    for (const currSheet of current.sheets) {
        const prevSheet = prevSheetMap.get(currSheet.sheetId);
        if (!prevSheet) continue; // new sheet — registration, not drift

        // Sheet title change (sheetId match, title beda = rename)
        if (prevSheet.title !== currSheet.title) {
            events.push({
                type: 'SHEET_RENAMED',
                severity: 'INFO',
                spreadsheetId: current.spreadsheetId,
                sheetId: currSheet.sheetId,
                sheetTitle: currSheet.title,
                payload: { from: prevSheet.title, to: currSheet.title },
            });
        }

        // ─── Column-level: match by letter ───
        const prevColMap = new Map(prevSheet.columns.map((c) => [c.letter, c]));
        const currColMap = new Map(currSheet.columns.map((c) => [c.letter, c]));

        // ADDED: letter di current, ga di previous
        for (const [letter, col] of currColMap) {
            if (!prevColMap.has(letter)) {
                events.push({
                    type: 'COLUMN_ADDED',
                    severity: 'INFO',
                    spreadsheetId: current.spreadsheetId,
                    sheetId: currSheet.sheetId,
                    sheetTitle: currSheet.title,
                    payload: { letter, header: col.header, idx: col.idx },
                });
            }
        }

        // REMOVED: letter di previous, ga di current
        for (const [letter, col] of prevColMap) {
            if (!currColMap.has(letter)) {
                events.push({
                    type: 'COLUMN_REMOVED',
                    severity: 'WARNING',
                    spreadsheetId: current.spreadsheetId,
                    sheetId: currSheet.sheetId,
                    sheetTitle: currSheet.title,
                    payload: { letter, header: col.header, idx: col.idx },
                });
            }
        }

        // RENAMED: letter sama, header beda
        for (const [letter, currCol] of currColMap) {
            const prevCol = prevColMap.get(letter);
            if (prevCol && prevCol.header !== currCol.header) {
                events.push({
                    type: 'COLUMN_RENAMED',
                    severity: 'WARNING',
                    spreadsheetId: current.spreadsheetId,
                    sheetId: currSheet.sheetId,
                    sheetTitle: currSheet.title,
                    payload: {
                        letter,
                        from: prevCol.header,
                        to: currCol.header,
                        idx: currCol.idx,
                    },
                });
            }
        }
    }

    return events;
}

/**
 * Escalate COLUMN_RENAMED / COLUMN_REMOVED severity ke CRITICAL
 * kalau kolom yang berubah adalah FK (giCol, bayCol, dll).
 *
 * @param events dari compareSnapshots
 * @param fkColumnsPerSheet map sheetId → Set<header yang FK>
 */
export function escalateFKSeverity(
    events: DriftEvent[],
    fkColumnsPerSheet: Map<number, Set<string>>
): DriftEvent[] {
    return events.map((e) => {
        if (e.type !== 'COLUMN_RENAMED' && e.type !== 'COLUMN_REMOVED') return e;
        if (!e.sheetId) return e;
        const fkSet = fkColumnsPerSheet.get(e.sheetId);
        if (!fkSet) return e;

        const headerToCheck =
            e.type === 'COLUMN_RENAMED'
                ? String((e.payload as any).from ?? '')
                : String((e.payload as any).header ?? '');

        if (fkSet.has(headerToCheck)) {
            return { ...e, severity: 'CRITICAL' as DriftSeverity };
        }
        return e;
    });
}
