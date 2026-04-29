# Data Input Workspace — Business Logic Design

> Dokumen ini menjelaskan business logic untuk Data Input Workspace di Dashboard UPT Bogor.
> Untuk agent: baca dokumen ini + CLOUD_CONSOLE.md sebelum implement.

---

## 1. Ringkasan Sistem

Data Input Workspace = **internal spreadsheet-like UI** di Dashboard untuk CRUD data aset PLN ke BigQuery. Menggantikan Google Sheets + Spreadsheet Sync CF.

**Prinsip utama:**
- Master Data = poros semua dropdown
- Column config = config-driven (Firestore), bukan hardcode
- Edit = local-first (dirty state di browser), save manual ke BQ
- Import = dari Excel/CSV, user mapping header

---

## 2. Arsitektur

```
┌────────────────────────────────────────────────────────────┐
│  BROWSER                                                    │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  DataTable Component                                   │  │
│  │  ├─ Column config dari Firestore (tipe, cascade, dll) │  │
│  │  ├─ Data rows dari BQ (via API)                        │  │
│  │  ├─ Dirty state di localStorage                        │  │
│  │  ├─ CascadeDropdown (generic, N-level)                 │  │
│  │  ├─ MultiSelect (filtered by parent)                   │  │
│  │  └─ ImportWizard (Excel → header mapping → validate)   │  │
│  └──────────────────────────────────────────────────────┘  │
│         │                                                     │
│         ▼                                                     │
│  localStorage: workspace_pending_edits                       │
│  (survive refresh, offline safe)                              │
└─────────┬────────────────────────────────────────────────────┘
          │ REST API
          ▼
┌─────────────────────────────────────────┐
│  API Routes (/api/data/)                │
│                                          │
│  GET  /{table}/rows       → query BQ     │
│  POST /{table}/batch-upsert → write BQ   │
│  GET  /{table}/config     → column config│
│  GET  /master/{table}     → dropdown opts│
│  POST /{table}/import     → bulk insert  │
│  POST /{table}/validate   → check rows   │
│  DELETE /{table}/rows     → soft delete  │
└─────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────┐
│  BigQuery                                │
│  ├─ Master_Data.*  (poros dropdown)      │
│  └─ Asset_Data.*   (data operasional)    │
└─────────────────────────────────────────┘
```

---

## 3. Data Hierarchy (Level System)

### Hirarki Lokasi (sudah ada)

```
Level 1: UPT           → Master_Data.UPT
Level 2: ULTG          → Master_Data.ULTG          FK: upt_id
Level 3: Gardu Induk   → Master_Data.Gardu_Induk   FK: ultg_id
Level 4: Bay           → Master_Data.Bay            FK: gi_id
Level 5: Peralatan     → Asset_Data.*               FK: bay_id
```

### Hirarki Asset (contoh: Relay)

```
Relay_Brand    → Master_Data.Relay_Brand
Relay_Type     → Master_Data.Relay_Type         FK: brand_id
Relay_Function → Master_Data.Relay_Function     FK: relay_type_ids (array)
```

### Auto-Inject Hirarki by Level

Saat user bikin tabel baru dan pilih level, sistem auto-inject kolom hirarki:

```
User bikin tabel "Asset_Data.CT", pilih level = "Bay" (Level 4)
  → Sistem auto-inject: UPT, ULTG, Gardu_Induk, Bay (cascade ready)
  → User tinggal tambah kolom spesifik: Merk_CT, Ratio, Class, dll
```

Mapping:
```
Level "UPT"         → inject: [UPT]
Level "ULTG"        → inject: [UPT, ULTG]
Level "Gardu Induk" → inject: [UPT, ULTG, Gardu_Induk]
Level "Bay"         → inject: [UPT, ULTG, Gardu_Induk, Bay]
```

---

## 4. Column Type System

### Tipe Kolom

| Type | Behavior | Contoh |
|------|----------|--------|
| `text` | Free text input | Nama Bay, Keterangan |
| `number` | Numeric only | Ratio CT, Tegangan |
| `dropdown` | Fixed options (hardcode) | Status: Baik/Rusak |
| `reference` | Single-select dari tabel master | Gardu Induk, Brand |
| `multi_reference` | Multi-select (checkbox) dari tabel master | Fungsi Proteksi |
| `date` | Date picker | Tanggal Operasi |
| `boolean` | Toggle on/off | Aktif |
| `auto` | Generated, read-only | ID, created_at |

### Column Config Schema (Firestore)

Collection: `table_configs/{table_id}`

```json
{
  "table_id": "Asset_Data.Relay",
  "display_name": "Relay",
  "level": "Bay",
  "dataset": "Asset_Data",
  "bq_table": "relay",
  "row_id_strategy": "uuid",
  "soft_delete": true,
  "columns": [
    {
      "key": "upt",
      "label": "UPT",
      "type": "reference",
      "ref_table": "Master_Data.UPT",
      "ref_display": "name",
      "required": true,
      "width": 120,
      "order": 1,
      "injected": true
    },
    {
      "key": "ultg",
      "label": "ULTG",
      "type": "reference",
      "ref_table": "Master_Data.ULTG",
      "ref_display": "name",
      "cascade_from": "upt",
      "cascade_fk": "upt_id",
      "required": true,
      "width": 120,
      "order": 2,
      "injected": true
    },
    {
      "key": "gardu_induk",
      "label": "Gardu Induk",
      "type": "reference",
      "ref_table": "Master_Data.Gardu_Induk",
      "ref_display": "name",
      "cascade_from": "ultg",
      "cascade_fk": "ultg_id",
      "required": true,
      "width": 200,
      "order": 3,
      "injected": true
    },
    {
      "key": "bay",
      "label": "Bay",
      "type": "reference",
      "ref_table": "Master_Data.Bay",
      "ref_display": "nama_bay",
      "cascade_from": "gardu_induk",
      "cascade_fk": "gi_id",
      "required": true,
      "width": 180,
      "order": 4,
      "injected": true
    },
    {
      "key": "brand",
      "label": "Brand",
      "type": "reference",
      "ref_table": "Master_Data.Relay_Brand",
      "ref_display": "name",
      "required": true,
      "width": 120,
      "order": 5
    },
    {
      "key": "relay_type",
      "label": "Type",
      "type": "reference",
      "ref_table": "Master_Data.Relay_Type",
      "ref_display": "name",
      "cascade_from": "brand",
      "cascade_fk": "brand_id",
      "required": true,
      "width": 160,
      "order": 6
    },
    {
      "key": "fungsi_proteksi",
      "label": "Fungsi Proteksi",
      "type": "multi_reference",
      "ref_table": "Master_Data.Relay_Function",
      "ref_display": "name",
      "filter_by": "relay_type",
      "filter_field": "relay_type_ids",
      "filter_mode": "contains",
      "required": false,
      "width": 250,
      "order": 7
    },
    {
      "key": "serial_number",
      "label": "Serial Number",
      "type": "text",
      "required": false,
      "width": 150,
      "order": 8
    }
  ]
}
```

### Cascade Logic (Pseudocode)

```
function getDropdownOptions(column, currentRowValues):
  allOptions = query(column.ref_table)

  if column.cascade_from:
    parentValue = currentRowValues[column.cascade_from]
    if parentValue:
      allOptions = allOptions.filter(
        row => row[column.cascade_fk] === parentValue.id
      )
    else:
      return []  // parent belum dipilih, dropdown kosong

  if column.filter_by:
    filterValue = currentRowValues[column.filter_by]
    if filterValue:
      allOptions = allOptions.filter(
        row => row[column.filter_field].includes(filterValue.id)
      )

  return allOptions.filter(row => row.status !== 'inactive')
```

### Reset Cascade on Parent Change

```
User ubah Gardu Induk dari "GI SENTUL" → "GI CIAWI"
  → Bay otomatis reset ke null (karena bay lama bukan milik GI baru)
  → Dropdown Bay reload options untuk GI CIAWI

User ubah Brand dari "NR" → "ABB"
  → Relay Type reset ke null
  → Fungsi Proteksi reset ke [] (kosong)
  → Dropdown Type reload untuk ABB
```

---

## 5. Dirty State & Save System

### State Lifecycle per Cell

```
CLEAN   → data dari BQ, belum disentuh         → warna default
DIRTY   → user sudah edit, belum save           → background kuning
SAVING  → sedang dikirim ke BQ                  → spinner kecil
SAVED   → berhasil save                         → flash hijau 1 detik → CLEAN
ERROR   → gagal save                            → background merah + tooltip
```

### localStorage Structure

```json
{
  "workspace_pending_edits": {
    "Asset_Data.Relay": {
      "row_uuid_001": {
        "_is_new": false,
        "brand": {
          "old": { "id": "1", "name": "NR" },
          "new": { "id": "2", "name": "ABB" },
          "edited_at": "2026-04-24T10:00:00Z"
        },
        "relay_type": {
          "old": { "id": "1", "name": "PCS-9611" },
          "new": null,
          "edited_at": "2026-04-24T10:00:01Z"
        }
      },
      "__new_row_temp_001": {
        "_is_new": true,
        "upt": { "old": null, "new": { "id": "1", "name": "BOGOR" }, "edited_at": "..." },
        "brand": { "old": null, "new": { "id": "1", "name": "NR" }, "edited_at": "..." }
      }
    }
  }
}
```

### Save Flow

```
User klik [Save N changes]
  │
  ├─ Collect semua dirty cells dari localStorage
  ├─ Group by row_id
  ├─ POST /api/data/{table}/batch-upsert
  │   Body: {
  │     "updates": [
  │       { "row_id": "uuid_001", "fields": { "brand": "2", "relay_type": null } }
  │     ],
  │     "inserts": [
  │       { "temp_id": "temp_001", "fields": { "upt": "1", "brand": "1", ... } }
  │     ]
  │   }
  │
  ├─ Response per row:
  │   { "row_id": "uuid_001", "status": "ok" }
  │   { "temp_id": "temp_001", "status": "ok", "row_id": "uuid_new" }
  │   { "row_id": "uuid_002", "status": "conflict", "current_value": {...} }
  │
  ├─ OK rows:
  │   → Remove dari localStorage
  │   → Cell state → SAVED → CLEAN
  │   → New rows: replace temp_id dengan real row_id
  │
  ├─ CONFLICT rows:
  │   → Cell state → CONFLICT (orange)
  │   → Show dialog: "Value sudah berubah di BQ. Overwrite / Accept / Cancel"
  │
  └─ ERROR rows:
      → Cell state → ERROR (merah)
      → Tetap di localStorage (bisa retry)
      → Show toast: "N rows gagal save: {error message}"
```

### Browser Refresh / Offline

```
Page load:
  1. Fetch data dari BQ via API
  2. Cek localStorage ada pending edits?
  3. Overlay pending edits di atas BQ data
  4. Dirty cells ditampilkan kuning

Close tab (beforeunload):
  if (hasDirtyEdits):
    show browser warning "Anda punya N perubahan belum disimpan"

Offline:
  Edit tetap bisa (simpan ke localStorage)
  Tombol [Save] disabled + "Offline"
  Online kembali → [Save] enabled
```

---

## 6. Import System (Excel/CSV)

### Flow

```
1. User klik [Import]
2. File picker (accept: .xlsx, .csv)
3. Parse file di browser (SheetJS / Papaparse)
4. Extract headers dari row 1
5. Auto-match headers dengan kolom BQ
6. Tampilkan mapping UI
7. User koreksi mapping yang salah
8. Preview 5 rows pertama
9. Validate semua rows
10. User pilih mode (Append / Upsert / Replace)
11. Import ke BQ
12. Show result summary
```

### Header Matching Logic

```
Priority order:
  1. Exact match (case-insensitive):     "UPT" === "upt"           → ✅ auto
  2. Normalized (strip _-. dan spasi):   "Gardu_Induk" === "gardu induk" → ✅ auto
  3. Fuzzy (contains / Levenshtein):     "Fungsi" ≈ "Fungsi Bay"   → 🟡 suggest
  4. No match:                           "Keterangan"               → 🔴 manual
```

### Mapping UI

```
┌──────────────────────────────────────────────────────┐
│  Import: relay_data.xlsx (150 rows)                   │
│                                                        │
│  Header File         Status   Map ke Kolom BQ          │
│  ──────────────────  ──────   ────────────────────     │
│  UPT                 ✅ auto  UPT                      │
│  ULTG                ✅ auto  ULTG                     │
│  GI                  🟡 sug   [Gardu Induk ▼]          │
│  Nama Bay            ✅ auto  Nama Bay                 │
│  Merk                🟡 sug   [Brand ▼]                │
│  Tipe                🟡 sug   [Type ▼]                 │
│  Fungsi              🟡 sug   [Fungsi Proteksi ▼]      │
│  Catatan             🔴       [-- Skip -- ▼]           │
│                                                        │
│  ⚠ Kolom BQ belum mapped: Serial Number (optional)    │
│                                                        │
│  Preview:                                              │
│  ┌──────┬───────┬──────────────┬─────────────┐        │
│  │ UPT  │ ULTG  │ GI           │ Nama Bay    │        │
│  │BOGOR │BOGOR  │GI 150KV SE.. │BUSBAR A 150 │        │
│  └──────┴───────┴──────────────┴─────────────┘        │
│                                                        │
│  Mode: ○ Append  ● Upsert  ○ Replace                  │
│                                                        │
│  [Cancel]                          [Validate & Import] │
└──────────────────────────────────────────────────────┘
```

### Pre-Import Validation

```
Setelah mapping, sebelum import:

Per row validasi:
  ✅ Valid            → siap import
  ⚠  Warning         → misal: value ga match reference tapi bisa insert
  ❌ Error            → required kosong, format salah, duplicate key

Summary:
  "145 valid, 3 warnings, 2 errors"
  [Import 145 valid]  [Import all 148]  [Cancel]
```

### Reference Resolution saat Import

```
File Excel isinya text: "GI 150KV SENTUL"
BQ butuhnya ID: "gi_003"

Saat import, sistem RESOLVE text → ID:
  1. Lookup "GI 150KV SENTUL" di Master_Data.Gardu_Induk
  2. Found → gunakan ID-nya
  3. Not found → mark sebagai warning
     "Row 45: 'GI 150KV SENTULL' tidak ditemukan (typo?)"
     Suggest closest match: "GI 150KV SENTUL" (Levenshtein 1)
```

---

## 7. Master Data Management Rules

### Tambah Master Data

```
Admin tambah GI baru di Master_Data.Gardu_Induk:
  → Insert row baru ke BQ
  → Otomatis muncul di dropdown "Gardu Induk" di SEMUA tabel
  → Tidak perlu config ulang apapun
```

### Nonaktifkan Master Data (Soft Delete)

```
Admin nonaktifkan "GI 150KV SENTUL":
  → Update status = "inactive" di Master_Data.Gardu_Induk
  → Dropdown GI: SENTUL tidak muncul lagi untuk input BARU
  → Data existing yang reference SENTUL: TETAP ADA
    → Ditandai visual: "(inactive)" atau icon ⚠
    → User bisa reassign ke GI lain jika perlu
  → Bay yang FK ke GI SENTUL: tampil warning
    "Bay ini berada di GI yang sudah tidak aktif"
```

### Hard Delete Protection

```
User klik delete master data:
  → Cek dulu: ada data lain yang reference ke row ini?
  → Ada → TOLAK delete
    "Tidak bisa hapus GI 150KV SENTUL. 
     12 Bay dan 45 Asset masih mereferensi GI ini.
     Gunakan 'Nonaktifkan' sebagai alternatif."
  → Tidak ada → izinkan delete (dengan konfirmasi)
```

---

## 8. New Table Creation

### Flow

```
User klik [+ New Table]
  → Form:
    Nama tabel: [___________]
    Dataset:    [Master_Data ▼] atau [Asset_Data ▼]
    Level:      [Bay ▼]                     ← pilih level hirarki
    Deskripsi:  [___________]

  → Klik [Create]
  → Sistem:
    1. Buat BQ table (schema dasar: id, status, created_at, updated_at)
    2. Auto-inject kolom hirarki sesuai level
    3. Buat column config di Firestore
    4. Table muncul di sidebar workspace

  → User lanjut: [+ Add Column] untuk kolom spesifik
```

### Add Column (di table yang sudah ada)

```
User klik [+] di header tabel
  → Form:
    Key:        [___________]  (auto: snake_case dari label)
    Label:      [___________]
    Tipe:       [reference ▼]
      Kalau reference:
        Ref table:    [Master_Data.Relay_Brand ▼]
        Cascade from: [-- None -- ▼]
      Kalau multi_reference:
        Ref table:    [Master_Data.Relay_Function ▼]
        Filter by:    [relay_type ▼]
      Kalau dropdown:
        Options:      [Baik, Rusak, Tidak Diketahui]
    Required:   [☐]
    Width:      [150] px

  → [Add Column]
  → Sistem:
    1. ALTER TABLE di BQ (add column)
    2. Update column config di Firestore
    3. Kolom muncul di tabel, siap dipakai
```

---

## 9. UI Components

### Komponen Utama

| Component | Fungsi |
|-----------|--------|
| `DataTable` | Tabel utama, baca column config, render cells sesuai tipe |
| `EditableCell` | Cell yang bisa double-click → edit → Enter/Escape |
| `CascadeDropdown` | Generic dropdown dengan filter cascade N-level |
| `MultiSelectDropdown` | Checkbox list, filter by parent column |
| `DirtyIndicator` | Badge "[Save N changes]" + "[Discard]" |
| `ImportWizard` | Modal multi-step: upload → mapping → preview → validate → import |
| `ColumnEditor` | Modal untuk add/edit column config |
| `TableCreator` | Modal untuk create new table |
| `ConflictDialog` | Dialog saat save conflict: Overwrite / Accept / Cancel |
| `ValidationToast` | Error/warning feedback per cell |

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Double-click | Edit cell |
| Enter | Confirm edit, move down |
| Escape | Cancel edit |
| Tab | Move to next cell |
| Shift+Tab | Move to previous cell |
| Arrow keys | Navigate cells |
| Ctrl+S | Save all pending changes |
| Ctrl+Z | Undo last edit (from localStorage) |
| Delete | Clear cell value (set dirty) |

---

## 10. API Specification

### GET /api/data/{table}/rows

```
Query params:
  page: number (default 1)
  limit: number (default 100)
  sort: string (column key)
  order: "asc" | "desc"
  filter: JSON string (optional)

Response:
{
  "rows": [
    {
      "_id": "uuid",
      "upt": { "id": "1", "name": "BOGOR" },
      "ultg": { "id": "1", "name": "BOGOR" },
      "gardu_induk": { "id": "3", "name": "GI 150KV SENTUL" },
      "brand": { "id": "1", "name": "NR" },
      ...
    }
  ],
  "total": 337,
  "page": 1,
  "limit": 100
}
```

Catatan: reference columns di-resolve ke `{ id, name }` oleh API (JOIN dengan master table). FE tidak perlu resolve sendiri.

### GET /api/data/{table}/config

```
Response: column config object (sama dengan schema di Section 4)
```

### GET /api/data/master/{table}

```
Query params:
  status: "active" (default, exclude inactive)

Response:
{
  "rows": [
    { "id": "1", "name": "BOGOR" },
    { "id": "2", "name": "SUKABUMI" }
  ]
}
```

Digunakan oleh CascadeDropdown untuk populate options. **Cache di browser** (stale-while-revalidate, 5 menit).

### POST /api/data/{table}/batch-upsert

```
Body:
{
  "updates": [
    {
      "row_id": "uuid_001",
      "fields": { "brand": "2", "relay_type": null },
      "old_values": { "brand": "1", "relay_type": "1" }
    }
  ],
  "inserts": [
    {
      "temp_id": "temp_001",
      "fields": { "upt": "1", "ultg": "1", "gardu_induk": "3", "bay": "5", "brand": "1" }
    }
  ]
}

Response:
{
  "results": [
    { "row_id": "uuid_001", "status": "ok" },
    { "temp_id": "temp_001", "status": "ok", "row_id": "uuid_new_123" },
    { "row_id": "uuid_002", "status": "conflict", "current": { "brand": "3" } }
  ]
}
```

### DELETE /api/data/{table}/rows

```
Body:
{
  "row_ids": ["uuid_001", "uuid_002"],
  "mode": "soft"
}

Soft delete: UPDATE SET status = 'deleted', deleted_at = NOW()
```

---

## 11. BQ Schema Pattern

### Master Table Template

```sql
CREATE TABLE Master_Data.{table_name} (
  id STRING NOT NULL,
  name STRING NOT NULL,
  -- FK kalau ada hirarki:
  parent_id STRING,           -- FK ke parent table
  -- Metadata:
  status STRING DEFAULT 'active',  -- 'active' | 'inactive'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  created_by STRING,
  updated_by STRING
);
```

### Asset Table Template

```sql
CREATE TABLE Asset_Data.{table_name} (
  id STRING NOT NULL,         -- UUID
  -- Hirarki (auto-injected by level):
  upt_id STRING NOT NULL,
  ultg_id STRING NOT NULL,
  gi_id STRING NOT NULL,
  bay_id STRING NOT NULL,
  -- Kolom spesifik (dari column config):
  brand_id STRING,
  relay_type_id STRING,
  fungsi_proteksi JSON,       -- array of IDs: ["1","2","5"]
  serial_number STRING,
  -- Metadata:
  status STRING DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  created_by STRING,
  updated_by STRING
);
```

---

## 12. Cloud Console Integration

```
Config:       service_runtime_configs/data_workspace
Route:        cloud-console/data-workspace/page.tsx
Log service:  data-workspace
Scheduler:    tidak ada (user-triggered)
Actions:
  - rebuild-cache: rebuild dropdown cache
  - validate-all: validate semua rows terhadap master
  - export: export tabel ke CSV/XLSX
```

---

## 13. Implementation Priority

### Sprint 1: Core Table (Minggu 1)

```
[ ] DataTable component (read data dari BQ, render sesuai column config)
[ ] EditableCell (double-click → edit → Enter/Escape)
[ ] Column config loader dari Firestore
[ ] API: GET rows, GET config
[ ] Dirty state (localStorage, visual indicator kuning)
[ ] Save button (batch-upsert API)
[ ] Add row / delete row
```

### Sprint 2: Dropdown System (Minggu 2)

```
[ ] CascadeDropdown (generic, N-level)
[ ] MultiSelectDropdown (checkbox, filtered)
[ ] Dropdown options dari master table (API + cache)
[ ] Cascade reset on parent change
[ ] Reference resolution (ID ↔ display name)
```

### Sprint 3: Import & Validation (Minggu 3)

```
[ ] ImportWizard (upload → parse → mapping UI)
[ ] Header matching (exact → normalized → fuzzy → manual)
[ ] Preview rows
[ ] Pre-import validation
[ ] Reference resolution saat import (text → ID)
[ ] Import modes: Append / Upsert / Replace
```

### Sprint 4: Table Management (Minggu 4)

```
[ ] New table creation (auto-inject hirarki)
[ ] Add/edit column (UI + BQ ALTER TABLE + Firestore update)
[ ] Sort & filter per kolom
[ ] Column reorder & resize
[ ] Soft delete master data + cascade warning
[ ] Hard delete protection (reference check)
```

### Sprint 5: Polish (Minggu 5)

```
[ ] Conflict detection on save
[ ] Keyboard navigation (arrows, tab, enter, escape, ctrl+s)
[ ] Undo/redo (localStorage history)
[ ] Offline indicator
[ ] beforeunload warning
[ ] Export XLSX
[ ] Conditional formatting (status colors)
[ ] Audit trail per row (last edited by, when)
```

---

## 14. Agent Instructions

> **Section ini WAJIB dibaca oleh agent sebelum mulai kerja.**
> Instruksi di section ini override apapun yang agent asumsikan sendiri.

### 14.1 Aturan Absolut (JANGAN DILANGGAR)

```
1. AUDIT DULU sebelum implement apapun
   - Scan seluruh folder project
   - Identifikasi file, komponen, API route yang SUDAH ADA
   - Identifikasi fitur yang SUDAH JADI vs BELUM ADA
   - Catat tech stack, library, pattern yang dipakai

2. JANGAN buat ulang yang sudah ada
   - Kalau komponen sudah ada dan fungsinya sama → EDIT, bukan buat baru
   - Kalau API route sudah ada → EXTEND, bukan replace
   - Kalau styling sudah ada → IKUTI pattern yang sama

3. JANGAN ubah file di luar scope
   - HANYA sentuh file di area: src/app/data-input/, src/app/api/data/
   - JANGAN sentuh: cloud-console/, api/console/, thor-vaisala/, notifier/
   - Kalau perlu referensi pattern → BACA file cloud-console, tapi JANGAN edit

4. ADAPTASI dengan sistem existing
   - Lihat cara cloud-console/ melakukan fetch data, handle state, render UI
   - Ikuti pattern yang sama: hooks, API route structure, error handling
   - Ikuti design system yang sudah ada (warna, spacing, komponen shared)
   - Kalau project pakai Tailwind → pakai Tailwind. Kalau CSS modules → ikuti.

5. STOP setelah setiap milestone
   - Setelah selesai 1 langkah, BERHENTI dan tanya user: "Lanjut ke langkah berikutnya?"
   - Jangan implement lebih dari 1 langkah sekaligus tanpa approval user
   - Jangan ngebut — kualitas lebih penting dari kecepatan
```

### 14.2 Urutan Kerja (Step by Step)

```
LANGKAH 0: BACA & PAHAMI
  Baca dokumen ini sampai selesai.
  Baca file referensi UX: docs/data-input-workspace-mockup.jsx (kalau ada).
  Pahami arsitektur Cloud Console existing: lihat src/app/cloud-console/ sebagai referensi pattern.
  JANGAN mulai coding sebelum selesai baca.
  
  Deliverable: (tidak ada file output, cuma pemahaman)
  → Tanya user: "Saya sudah baca. Lanjut ke audit?"

─────────────────────────────────────────────────

LANGKAH 1: AUDIT
  Scan project dan catat:
  a. Semua file terkait data-input, workspace, master-data, asset-data
  b. Semua API route terkait /api/data/
  c. Semua komponen shared yang bisa dipakai (DataTable, Dropdown, Modal, dll)
  d. Fitur yang SUDAH JADI (functional, bisa dipakai user)
  e. Fitur yang BELUM ADA (dibandingkan dengan design doc ini)
  f. Tech stack: framework, CSS method, state management, library
  g. BQ schema: dataset names, table names, column names yang sudah ada
  h. Firestore collections yang sudah ada terkait data workspace

  Deliverable: docs/AUDIT_DATA_INPUT.md
  Format:
    ## Files Found (path → fungsi, 1 baris per file)
    ## Features Done (list fitur yang sudah jalan)
    ## Features Missing (list fitur yang belum ada, mapped ke Sprint 1-5)
    ## Tech Stack (framework, CSS, libraries, patterns)
    ## BQ Schema (dataset.table → columns)
    ## Firestore Collections (collection/doc → fungsi)
    ## Pattern Reference (pattern dari cloud-console/ yang bisa diikuti)
  
  → Tanya user: "Audit selesai. Review dulu, atau lanjut ke langkah 2?"

─────────────────────────────────────────────────

LANGKAH 2: API ROUTES — READ
  Berdasarkan AUDIT, implement API routes yang BELUM ADA:
  
  a. GET /api/data/[table]/rows/route.ts
     - Query BQ, join master data, resolve reference ID → display name
     - Support: page, limit, sort, order, search
     - Ikuti pattern API yang sudah ada di project
     
  b. GET /api/data/[table]/config/route.ts
     - Baca column config dari Firestore: table_configs/{table}
     
  c. GET /api/data/master/[table]/route.ts
     - Baca master data untuk dropdown (status=active default)
     - Cache-friendly response headers

  CATATAN:
  - Kalau route sudah ada tapi kurang fitur → EXTEND
  - Kalau route belum ada → CREATE mengikuti pattern existing
  - Pakai @google-cloud/bigquery (lihat cara cloud-console/ pakai)
  - Error handling wajib (try-catch, proper HTTP status)

  Deliverable: API routes yang bisa di-test via curl/browser
  → Test setiap route, pastikan response valid
  → Tanya user: "API read sudah jadi. Lanjut ke save?"

─────────────────────────────────────────────────

LANGKAH 3: API ROUTE — SAVE (BATCH UPSERT)
  Implement POST handler untuk save data:
  
  a. POST /api/data/[table]/rows/route.ts
     - Terima: { updates: [...], inserts: [...] }
     - Validate required fields + reference exists
     - Conflict check (old_value vs current BQ value)
     - Execute: MERGE/INSERT ke BQ (parameterized query, BUKAN string concat)
     - Return status per row: ok / conflict / error
     
  b. Helper: src/app/api/data/_lib/validation.ts
     - validateRow(row, columnConfig)
     - checkConflict(rowId, oldValues, table)

  CATATAN:
  - Soft delete ONLY (UPDATE status='deleted', JANGAN DELETE row)
  - Log write operations ke Cloud Logging (ikuti pattern cloud-console/)
  - BQ parameterized queries (SQL injection prevention)

  Deliverable: POST endpoint yang bisa save ke BQ
  → Test: insert 1 row, update 1 row, cek di BQ
  → Tanya user: "Save API jadi. Lanjut ke FE?"

─────────────────────────────────────────────────

LANGKAH 4: CONNECT FE KE API
  Update komponen FE existing agar pakai real API:
  
  a. Ganti mock/static data → fetch dari GET /api/data/{table}/rows
  b. Load column config dari GET /api/data/{table}/config
  c. Load dropdown options dari GET /api/data/master/{table}
  d. Implement dirty state di localStorage (lihat Section 5 design doc)
  e. Save button → POST batch-upsert → handle response (ok/conflict/error)
  f. beforeunload warning kalau ada unsaved changes
  g. Cascade dropdown: parent berubah → child reset + reload options
  h. Multi-select dropdown: filter options berdasar parent column

  CATATAN:
  - Lihat docs/data-input-workspace-mockup.jsx sebagai REFERENSI UX
  - JANGAN copy-paste mockup langsung — adaptasi ke komponen existing
  - Ikuti design system / CSS pattern yang sudah ada di project
  - State management: ikuti cara cloud-console/ manage state

  Deliverable: Tabel yang bisa read, edit, save ke BQ via browser
  → Test: edit cell, lihat kuning (dirty), save, refresh, data tetap
  → Tanya user: "FE connected. Lanjut ke import?"

─────────────────────────────────────────────────

LANGKAH 5: IMPORT WIZARD
  Implement import dari Excel/CSV:
  
  FE:
  a. ImportWizard modal (multi-step)
  b. Parse file di browser (SheetJS untuk xlsx, Papaparse untuk csv)
  c. Header matching: exact → normalized → fuzzy → manual
  d. Mapping UI: user koreksi mapping
  e. Preview 5 rows pertama
  f. Mode selection: Append / Upsert / Replace
  
  BE:
  g. POST /api/data/[table]/import/route.ts
     - Terima mapped rows dari FE (sudah di-parse di browser)
     - Resolve reference text → ID (lookup master table, fuzzy match)
     - Validate semua rows
     - Return summary: valid/warning/error counts
     - Execute import ke BQ

  CATATAN:
  - File parsing di BROWSER, bukan server
  - FE kirim JSON (bukan raw file) ke API
  - Reference resolution di SERVER

  Deliverable: Import wizard functional end-to-end
  → Test: upload xlsx, mapping, preview, import, cek BQ
  → Tanya user: "Import jadi. Lanjut ke review?"

─────────────────────────────────────────────────

LANGKAH 6: REVIEW & FIX
  Review semua code yang sudah dibuat:
  
  Checklist:
  [ ] Semua API routes punya error handling (try-catch, proper status)
  [ ] SQL queries pakai parameterized (bukan string concat)
  [ ] Validation logic konsisten FE ↔ BE
  [ ] localStorage dirty state survive browser refresh
  [ ] Cascade dropdown reset child saat parent berubah
  [ ] Soft delete (bukan hard delete)
  [ ] beforeunload warning ada dan berfungsi
  [ ] Pattern konsisten dengan cloud-console/
  [ ] Tidak ada file di luar scope yang tersentuh
  [ ] Import wizard handle edge case (file kosong, header salah, duplicate)
  
  Deliverable: docs/REVIEW_DATA_INPUT.md
  Format:
    ## Issues Found (severity: critical / warning / info)
    ## Fixes Applied
    ## Remaining TODOs (untuk sprint berikutnya)
  
  → Tanya user: "Review selesai. Ada yang perlu diperbaiki?"
```

### 14.3 Referensi Pattern dari Cloud Console

```
Agent WAJIB lihat file-file ini sebagai referensi pattern (BACA, jangan edit):

Pattern FE:
  src/app/cloud-console/layout.tsx                → layout pattern
  src/app/cloud-console/_components/              → shared UI components
  src/app/cloud-console/_components/useFirestore.ts → hooks pattern
  src/app/cloud-console/thor-vaisala/page.tsx      → service page pattern

Pattern BE:
  src/app/api/console/services/route.ts            → GET pattern
  src/app/api/console/services/[id]/config/route.ts → GET/POST config pattern
  src/app/api/console/_lib/firestore.ts            → Firestore client pattern
  src/app/api/console/_lib/logging.ts              → Cloud Logging pattern

Adaptasi pattern ini ke area data-input. 
Konsistensi lebih penting daripada "cara yang lebih baik".
```

### 14.4 Compact Reminder

```
Kalau sesi sudah panjang (30+ turn atau terasa lambat):
  → Jalankan /compact
  → Lanjut kerja dari langkah terakhir

Kalau context mulai penuh:
  → Prioritas: selesaikan langkah current
  → STOP, tanya user apakah mau lanjut di sesi baru
  → Kalau ya: generate HANDOFF.md berisi progress + next steps
```
