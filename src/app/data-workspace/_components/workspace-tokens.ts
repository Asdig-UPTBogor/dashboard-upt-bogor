/**
 * workspace-tokens — design constants untuk chrome Data Workspace.
 *
 *  Follows CE Next Level design system (docs/claude-designer/DESIGN_SYSTEM.md):
 *    - Monochrome slate background
 *    - Amber primary = satu-satunya accent warna
 *    - NO colored dots / LEDs per kategori
 *    - Kategori disinyalkan via label + indent + divider line, BUKAN warna
 *
 *  Edit 1 angka di sini = semua chrome ikut.
 */

export const WORKSPACE_CHROME = {
    /** Tinggi TopBar dan sidebar header — harus sama supaya horizontal rule
     *  antara baris 1 (top bar) dan baris 2 (sidebar header ↔ content) align. */
    ROW_HEIGHT_PX: 44,
    /** Horizontal padding konsisten antar cell chrome. */
    PAD_X_PX: 10,
    /** Gap antara icon button di toolbar. */
    GAP_PX: 4,
    /** Icon button clickable size. */
    ICON_BTN_PX: 28,
    /** Brand logo box (square) di TopBar kiri. */
    BRAND_BOX_PX: 28,
} as const;

export const WORKSPACE_SIDEBAR: {
    LS_KEY: string;
    LS_KEY_COLLAPSED: string;
    /** Persisted: array of dataset IDs currently expanded (showing tables). */
    LS_KEY_EXPANDED_DS: string;
    /** Persisted: array of group/category keys currently collapsed (hidden). */
    LS_KEY_COLLAPSED_SECTIONS: string;
    MIN_PX: number;
    MAX_PX: number;
    DEFAULT_PX: number;
    /** Width sidebar saat collapsed — narrow rail dengan icon-only (VS Code/Linear style). */
    COLLAPSED_RAIL_PX: number;
    /** Mobile breakpoint — below this width, sidebar jadi drawer overlay. */
    MOBILE_BREAKPOINT_PX: number;
} = {
    LS_KEY: "dw:sidebar-width",
    LS_KEY_COLLAPSED: "dw:sidebar-collapsed",
    LS_KEY_EXPANDED_DS: "dw:expanded-ds",
    LS_KEY_COLLAPSED_SECTIONS: "dw:collapsed-sections",
    MIN_PX: 220,
    MAX_PX: 560,
    DEFAULT_PX: 280,
    COLLAPSED_RAIL_PX: 48,
    MOBILE_BREAKPOINT_PX: 768,
};

export const WORKSPACE_OVERLAY: {
    MODAL_Z_INDEX: number;
    THEME_PLACEHOLDER_PX: number;
} = {
    MODAL_Z_INDEX: 200,
    THEME_PLACEHOLDER_PX: 72,
};

/* ─── Kategori default (4 + fallback Uncategory) ──────────────────
 *
 *  Per user spec:
 *    1. Transmission
 *    2. Gardu Induk
 *    3. Protection
 *    4. Platform
 *    U. Uncategory — muncul HANYA kalau ada dataset yg belum di-mapping.
 *
 *  Extended via Firestore `data_workspace_categories`. Admin tambah kategori
 *  baru via UI — seed ini jadi minimum floor saja.
 */
export type CategoryKey =
    | "transmission"
    | "gardu-induk"
    | "protection"
    | "platform"
    | "uncategory";

export const CATEGORY_ORDER: readonly CategoryKey[] = [
    "transmission",
    "gardu-induk",
    "protection",
    "platform",
    "uncategory",
] as const;

/** Kategori fallback ketika dataset tidak bisa di-resolve. */
export const UNCATEGORY_KEY: CategoryKey = "uncategory";

export function isCategoryKey(v: string): v is CategoryKey {
    return (CATEGORY_ORDER as readonly string[]).includes(v);
}

/**
 * Category metadata — NO colored dot, NO warna hue acak.
 *  - `label`: display name
 *  - `hint`: tooltip dijelasin apa isinya
 *
 *  Semua kategori hide saat kosong (seragam). Uncategory show otomatis
 *  kalau ada dataset yang belum ter-mapping ke kategori aktif.
 */
export const CATEGORY_PALETTE: Record<CategoryKey, {
    label: string;
    hint: string;
}> = {
    transmission: {
        label: "Transmission",
        hint: "Tower, jaringan, proteksi transmisi, SLD, ROW.",
    },
    "gardu-induk": {
        label: "Gardu Induk",
        hint: "Asset GI, MTU (PMT/PMS/CT/CVT/trafo/LA), kondisi GI.",
    },
    protection: {
        label: "Protection",
        hint: "Relay, program kerja proteksi, setting, koordinasi.",
    },
    platform: {
        label: "Platform",
        hint: "Internal service data (Thor/Dispatch/WaGate/dll).",
    },
    uncategory: {
        label: "Uncategory",
        hint: "Dataset belum ter-mapping. Drag ke kategori lain untuk assign.",
    },
};
