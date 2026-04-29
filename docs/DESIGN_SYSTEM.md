# Dashboard UPT Bogor — Design System v1.0

> **LOCKED 2026-04-27.** Single source of truth untuk semua page dashboard.
> Reference page: `/transmisi/lm-jaringan/` (golden standard).
> Untuk update rules: edit file ini + sync ke `CLAUDE.md` section "🎨 DESIGN SYSTEM v1.0".

---

## 0. Filosofi

Dashboard ini **UI/UX bertarget operator non-technical PLN**. Visual harus:

- **Konsisten** — pattern sama lintas 40+ page
- **Hierarki jelas** — primary KPI lebih besar dari secondary
- **Color-coded** — hijau (selesai), oranye (on progress), biru/amber (panel accent)
- **Smooth motion** — transition + hover + click feedback halus
- **Token-driven** — zero hardcode, semua dari CSS var
- **Theme-aware** — light + dark mode semua color konsisten

---

## 1. Token Reference

### 1.1 Surface (background ladder)
```
var(--bg-0)   — page background (paling gelap di dark / paling terang di light)
var(--bg-1)   — card background
var(--bg-2)   — secondary surface (table header, subtle highlight)
var(--bg-3)   — tertiary (mostly unused, badge bg)
```

### 1.2 Foreground (text ladder)
```
var(--fg-0)   — primary text (heading, value)
var(--fg-1)   — body text
var(--fg-2)   — secondary text (label, caption)
var(--fg-3)   — muted (disabled, decorative)
```

### 1.3 Border / Line
```
var(--line)     — default border, divider
var(--line-2)   — stronger border (hover state, focus)
```

### 1.4 Status / Condition (data viz colors, sama di light + dark)
```
var(--cond-very-good)   — #3ecf8e — Selesai / target tercapai
var(--cond-good)        — #8dd884 — On track
var(--cond-fair)        — #f3c14b — Progress
var(--cond-poor)        — #f08a3e — On Progress / belum tercapai
var(--cond-critical)    — #e5484d — Alert / error
```

**Aturan pakai:**
- `Selesai` di bar/badge → `cond-very-good`
- `On Progress` (belum selesai) → `cond-poor`
- Threshold-based color (`getPctColor(pct)`):
  - ≥75% → `#5b8def` (biru — excellent)
  - ≥50% → `cond-very-good` (hijau)
  - ≥25% → `cond-fair` (amber)
  - >0% → `cond-poor` (oranye)
  - 0%/no data → `cond-critical` (merah) atau `fg-3`

### 1.5 Domain Accent (panel-specific)
```
var(--color-abo)            — #5b8def — Anti Blackout (biru)
var(--color-ps)             — #f3c14b — Program Strategis (amber)
var(--color-ultg-bogor)     — #5b8def — ULTG Bogor (biru)
var(--color-ultg-sukabumi)  — #f08a3e — ULTG Sukabumi (oranye)
var(--accent-amber)         — #f3c14b — primary accent (button, focus, highlight)
```

### 1.6 Spacing
```
var(--space-stack)      — 12px — gap antar sibling card (space-y-3 equivalent)
var(--space-grid-gap)   — 12px — gap antar grid cell
var(--space-card-pad)   — 20px — padding default Card body
var(--space-section)    — 24px — gap antar major sections
```

### 1.7 Radius / Shadow / Font
```
var(--r-sm)             — 6px  — small elements (button, badge, segment)
var(--r-md)             — 10px — chip, control
var(--r-lg)             — 14px — Card

var(--shadow-1)         — Card shadow

var(--font-sans)        — Inter
var(--font-mono)        — JetBrains Mono (numbers, code)
```

---

## 2. Utility Classes (di `globals.css`)

```
.num                — tabular numerals + mono font
.ds-led-dot         — LED pulse indicator (9x2 px, set color via inline)
.ds-scroll-accent   — custom thin scrollbar (set --scroll-color via inline)
.ds-heading         — H1 page (24/700)
.ds-body            — body text 14/400 muted
.ds-label           — label 12/500
```

**Cara pakai LED dot:**
```tsx
<span className="ds-led-dot" style={{ color: "var(--cond-very-good)" }} />
<span>Real-time · BQ sync</span>
```

**Cara pakai scrollbar accent:**
```tsx
<div
  className="ds-scroll-accent"
  style={{
    overflowY: "auto",
    ["--scroll-color" as string]: "var(--color-abo)",
  }}
>
```

---

## 3. Layout Template (PATEN untuk semua page)

```tsx
"use client";

import { motion } from "framer-motion";
import { Card } from "@/components/designer/Card";
import { Icon } from "@/components/designer/Icon";

export default function MyPage() {
  return (
    <div className="space-y-3">
      {/* HEADER ROW */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3">
        <div>
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1.5">
            <span>Section</span>
            <Icon name="chevronRight" size={11} />
            <span style={{ color: "var(--fg-0)" }}>Page Title</span>
          </div>
          {/* Title + Subtitle */}
          <h1 className="ds-heading">Page Title</h1>
          <p className="ds-body mt-0.5">Subtitle description</p>
        </div>
        {/* Action toolbar (right) */}
        <div className="flex gap-2 items-center flex-wrap">
          {/* buttons, badges, dropdowns */}
        </div>
      </div>

      {/* GRID 12-COL */}
      <div className="grid grid-cols-12 gap-3">
        <Card style={{ gridColumn: "span 4" }} noPad>
          {/* Card Header — Caption Pattern */}
          <CardCaption>Card Title</CardCaption>
          {/* Card Body */}
          <div style={{ padding: "var(--space-card-pad)" }}>
            {/* content */}
          </div>
        </Card>
      </div>
    </div>
  );
}

function CardCaption({ children }: { children: string }) {
  return (
    <div
      style={{
        padding: "16px 20px",
        borderBottom: "1px solid var(--line)",
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <span style={{ width: 16, height: 1.5, background: "var(--fg-3)" }} />
      <span
        style={{
          fontSize: 11,
          color: "var(--fg-0)",
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          fontWeight: 600,
        }}
      >
        {children}
      </span>
    </div>
  );
}
```

---

## 4. Component Patterns

### 4.1 Caption Header (caption-row pattern)
```
── PAGE TITLE  ●Real-time · BQ sync
```
- Dash 16x1.5px background `var(--fg-3)`
- Text uppercase 11px letterSpacing 0.12em weight 600 color `var(--fg-0)`
- LED indicator (optional): `.ds-led-dot` di kanan

### 4.2 KPI Stack (vertical metric)
```
23.504              ← num size 64-44, weight 600, color fg-0 / accent
Item Pekerjaan      ← label 12.5px / weight 500 / fg-1
Sublabel (opt)      ← 11px / fg-3
```

### 4.3 Segmented Progress Bar
```
[████ 40% hijau ][░░░░░░░░ 60% oranye ]
        Selesai 4.897        On Progress 18.607
```
- Bar height 8px (thin) atau 32px (thick with inside labels)
- Gap 4px antar segment
- Border-radius outer corners only (`999px 0 0 999px` left + `0 999px 999px 0` right)
- Legend: `flex pct/pctOpen 1 0` proporsional sejajar di bawah segment
- Threshold label inside: ≥10% (kalau bar thick)

### 4.4 ULTG Row (clickable filter row)
```
ULTG Bogor    ABO: 3 Item · PS: 2 Item · 2.711 / 13.024 item
[bar 32px]
Selesai 2.711       On Progress 10.313
```
- Click → toggle filter aktif
- Hover: bg accent 6% + inset border accent 30%
- Active: bg accent 10% + inset border 1px accent
- Dimmed (other ULTG saat filter aktif): opacity 0.5

### 4.5 Hero Panel (golden ratio layout)
```
[Total Item   |  Anti Blackout  |  Program Strategis ]
   1.618fr       1fr               1fr
```
- 3 panel side-by-side dalam 1 Card
- Panel divider: 1px gradient line
- Panel kiri (Total/highlight): primary stats, larger typography
- Panel kanan: 2-stack KPI dengan label + sublabel
- Click filter activates panel-specific accent + dim others

### 4.6 Click-to-Filter Hint (hover)
- Position: absolute bottom-right corner
- Icon: mouse rectangle (`<rect x=6 y=3 w=12 h=18 rx=6 />` + `<line x=12 y=7 to y=11 />`)
- Text: "Click to filter", fontSize 9.5, color accent, letterSpacing 0.04em
- Visible only on hover (not when active/dimmed)

### 4.7 Animation (framer-motion)
- Card layout transition: `<motion.div layout transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}>`
- Enter/exit (AnimatePresence): `initial: {opacity: 0, scale: 0.97}` → `animate: {opacity: 1, scale: 1}` → `exit: {opacity: 0, scale: 0.97}`
- Theme transition: GLOBAL via globals.css (smooth 0.3s cubic-bezier)

### 4.8 Active vs Hover State
- **Hover** (clickable): bg subtle accent (6-10%) + inset border accent (30-35%) + cursor pointer
- **Active** (selected): bg accent (10-14%) + inset border 1px solid accent
- **Dimmed** (filter applied to other): opacity 0.5
- Transition: 0.25s ease pada bg + box-shadow

---

## 5. Component Library (di `src/components/designer/`)

```
Card        — wrap content with bg, border, radius, shadow
Badge       — pill with tone (neutral/very-good/good/fair/poor/critical)
Button      — Btn (ghost/primary/subtle) + IconBtn (square)
Tabs        — underline tabs with count badge
Icon        — inline SVG (grid/target/calendar/zap/shield/etc)
StackedBar  — horizontal segmented bar with legend
```

**Import:** `import { Card } from "@/components/designer/Card";`

---

## 6. Anti-Pattern (LARANGAN KERAS)

```
❌ Hardcode hex                       ✅ var(--color-abo) etc
❌ Custom padding/spacing per page    ✅ var(--space-*)
❌ shadcn Card raw (no override)      ✅ designer Card / shadcn-with-override
❌ Mix Tailwind class + inline style  ✅ pick one paradigm per element
❌ Bikin pattern baru tanpa konsultasi ✅ Update DESIGN_SYSTEM.md dulu
❌ Animation custom timing             ✅ Reuse existing duration
❌ Chart library lain                  ✅ ECharts + chart-tokens.ts
❌ Skip type check                     ✅ Run `npx tsc --noEmit` per iter
```

---

## 7. ECharts Theme

ECharts canvas-based (tidak bisa pakai CSS var), wajib pakai token dari `src/lib/chart-tokens.ts`:

```ts
import {
  ECHART_COLORS, ECHART_FONT, CHART, getTooltipPreset
} from "@/lib/chart-tokens";

// Color: ECHART_COLORS[themeKey] (dark/light)
// Font:  ECHART_FONT.label (12), .data (14), .kpi (18), .hero (28)
// Donut: CHART.donut (radius, padding, label, animation)
// Tooltip: getTooltipPreset(themeKey)
```

---

## 8. Workflow Page Baru (urut)

1. **Baca page reference**: `/transmisi/lm-jaringan/_components/LmJaringanContent.tsx`
2. **Copy layout template** dari section 3 di atas
3. **Ganti data + label** sesuai konteks page (misal Gardu Induk)
4. **Pakai komponen** dari `/components/designer/` — JANGAN bikin custom
5. **Pakai token CSS var** — JANGAN hardcode hex/spacing
6. **Animation** pakai framer-motion `<motion.div layout>` kalau ada layout shift
7. **Type check**: `cd dashboard && npx tsc --noEmit`
8. **Update memory** + page list kalau ada pattern baru

---

## 9. File Reference

```
src/app/globals.css                             — token + utility CSS
src/components/designer/                         — Card, Badge, Btn, Icon, dll
src/lib/chart-tokens.ts                         — ECharts theme token
src/app/transmisi/lm-jaringan/                  — REFERENCE PAGE (golden std)
  _components/LmJaringanContent.tsx             — main composition
  _components/v2/HeroLM.tsx                     — Hero pattern
  _components/v2/UltgProgressCard.tsx           — segmented bar + ULTG row
  _components/v2/ProgramListBars.tsx            — single-fill bar list
  _components/v2/DataTableLM.tsx                — table pattern (kolom span/group)
  _components/v2/ProgramListHeader.tsx          — caption split-color
```

---

## 10. Changelog

- **v1.0 (2026-04-27)** — Locked. Program Kerja Transmisi jadi golden standard.
  - Token: surface, foreground, line, condition, domain accent, spacing, radius, shadow, font
  - Utility: .num, .ds-led-dot, .ds-scroll-accent, ds-heading/body/label
  - shadcn Card override global
  - Theme transition smooth 0.3s
  - Layout template: space-y-3 + grid-cols-12 gap-3
  - Component lib: Card, Badge, Button, Icon, Tabs, StackedBar
  - Pattern: Caption row, KPI stack, Segmented bar, Hero panel, Click filter hint
