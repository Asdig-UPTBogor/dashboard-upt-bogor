# Data Input Dashboard — Audit v0.3
> Per 2026-04-24 akhir sesi. Status SIAP untuk testing, beberapa fitur backlog.

## 🔧 Bug fixed this iteration (2026-04-24 malam)

- **PATCH row save returns updatedRows: 0 padahal OK** — sebelumnya dmlStats
  dibaca sebelum BQ job selesai. Fix: `await job.getQueryResults()` sebelum
  read metadata. Verified via curl: `updatedRows: 1`, address persisted di BQ.
- **Row highlight hilang saat click kolom lain di row sama** — fix click logic
  jadi "always select that row" (tidak toggle). Deselect via Escape key.
- **Konfig Kolom UX jelek (slide-in drawer accordion)** — rebuild jadi
  **ColumnHeaderMenu** per-column dropdown di header (chevron) — pattern
  Google Sheets / Airtable. Click chevron → menu: Rename alias, Ubah tipe,
  Edit CHOICE options, Link ke Master, Hide/Show, Pin L/R, Delete. Atomic.

## ⚠️ Limitation — research jujur

**react-data-grid v7 beta TIDAK support native range selection drag** (drag
across multiple cells to highlight range). Fitur available:
- Single cell click + arrow nav ✓
- Fill handle drag corner (onFill) ✓
- Row selection via selectedRows ✓
- Copy/paste single cell ✓
- Column resize ✓

Range selection drag = butuh custom implementation (mouseDown→mouseMove→
mouseUp overlay tracking selected range) ATAU migrate ke ag-grid (commercial
license). Decision: defer — fitur ini tidak kritis untuk workflow input data
saat ini.

## ✅ DONE — sesuai design doc + iterasi session

### Pattern Universal BQ Browser + Editor (Mental Model)
- [x] Dataset ≡ spreadsheet, Table ≡ sheet tab (§0 v0.3)
- [x] Auto-discover BQ datasets (no registry seed) — `bq.getDatasets()`
- [x] Auto-discover BQ tables per dataset
- [x] Firestore overlay 3-collection separation: `data_platform_dataset/table/columns`
- [x] Zero hardcode per table — FK registry dynamic scan Master_Data

### Route + Struktur
- [x] `/data-input` — landing, list dataset grouped by origin
- [x] `/data-input/[ds]` — dataset detail + list tables
- [x] `/data-input/[ds]/[t]` — workspace grid per table
- [x] `/data-input/new/dataset` — wizard tambah dataset (BQ mk + label `origin=user`)
- [x] `/data-input/new/table` — wizard 4-step tambah table + "Link ke Master" picker

### API
- [x] `GET /api/data-input/datasets` list
- [x] `POST /api/data-input/datasets` create BQ + label
- [x] `GET /api/data-input/datasets/[ds]` detail + tables
- [x] `DELETE /api/data-input/datasets/[ds]` drop
- [x] `POST /api/data-input/datasets/[ds]/tables` create table
- [x] `GET /api/data-input/datasets/[ds]/tables/[t]` schema + overlay
- [x] `DELETE /api/data-input/datasets/[ds]/tables/[t]` drop
- [x] `GET /api/data-input/datasets/[ds]/tables/[t]/rows` list (LIMIT + is_active filter)
- [x] `POST /api/data-input/datasets/[ds]/tables/[t]/rows` insert
- [x] `PATCH /api/data-input/datasets/[ds]/tables/[t]/rows` update (optimistic lock)
- [x] `DELETE /api/data-input/datasets/[ds]/tables/[t]/rows` soft/hard delete
- [x] `PATCH /api/data-input/datasets/[ds]/tables/[t]/schema` update overlay
- [x] `POST /api/data-input/datasets/[ds]/tables/[t]/columns` ALTER TABLE ADD COLUMN

### Master Data (FK chain)
- [x] BQ tables `Master_Data.{UPT,ULTG,Gardu_Induk,Bay}` with UUID PK + audit
- [x] FK chain: Bay.gi_id → GI.ultg_id → ULTG.upt_id → UPT
- [x] Auto-detect REFERENCE via naming convention + FK registry scan
- [x] Direct parent FK resolve ke display name di grid (gi_id → "GI 150KV BOGOR BARU")

### Workspace (MasterGrid) — God-Mode react-data-grid
- [x] Inline edit (dblclick → type → Tab/Enter save)
- [x] Keyboard nav (arrow, Tab, Shift+Tab, Enter, Esc) — built-in RDG
- [x] Copy cell (Ctrl+C) via `onCellCopy`
- [x] Paste cell (Ctrl+V) via `onCellPaste` — parse INT/FLOAT/BOOL dari text
- [x] Fill handle drag (`onFill`)
- [x] Undo/Redo (Ctrl+Z / Ctrl+Y) — client-side history stack 10 steps
- [x] Column resize (native RDG)
- [x] Column sort (click header)
- [x] Filter per kolom — Google Sheets style (checkbox + search + Select/Clear All)
- [x] Row click = toggle highlight (click sama lagi = deselect)
- [x] Multi-select via Ctrl/Cmd+click
- [x] Row highlight strong via CSS override (di-row-selected class + !important)
- [x] Bulk archive (≥2 selected)
- [x] **Staging row di bottom** — Quick Add inline, tanpa tombol
- [x] **"+" column virtual di rightmost** — Add Column inline, tanpa tombol
- [x] Konfig Kolom slide-in drawer (alias, CHOICE options, REFERENCE picker)
- [x] Default alias Indonesia-friendly (gi_id → "Gardu Induk", dll)
- [x] Audit columns hidden default

### Sidebar Dinamis
- [x] 1 entry "Data Input Dashboard" expandable
- [x] Add Dataset + Add Table + Overview links
- [x] Auto-load list dataset dari API
- [x] Nested dataset → tables (on-demand expand fetch)
- [x] Origin badge U/P/L (user/platform/legacy)
- [x] Sort: User → Platform → Legacy (alfabetis per grup)

### Dataset Origin Detection
- [x] BQ label `origin=user` saat created via wizard
- [x] Known platform list (thor_vaisala, dispatch, wagate, Master_*_UPT_Bogor, dll)
- [x] Fallback "legacy" untuk existing tanpa label
- [x] Master_Data = "user" (baru dibuat untuk Data Input)

### Performance + Error Handling
- [x] `apiFetch` helper — AbortController timeout (15s default)
- [x] Server-side Firestore memo cache 2-menit TTL
- [x] Client-side SWR stale-while-revalidate cache
- [x] Firestore transaction watchdog 10s
- [x] Error format konsisten (TimeoutError, ApiError, formatApiError)
- [x] Schema endpoint 3-parallel fetch (BQ + 2 Firestore overlay)
- [x] BQ rows LIMIT default 5000 + filter `is_active IS NOT FALSE`

### Docs
- [x] `DATA_PLATFORM_DESIGN.md` v0.3 — pattern utama + iterasi terbaru
- [x] `CLAUDE.md` Dashboard — state + role Master Data + larangan keras

---

## ❌ BELUM / PHASE SELANJUTNYA

### High-value UX (kalau sempat sebelum test)
- [ ] **CHOICE [+ Tambah Opsi] in-the-fly** — tombol di bawah dropdown CHOICE saat
  cell editing, user tambah opsi baru tanpa tutup row
- [ ] **CHOICE_CASCADE** — dropdown auto-filter by parent column value
  (contoh: Bay dropdown filter by gi_id pick)

### Operational (Phase 4-5 per design doc §8)
- [ ] **Audit log** — BQ `platform_internal.audit_log` partitioned + writer wrapper
- [ ] **Export xlsx/csv/Sheets** — exceljs + BQ EXPORT API
- [ ] **Bulk import 5-step wizard** — CSV/Excel upload → match header → validate
  → diff review → commit (MERGE via staging table)
- [ ] **File upload Drive** — OAuth + resumable upload + thumbnail render
- [ ] **Page lock + heartbeat** — Firestore page_locks/{resource} + TTL 10min
  + onSnapshot untuk multi-admin aware

### Security + RBAC (Phase 5)
- [ ] **Password protect /data-input** — middleware sederhana (env-based atau
  Firestore user whitelist) seperti Cloud Console dulu
- [ ] **Firestore user_roles/{email}** — admin/editor/viewer
- [ ] **API middleware** — cek role per endpoint
- [ ] **Admin UI /admin/roles** — add user + assign table permissions
- [ ] **Admin UI /admin/audit** — filter + timeline viz

### Page Builder (Phase 6)
- [ ] **Edit mode per page dashboard** — admin toggle View/Edit
- [ ] **Component config panel** — data source, agg, filter, style
- [ ] **Save config** Firestore dashboard_pages_v5

### Data Migration (Phase 7)
- [ ] **Repoint dashboard existing** pelan-pelan ke Master_Data.* dari legacy
  dataset (healthy-index, petir, CE Next Level, dll)
- [ ] **Shutdown sync engine** Cloud Function `ss-sync` setelah semua viz re-point

---

## 🔍 HAL-HAL IMPLICIT dari iterasi yang perlu verify

User said berulang:
- [x] **Row click = 1× highlight** (tidak perlu checkbox kolom)
- [x] **Bulk bar cuma muncul ≥2 row** (tidak noisy untuk single select)
- [x] **"+ Row" button dihapus** — staging row di bottom
- [x] **"+ Kolom" button dihapus** — "+" virtual column di rightmost
- [x] **Level label correct** (UPT=1, ULTG=2, GI=3, Bay=4)
- [x] **Alias friendly default** (gi_id → "Gardu Induk")
- [x] **HierarchyStrip DIHAPUS** — user bilang ga perlu
- [x] **Virtual ancestor columns DIHAPUS** — user bilang ga perlu
- [x] **Deselect button DIHAPUS** — click row lagi = toggle off

User belum bilang tapi implisit dari design doc §4.3:
- [ ] Copy-paste multi-cell range (RDG bisa, belum test actual cross-cell)
- [ ] Keyboard Ctrl+Z di cell focus (kemungkinan work, belum verify)
- [ ] Drag fill handle visual cue (RDG default, belum test)
- [ ] Frozen PK column kiri (belum set)

---

## 📊 File Inventory

### API (7 route files)
```
/api/data-input/
  datasets/route.ts                                    GET+POST datasets
  datasets/[ds]/route.ts                               GET+DELETE dataset
  datasets/[ds]/tables/route.ts                        POST table
  datasets/[ds]/tables/[t]/route.ts                    GET+DELETE table
  datasets/[ds]/tables/[t]/rows/route.ts               GET+POST+PATCH+DELETE rows
  datasets/[ds]/tables/[t]/schema/route.ts             PATCH column overlay
  datasets/[ds]/tables/[t]/columns/route.ts            POST ALTER TABLE
  _lib/clients.ts                                      BQ + Firestore singletons
  _lib/bq-discovery.ts                                 list + schema + FK registry + DEFAULT_ALIAS
  _lib/overlay-config.ts                               Firestore overlay + memo cache
```

### FE pages
```
/data-input/
  page.tsx                 landing (grouped by origin)
  [ds]/page.tsx            dataset detail
  [ds]/[t]/page.tsx        workspace
  new/dataset/page.tsx     wizard
  new/table/page.tsx       wizard 4-step dengan Link ke Master
  _workspace/
    MasterGrid.tsx         main spreadsheet grid (~900 lines, full RDG features)
    AddRowModal.tsx        form detail modal
    AddColumnModal.tsx     wizard add column inline
    ColumnConfigurator.tsx slide-in drawer edit schema overlay
    SheetFilterPopup.tsx   Google-Sheets-style filter
    types.ts               ColumnMeta + RowData + FilterOp
```

### Shared utils
```
/hooks/
  useTableWorkspace.ts     fetch + CRUD + SWR cache
/lib/
  api-client.ts            apiFetch + TimeoutError + ApiError + formatApiError
  workspace-cache.ts       client-side SWR cache (module-level Map)
/components/
  DataInputSidebarTree.tsx dynamic sidebar nested
```

---

## 🎯 Rekomendasi: sebelum test user

1. Test flow end-to-end via browser:
   - [ ] Landing → click dataset → click table → grid render
   - [ ] Click row → highlight strong visible
   - [ ] Click same row again → deselect
   - [ ] Dblclick cell → inline edit → Tab → next cell → Enter save → PATCH success toast
   - [ ] Staging row di bottom → ketik cell → Enter → createRow POST
   - [ ] Click "+" header column → AddColumnModal → pick Master link → ALTER TABLE
   - [ ] Filter funnel → checkbox values → apply → rows filtered
   - [ ] Ctrl+C cell → Ctrl+V di cell lain → value copied
   - [ ] Drag corner fill → row below gets value
   - [ ] Ctrl+Z → undo last change
2. Pastikan tiap API response < 2s setelah warm cache
3. Verify Typecheck clean

Setelah user test → feedback → iterasi selanjutnya sesuai prioritas (CHOICE in-the-fly → Audit log → Export).
