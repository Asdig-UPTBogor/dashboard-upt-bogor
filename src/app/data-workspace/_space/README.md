# Space — Data Workspace Editor (TanStack Table v8)

> God-mode editor untuk satu BQ table. Replacement untuk legacy `MasterGrid`
> (`src/app/data-input/_workspace/MasterGrid.tsx`, 1066 lines monolith).
>
> Stack: **TanStack Table v8** (headless) + **react-virtual v3** + **Zod**.
> Style: **CE Next Level** (cool slate + amber primary) via `ds-*` tokens.

---

## Mengapa refactor

`MasterGrid` lama (4892 lines spread di 20 files) udah ga scalable:
- State + render + business logic campur dalam 1 file
- Edit fitur baru = sentuh banyak tempat
- React-data-grid 7.x rigid (style fight, type weak)
- 187 fitur target di roadmap → butuh foundation modular

**Goal**: foundation yang scalable untuk 187 fitur lewat plugin pattern.

---

## Quick start

Toggle via URL flag:

```
/data-workspace/Master_Data/Bay              → MasterGrid (legacy)
/data-workspace/Master_Data/Bay?v=space      → Space (TanStack v8)
```

Side-by-side AB testing tanpa redeploy.

---

## Arsitektur

```
_space/
├── Space.tsx                  ← Orchestrator (200 lines, ZERO business logic)
├── core/
│   ├── meta.d.ts              ← Module augmentation (TableMeta, ColumnMeta)
│   ├── space-tokens.ts        ← Numeric constants (row height, padding)
│   ├── useSpaceColumns.ts     ← ColumnSchema → ColumnDef[] transform
│   └── useSpaceTable.ts       ← useReactTable instance + persisted state
├── editors/                   ← Cell editors (Phase 2+)
├── renderers/
│   └── CellRenderer.tsx       ← Display formatters per type
├── ui/
│   ├── SpaceToolbar.tsx       ← Search, refresh, columns, export, new
│   ├── SpaceContainer.tsx     ← Virtualized grid (react-virtual)
│   ├── SpaceHeaderCell.tsx    ← Sort indicator, resize handle, drag (future)
│   ├── SpaceBodyCell.tsx      ← Cell wrapper (right-align numbers, etc)
│   └── SpaceStatusBar.tsx     ← Footer: row count, dirty, save
└── features/                  ← Hooks per kapabilitas (Phase 2+)
    └── (useDirtyState, useBatchSave, useUndoRedo, etc)
```

### Filosofi modular

- **Single responsibility per file** → debug langsung tau lokasi bug
- **Loose coupling** → tambah fitur = tambah module, bukan modify existing
- **Type contracts ketat** → `TableMeta` + `ColumnMeta` augmentation = compile-time check
- **Native-first** → pakai TanStack hooks built-in, custom hanya kalau benar-benar perlu

### Yang TanStack handle native (jangan re-implement)

| Fitur | TanStack hook |
|---|---|
| Sort multi-column | `getSortedRowModel`, `column.getToggleSortingHandler()` |
| Filter (global + per-column) | `getFilteredRowModel`, `setColumnFilters` |
| Pagination | `getPaginationRowModel`, `setPagination` |
| Row selection (multi/indeterminate) | `enableRowSelection`, `row.getToggleSelectedHandler()` |
| Column pin (left/right) | `column.pin`, `getStart("left")`, `getAfter("right")` |
| Column visibility | `column.getToggleVisibilityHandler()` |
| Column resize | `header.getResizeHandler()`, `columnResizeMode: "onChange"` |
| Column ordering | `setColumnOrder()` |

### Yang kita custom build di atas TanStack

| Fitur | Lokasi |
|---|---|
| Editor types (CHOICE/CASCADE/REFERENCE/FILE) | `editors/` (Phase 2+) |
| Display formatters per type | `renderers/CellRenderer.tsx` |
| Dirty state + localStorage draft | `features/useDirtyState.ts` (Phase 2) |
| Batch save (POST /rows/batch-upsert) | `features/useBatchSave.ts` (Phase 2) |
| Validation (Zod-based per kolom) | `features/useValidation.ts` (Phase 4) |
| Formula engine (HyperFormula) | `features/useFormula.ts` (Phase 6 — Level 3) |
| Conditional rules | `features/useConditionalRules.ts` (Phase 6 — Level 3) |
| Audit history panel | `panels/AuditPanel.tsx` (Phase 5 — Level 4) |
| Page lock + heartbeat | `features/useRowLock.ts` (Phase 5 — Level 4) |
| Plugins (custom column type) | `plugins/` (Phase 7+ — Level 5) |

---

## Module augmentation pattern

`core/meta.d.ts` extend TanStack types untuk:

**TableMeta** (action callbacks shared antar cell):
```ts
updateCell, commitRow, refresh, isDirty, getError, getOriginalValue,
columnSchemas, readOnly, density
```

**ColumnMeta** (per-kolom metadata):
```ts
editor, formatter, choices, cascade, reference, file, validation,
required, formula, conditional, permission, schema
```

Tambah field baru di sini = type-safe di seluruh consumer.

---

## File upload (Phase 5+)

Schema sudah disediakan via `ColumnMeta.file`:

```ts
{
  editor: "FILE",
  file: {
    bucket: "wagate-media",      // GCS bucket
    accept: ["image/*", "application/pdf"],
    maxSize: 10_485_760,         // 10MB
    multi: false,                // single file per cell
  }
}
```

Render: `renderers/CellRenderer.tsx → FileCell` (filename + icon).
Editor (Phase 5): `editors/FileEditor.tsx` → upload via `/api/workspace/upload`
→ resolve ke GCS path → store path di cell value.

Pattern follow ekosistem (lihat `Dispatch/src/lib/gcs-fetch.ts` + `wagate-media`).

---

## State persistence

Per-table user preferences di localStorage (key: `dw:space:prefs:<dataset>:<table>`).
Persisted: sort, filter, pinning, visibility, ordering, sizing, pagination, search.

Reset via `useSpaceTable.resetPrefs()`.

---

## Phase roadmap

| Phase | Scope | Estimate |
|---|---|---|
| **0 — Setup** ✅ | Install deps, scaffold structure | done |
| **1 — Display** ✅ | Read-only render, sort/filter/pin/virt/select | done |
| **2 — Edit + Save** | Editor router, dirty state, batch save | 4-5h |
| **3 — Dropdown system** | CHOICE, CASCADE, REFERENCE editors | 3-4h |
| **4 — Power UX** | Keyboard nav, undo, copy/paste, per-col filter | 4-5h |
| **5 — Migration cutover** | Parity test → switch flag → remove MasterGrid | 2-3h |
| **6+ — Iterative** | Formula, validation, audit, lock, plugins | per kebutuhan |

---

## Convention untuk kontributor

1. **Style**: WAJIB pakai `ds-*` tokens dari `globals.css` + Tailwind utility. JANGAN hardcode hex/rgb. Match `WORKSPACE_DESIGN_LANGUAGE.md` grammar.
2. **Naming**: `Space*` prefix (SpaceToolbar, SpaceContainer, dll).
3. **Type safety**: extend `TableMeta`/`ColumnMeta` di `meta.d.ts`, jangan hand-roll generic.
4. **Komentar**: minimal, hanya kalau WHY non-obvious. JANGAN narrate WHAT.
5. **Test path**: tambah ke `?v=space` flag, validasi side-by-side dengan MasterGrid.

---

**Last updated**: 2026-04-25 (Phase 1 complete)
