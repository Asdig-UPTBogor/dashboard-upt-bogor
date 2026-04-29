# DATA PLATFORM DESIGN

> **Platform internal operasi data UPT Bogor** — integrated Input + Storage + Output di 1 Dashboard Next.js.
> Status: Draft iteratif v0.3. Last updated: 2026-04-24.
> Author: Selamat Lestari (architect) + Opus (consultant).

---

## 0. PATTERN UTAMA (v0.3 — 2026-04-24 pivot)

### Mental Model

```
BigQuery ≡ Google Sheets
  ┌─────────────────────────────────────┐
  │  dataset  = spreadsheet (file)       │
  │  table    = sheet tab (di dalamnya) │
  │  rows     = baris data               │
  │  columns  = kolom (schema BQ)        │
  └─────────────────────────────────────┘

Data Input Dashboard = universal browser + editor untuk semua BQ
  ▸ Sidebar auto-discover semua dataset + table BQ
  ▸ Click table = workspace grid (spreadsheet UX) edit langsung ke BQ
  ▸ Click dataset = halaman config (meta, list table, aksi)
  ▸ [+ Dataset] [+ Table] wizard untuk bikin dataset/table baru
  ▸ Firestore cuma store overlay config (alias, CHOICE options, UI hints)
    — bukan data, bukan registry
```

### Core Principle

**ZERO HARDCODE per table.** Satu komponen `MasterGrid` dipakai untuk semua
workspace (UPT, Bay, strikes Thor, asset tower, custom table user). Pattern
ini berarti:

- Tambah table BQ baru = muncul otomatis di sidebar tanpa code change
- Rename/alter kolom di BQ = auto-reflect di FE
- Admin edit alias/CHOICE options di UI → tersimpan di Firestore overlay,
  langsung live semua user via onSnapshot

### 4 Layer Arsitektur

```
┌─ LAYER 1: DISCOVERY ───────────────────────────────────────┐
│  bq list datasets                → populate sidebar dataset │
│  bq list tables --dataset=…      → populate sidebar tables  │
│  bq dataset.table.getMetadata()  → schema render di grid   │
└──────────────────────────────────────────────────────────────┘

┌─ LAYER 2: CONFIG OVERLAY (Firestore) ──────────────────────┐
│  data_input_config/{ds}__{t}                                 │
│    { columns: { [colName]: {alias, type, mode, options,     │
│                              reference, hidden, readOnly} } │
│      uiHints: { defaultSort, defaultFilter, icon, ... } }   │
│  Opsional per table. Admin edit via Column Configurator UI.  │
│  Kalau doc belum ada → FE pakai BQ schema raw (name as-is).  │
└──────────────────────────────────────────────────────────────┘

┌─ LAYER 3: RENDER (generic FE components) ──────────────────┐
│  MasterGrid           — spreadsheet UX, BQ-backed            │
│  ColumnConfigurator   — edit overlay per kolom               │
│  SheetFilterPopup     — filter per kolom (Sheets-style)      │
│  AddRowModal          — form dinamis dari schema             │
│  AddTableWizard       — bikin table BQ baru                  │
│  AddDatasetWizard     — bikin dataset BQ baru                │
│  SEMUA generic. Zero hardcode per table.                     │
└──────────────────────────────────────────────────────────────┘

┌─ LAYER 4: BQ CRUD (generic API) ──────────────────────────┐
│  GET  /api/data-input/datasets                              │
│       list dataset BQ (filter by allowlist / role)          │
│  GET  /api/data-input/datasets/[ds]                         │
│       dataset meta + child tables                           │
│  POST /api/data-input/datasets                              │
│       create dataset (bq mk)                                │
│  GET  /api/data-input/datasets/[ds]/tables/[t]              │
│       table schema + overlay merged                         │
│  POST /api/data-input/datasets/[ds]/tables                  │
│       create table (bq mk) + define columns                 │
│  GET  /api/data-input/datasets/[ds]/tables/[t]/rows         │
│       list rows (SELECT *)                                  │
│  POST /api/data-input/datasets/[ds]/tables/[t]/rows         │
│       insert row                                            │
│  PATCH /api/data-input/datasets/[ds]/tables/[t]/rows        │
│       update row + optimistic lock                          │
│  DELETE /api/data-input/datasets/[ds]/tables/[t]/rows       │
│       soft delete (kalau ada is_active) / hard delete       │
│  PATCH /api/data-input/datasets/[ds]/tables/[t]/schema      │
│       update column overlay (alias, CHOICE options)         │
└──────────────────────────────────────────────────────────────┘
```

### Flow User

```
[1] Buka /data-input
    ↓ Sidebar auto-populate dari bq list datasets
    ↓ Landing page list semua dataset (grid card)

[2] Click dataset (contoh "Master_Data")
    → /data-input/Master_Data
    ↓ Halaman dataset: meta BQ, list tables (card), counts, sizes
    ↓ [+ Table in this dataset]

[3] Click table (contoh "UPT")
    → /data-input/Master_Data/UPT
    ↓ Workspace grid (MasterGrid):
      ▸ Header alias dari Firestore overlay (fallback BQ col name)
      ▸ Row click = highlight
      ▸ Dblclick cell = inline edit → PATCH BQ
      ▸ Filter per kolom (checkbox Sheets-style)
      ▸ [+ Row] tambah row langsung
      ▸ [⚙ Konfig Kolom] edit alias/CHOICE/REFERENCE

[4] Click [+ Dataset] (toolbar global)
    → halaman wizard:
      1. Nama dataset + location + deskripsi
      2. Review
      3. Submit → bq mk dataset → redirect /data-input/<new>

[5] Click [+ Table]
    → halaman wizard:
      1. Pilih dataset parent
      2. Nama table + deskripsi
      3. Define kolom: nama, tipe, mode, (opsional CHOICE/REFERENCE)
      4. Partitioning/clustering (opsional)
      5. Submit → bq mk table + init Firestore overlay
      → redirect /data-input/<ds>/<t>
```

### Yang Otomatis Muncul di Sidebar

Semua dataset BQ yang user punya access ke project:

| Source Platform | Dataset | Contoh Table |
|---|---|---|
| Master Data (Level 0) | `Master_Data` | UPT, ULTG, Gardu_Induk, Bay |
| Thor (Level 1) | `thor_vaisala` | strikes, predictions, sync_log |
| Dispatch (Level 3) | `dispatch` | delivery_log |
| WaGate (Level 3) | `wagate` | message_log, event_log |
| Transmisi | `Master_Transmisi_UPT_Bogor` | tower, jaringan, proteksi |
| Asset GI | `Dashboard_Gardu_Induk_UPT_Bogor` | CT, CVT, kabel, LA, PMS, PMT |
| Relay | `Master_Asset_Relay_UPT_Bogor` | (tables) |
| CE | `Mirroring_Common_Enemy_Next_Level_UPT_Bogor` | (tables) |
| (future) | (any dataset user bikin) | (any table) |

Data Input Dashboard = **satu UI untuk semua**.

### Non-Goal (scope lock pivot v0.3)

- TIDAK menggantikan Dashboard viz pages — mereka tetap baca BQ untuk render chart/map
- TIDAK real-time collab spreadsheet-like — 1 editor per table via optimistic lock
- TIDAK OLAP complex query builder — scope = CRUD + filter + sort saja

---

## 0A. ITERASI KESEPAKATAN (running log)

Tanggal pivot: 2026-04-23. User insight: Sheet-as-SSOT anti-pattern untuk analytics yg di-JOIN.

**v0.3 pivot (2026-04-24) — universal BQ browser/editor:**
- Drop hardcoded Master Data path — semua dataset/table BQ auto-discover dari `bq list`
- Sidebar nested dataset → tables dari API discovery (data_platform_dataset → children tables)
- `MasterGrid` component generic, dipakai semua workspace (zero hardcode per table)
- Firestore = pure overlay config (alias, CHOICE options, UI hints) — bukan registry, bukan data
- BQ tetap = storage utama CRUD; koreksi dari v0.2 research yang over-weight Google docs
- Agent sebelumnya benar: BQ viable untuk CRUD UI small-scale (Master tables ~365 rows)

**v0.3 iterasi detail:**
- Firestore namespace standar: `data_platform_*` (align dengan CLAUDE.md konvensi) —
  bukan `data_input_*` atau `schema_metadata` (semua deprecated)
- 3 Firestore collection terpisah per fungsi (separation of concern):
  - `data_platform_dataset/{ds}` → dataset-level overlay (alias, icon, deskripsi)
  - `data_platform_table/{ds}__{t}` → table-level overlay (primaryKey, displayKey, defaultSort, alias)
  - `data_platform_columns/{ds}__{t}` → per-column overlay ({ columns: { [col]: meta } })
- Route hierarchy: `/data-input` → `/data-input/[ds]` → `/data-input/[ds]/[t]`
- Sidebar `Data Input Dashboard` expandable:
  - `dataset A` expand → list `table 1, table 2, ...` → click table masuk workspace
  - Auto-refresh ketika admin bikin dataset/table baru via wizard
- Wizard pages: `/data-input/_new/dataset` dan `/data-input/_new/table` (bukan modal)
- PK auto-inferred dari kolom `{table}_id`, `id_{table}`, atau `id`; user bisa override via Table Overlay

**v0.3 Dataset origin (BQ label `origin`):**
- `user`     → dibuat user via wizard "+ Dataset". CRUD penuh.
- `platform` → dibuat platform Level 1/1E/2/3 (Thor, Dispatch, WaGate, Asisten Reporter, dll).
               Dataset ini "handle sendiri caranya ditampilkan" (user feedback) — bisa
               read-only atau ada integration khusus.
- `legacy`   → default kalau tidak ada label. Dataset existing dari sistem Spreadsheet Sync
               lama. Akan dihapus setelah Data Input stabil. Jangan bikin fitur baru
               yang bergantung.
- Admin bisa override via UI Dataset Config page ("Mark as Platform" / "Mark as User").

**v0.3 Migration path (dashboard existing → Data Input pattern):**
- Dashboard pages existing (gardu-induk/healthy-index, transmisi/petir, ce-next-level,
  dll) sekarang read BQ langsung via legacy Spreadsheet Sync path.
- Migrasi bertahap: pelan-pelan repoint dashboard viz → read BQ via API layer
  yang share dengan Data Input. Pattern: kolom overlay Firestore yang sama dipakai
  dashboard untuk rendering (alias di chart legend, CHOICE color di pie chart, dll).
- End state: Data Input = SSOT authoring, dashboard = viz consumer. Satu pattern.

**v0.3 final iterasi — UX decisions (2026-04-24 sore, SUPERSEDES §4.3 earlier breadcrumb idea):**
- Click row SEKALI = highlight. Click row SAMA lagi = deselect (toggle).
- HAPUS HierarchyStrip (click row → muncul chain) — user ga perlu. Data chain
  cukup ada di layer data (FK stable), tidak harus ditampilin UI.
- HAPUS virtual ancestor columns (UPT/ULTG di Bay grid) — user ga perlu.
  Direct parent FK saja yang di-resolve (gi_id → nama GI).
- Deselect button DIHAPUS dari bulk bar — click row sama lagi cukup.

**v0.3 Add Table Wizard enhancement "Link ke Master":**
- Step 3 (Define Kolom) punya dropdown "Link ke Master" per kolom:
  ```
  none / UPT / ULTG / Gardu Induk / Bay
  ```
- Pilih "Bay" → nama + tipe auto-lock ke `bay_id STRING` convention.
- Auto-detect FK di bq-discovery.ts pakai convention ini → REFERENCE type
  render label di grid (bukan UUID mentah).
- Pattern ini memungkinkan admin bikin tabel user baru (MTU, Asset, dll)
  yang chain ke Master Data tanpa harus paham konsep FK.

**v0.3 pelajaran dari iterasi yang gagal (Session 2026-04-24):**
- Gagal iterasi 1: hardcoded 4 master route (upt/ultg/gi/bay) — user frustasi karena ga scale ke dataset lain
- Gagal iterasi 2: mock data invented kolom (head_name, phone, gi_type, status) — tidak sesuai real BQ schema
- Gagal iterasi 3: checkbox + drawer UX — user mau Airtable/Sheets-simple, bukan enterprise form
- Gagal iterasi 4: Firestore sebagai registry primary — user tegaskan Firestore cuma buat config
- Gagal iterasi 5: terlalu banyak wireframe ASCII — user: "bingung saya!". Sekarang langsung build + preview

**17 kesepakatan per 2026-04-24:**
1. Pivot dari Sheet→Sync→BQ → Data Platform self-contained (Input + Storage + Output di 1 Dashboard)
2. Arsitektur 3-layer (lihat §3)
3. BQ schema enforced, FK by UUID stable (bukan hash)
4. Master Data = 1 dataset, tables: `UPT`, `ULTG`, `Gardu_Induk`, `Bay`
5. Level tabel: SINGLE PICK radio (UPT/ULTG/GI/Bay/FLAT) — parent chain otomatis dari Master
6. Page lock concurrent edit + TTL 10min + tombol Claim saat expire/release + heartbeat 30s
7. Audit log semua mutation sejak Phase 2
8. Soft delete default (is_active=false), hard delete via Purge admin
9. Optimistic lock per row via `_updated_at`
10. Bulk import CSV/Excel dengan diff review + validate per row
11. File upload via Google Drive (bukan GCS) — metadata path di BQ
12. Role: admin / editor / viewer
13. Cloud Run native multi-user scaling
14. Page builder + component edit mode (admin toggle View/Edit)
15. Dropdown field: CHOICE / CASCADE / REFERENCE — editable in-the-fly tanpa tutup form
16. Config storage: Firestore primary (realtime onSnapshot) + optional BQ mirror untuk analytics
17. Istilah: drop "dim/fact". Pakai "Master Table" (UPT/ULTG/GI/Bay) + "Data Table" (operasional)

---

## 0. RINGKAS 1 HALAMAN

```
┌────────────────────────────────────────────────────────────┐
│ APA                                                         │
│   Platform data internal yg gabungin:                       │
│   ▸ INPUT: form CRUD + bulk import + file upload            │
│   ▸ STORAGE: BigQuery (schema-enforced, ACID via app)       │
│   ▸ OUTPUT: dashboard viz (existing) + editor edit-mode    │
│                                                             │
│ KENAPA                                                      │
│   Menggantikan pattern Sheet→Sync→BQ yg fragile dan rentan  │
│   drift. Pattern self-contained = industry standard MDM +   │
│   operational data app (seperti Retool, Airtable, Metabase) │
│                                                             │
│ UNTUK SIAPA                                                 │
│   Admin : full CRUD + schema change + role management       │
│   Editor: read + edit tabel yg assigned                     │
│   Viewer: read-only dashboard                                │
│                                                             │
│ KAPAN JADI                                                  │
│   Phase 1-6, total 15-20 hari kerja                         │
│   Phase 1 (fondasi, 3-4 hari) → usable internal             │
│   Phase 6 (audit/role) → production-ready                   │
│                                                             │
│ NEMPEL DI MANA                                              │
│   Dashboard-UPT-Bogor route /maintenance/data-platform      │
│   Share komponen UI + BE SDK dengan route existing          │
└────────────────────────────────────────────────────────────┘
```

---

## 1. GOAL & NON-GOAL

```
┌─ GOAL ────────────────────────────────────────────────────┐
│ G1  Data fundamental (dim + fact) source-of-truth di BQ    │
│     bukan spreadsheet                                       │
│ G2  FE input + output di 1 universe (Dashboard Next.js)    │
│ G3  Schema enforced di write time (no drift detection)     │
│ G4  FK referential integrity di app-layer (dropdown only)  │
│ G5  Role-based access (Admin / Editor / Viewer)            │
│ G6  Audit log per write action                             │
│ G7  Soft delete + history (SCD Type 2) untuk critical data │
│ G8  Bulk import CSV/Excel dgn preview + schema-diff review │
│ G9  File upload (gambar/PDF/dokumen) per row, batch OK     │
│ G10 Export ke Excel/CSV/Sheets                             │
│ G11 Edit mode per dashboard page: admin bisa re-config     │
│     komponen (data source, agg, filter) tanpa code         │
│ G12 Page builder dinamis: add/remove komponen, grid layout │
└─────────────────────────────────────────────────────────────┘

┌─ NON-GOAL (scope creep lock) ──────────────────────────────┐
│ X1  BUKAN menggantikan Sheet untuk semua flow — Sheet      │
│     masih jalur bulk import sekali-sekali saja              │
│ X2  BUKAN real-time collab spreadsheet-like (seperti       │
│     Google Sheets multi-cursor) — scope kita single-writer  │
│     per row dengan optimistic lock                          │
│ X3  BUKAN OLAP engine — visualisasi pakai ECharts existing │
│ X4  BUKAN full RBAC enterprise (OAuth2 scopes, SCIM, dll)  │
│     — scope kita role statis di Firestore                   │
│ X5  BUKAN replace Cloud Console (ops monitoring separate)  │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. USER & ROLE

```
┌────────────────────────────────────────────────────────────┐
│ ROLE      SIAPA                 CAPAB                        │
│─────────  ──────────────────── ──────────────────────────── │
│ admin     Sir Selamat, Aan     CRUD semua tabel              │
│                                + schema change (ALTER table) │
│                                + role management             │
│                                + audit viewer                │
│                                                              │
│ editor    Tim operasi per       Read + CRUD row di tabel    │
│           bidang (Proteksi,     yg diassigned                │
│           Transmisi, Hargi)     NO schema change             │
│                                                              │
│ viewer    Manajemen / reviewer  Read-only dashboard          │
│                                 NO edit                      │
│                                                              │
│ guest     Public (optional)     Overview publik aja          │
└────────────────────────────────────────────────────────────┘

Mapping:
  user_email → role → allowed_tables[]
  Firestore: `user_roles/{email}`
  Schema: { email, role, tables: string[], updatedAt, updatedBy }
```

---

## 3. ARSITEKTUR 3-LAYER

```
                   Dashboard (Next.js)
   ┌───────────────────────────────────────────────┐
   │                                                 │
   │  ┌─ INPUT LAYER ─────────────────────────────┐ │
   │  │  /maintenance/data-platform                │ │
   │  │  ├─ datasets          : browse + CRUD      │ │
   │  │  ├─ tables            : browse + CRUD      │ │
   │  │  ├─ rows              : data grid edit      │ │
   │  │  ├─ bulk-import       : CSV/Excel wizard   │ │
   │  │  ├─ master-editor     : UPT/ULTG/GI/Bay    │ │
   │  │  └─ admin             : roles + audit      │ │
   │  └────────────────────────────────────────────┘ │
   │                    ↕ API                        │
   │  ┌─ BACKEND ─────────────────────────────────┐ │
   │  │  /api/data-platform/*                      │ │
   │  │  ├─ datasets/  create/list/delete          │ │
   │  │  ├─ tables/    create/list/alter/delete    │ │
   │  │  ├─ rows/      insert/update/delete/query  │ │
   │  │  ├─ bulk/      dry-run/commit              │ │
   │  │  ├─ files/     upload/list/delete          │ │
   │  │  └─ audit/     log-writer + log-viewer     │ │
   │  └────────────────────────────────────────────┘ │
   │                    ↕                             │
   │  ┌─ OUTPUT LAYER (existing dashboard pages) ─┐ │
   │  │  /gardu-induk/healthy-index                │ │
   │  │  /transmisi/petir                          │ │
   │  │  /cloud-console/*                          │ │
   │  │  + EDIT MODE per page (admin toggle)       │ │
   │  └────────────────────────────────────────────┘ │
   └───────────────────────────────────────────────┘
                        ↕
      ┌────────────────────────────────────┐
      │ STORAGE                             │
      │  BigQuery: semua tabel data         │
      │  Firestore: user_roles, audit_log, │
      │             page_configs, schema    │
      │             metadata                │
      │  Drive    : file upload             │
      └────────────────────────────────────┘
```

---

## 4. MODULE BREAKDOWN

### 4.1 Dataset CRUD

```
Route: /maintenance/data-platform/datasets

UI:
  List (table):
    ID | Location | Tables | Modified | [Actions]

  Actions per row:
    ▸ [Open] → drill ke /datasets/<id>/tables
    ▸ [Edit] → rename label (metadata, bukan rename dataset)
    ▸ [Delete] → confirm modal

  Global:
    [+ New Dataset] → wizard (ID, location, labels)

API:
  GET  /api/data-platform/datasets
  POST /api/data-platform/datasets        body: { id, location, labels }
  PATCH /api/data-platform/datasets/:id   body: { labels, description }
  DELETE /api/data-platform/datasets/:id  ?force=true untuk drop cascade

Rules:
  Admin only (schema change).
  Dataset ID validate: ^[a-zA-Z0-9_]{1,1024}$
  Drop dataset = drop semua table inside — HARD confirm 2-step.
```

### 4.2 Table CRUD + Schema

```
Route: /maintenance/data-platform/datasets/<ds>/tables

UI:
  List:
    Table Name | Type | Rows | Size | Cols | Modified | [Actions]

  Click table → drill ke /tables/<name>/rows

  [+ New Table] → wizard:
    Step 1: Nama tabel + deskripsi
    Step 2: Pilih LEVEL (single pick radio):
            ◯ UPT        (kolom upt_id auto-generated)
            ◯ ULTG       (kolom ultg_id, parent UPT auto via chain)
            ◯ Gardu Induk (kolom gi_id)
            ◯ Bay        (kolom bay_id)
            ◯ FLAT       (no FK ke Master)
    Step 3: Define kolom data (nama, tipe, required?, default?)
    Step 4: Set partitioning (optional, by date)
    Step 5: Review + Create

  Level parent chain dijelaskan di UI:
    Kalau pilih Bay → data akan bisa di-filter naik ke GI, ULTG, UPT
    Kalau pilih GI  → bisa naik ke ULTG, UPT
    Chain dibaca dari Master Data (bay.gi_id → gi.ultg_id → ultg.upt_id)
    User tidak perlu duplikasi kolom parent di tabel ini.

  Edit schema (separate page):
    ▸ [+ Kolom]          → ALTER TABLE ADD COLUMN
    ▸ [X] di kolom       → ALTER TABLE DROP COLUMN (confirm)
    ▸ Rename             → BQ ga native, pakai trick
                           (CREATE kolom baru + UPDATE + DROP lama)
    ▸ Change tipe        → similar recreate column
    ▸ Edit options (CHOICE/CASCADE/REFERENCE) → Firestore
                                                 schema_metadata update
                                                 (in-the-fly, realtime)

API:
  GET  /api/data-platform/tables?dataset=<ds>
  GET  /api/data-platform/tables?dataset=<ds>&table=<n>   (detail)
  POST /api/data-platform/tables  body: { dataset, id, level, columns[], partitioning? }
  PATCH /api/data-platform/tables/:id  body: { addColumns?, dropColumns?, renameColumns? }
  DELETE /api/data-platform/tables/:id

Column type list (extended dari BQ native):
  BQ-native:
    STRING | INT64 | FLOAT64 | NUMERIC | BOOL | DATE | TIMESTAMP
    GEOGRAPHY | JSON | BYTES

  App-level (stored di BQ STRING, metadata di Firestore):
    CHOICE           → dropdown enum (options[])
    CHOICE_CASCADE   → dropdown depending on parent column value
    REFERENCE        → dropdown from another table (table + display_col + value_col + filter?)
    FILE             → Drive fileId (atau array fileIds)
    RICH_TEXT        → markdown string
    URL              → validated URL string

Column definition shape:
  {
    name: string,
    type: '<bq-native-or-app-level>',
    mode: 'REQUIRED' | 'NULLABLE' | 'REPEATED',
    description?: string,
    default?: any,
    // per type extra:
    options?: Array<{ value, label, color }>,       // CHOICE
    parent_column?: string,                          // CHOICE_CASCADE
    options_map?: Record<string, string[]>,          // CHOICE_CASCADE
    reference?: { dataset, table, display_col, value_col, filter? },  // REFERENCE
  }

Rules:
  Admin only untuk create/alter/delete.
  Editor bisa pakai tabel (CRUD row) kalau assigned.
  Edit options (CHOICE list, dll) → editor juga boleh (Firestore, ga touch schema BQ)
```

### 4.3 Row CRUD — Data Grid

```
Route: /maintenance/data-platform/datasets/<ds>/tables/<n>/rows

UI:
  Data grid (react-data-grid):
    ▸ Virtual scroll (handle >100k row)
    ▸ Inline edit: dblclick → type → Tab/Enter save
    ▸ Copy-paste multi-cell (Ctrl+C / Ctrl+V)
    ▸ Keyboard nav (arrow, Tab, Shift+Tab, Enter)
    ▸ Column resize, sort, filter (in-memory + server-side)
    ▸ Frozen column opsi (left: PK, right: action)
    ▸ Row select via checkbox
    ▸ Undo/Redo (Ctrl+Z) — client-side history
    ▸ Auto-save per cell ATAU batch save "Save Changes" tombol
      (user preference, default auto-save)

  Toolbar:
    [+ Row]                 → append + edit mode
    [Bulk Edit] (n selected) → modal: pick column + value
    [Delete] (n selected)   → soft delete (is_active=false)
    [Export]                → .xlsx / .csv / Sheets
    [Bulk Import]           → wizard diff-review
    [Filter]                → sidebar advanced filter

  Cell editor per tipe:
    STRING      : text input
    INT/FLOAT   : number input
    DATE        : date picker
    TIMESTAMP   : datetime picker
    BOOL        : toggle
    CHOICE      : dropdown enum + colored badge
    CHOICE_CASCADE : dropdown, auto-filter by parent column value
    REFERENCE   : async-dropdown dari tabel target (search, optional
                  filter by row context)
    FILE        : upload widget + preview thumbnail (Drive)
    RICH_TEXT   : markdown editor modal
    URL         : text input + validate + preview

  Context awareness saat edit row level Bay:
    Setelah user pilih bay_id, FE tampilkan breadcrumb:
      "GI Tambun → ULTG Bogor → UPT Jabodetabek"
    Supaya user verify konteks tanpa buka tabel lain.

  Add option in-the-fly (CHOICE / CHOICE_CASCADE / REFERENCE):
    Di dropdown paling bawah [+ Tambah Opsi] (kalau user admin/editor)
    Modal kecil popup: label + color (atau create row baru di
    tabel reference untuk REFERENCE type)
    Save → dropdown refresh realtime via Firestore onSnapshot
    User lanjut input tanpa keluar dari row yg sedang diedit

API:
  GET    /api/data-platform/rows?dataset=<ds>&table=<n>&page=1&limit=100&filter=...&sort=...
  POST   /api/data-platform/rows                body: { dataset, table, row }
  PATCH  /api/data-platform/rows                body: { dataset, table, _row_id, _updated_at, changes }
  DELETE /api/data-platform/rows?softDelete=1   body: { dataset, table, _row_ids[] }

Backend strategy:
  BQ: streaming insert untuk INSERT
  BQ: DML UPDATE/DELETE untuk edit (bayar per byte scan)
  Optimization: kalau row_count >1M → suggest batch edit via bulk import

Optimistic lock:
  Setiap row punya kolom `_updated_at` (timestamp).
  Saat PATCH, user kirim `_updated_at` original.
  Server check: kalau DB _updated_at != original → reject 409.
  Client: prompt "Data diubah orang lain, refresh dulu".
```

### 4.4 Bulk Import — Schema-aware with Diff Review

```
Route: /maintenance/data-platform/datasets/<ds>/tables/<n>/bulk-import

UI 5-step wizard:

Step 1 — Upload file
  Drag-drop .csv / .xlsx / .xls atau paste Sheet URL
  Backend parse → detect encoding, delimiter, sheet tab (Excel)

Step 2 — Match header
  Bandingkan file header vs BQ schema

  ┌────────────────────────────────────────────┐
  │ Match 8 kolom:                              │
  │   file "nama"         → BQ "nama"  ✓         │
  │   file "gi"           → BQ "gi_name" ✓ (rename suggest) │
  │   file "ULTG"         → BQ "ultg_name" ✓              │
  │   ...                                        │
  │                                              │
  │ 2 kolom file BARU (belum ada di BQ):        │
  │   "catatan"    [+ Add to table] [Skip]      │
  │   "tag"        [+ Add to table] [Skip]      │
  │                                              │
  │ 1 kolom BQ hilang di file:                   │
  │   "deprecated_field" [Skip row kalau kosong] │
  │                                              │
  │ [Back] [Next: Validate]                      │
  └────────────────────────────────────────────┘

Step 3 — Validate row-level
  Loop semua row. Cek:
    ▸ Required fields terisi?
    ▸ Tipe data cocok? (INT kolom tdk string)
    ▸ FK value valid? (exists di tabel target?)
    ▸ Unique constraint? (kalau ada)

  Report:
    Row 1-500  ✓ valid
    Row 501    ✗ FK: GI "TAMBOEN" tidak ditemukan (typo?)
    Row 502    ✗ tgl_pemeliharaan: format salah "31/02/2026"
    ...

  User action per error:
    ▸ [Fix inline]  → edit cell di preview grid
    ▸ [Skip row]    → ga insert, catat di log
    ▸ [Download errors] → export CSV error untuk fix offline

Step 4 — Review + Commit
  Summary:
    "X row baru akan di-insert"
    "Y row existing akan di-UPDATE (match by PK)"
    "Z row skip (error)"
    "W kolom ditambahkan ke tabel"

  [Back] [Commit]

Step 5 — Result
  Success: "X row inserted, Y updated, 0 errors"
  Partial: detail per-row report + link audit log

Backend:
  ▸ Upload file → parse server-side
  ▸ Staging BQ table (temp)
  ▸ Diff SQL (vs target table)
  ▸ MERGE statement dengan ON PK
  ▸ Drop staging
  ▸ Write audit log entry

Rules: Admin/Editor dengan permission table.
```

### 4.5 File Upload (Drive)

```
Pattern:
  User di form / grid klik [Upload]
    ↓ FE request signed upload URL dari BE
  BE call Drive API files.create (metadata only, resumable)
    ↓ return upload URL + fileId
  FE upload byte langsung ke Drive resumable endpoint
    ↓ progress bar via fetch stream
  Setelah selesai, FE POST /api/data-platform/rows
    body: { kolom: fileId }  atau { kolom: [fileId1, fileId2] untuk array }
  BE INSERT/UPDATE row + audit log

Display di grid:
  Kolom tipe FILE → render thumbnail:
    Image: <img src=drive-thumbnail-url />
    PDF/Doc: ikon + nama file + download button
  Click thumbnail → open di Drive view

Storage:
  Bucket struktur di Drive (folder shared):
    /DataPlatform/
      /<dataset>/
        /<table>/
          /<row_id>/
            <file>.ext

  Naming: <row_id>_<colname>_<timestamp>.<ext>
  Metadata: { dataset, table, row_id, column, uploaded_by, uploaded_at }
  Permission: SA punya edit, user login punya view (via IAM/ACL)

Bulk upload:
  Multi-file select, drag multiple files.
  Parallel upload 3 at a time, progress UI.
  Auto-assign ke row yang lagi di-edit atau ke kolom bulk-edit mode.
```

### 4.6 Export

```
API: GET /api/data-platform/export?dataset=<ds>&table=<n>&format=<xlsx|csv|sheets>

xlsx: stream via exceljs (dep akan ditambahkan)
csv : stream via BQ EXPORT DATA AS CSV → GCS → signed URL
sheets: create new Sheet, append data, return shareable link

Scope trigger: tombol [Export] di grid, pilih format.
Future: scheduled export (cron → email/WA).
```

### 4.7 Master Data Editor (Fondasi)

```
Route: /maintenance/data-platform/master

Dataset: Master_Data
Tables : UPT, ULTG, Gardu_Induk, Bay (4 tab di UI)

Per-tab UI:
  Tree view (hirarki) + detail panel kanan
  Contoh untuk Bay:
    GI Tambun ▸ Bay 150kV A  [edit | archive]
                Bay 150kV B
                Bay 275kV C

  Add: [+ Bay] → modal: parent GI (dropdown), nama, voltage, type
  Edit: inline atau detail panel
  Archive: soft delete (is_active=false), keep row + history

Schema BQ (UUID-based, stable):
  Master_Data.UPT
    upt_id         STRING (UUID v4)   PK
    upt_name       STRING NOT NULL
    address        STRING
    is_active      BOOL DEFAULT TRUE
    valid_from     TIMESTAMP
    valid_to       TIMESTAMP
    created_by     STRING
    created_at     TIMESTAMP
    updated_by     STRING
    updated_at     TIMESTAMP

  Master_Data.ULTG:
    ultg_id        STRING (UUID)   PK
    upt_id         STRING (FK app-level → UPT.upt_id)
    ultg_name      STRING
    ... (sama pattern)

  Master_Data.Gardu_Induk:
    gi_id          STRING (UUID)   PK
    ultg_id        STRING (FK → ULTG.ultg_id)
    gi_name        STRING
    voltage_kv     INT64
    latitude       FLOAT64
    longitude      FLOAT64
    ...

  Master_Data.Bay:
    bay_id         STRING (UUID)   PK
    gi_id          STRING (FK → Gardu_Induk.gi_id)
    bay_name       STRING
    bay_type       STRING   ('PENGHANTAR'/'TRAFO'/'BUSBAR'/dll)
    voltage_kv     INT64
    ...

Keuntungan design ini:
  ▸ ID = UUID persisted (stable, bukan hash string)
  ▸ Rename nama → ID tetap, semua FK tetap valid di semua Data Table
  ▸ Parent chain query: Bay.gi_id → GI.ultg_id → ULTG.upt_id → UPT
    Dashboard bisa filter drill-down otomatis.
  ▸ SCD Type 2 via valid_from/to + is_active
  ▸ Rollback per row gampang via history
```

### 4.8 Page Builder + Edit Mode Komponen

```
Existing: /maintenance/page-builder dengan react-grid-layout
Tambah: mode EDIT per page dashboard existing

UI:
  Header page: toggle [View / Edit] (admin-only)
  Edit mode aktif → setiap komponen dikelilingi border + ikon pensil

  Klik pensil → panel kanan muncul:
    Komponen type : Donut / Bar / Line / Card / Table / Map / ...
    Data source  : dropdown tabel BQ
    Dimension    : dropdown kolom (x-axis, group by)
    Measure      : dropdown kolom + aggregation (SUM/COUNT/AVG/MAX)
    Filter       : visual builder (column = value AND/OR ...)
    Style        : color palette, label, legend position
    [Save] → simpan config ke Firestore dashboard_pages_v5

  Drag-drop layout (react-grid-layout, sudah ada)
  Add komponen: [+ Komponen] floating button
  Delete komponen: [X] di ikon pensil

API:
  GET  /api/data-platform/page-configs/:path
  PUT  /api/data-platform/page-configs/:path    body: { layout, components }

Firestore schema:
  dashboard_pages_v5/{pagePath}:
    layout: [...]        // react-grid-layout
    components: [{
      id, type, title,
      dataSource: { dataset, table },
      dimension: string,
      measure: { column, agg },
      filter: [...],
      style: {...}
    }]
    updatedBy, updatedAt
```

### 4.9 Audit Log

```
Tabel BQ: platform_internal.audit_log
  event_id       STRING (UUID)
  event_ts       TIMESTAMP
  user_email     STRING
  action         STRING ('CREATE_ROW'/'UPDATE_ROW'/'DELETE_ROW'/
                          'ADD_COLUMN'/'DROP_COLUMN'/'CREATE_TABLE'/
                          'DELETE_TABLE'/'ROLE_CHANGE'/dll)
  target_dataset STRING
  target_table   STRING
  target_row_id  STRING (optional)
  target_column  STRING (optional)
  before         JSON (state sebelum — nullable untuk CREATE)
  after          JSON (state sesudah — nullable untuk DELETE)
  ip             STRING
  user_agent     STRING

Writer: BE wrapper di setiap mutation endpoint.
Viewer: /admin/audit → filter + timeline viz.
Retention: kekal (partitioned by event_ts DATE).
```

### 4.10 Role & Permission

```
Firestore: user_roles/{email}
  email         STRING
  role          'admin' | 'editor' | 'viewer' | 'guest'
  tables        STRING[]   // hanya untuk editor, daftar tabel yg boleh di-edit
  assignedBy    STRING
  assignedAt    TIMESTAMP
  updatedAt     TIMESTAMP

Admin UI: /admin/roles
  Table: email | role | allowed tables | actions
  [+ Add user] → email + role + pick tables

Middleware:
  Setiap API data-platform/* cek header Authorization
  Decode user email (via IAP atau Firebase Auth)
  Cek user_roles/{email}
  Reject kalau role tidak match required capability
```

---

## 4.11 Concurrent Edit Strategy (Page Lock)

```
Tujuan: 1 halaman hanya bisa diedit oleh 1 admin/editor pada 1 waktu.
        Sisanya otomatis read-only + tampilkan siapa yg lagi edit.

Storage:
  Firestore: page_locks/{resource_key}
    resource_key   = "table:<dataset>__<table>" atau
                      "page:<pagePath>" atau
                      "master:<upt|ultg|gi|bay>"
    owner_email    STRING
    owner_name     STRING
    acquired_at    TIMESTAMP
    last_heartbeat TIMESTAMP
    ttl_seconds    INT (default 600 = 10 menit)

FE behavior:
  User buka halaman data-input/edit:
    ↓ FE call POST /api/lock/acquire { resource }
    ↓ BE cek existing lock:
       - No existing lock → ACQUIRE, mode EDIT
       - Expired lock (now - last_heartbeat > ttl) → TAKEOVER + audit
       - Active lock (heartbeat < ttl) → REJECT, return owner info
    ↓ Kalau acquired: FE start heartbeat tiap 30 detik
      (PATCH /api/lock/heartbeat)
    ↓ Kalau rejected: FE mode READ-ONLY + banner
      "🔒 Budi (budi@pln.co.id) sedang edit sejak 14:32"
    ↓ Saat user tutup tab / unmount component:
      FE call DELETE /api/lock/release (best effort)

Tombol [Claim Edit]:
  Muncul di mode READ-ONLY kalau:
    - Lock expire (TTL habis)
    - Owner explicit release
  Klik → FE try acquire lagi.

API:
  POST   /api/lock/acquire     body: { resource, user }
  PATCH  /api/lock/heartbeat   body: { resource, user }
  DELETE /api/lock/release     body: { resource, user }
  GET    /api/lock/status      query: resource

Realtime:
  FE subscribe via Firestore onSnapshot ke page_locks/{resource_key}
  Saat lock release / take-over → admin lain auto-notifikasi
  Tidak perlu poll.

Admin override:
  Role 'admin' bisa force-claim lock yg owned by user lain
  Modal konfirm: "User X lagi edit. Force claim akan kick dia keluar."
  Audit log: action=LOCK_FORCE_CLAIM
```

---

## 4.12 UX Principles untuk Data Input

```
[1] FORMS SMART, BUKAN DUMB
    ▸ Auto-focus field pertama saat buka
    ▸ Tab navigation lancar (Enter = next, Shift+Tab = back)
    ▸ Auto-complete dari history input user
    ▸ Dropdown FK dengan search + lazy load (>1000 opsi)
    ▸ Smart default (kolom tanggal = hari ini, kolom user =
      logged-in admin)

[2] VISUAL PARENT CONTEXT
    Saat input data di tabel level Bay:
      User pilih Bay "Bay A"
      FE tampilkan breadcrumb:
        "→ GI Tambun → ULTG Bogor → UPT Jabodetabek"
    User tahu konteks tanpa pindah tabel.

[3] INLINE EDIT GRID DENGAN EXCEL-LIKE SHORTCUT
    ▸ Ctrl+C / Ctrl+V multi-cell
    ▸ Ctrl+Z undo (5 step history)
    ▸ Arrow nav + Enter commit + Esc cancel
    ▸ Drag corner → fill down
    ▸ Paste dari Excel → auto-detect row/kolom boundary

[4] SAVE STATE CLEAR — USER NEVER BINGUNG
    ▸ Indicator "Draft tersimpan otomatis" di corner
    ▸ Unsaved changes → warning saat klik keluar
    ▸ Status per-row: 🟢 Synced / 🟡 Pending / 🔴 Error

[5] KEYBOARD-FIRST
    Power user bisa input 100 row tanpa lepas keyboard.
    Mouse cuma untuk setup awal.

[6] MODE SWITCH FLEXIBLE
    Toggle: [Grid mode] / [Form mode]
    Grid  : edit cepat banyak row
    Form  : input detail 1 row dengan validasi lengkap

[7] ERROR STATE HELPFUL
    Bukan "Error: validation failed"
    Tapi: "Kolom 'voltage_kv' harus angka. Anda ketik 'abc'.
    Coba ketik angka misalnya 150"

[8] PREVIEW SEBELUM COMMIT
    Bulk action (delete, update batch): tampilkan sample
    3 row yg kena, minta konfirm jumlah "12 row akan diubah"

[9] ADD OPTION IN-THE-FLY
    Dropdown CHOICE/CASCADE/REFERENCE punya tombol [+ Tambah Opsi]
    User ga perlu keluar row yg lagi diedit.
    Realtime propagate ke semua admin yg tabel sama terbuka.

[10] PAGE LOCK BANNER
    Ga silent. Kalau read-only karena lock → banner top:
      "🔒 Budi sedang edit — Anda bisa lihat tapi tidak edit.
       Bisa klik [Claim Edit] kalau lock expire."
```

---

## 5. SCHEMA BQ — DATASET LAYOUT

```
Master_Data/                    ← Master reference tables
  UPT
  ULTG
  Gardu_Induk
  Bay

platform_internal/                    ← internal platform metadata
  audit_log                     ← full audit trail (BQ partitioned)
  file_metadata                 ← file upload registry (Drive pointer)
  (platform_internal V1 legacy dim_*/sync_history keep read-only sampai
   migrasi selesai, lalu archive/drop)

<user-datasets>/                ← dataset operasional (user-created)
  Jadwal_Padam, Asset_Relay, dst
  Tabel di dalamnya di-CRUD via FE Data Platform

Firestore/
  user_roles/{email}              ← RBAC
  page_locks/{resource}           ← concurrent edit lock
  dashboard_pages/{path}          ← page layout + component config
                                    (new, untuk Data Platform pages)
  schema_metadata/{ds}__{tbl}     ← column CHOICE options, CASCADE
                                    map, REFERENCE config, UI hints
  dashboard_pages_v5/{path}       ← existing page config (kept)
```

---

## 6. TECH STACK

```
Frontend (udah ada di Dashboard):
  Next.js 16 App Router
  React 19
  react-data-grid 7 (inline edit grid)
  react-hook-form + zod (form + validation)
  @dnd-kit (drag-drop)
  react-grid-layout (page builder)
  @xyflow/react (canvas page config, existing)
  ECharts (viz)
  shadcn/ui + tailwind v4 (komponen)
  lucide-react (icon)

Backend:
  Next.js API routes (serverless)
  @google-cloud/bigquery (BQ SDK)
  @google-cloud/firestore
  googleapis (Drive API)
  exceljs (export xlsx) ← NEW dep
  papaparse (CSV parse) ← NEW dep
  uuid (v4 gen)

Auth:
  Firebase Auth (existing) ATAU IAP (future Phase)
  Middleware: cek email → Firestore user_roles

Deployment:
  Cloud Run (Dashboard) — existing
```

---

## 7. MIGRASI DARI SISTEM EXISTING

```
┌─ KEEP (jalan terus) ───────────────────────────────────────┐
│ ▸ Dashboard viz pages (/gardu-induk/*, /transmisi/*, dll)  │
│ ▸ Cloud Console (/cloud-console/*) — ops monitoring        │
│ ▸ BQ dataset user existing (data ga disentuh)              │
│ ▸ Sync engine V1 CF ss-sync (biarin jalan sementara buat   │
│   dashboard lama baca data V1 yg masih ada)                │
└─────────────────────────────────────────────────────────────┘

┌─ BUILD FRESH ──────────────────────────────────────────────┐
│ ▸ /maintenance/data-platform/* (semua route baru)          │
│ ▸ /api/data-platform/* (semua API baru)                    │
│ ▸ platform_internal.dim_*_v2 (UUID-based master)                 │
│ ▸ platform_internal.audit_log                                    │
│ ▸ Firestore user_roles, schema_metadata                    │
└─────────────────────────────────────────────────────────────┘

┌─ DEPRECATE (bertahap) ─────────────────────────────────────┐
│ ▸ /maintenance/data-connector-v5 → merge ke data-platform  │
│ ▸ /maintenance/master-data → merge ke data-platform        │
│ ▸ /maintenance/master-hierarchy-wizard → merge ke master   │
│   editor baru                                              │
│ ▸ Sync engine Sheet → BQ (CF ss-sync V1 + V2) —           │
│   PAUSE setelah data migrasi, archive                      │
│ ▸ data_sources, data_sources_v2 collection Firestore —    │
│   deprecate setelah migrasi                                │
└─────────────────────────────────────────────────────────────┘

┌─ MIGRATE DATA ─────────────────────────────────────────────┐
│ [1] dim_* V1 → dim_*_v2 dengan UUID baru                   │
│     Script one-off: baca dim_upt/ultg/gi/bay existing,     │
│     generate UUID per row, INSERT ke V2 tables             │
│     Mapping old_id → new_id disimpan sementara             │
│                                                             │
│ [2] Fact tables (n_*) tidak migrate data                   │
│     Data aset operasional dibiarkan di BQ dataset          │
│     existing. FK column pointed ke dim_*_v2 lewat app      │
│     logic (JOIN by name awalnya, lalu di-backfill UUID     │
│     gradually saat user edit via FE baru).                 │
│                                                             │
│ [3] Dashboard viz pages pelan-pelan di-repoint:            │
│     ▸ Bulan pertama: 1-2 page pilot dengan data Platform   │
│     ▸ Bulan kedua: migrate sisanya                          │
│     ▸ Bulan ketiga: shutdown sync engine                    │
└─────────────────────────────────────────────────────────────┘
```

---

## 8. PHASE & MILESTONES

```
Phase 0 — Design alignment (Sir review, 1 hari)
  ▸ Dokumen ini direview
  ▸ Konfirmasi scope, finalize role model, konfirmasi BQ
    dataset structure
  ▸ Output: doc approved ✓

Phase 1 — Foundation (3-4 hari)
  ▸ Route /maintenance/data-platform + sidebar nav
  ▸ API /datasets + /tables list (read-only)
  ▸ FE: browse datasets → tables → table detail + schema view
  ▸ Page responsive, dark mode, style konsisten ds-*
  ▸ Output: bisa browse all BQ content ✓

Phase 2 — Master Data Editor (4-5 hari)
  ▸ Schema dim_*_v2 (UUID)
  ▸ Migration script V1 → V2
  ▸ FE: UPT/ULTG/GI/Bay CRUD form + tree view
  ▸ API: /master/upt, /master/ultg, /master/gi, /master/bay
  ▸ Audit log per action
  ▸ Output: admin bisa CRUD master 100% tanpa Sheet ✓

Phase 3 — Table Builder + Row CRUD (5-6 hari)
  ▸ FE: wizard create table + schema editor
  ▸ FE: data grid (react-data-grid) untuk row CRUD
  ▸ Inline edit, copy-paste, bulk edit modal, soft delete
  ▸ API: /tables, /rows (insert/update/delete/query)
  ▸ Optimistic lock via _updated_at
  ▸ Output: admin bisa bikin tabel + isi data full ✓

Phase 4 — Bulk Import + File Upload (3-4 hari)
  ▸ Wizard 5-step bulk import (upload, diff, validate, review, commit)
  ▸ exceljs + papaparse untuk parse
  ▸ Drive API integration untuk file upload
  ▸ Cell editor tipe FILE (thumbnail + upload widget)
  ▸ Output: bulk workflow jalan ✓

Phase 5 — Role, Audit, Export (2-3 hari)
  ▸ Firestore user_roles + middleware
  ▸ Admin UI /admin/roles + /admin/audit
  ▸ Export endpoint xlsx/csv/sheets
  ▸ Output: production-ready, aman ✓

Phase 6 — Page Builder Edit Mode (3-4 hari)
  ▸ Per-page toggle View/Edit (admin only)
  ▸ Component config panel (data source, agg, filter, style)
  ▸ Save ke dashboard_pages_v5
  ▸ Output: self-service BI akrif ✓

TOTAL: 21-26 hari kerja = ~4-5 minggu full-time

Bisa paralel Phase 3 + Phase 4 setelah 2 selesai.
```

---

## 9. OPEN QUESTIONS

```
OQ-1  Auth pakai Firebase Auth atau IAP?
      Firebase: sudah setup, tapi perlu login page
      IAP    : Google Cloud native, lebih aman (HTTPS-level),
               tapi setup lebih lama + cost
      PENDING putus.

OQ-2  FK app-level vs BQ constraint?
      BQ ga support FK constraint native
      App-level via dropdown + server validation — works tapi
        tidak prevent raw SQL bypass
      PENDING: accept risk atau tambah rules di layer lain?

OQ-3  Soft delete vs hard delete default?
      Rekomendasi saya: default SOFT (is_active=false)
      Hard delete cuma untuk admin via special button "Purge"
      PENDING konfirm.

OQ-4  Multi-user concurrent edit — strategy?
      Optimistic lock (_updated_at) — sudah dijelaskan
      Alternatif: pessimistic lock (row-level) pakai Firestore
                   flag, lebih kompleks
      PENDING: apakah optimistic cukup?

OQ-5  File storage: Drive atau GCS?
      Drive: ekosistem Google, user bisa langsung view
      GCS  : lebih cepat untuk volume besar, lebih murah
      PENDING konfirm. User sudah prefer Drive.

OQ-6  Migrasi n_* data existing — copy atau reference?
      Option A: copy ke BQ dataset baru, data terpisah
      Option B: tetap di dataset existing, di-wrap dengan
                 schema_metadata di Firestore
      Rekomendasi: Option B, avoid data duplication.
      PENDING konfirm.

OQ-7  Rollback strategy untuk schema change?
      Option: simpan snapshot schema di Firestore sebelum ALTER
      Rollback via admin UI: pilih version → restore
      PENDING: butuh atau skip Phase 5?
```

---

## 10. PRINSIP UI/UX

```
[1] INPUT SIMPLE DULU, ADVANCED DI BALIK 1 KLIK
    Default form: field-field basic saja
    Advanced: tombol "Tampilkan detail" buka field tambahan

[2] VALIDASI REAL-TIME DI FORM
    Field merah saat invalid sambil user ketik
    Error message jelas di bawah field
    [Save] disabled sampai semua valid

[3] DESTRUCTIVE ACTION WAJIB KONFIRM 2-STEP
    Delete dataset / drop table / purge row:
      Modal: "Ketik nama dataset untuk konfirm"

[4] FEEDBACK PER ACTION
    Toast notifikasi setelah save/edit/delete
    Spinner saat loading
    Error state jelas + action "Retry"

[5] KEYBOARD SHORTCUT (power users)
    Ctrl+S save, Ctrl+Z undo, Ctrl+C/V copy-paste cell,
    Esc cancel, Enter confirm

[6] CONSISTENT SAMA DASHBOARD EXISTING
    Pakai ds-* class + chart-tokens.ts
    Dark mode default, Aniq palette
    shadcn/ui components, lucide icons

[7] RESPONSIVE (minimal tablet-friendly)
    Desktop utama, tablet usable, mobile read-only

[8] EMPTY STATE DIDESAIN
    "Belum ada data" dengan CTA jelas [+ Tambah]
    Ga kosong melompong
```

---

## 11. METRIK SUKSES

```
Technical:
  ✓ Zero sync engine maintenance (drift detection irrelevant)
  ✓ Schema change in-app, no deployment required
  ✓ Response time <500ms untuk list, <2s untuk grid 10k rows
  ✓ Bulk import 10k rows <60s
  ✓ Audit log 100% coverage per write

Business:
  ✓ Tim ops nambah row via FE >80% dari total input (target)
  ✓ Dashboard viz page data freshness <5 menit dari edit
  ✓ Zero "data salah di-JOIN" incident per bulan
  ✓ Onboarding user baru <30 menit (vs Sheet training 2 jam)
```

---

## 12. CATATAN

```
▸ Ini doc LIVING, iterative update per feedback Sir
▸ Rev tiap Phase selesai
▸ Review meeting per 2 hari selama build
▸ Naming consistency: "Data Platform" untuk label UI,
  "data-platform" untuk code/route/API
▸ Audit log bukan backlog item — implement dari Phase 2,
  semua mutation wajib audit
▸ Test strategi: Phase 1-3 unit test, Phase 4-6 tambah E2E
  Playwright
```

---

## 13. FORECAST 12 BULAN (growth plan)

```
BULAN 1-2 (sekarang):
  Master Data + 5-10 table operasional
  Tim 2-3 admin, 10 editor

BULAN 3-6:
  20-30 tabel. Tim nambah. Kebutuhan baru muncul:
  → Saved views (admin save filter + sort sbg view)
  → Custom formulas (computed column)
  → Cross-table JOIN queries via UI
  → Alert rules (notif WA/email saat row match kondisi)

BULAN 6-12:
  Platform stabil. Kebutuhan scale:
  → API external (partner ULTG request access data)
  → Scheduled reports (PDF/Excel otomatis WA/email)
  → Data lineage (row X berasal dari import file Y)
  → Anomaly detection (ML on top of data)
  → Mobile app (tim lapangan input via HP)

Arsitektur yg diusulkan SKALA dengan ini:
  ▸ Schema-driven form generator → tabel baru = tanpa kode tambahan
  ▸ Audit log lengkap → lineage native
  ▸ BQ sbg storage → ML ready + external API friendly
  ▸ RBAC role + table permission → multi-tenant ready (future)
  ▸ File upload Drive → public share URL gampang

Runway: 2-3 tahun tanpa re-architect.

Asisten Reporter (Level 2 platform) akan banyak konsumsi data
cross-reference dari sini. Contoh:
  ▸ Jadwal padam vs target item pekerjaan — cross-JOIN lewat
    gi_id chain
  ▸ Progress program kerja vs realisasi — cross-JOIN lewat
    bidang + periode
  ▸ Alert "item telat" — query rules-based dari Data Platform
Desain FK stable (UUID) kritikal untuk pattern ini jalan mulus.
```

---

## 14. CATATAN

```
▸ Doc LIVING, iterative update per feedback Sir
▸ Rev tiap Phase selesai
▸ Review meeting per 2 hari selama build
▸ Naming consistency: "Data Input Dashboard" untuk label UI,
  "data-platform" untuk code/route/API
▸ Audit log bukan backlog item — implement dari Phase 2,
  semua mutation wajib audit
▸ Test strategi: Phase 1-3 unit test, Phase 4-6 tambah E2E
  Playwright
▸ Auth (Phase 5 → Phase 7): defer ke akhir, selama develop
  semua user dianggap admin. Implement sebelum deploy prod.
▸ Istilah "SS" / "Spreadsheet Sync" JANGAN disebut di Data
  Platform — context beda. SS legacy tool freeze, archive.
▸ BQ dataset "ss_platform" rename ke "platform_internal"
  untuk menghindari confusion dengan SS legacy.
```

---

**End of document. Version 0.2 draft. 2026-04-24.**
