# MasterGrid Decomposition Blueprint

**Date:** 2026-04-24
**Current size:** ~1853 lines monolith
**Target:** `MasterGrid.tsx` < 400 lines (thin orchestrator)

## File Tree Target

```
_workspace/
├── MasterGrid.tsx              orchestrator < 400 baris
├── grid-utils.ts               pure utils: estimateWidth, formatRelativeTime, formatDate
├── cell-renderers.tsx          renderCellView + renderEditor dispatchers
├── cell-editors.tsx            Bool/Number/Choice/Reference editors
├── ExportMenuPopup.tsx         export popup + item
├── ColumnHeaderPopover.tsx     cascading menu + entry type + PopoverItem
├── HeaderCellMinimal.tsx       header cell + SortIconButton
├── hooks/
│   ├── useSortState.ts         sortColumns + toggleSort + sortRows (__ancestor_ aware)
│   ├── useColumnFilters.ts     filters + search + filteredRows
│   ├── useDraftMode.ts         dirty + undo/redo + save/discard + copy/paste/fill
│   └── useCellSelection.ts     selectedRows + handleCellClick
```

## Execution Order (12 steps)

1. `grid-utils.ts` — cut utils
2. `cell-editors.tsx` — cut Bool/Number/Choice/Reference
3. `cell-renderers.tsx` — cut renderCellView/renderEditor
4. `HeaderCellMinimal.tsx` — cut + SortIconButton
5. `ColumnHeaderPopover.tsx` — cut + PopoverItem
6. `ExportMenuPopup.tsx` — cut + ExportMenuItem
7. `hooks/useCellSelection.ts` — extract selection state + click toggle
8. `hooks/useSortState.ts` — extract sort + toggle + sortRows
9. `hooks/useColumnFilters.ts` — extract filters + search + filteredRows
10. `hooks/useDraftMode.ts` — extract dirty/undo/redo/save (biggest step)
11. Verify `MasterGrid.tsx` < 400 lines
12. E2E smoke test

Typecheck after each step. Commits atomic per step.

## Risks

- **R1 closure stale di useDraftMode** → pakai functional updater konsisten (`setRows(prev => ...)`)
- **R2 showToast ref identity** → wrap useCallback BEFORE passing ke hook
- **R3 handleCellKeyDown split** → MasterGrid compose 2 handlers dari useCellSelection + useDraftMode
- **R4 rdgColumns dep graph** → tetap di MasterGrid (junction semua hooks)
- **R5 editor hooks (useState)** → pastikan tetap React component JSX, bukan plain call
- **R6 MasterConfig circular import** → pindahkan ke `types.ts` sebelum Step 10

## Deferred (iter berikutnya)

- Split cell-editors per-file (Bool.tsx / Number.tsx) — muat 1 file sekarang
- `buildColumnMenuSections` sebagai registry factory — defer sampai > 5 entries
- Virtual ancestor columns sebagai modul — defer
- `useRefOptions` hook — defer

## Module Contracts (abbreviated)

```ts
// hooks/useSortState.ts
export function useSortState(): {
    sortColumns: readonly SortColumn[];
    setSortColumns: React.Dispatch<React.SetStateAction<readonly SortColumn[]>>;
    toggleSort: (key: string, shift: boolean) => void;
    sortRows: (rows: RowData[]) => RowData[];
}

// hooks/useColumnFilters.ts
export function useColumnFilters(rows, columns, refLookup): {
    filters: Record<string, SheetFilter>;
    setFilter: (f: SheetFilter | null) => void;
    clearAllFilters: () => void;
    filteredRows: RowData[];
    search: string;
    setSearch: (v: string) => void;
}

// hooks/useDraftMode.ts
export function useDraftMode(config, columns, serverRows, selectedRows,
    onUpdateRow, onArchiveRow, onRefresh, showToast
): { rows, dirtyMap, pendingCount, saving, stagingRow,
    handleRowsChange, handleCellCopy, handleCellPaste, handleFill,
    markDeleted, saveChanges, discardChanges, rowClass }

// hooks/useCellSelection.ts
export function useCellSelection(primaryKey: string): {
    selectedRows: Set<string>;
    setSelectedRows: React.Dispatch<React.SetStateAction<Set<string>>>;
    handleCellClick: (args, event) => void;
}
```

Full blueprint: lihat arsitek output di task id ac088b2cb35b94c2a.
