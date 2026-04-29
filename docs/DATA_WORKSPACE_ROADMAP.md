# Data Input Workspace — God Mode Feature Roadmap

> 187 fitur, 5 level, ~5 bulan estimasi. Canonical spec dari sesi desain
> bareng Claude Desktop. Implementasi bertahap — prioritas MUST-HAVE dulu.
>
> **Prinsip:** config-driven · zero hardcode · scalable · registry pattern.

---

## Level 1 — Core (Foundation · Sprint 1-3)

### A. Table Management
- A01. Sidebar list semua tables (grouped: Master Data / Asset Data)
- A02. Create new table (nama, dataset, level)
- A03. Auto-inject hirarki berdasar level yang dipilih
- A04. Delete / nonaktifkan table (soft delete)
- A05. Table metadata (row count, last updated, created by)
- A06. Table search di sidebar
- A07. Collapse/expand sidebar
- A08. Table ordering (drag reorder atau custom sort)

### B. Column Management
- B01. Add column (via UI, bukan coding)
- B02. Edit column (label, type, width, required)
- B03. Delete column (soft — hide, bukan hapus data di BQ)
- B04. Column types: text, number, date, boolean, dropdown, reference, multi_reference, auto
- B05. Column ordering (drag reorder)
- B06. Column resize (drag border)
- B07. Column hide/show toggle
- B08. Column freeze (freeze kolom kiri saat scroll horizontal)
- B09. Column config disimpan di Firestore (config-driven)
- B10. Required field indicator (*)

### C. Data Viewing
- C01. Tabel data dengan pagination
- C02. Sort per kolom (klik header, asc/desc)
- C03. Filter per kolom (dropdown filter atau text filter)
- C04. Global search (across semua kolom)
- C05. Row numbering (#)
- C06. Breadcrumb navigasi
- C07. Row count display
- C08. Loading skeleton saat fetch
- C09. Empty state (tabel kosong → "No data, add first row")
- C10. Responsive scroll (horizontal + vertical)

### D. Data Editing
- D01. Add row via modal form
- D02. Edit row via modal form (klik row atau icon edit)
- D03. Delete row (soft delete, dengan konfirmasi)
- D04. Bulk select rows (checkbox)
- D05. Bulk delete (select multiple → delete)
- D06. Duplicate row (copy row, buka modal pre-filled)

### E. Dropdown System
- E01. Fixed dropdown (hardcode options: Ya/Tidak, Baik/Rusak)
- E02. Reference dropdown (dari tabel master BQ)
- E03. Cascade dropdown (pilih UPT → ULTG filter otomatis)
- E04. Multi-select dropdown (checkbox list, misal Fungsi Proteksi)
- E05. Filtered multi-select (filter by parent column)
- E06. Cascade reset (parent berubah → child reset ke kosong)
- E07. Inactive master data → tidak muncul di dropdown
- E08. Dropdown search (ketik untuk filter options, untuk list panjang)
- E09. Dropdown loading state (saat fetch options dari BQ)
- E10. "Add new" option di dropdown (quick-add master data tanpa pindah tabel)

### F. Save System
- F01. Dirty state indicator (cell/row kuning kalau diedit)
- F02. Save button dengan count "[Save 3 changes]"
- F03. Discard button (revert semua edit ke original)
- F04. Batch save ke BQ (1 API call untuk semua changes)
- F05. Save response per row (ok / conflict / error)
- F06. Toast notification (save success / error)
- F07. beforeunload warning ("Ada perubahan belum disimpan")

### G. Local Persistence
- G01. Dirty state di localStorage (survive browser refresh)
- G02. Offline edit (tetap bisa edit, save nanti saat online)
- G03. Online/offline indicator
- G04. Auto-restore pending edits saat page load

---

## Level 2 — Smart Features (Productivity · Sprint 4-6)

### H. Import System
- H01. Upload Excel (.xlsx) / CSV
- H02. Parse file di browser (SheetJS / Papaparse)
- H03. Header auto-matching (exact → normalized → fuzzy)
- H04. Header mapping UI (user koreksi yang salah/suggest)
- H05. Preview data (5 rows pertama setelah mapping)
- H06. Import mode selection (Append / Upsert / Replace)
- H07. Pre-import validation (required, type, reference check)
- H08. Reference resolution (text → ID, lookup master table)
- H09. Fuzzy match suggestion ("GI SENTULL" → "GI SENTUL?")
- H10. Import result summary (N success, N warning, N error)
- H11. Import history log (siapa import, kapan, berapa rows)

### I. Export System
- I01. Export CSV
- I02. Export XLSX (dengan formatting)
- I03. Export filtered view (bukan semua data, sesuai filter aktif)
- I04. Export selected rows only
- I05. Export with column selection (pilih kolom mana yang di-export)
- I06. Print-friendly view

### J. Inline Editing (Upgrade dari Modal)
- J01. Double-click cell → edit di tempat
- J02. Enter → confirm, Escape → cancel
- J03. Tab → next cell, Shift+Tab → previous
- J04. Arrow keys navigasi
- J05. Inline dropdown (klik cell reference → dropdown muncul di cell)
- J06. Inline multi-select (klik cell multi → checkbox list muncul)
- J07. Cell-level dirty indicator (border kuning per cell)

### K. Bulk Operations
- K01. Bulk edit (select multiple → edit 1 field untuk semua)
- K02. Bulk status change (select → "Set status Baik")
- K03. Copy-paste dari Excel (select range di Excel → paste ke tabel)
- K04. Fill down (select cells → isi value yang sama ke bawah)
- K05. Bulk import dari tabel lain (copy rows dari tabel A ke tabel B)

### L. Validation System
- L01. Required field check (cell merah kalau kosong)
- L02. Type validation (huruf di kolom number → error)
- L03. Reference validation (ID harus exist di master)
- L04. Duplicate key check (prevent duplicate row)
- L05. Error tooltip (hover cell merah → pesan error)
- L06. Validation summary bar ("3 errors, 2 warnings in this table")
- L07. Jump to error (klik error → scroll ke row/cell bermasalah)

### M. Master Data Rules
- M01. Tambah master data → otomatis muncul di semua dropdown
- M02. Soft delete master → dropdown hide, data existing tetap ada
- M03. Hard delete protection (ada relasi → tolak, suruh nonaktifkan)
- M04. Cascade warning (nonaktifkan GI → warning ke Bay terkait)
- M05. Reactivate (master yang di-nonaktifkan bisa diaktifkan lagi)
- M06. Merge master data (2 GI duplicate → merge jadi 1, re-reference)

---

## Level 3 — Intelligence (Config-Driven Logic · Sprint 7-10)

### N. Formula Engine
- N01. Calculated columns (formula dari kolom lain). Contoh: `total_harga = {harga_satuan} × {jumlah}`
- N02. Date formulas. Contoh: `umur_aset = TODAY() - {tanggal_operasi}`
- N03. Conditional value. Contoh: `IF {umur_aset} > 25 THEN "Perlu Penggantian"`
- N04. Cross-table formula. Contoh: `COUNT rows di Asset_Data.Relay WHERE bay_id = THIS.id`
- N05. Aggregation formula. Contoh: `SUM({daya_mva}) WHERE gi_id = THIS.gi_id`
- N06. Formula preview (lihat hasil sebelum save)
- N07. Formula error handling (field kosong, division by zero)
- N08. Formula config di Firestore (bukan hardcode)

### O. Conditional Rules
- O01. Conditional required: `IF tipe_bay = "Trafo" THEN daya_mva REQUIRED`
- O02. Conditional visibility: `IF tipe_bay = "Trafo" THEN SHOW kolom daya_mva`
- O03. Conditional dropdown filter: `IF brand = "NR" THEN type OPTIONS = [PCS-9611, PCS-9612]`
- O04. Conditional formatting: `IF status = "Rusak" THEN cell background merah`
- O05. Conditional default value: `IF tipe_bay = "Busbar" THEN default tegangan = "150"`
- O06. Rules config di Firestore (bukan hardcode)
- O07. Rule priority (kalau 2 rule conflict, mana yang menang)

### P. Relations & Cross-Reference
- P01. One-to-many display: Di tabel Bay → section "Assets di Bay ini" (list Relay, CT, PT)
- P02. Clickable reference: Klik "GI 150KV SENTUL" di tabel Bay → jump ke tabel GI, row itu
- P03. Back-reference count: Di tabel GI → kolom "Total Bay: 12"
- P04. Related data preview: Hover reference → popup preview data dari tabel master
- P05. Dependency graph: Visualisasi GI → Bay → Relay/CT/PT (tree view)
- P06. Impact analysis: "Kalau delete GI ini, 12 Bay dan 45 Asset akan terpengaruh"

### Q. Views & Saved Filters
- Q01. Save filter combination sebagai "View". Contoh: "Relay NR di ULTG Bogor" = filter brand=NR + ultg=BOGOR
- Q02. View sharing (view bisa dipakai user lain)
- Q03. Default view per user
- Q04. Pivot view (group by kolom tertentu)
- Q05. Card view (tampilan card selain tabel)
- Q06. Tree view (expandable hirarki: GI → Bay → Asset)
- Q07. Map view (kalau ada koordinat → tampilkan di peta)

---

## Level 4 — Enterprise (Multi-User & Control · Sprint 11-14)

### R. Permission System
- R01. Role-based access (Admin, Operator, Viewer)
- R02. Table-level permission (Operator: edit Asset, read-only Master)
- R03. Column-level permission (kolom "harga" hanya untuk Finance)
- R04. Row-level permission (user A hanya bisa edit data ULTG Bogor)
- R05. Action-level permission (siapa boleh import, siapa boleh delete)
- R06. Permission config di Firestore

### S. Audit & History
- S01. Audit trail per row (siapa edit, kapan, field apa)
- S02. Version history (lihat value sebelumnya)
- S03. Rollback (revert row ke versi sebelumnya)
- S04. Diff view (bandingkan 2 versi side-by-side)
- S05. Activity log (semua aktivitas di workspace: create, edit, delete, import)
- S06. Export audit log

### T. Workflow & Approval
- T01. Draft → Review → Approved flow
- T02. Approval notification
- T03. Reject dengan komentar
- T04. Bulk approve
- T05. Workflow config per tabel (tabel A perlu approval, tabel B tidak)
- T06. Multi-level approval (Operator → Supervisor → Manager)

### U. Conflict Resolution
- U01. Optimistic locking (detect concurrent edit)
- U02. Conflict dialog (Overwrite / Accept Theirs / Cancel)
- U03. Real-time indicator (user lain sedang edit row yang sama)
- U04. Lock row saat edit (optional, pessimistic locking)
- U05. Merge conflict (2 user edit field berbeda di row yang sama → auto-merge)

---

## Level 5 — God Mode (Self-Operating · Sprint 15-20)

### V. Notification Triggers
- V01. Row created trigger → notify WA/Telegram
- V02. Field changed trigger (status berubah ke "Rusak" → notify admin)
- V03. Threshold trigger (count "Rusak" > 10 → escalation notification)
- V04. Schedule trigger (setiap Senin jam 8 → summary report ke WA)
- V05. Import completed trigger → notify operator
- V06. Trigger config di Firestore (bukan hardcode)
- V07. Trigger history log (trigger mana yang fired, kapan)

### W. Scheduled Auto-Actions
- W01. Auto-flag rows (umur_aset > 25 → auto set "Perlu Penggantian")
- W02. Auto-summary (setiap minggu: count rows per status → report)
- W03. Auto-validate (setiap hari: cek data kosong → reminder)
- W04. Auto-archive (data > 5 tahun → pindah ke archive table)
- W05. Auto-sync (sync data dari source eksternal → update BQ)
- W06. Cron config di Firestore

### X. Report Generator
- X01. Report template config (pilih tabel, kolom, filter, grouping)
- X02. Auto-generate report (PDF / XLSX)
- X03. Chart embedded di report (bar, pie, line)
- X04. Schedule report (setiap bulan → generate → kirim ke WA)
- X05. Cross-table report (gabung data dari multiple tabel)
- X06. Report history & archive

### Y. File Management (GCS Integration)
- Y01. Column type "file" (upload ke GCS)
- Y02. Image preview di cell (thumbnail)
- Y03. File preview modal (klik → lihat foto/PDF)
- Y04. Multi-file per cell (attach multiple files)
- Y05. GCS browser (browse bucket per tabel)
- Y06. File versioning (upload baru, simpan versi lama)
- Y07. Bulk file upload
- Y08. File type restriction per kolom (hanya .jpg .pdf, dll)

### Z. Plugin System
- Z01. Custom column type (misal: "qr_code" → auto-generate QR per row)
- Z02. Custom action button (misal: "Generate Label" per asset)
- Z03. Custom validator (misal: cek API PLN untuk validasi ID pelanggan)
- Z04. Custom widget (misal: mini chart di cell)
- Z05. Plugin register via config
- Z06. Plugin marketplace (share plugin antar tabel)

### AA. API & Integration
- AA01. REST API per tabel (external system bisa read/write)
- AA02. Webhook (data berubah → POST ke URL external)
- AA03. Google Sheets sync (2-way sync dengan spreadsheet)
- AA04. CSV auto-import (watch folder GCS → auto import file baru)
- AA05. API key management (per external client)
- AA06. Rate limiting & quota

---

## Summary Count

| Level | Sections | Fitur |
|---|---|---|
| 1 · Core | A/B/C/D/E/F/G | 55 |
| 2 · Smart | H/I/J/K/L/M | 42 |
| 3 · Intelligence | N/O/P/Q | 28 |
| 4 · Enterprise | R/S/T/U | 23 |
| 5 · God Mode | V/W/X/Y/Z/AA | 39 |
| **Total** | | **187** |

---

## Priority Matrix

### MUST HAVE (tanpa ini ga bisa dipakai)
`A01-A03` · `B01-B04, B09` · `C01-C04, C06` · `D01-D03` · `E01-E07` · `F01-F07` · `G01`

### SHOULD HAVE (bikin experience bagus)
`A05` · `B05-B08` · `C05, C07-C10` · `D04-D06` · `E08-E09`
`H01-H10` · `I01-I03` · `L01-L05` · `M01-M04`

### NICE TO HAVE (upgrade bertahap)
`I04-I06` · `J01-J07` · `K01-K05` · `L06-L07` · `M05-M06`
Level 3/4/5 semua

---

## Architecture Principles (harga mati)

1. **Modular per fitur** — 1 file 1 concern. Tidak ada monolith >500 lines.
2. **Registry pattern** — fitur baru = append entry ke registry, core tidak disentuh.
3. **Config-driven** — behavior lewat Firestore overlay, zero `switch(table)`.
4. **Pure fn + hooks + dumb components** — 3-layer separation.
5. **Typed contracts** — satu source of truth per domain di `types.ts`.
6. **Testable** — pure fn unit test, hooks mockable, components snapshot.
7. **Observable** — structured logs `[workspace:<module>]`.
8. **Feature-flagged** — Level 1 first, higher levels gated via FS flag.

## File Structure Target

```
src/app/data-workspace/
├── layout.tsx                       overlay shell
├── login/page.tsx                   auth gate
├── page.tsx                         landing (empty state + hints)
├── [dataset]/page.tsx               dataset hub
├── [dataset]/[table]/page.tsx       grid editor
└── _components/
    ├── WorkspaceShell.tsx           chrome composition
    ├── WorkspaceTopBar.tsx          top bar
    ├── DatasetTree.tsx              sidebar tree
    └── features/                    one folder per Level/Section

src/lib/workspace/
├── types.ts                         CategoryMeta, ColumnMeta, etc.
├── category-resolver.ts             pure fn (convention → fallback)
├── category-registry.ts             FS onSnapshot hook
├── column-types-registry.ts         B04: per-type editor/renderer registry
├── dropdown-resolver.ts             E: fixed/reference/cascade/multi
├── formula-engine.ts                N: parser + evaluator
├── conditional-rules.ts             O: rule evaluator
├── validation-registry.ts           L: validator registry
├── permission-guards.ts             R: RBAC enforcement
└── plugin-registry.ts               Z: plugin register + lookup

src/app/api/workspace/
├── auth/                            login/logout
├── meta/datasets/[id]/              category + alias PATCH
├── tables/[ds]/[t]/
│   ├── schema/                      get + PATCH overlay
│   ├── rows/                        CRUD + batch
│   ├── columns/[name]/              ALTER + overlay
│   └── export/                      server-side export
├── refs/                            FK lookup + cascade
├── formulas/eval/                   server-side formula eval
├── audit/                           log query
└── locks/                           page lock TTL
```

---

## Rollout Plan

**Sprint 1-3 (Level 1 Core):** Fondasi — sidebar sections, column types registry, dropdown system, draft mode, localStorage persistence. Target: operator bisa input data real.

**Sprint 4-6 (Level 2 Smart):** Import/Export proper, inline edit Excel-grade, validation framework. Target: produktivitas operator 3×.

**Sprint 7-10 (Level 3 Intelligence):** Formula engine, conditional rules, views saved filter. Target: zero-coding kustomisasi per tabel.

**Sprint 11-14 (Level 4 Enterprise):** RBAC, audit trail, approval workflow, concurrency. Target: multi-user produksi aman.

**Sprint 15-20 (Level 5 God Mode):** Triggers, scheduled actions, reports, GCS files, plugins, API. Target: platform self-operating.

---

**Last updated:** 2026-04-24
**Source:** sesi Claude Desktop · canonical spec
