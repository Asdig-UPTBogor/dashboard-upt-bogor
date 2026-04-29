# Workspace Design Language — "Cold Enterprise Monochrome"

> Extension dari [CE Next Level design system](./claude-designer/DESIGN_SYSTEM.md).
> CE Next Level define **visual tokens** (palette, typography). Dokumen ini define
> **interaction grammar** — bagaimana user nge-interact dengan UI: hover states,
> inline editing, menu discipline, sidebar behavior, dll.
>
> **Untuk agent lain:** kalau user bilang "pakai style workspace sidebar",
> baca 2 file sekaligus:
>   1. `docs/claude-designer/DESIGN_SYSTEM.md` — colors, fonts, tokens
>   2. `docs/WORKSPACE_DESIGN_LANGUAGE.md` (file ini) — interaction rules
>
> Reference fisik hasil jadinya: `src/app/data-workspace/_components/DatasetTree.tsx`.

---

## 1. DNA

3 prinsip yang membedakan "Workspace Style" dari generic dashboard:

1. **Monochrome slate dengan 1 accent** — cool slate bg (`#0b0d10` dark / `#f6f7f9` light),
   amber (`#f3c14b`) sebagai SATU-SATUNYA accent warna. Tidak ada emerald/blue/purple
   random. Destructive tetap red tapi subtle. Success tidak perlu warna — pakai ✓ icon.

2. **Hover-to-reveal controls** — idle state = clean (zero chrome). Action buttons
   (edit/delete/menu/grip) `opacity-0 group-hover/xxx:opacity-60`. User lihat DATA
   dulu, kontrol hanya muncul saat intent.

3. **Inline over modal** — rename, reorder, assign via sidebar/row langsung.
   Modal HANYA untuk create wizard multi-step (new dataset/new table/import).

---

## 2. Color Semantic

| Color | Where | Why |
|---|---|---|
| `text-muted-foreground` | default idle text, label, icon | nampak tapi tidak teriak |
| `text-primary` (amber) | hover state, active state, selected item, emphasized section | "I'm here / I'm selected" |
| `text-destructive` | archive/delete only | destructive CTA |
| `text-foreground` | editable text input content | full opacity baca saja |

**Aturan emas:** kalau ada 3 warna berbeda dalam 1 region → revisi. Pasti 1 salah.

---

## 3. Chrome Height (Grid Alignment)

Shared constant: `WORKSPACE_CHROME.ROW_HEIGHT_PX = 44`.

TopBar 44px ↔ Sidebar header 44px ↔ (future toolbar) 44px.
Horizontal rules aligned otomatis. Divider vertikal antara brand cell ↔ sidebar
body = divider antara main topbar column ↔ sidebar. Visually grid-aligned.

**Aturan:** Tambah chrome row baru (toolbar di main area, filter bar, dll)
= PAKAI `WORKSPACE_CHROME.ROW_HEIGHT_PX`. Magic number 40/48/50 → reject.

---

## 4. Sidebar Grammar

### Structure
```
┌──────────────────────────────────────┐
│ [label] [hover-icons …] [counter]    │  ← Row height = ROW_HEIGHT_PX
├──────────────────────────────────────┤
│ 🔍 Filter…                            │  ← Search (always visible)
├──────────────────────────────────────┤
│ ▸ Section label ──────────  N   [⋯]  │  ← Collapsed by default
│ ▾ Section label ──────────  N   [⋯]  │  ← Expanded = amber accent
│    item                              │
│    item                              │
└──────────────────────────────────────┘
```

### Rules

**R1. Section header:**
- `[chevron] [label] [━━━ fill line ━━━] [count] [kebab ⋯]`
- NO drag grip icon (moved to menu item "Move up/down")
- Label = `ds-label` tokens
- Count = `ds-small font-mono tabular-nums`
- Fill line antara label dan count = `h-px bg-border/40`
- Label + line berubah amber saat: expanded ATAU hovered
- Kebab hover-revealed (opacity-0 → 60 on hover)

**R2. Item row:**
- `[chevron] [icon] [label]                 [hover: grip ⋮⋮] [action +]`
- chevron untuk expand children (tables, etc)
- icon subtle (`text-muted-foreground opacity-60`)
- label click = navigate
- grip icon RIGHT side (dekat action button), hover-revealed
- action `+` untuk create-inside (new table in dataset), hover-revealed

**R3. Collapse-by-default:**
Pas first-load semua section collapsed. User expand manual.
Alasan: cognitive load. User yang baru buka sidebar harus bisa scan kategori
dulu sebelum drill down.

**R4. Empty section = hidden:**
Section tanpa item ga di-render. Jangan nyampah visual.
Uncategory section juga hide kalau tidak ada orphan. Show HANYA sebagai
attention signal "ini perlu assign".

---

## 5. Interaction Patterns

### 5a. Inline Rename
Double-click label → transform ke `<input autoFocus>`. Enter commit, Esc cancel, blur commit.
JANGAN popup rename modal.

### 5b. Drag-to-Assign
Grip icon (hover-revealed) = drag handle. User drag item → drop ke section header
yang jadi droppable zone. `@dnd-kit` `useDraggable` + `useDroppable`.
DragOverlay portal ke `document.body` dengan `zIndex: 10000` (hindari clipping).

**Penting:** Original item TIDAK pakai `transform` saat drag. Hanya `opacity: 0.35`
sebagai placeholder. DragOverlay yang travel ikut cursor.

### 5c. Kebab Menu
Hover-revealed `⋯` (MoreHorizontal) di kanan section header / item.
Click = popover dropdown dengan:
- Primary actions (Rename, Move up/down, Duplicate, etc)
- Separator `border-t`
- Destructive (Archive/Delete, `text-destructive`)

Close via click outside / Esc.

### 5d. Confirm Dialog
Custom themed modal, **bukan** browser native `confirm()`.
Pattern: `await useWorkspace().confirm({ title, description, destructive })`.
Returns Promise<boolean>. Resolves `false` on Esc/backdrop-click/Cancel.

### 5e. Create Inline
New category / new item via small button di akhir list.
Click → expand jadi mini-form (2 input: key + label).
Enter = commit, Esc = cancel. Tidak buka modal.

---

## 6. Write Pattern (Firestore)

**Atomic click action** → direct write (dropdown change, kebab action).
**Continuous input** (text, number) → STAGED + Save button.

| Widget | Pattern | Cost |
|---|---|---|
| Dropdown / select | direct onChange | 1 write/action |
| Text / number input | staged + Save | 1 write / batch |
| Drag-drop | direct onDragEnd | 1 write / drop |
| Checkbox / toggle | direct | 1 write |
| Kebab action (Rename, Archive, Move) | direct | 1 write |

Rationale: continuous input = user "tidak committed" sampai Save. Atomic =
user commit at gesture. Hemat Firestore write quota tanpa sacrifice UX.

---

## 7. Modal Discipline

Modal HANYA untuk:
1. **Multi-step wizard** (new dataset, new table, bulk import)
2. **Destructive confirm** dengan context lengkap
3. **Form kompleks** yang tidak cocok inline (7+ field)

Modal structure: `<Modal open title subtitle icon size>` dari
`src/app/data-workspace/_components/Modal.tsx`.
- Header icon box = `bg-muted/30 border-border/50` (BUKAN amber)
- Header title = `ds-title`
- Close via Esc, backdrop click, X button
- Confirm via Enter (di ConfirmDialog)

---

## 8. Token Usage

Selalu pakai token, **jangan hardcode**:
```ts
// ✅ OK
import { WORKSPACE_CHROME, WORKSPACE_SIDEBAR, WORKSPACE_OVERLAY }
    from "./workspace-tokens";
style={{ height: WORKSPACE_CHROME.ROW_HEIGHT_PX }}

// ❌ NO
style={{ height: 44 }}
style={{ height: "2.75rem" }}
```

```tsx
// ✅ OK — ds-token CSS classes
<h1 className="ds-heading">
<span className="ds-label">
<span className="ds-small font-mono tabular-nums">

// ❌ NO
<h1 className="text-2xl font-bold">
<span className="text-xs uppercase tracking-wider">
```

---

## 9. Responsive

Sidebar resizable (220–560px via drag handle). Widget chain adapt:
- `< 280px` → hide utility labels, icons only
- `< 240px` → tight spacing, count badge truncate
- `< MOBILE_BREAKPOINT_PX (768px)` → sidebar = drawer overlay (slide-from-left), TopBar shows hamburger

### 9a. Sidebar resize-toggle pattern (Notion/Linear style)

Vertical divider antara sidebar ↔ main = **resize handle + center toggle** dalam 1 region.

```
┌── sidebar ──┐│┌── main ──┐
│             │‖│           │
│             │◀│  ← center chevron (h-6 w-6 rounded-full)
│             │‖│              opacity-0 idle, 100 on group-hover
│             │‖│              !100 when collapsed (always visible)
└─────────────┘│└──────────┘
                ↑ full-height drag area (cursor-col-resize)
                  hover: bg-primary/20, drag: bg-primary/30
                  double-click → reset to DEFAULT_PX
```

**Rules:**
- Container: `<div className="relative w-1 shrink-0 group/handle">` (1px wide visual, group host)
- Drag area `absolute inset-y-0 -left-1 -right-1` (3px hit area, easier grab)
- Vertical line `absolute inset-y-0 left-0 w-px bg-border/60`, brightens to `primary/40` on hover, `primary/60` while dragging
- Toggle button absolutely centered (`top-1/2 left-0 -translate-y-1/2 -translate-x-1/2`), rounded-full, `bg-card border-border/70`
- Toggle uses `ds-interactive ds-press ds-focus` utilities
- Icon: `ChevronLeft` when expanded, `ChevronRight` when collapsed
- Toggle hidden by default (`opacity-0`), revealed on `group-hover/handle`, **always visible when collapsed** (`!opacity-100`)
- Old TopBar toggle button = REMOVED. Single source of truth at the divider.

**Why:** divider doubles as control surface — zero floating chrome, intuitive (Notion/Linear pattern), keeps TopBar clean.

---

## 10. Animation Utilities (token-driven)

Idle controls feel dead. Hand-rolled `hover:bg-foo transition-all duration-150` everywhere = inconsistent + unmaintainable. Workspace pakai 4 utility class via `globals.css @layer components`:

| Class | Purpose | When |
|---|---|---|
| `ds-interactive` | Standard hover/active feedback (color, bg, border transitions) + scale(0.97) on active + cursor-pointer | ALL clickable elements |
| `ds-card-hover` | Card lift (translateY -1px) + glow (primary 8%) + border tint (primary 40%) | Cards/tiles |
| `ds-press` | Tactile press scale(0.96) on active | Buttons w/ explicit press feedback |
| `ds-focus` | Accessible focus ring (primary 40% box-shadow, 2px) | Anything keyboard-reachable |
| `ds-transition` | Standard 150ms transition (legacy, prefer ds-interactive) | Custom one-off |

**All driven by tokens** (no hardcoded values):
```css
.ds-interactive {
  transition: color/bg/border/shadow/transform var(--ds-duration-fast) var(--ds-easing-ease-out);
  cursor: pointer;
}
.ds-interactive:hover { background-color: var(--ds-hover); }
.ds-interactive:active { transform: scale(0.97); }
.ds-card-hover:hover {
  background-color: var(--ds-hover);
  border-color: color-mix(in oklch, var(--primary) 40%, transparent);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px color-mix(in oklch, var(--primary) 8%, transparent);
}
```

**Convention:**
- Buttons → `ds-interactive ds-press ds-focus`
- Cards / tiles → `ds-card-hover` (combine with `ds-interactive` if clickable)
- Links inside lists → `ds-interactive ds-press`
- NEVER hand-roll `hover:bg-X transition-Y` — extend `globals.css` instead

Edit token (`--ds-duration-fast`, `--ds-hover`) = entire workspace updates.

---

## 11. Shared Visual Primitives — `WorkspaceUI.tsx`

Setiap page workspace (Overview, Dataset hub, Table editor) WAJIB pakai shared building blocks dari `src/app/data-workspace/_components/WorkspaceUI.tsx`. Edit 1 component → semua page ikut. Zero hardcoded styling per page.

| Primitive | Purpose |
|---|---|
| `<PageShell>` | Container (max-w-5xl mx-auto, padding, vertical spacing) |
| `<PageHeader>` | Title + subtitle + action slot |
| `<SectionHeader>` | Minor heading (uppercase tracking-wider) + optional hint + optional action |
| `<StatRow>` | Horizontal split stats (grid divide-x dalam 1 border container) |
| `<StatCard>` | Single bordered stat tile (alternative when stats stand-alone) |
| `<ActionPill>` | Inline button (icon + label, primary/default variant, busy state) |
| `<ListContainer>` + `<ListRow>` | Divided list (href OR onClick, icon + title + meta + chevron) |
| `<EmptyState>` | "No data" pattern (max-w-md mx-auto, icon + title + description + CTA) |
| `<LoadingState>` | Spinner + label |
| `<ErrorBanner>` | Destructive-tone error tile |
| `<Chip>` | Badge / category chip (default or primary tone) |

**Rule:** kalau butuh card/header/list/stat baru di workspace area → cek dulu di WorkspaceUI. Kalau belum ada, tambah di sana, JANGAN bikin hand-rolled di page.

---

## 12. Group Terminology

UI says **"Group"** (label, modal title: "New group", section: "By group").
Code keeps `category` everywhere (collection `data_workspace_categories`, field `category`, function `resolveCategory`, palette `CATEGORY_PALETTE`).

Reason: rename whole codebase = churn risk. UI label change = cheap.

---

## 13. Observability

```ts
// Structured logs, prefix `[workspace:<module>]`
console.warn("[workspace:registry] onSnapshot error", err);
console.debug("[workspace:sidebar] reorder", { from, to });
```

Error surface:
- Toast (sonner) untuk global
- Inline destructive banner untuk module-local
- Console `console.warn` untuk dev observability

---

## 14. Reference Implementation

Source of truth (baca ini, bukan ngarang):

| Feature | File |
|---|---|
| Sidebar grammar | `src/app/data-workspace/_components/DatasetTree.tsx` |
| Chrome tokens | `src/app/data-workspace/_components/workspace-tokens.ts` |
| TopBar | `src/app/data-workspace/_components/WorkspaceTopBar.tsx` |
| Shell layout | `src/app/data-workspace/_components/WorkspaceShell.tsx` |
| Confirm dialog | `src/app/data-workspace/_components/ConfirmDialog.tsx` |
| Modal primitive | `src/app/data-workspace/_components/Modal.tsx` |
| Realtime hook (onSnapshot) | `src/lib/workspace/useCategoryRegistry.ts` |
| 3-tier resolver pattern | `src/lib/workspace/category-resolver.ts` |
| Shared visual primitives | `src/app/data-workspace/_components/WorkspaceUI.tsx` |
| Animation utilities | `src/app/globals.css` (`@layer components`) |
| Sidebar resize+toggle | `src/app/data-workspace/_components/WorkspaceShell.tsx` (lines ~166-227) |

---

## 15. Prompt Template untuk Agent Lain

Kalau delegate UI work ke agent lain, paste prompt ini:

```
Design requirements:
1. Visual tokens: follow docs/claude-designer/DESIGN_SYSTEM.md (CE Next Level)
2. Interaction grammar: follow docs/WORKSPACE_DESIGN_LANGUAGE.md
3. Reference implementation: src/app/data-workspace/_components/DatasetTree.tsx

Constraints:
- Monochrome slate + amber (`#f3c14b`) ONLY accent
- Chrome height 44px (WORKSPACE_CHROME.ROW_HEIGHT_PX)
- Hover-to-reveal controls (opacity-0 group-hover:opacity-60)
- Collapse-by-default
- Inline > modal (modal only for multi-step wizard)
- Zero hardcoded magic numbers (pakai tokens)
- ds-* classes untuk typography (ds-label, ds-title, ds-small, dll)
- ds-interactive / ds-card-hover / ds-press / ds-focus untuk animasi (NEVER hand-roll hover)
- Pakai primitives WorkspaceUI.tsx (PageShell, PageHeader, ListRow, EmptyState, dll)
```

---

**Last updated:** 2026-04-25
**Pattern name:** "Cold Enterprise Monochrome"
**Inspirations:** Linear (primary), Supabase Studio (structural), Notion (interaction), CE Next Level (tokens), VS Code (spatial hierarchy)
