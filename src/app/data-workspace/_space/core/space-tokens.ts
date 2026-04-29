/**
 * Space — design tokens.
 *
 * Sync dengan workspace tokens (CE Next Level cool slate + amber primary).
 * Single source of truth — edit di sini = semua Space ikut.
 *
 * Color palette pakai CSS variables dari globals.css (--background, --primary, dll)
 * via Tailwind classes (bg-background, text-foreground, ds-* utilities).
 * Tokens di file ini hanya untuk numeric constants (height, width, padding).
 */

export const SPACE_GRID = {
    /** Default row height (px) — comfortable density. */
    ROW_HEIGHT_PX: 36,
    /** Compact density row height. */
    ROW_HEIGHT_COMPACT_PX: 28,
    /** Header row height. */
    HEADER_HEIGHT_PX: 36,
    /** Toolbar height (search + filter + actions). */
    TOOLBAR_HEIGHT_PX: 44,
    /** Status bar (footer: row count, dirty count, save). */
    STATUS_HEIGHT_PX: 32,

    /** Cell padding horizontal. */
    CELL_PAD_X_PX: 10,
    /** Cell padding vertical. */
    CELL_PAD_Y_PX: 6,

    /** Default column width (px) when no explicit size. */
    COL_WIDTH_DEFAULT_PX: 160,
    /** Min column width when resizing. */
    COL_WIDTH_MIN_PX: 60,
    /** Max column width when resizing. */
    COL_WIDTH_MAX_PX: 600,
    /** Width khusus kolom row-number (#). */
    COL_ROWNUM_WIDTH_PX: 44,
    /** Width khusus kolom checkbox select. */
    COL_SELECT_WIDTH_PX: 36,

    /** Virtualization overscan (rows rendered di luar viewport). */
    VIRT_OVERSCAN: 8,
} as const;

export const SPACE_LS = {
    /** localStorage key prefix untuk per-table user prefs. */
    PREFS_PREFIX: "dw:space:prefs",
    /** localStorage key prefix untuk dirty draft. */
    DRAFT_PREFIX: "dw:space:draft",
} as const;

/** Build LS key per table per user (per-user via cookie/session lebih lengkap). */
export function spacePrefsKey(dataset: string, table: string): string {
    return `${SPACE_LS.PREFS_PREFIX}:${dataset}:${table}`;
}
export function spaceDraftKey(dataset: string, table: string): string {
    return `${SPACE_LS.DRAFT_PREFIX}:${dataset}:${table}`;
}
