# Space — Test Checklist (v0 user-facing)

> Buka URL apapun: `/data-workspace/[dataset]/[table]` (default Space, no flag).
> Tabel besar sebagai recommended test bed: `Master_Transmisi_UPT_Bogor/n_5_HEALTHY_INDEX_TOWER` (1637 rows, 25 cols).

## A. Header / Title
- [ ] Header tampil di atas: icon Table2 + alias table (orange) + "edit alias" pencil button (hover)
- [ ] Subtitle mono `dataset.table` + label `read-only` kalau platform table
- [ ] Description (kalau ada di overlay)
- [ ] Stats meta strip: rows · cols · PK · level · kind

## B. Toolbar (Row 1)
- [ ] Search input di kiri — ketik realtime filter
- [ ] X clear search muncul saat ada query
- [ ] Counter "N rows · M selected" (selected appears amber kalau ada)
- [ ] Tombol Columns3 → toggle drawer ColumnSidePanel
- [ ] Tombol ColumnsIcon (kalau bukan readonly) → AddColumnModal
- [ ] Tombol Upload (kalau bukan readonly) → BulkImportPanel
- [ ] Tombol Download → ExportMenuPopup (CSV/XLSX/PDF)
- [ ] Tombol Refresh → reload data (loading spinner saat fetch)
- [ ] Tombol "+ New row" amber (kalau onCreateRow ada) → open RowFormModal

## C. Grid display
- [ ] Sticky header row (44px tinggi)
- [ ] Body rows zebra (genap muted-tinted)
- [ ] Hover row → bg muted/40
- [ ] Selected row → bg primary/10
- [ ] Cell numeric right-align mono tabular
- [ ] Cell BOOL center, ✓ / ─ icon
- [ ] Cell CHOICE → colored chip (badge with dot)
- [ ] Cell URL → primary text + ExternalLink icon, clickable open new tab
- [ ] Cell FILE → FileIcon + filename
- [ ] Cell REFERENCE → mono ID (display name lookup di Phase 5)
- [ ] Empty cell → "—" muted

## D. Sort
- [ ] Klik header label → sort ASC (icon ArrowUp orange)
- [ ] Klik lagi → sort DESC (ArrowDown orange)
- [ ] Klik lagi → unsort (ChevronsUpDown muted)
- [ ] Multi-col: shift+klik header lain — secondary sort
- [ ] Persisted ke localStorage (refresh page → sort kembali)

## E. Filter per kolom
- [ ] Hover header → icon Funnel muncul (opacity-60)
- [ ] Klik Funnel → ColumnFilterPopover muncul di bawah
- [ ] Type-aware:
  - TEXT: input "contains"
  - NUMBER/FLOAT: range min-max
  - DATE: range from-to
  - BOOL: tri-state (true/false/empty)
  - CHOICE/MULTI/REFERENCE: checkbox list dengan search + "Pilih semua/Hapus semua"
- [ ] Filter aktif → Funnel icon orange + bg/10
- [ ] Tombol "Clear" → reset filter
- [ ] Esc / klik luar → close popover

## F. Search global
- [ ] Search box realtime filter semua kolom
- [ ] Combine dengan filter per-kolom (intersect)
- [ ] Counter "N of M rows" kalau filtered

## G. Column management (drawer)
- [ ] Klik Columns3 → drawer slide-in dari kiri 420px wide
- [ ] List kolom: pinned / visible / hidden / fk groups
- [ ] Toggle eye → hide/show kolom
- [ ] Pin L/R buttons → freeze kolom
- [ ] Drag handle → reorder kolom
- [ ] Klik nama kolom → expand inline form: alias, description, BQ type, CHOICE options, REFERENCE picker
- [ ] Save batch → POST `/api/data-input/datasets/[ds]/tables/[t]/columns/overlay`
- [ ] Drawer resizable via drag right edge

## H. Add Column
- [ ] Klik tombol AddColumn (toolbar) → modal "Add column"
- [ ] Field: nama, tipe (STRING/INT/FLOAT/NUMERIC/BOOL/DATE/TIMESTAMP), mode (REQUIRED/NULLABLE), description
- [ ] Optional: "Link ke Master" → otomatis nama jadi `<level>_id` + tipe STRING
- [ ] Submit → ALTER TABLE BQ + Firestore overlay → reload

## I. Add Row (RowFormModal)
- [ ] Klik "+ New row" → modal dengan form per kolom non-readonly
- [ ] Required field marked `*`
- [ ] Editor sesuai type per kolom
- [ ] Submit disabled kalau required kosong
- [ ] Save → POST insert + toast success + close + refresh
- [ ] Cancel/X → close tanpa save

## J. Edit cell (inline)
- [ ] Dblclick cell → editor mount (border orange)
- [ ] Editor type sesuai column.meta.editor:
  - TEXT/RICH_TEXT/URL → input text
  - NUMBER → input number integer (right-align, mono)
  - FLOAT → input number decimal
  - DATE → date picker
  - TIMESTAMP → datetime-local picker
  - BOOL → cycle button (null → true → false)
  - CHOICE → native select
  - CHOICE_CASCADE → select filtered by parent (warning kalau parent kosong)
  - REFERENCE → async combobox dengan search 1000 row dari master table
  - MULTI_SELECT → checkbox popover
  - FILE → upload prompt (placeholder, backend pending)
- [ ] Enter → commit
- [ ] Esc → cancel
- [ ] Blur → commit (kecuali File yg butuh tombol close)

## K. Dirty state + Save
- [ ] Cell edited → border-l amber + bg amber/10
- [ ] Status bar bawah: "K unsaved · [Discard] [Save]"
- [ ] Save → sequential POST per dirty row → toast per batch
- [ ] Auto-refresh setelah save sukses
- [ ] Discard → revert overlay → toast info
- [ ] Refresh page → dirty state restored dari localStorage

## L. Undo / Redo (NEW)
- [ ] Edit cell, lalu Ctrl+Z → revert ke previous value
- [ ] Ctrl+Shift+Z atau Ctrl+Y → redo
- [ ] Edit chain: A→B→C, Ctrl+Z 2x → kembali A, Ctrl+Y 1x → kembali B
- [ ] Stack depth: 50 entries
- [ ] Tidak trigger di dalam input editor focus

## M. Pagination
- [ ] Status bar kanan bawah: "100/page" select dropdown
- [ ] Tombol « ‹ p/N › » navigate pages
- [ ] Disabled kalau di first/last page
- [ ] Pilih 50/100/200/500/1000 per page
- [ ] Persisted ke localStorage

## N. Export
- [ ] Klik Download → menu CSV/XLSX/PDF
- [ ] CSV: filtered visible cols only
- [ ] XLSX: lazy load library xlsx + write file
- [ ] PDF: browser print dialog (placeholder)
- [ ] Toast confirmation per export

## O. Bulk Import
- [ ] Klik Upload → BulkImportPanel modal 5-step
- [ ] Step 1: upload .csv/.xlsx
- [ ] Step 2: header mapping (auto + manual)
- [ ] Step 3: preview 5 row
- [ ] Step 4: pilih mode INSERT/UPSERT/REPLACE
- [ ] Step 5: validation + import → BQ
- [ ] Done → close + refresh

## P. Row selection
- [ ] Visual: kolom select belum tampil di grid (Phase 5 add column)
- [ ] State tersedia (table.getSelectedRowModel) → bisa di-extend
- [ ] Counter "M selected" muncul di toolbar saat ada selected

## Q. Read-only mode
- [ ] Kalau config.readOnly = true:
  - Header label "READ-ONLY" tampil
  - Tombol AddColumn / Import / NewRow hilang
  - Cell dblclick disabled, tooltip "Read-only"

## R. Style + theme
- [ ] CE Next Level palette: cool slate bg `#0b0d10` · card `#12151a` · amber primary `#f3c14b`
- [ ] Semua dengan `ds-*` tokens (ds-interactive, ds-press, ds-focus, ds-transition, ds-label, ds-small)
- [ ] Font: Geist body, JetBrainsMono numbers
- [ ] No hardcoded colors

## S. Performance
- [ ] Buka tabel besar (Thermovisi 15994 rows) — scroll smooth via virtualization
- [ ] Resize kolom — instant feedback
- [ ] Edit cell tabel besar — no lag

## T. Persistence
- [ ] localStorage key `dw:space:prefs:<ds>:<tbl>` — sort/filter/pin/vis/order/size/page/search
- [ ] localStorage key `dw:space:draft:<ds>:<tbl>` — pending dirty edits
- [ ] Refresh page → state restored
- [ ] Clear via DevTools → reset

---

## Deferred (post-Phase 4)

- ⏳ Keyboard arrow navigation antar cell (hook ready, wiring belum)
- ⏳ Copy-paste range Excel-style (Phase 5)
- ⏳ Inline alias edit di header (button placeholder ready, save logic Phase 5)
- ⏳ Row right-click context menu (archive/duplicate)
- ⏳ FILE upload backend `/api/workspace/upload` (placeholder editor ready)
- ⏳ REFERENCE async resolve display name di CellRenderer (sekarang masih show ID)
- ⏳ CHOICE_CASCADE parent value lookup (sekarang fallback "pilih parent dulu")
- ⏳ Audit panel (history per row)
- ⏳ Page lock + heartbeat (concurrent edit)
- ⏳ Formula engine (HyperFormula, Level 3)
- ⏳ Conditional rules (Level 3)
- ⏳ Plugin system (Level 5)

---

## Yang harus DI-CEK MANUAL

1. Buka `/data-workspace/Master_Transmisi_UPT_Bogor/n_14_LM_JARINGAN_2026` (35 row, master)
2. Buka `/data-workspace/Master_Transmisi_UPT_Bogor/n_5_HEALTHY_INDEX_TOWER` (1637 row, scroll test)
3. Buka `/data-workspace/thor_vaisala/strikes` atau dataset lain untuk test non-Master_Data
4. Test edit, undo, redo, save
5. Test filter per kolom (Funnel icon)
6. Test pagination (status bar bawah)
7. Test column drawer (alias, pin, hide)
8. Test add row
9. Test export CSV
10. Inspect localStorage (DevTools → Application → Local Storage)
