# Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** Dashboard UPT Bogor
**Generated:** 2026-04-09 22:51:09
**Category:** Smart Home/IoT Dashboard

---

## Global Rules

### Color Palette

| Role | Hex | CSS Variable |
|------|-----|--------------|
| Primary | `#1E40AF` | `--color-primary` |
| Secondary | `#3B82F6` | `--color-secondary` |
| CTA/Accent | `#F59E0B` | `--color-cta` |
| Background | `#F8FAFC` | `--color-background` |
| Text | `#1E3A8A` | `--color-text` |

**Color Notes:** Blue data + amber highlights

### Typography

- **Heading/Body Font:** Inter (--font-sans)
- **Mono Font:** JetBrains Mono (--font-mono) — KPI numbers, data values, code
- **Mood:** dashboard, data, analytics, technical, precise
- **Defined in:** globals.css `--font-sans` and `--font-mono`
- **To change fonts:** update `--font-sans` / `--font-mono` in globals.css → applies to all 32 pages

### Typography Levels (globals.css `ds-*` classes) — v2 GOD MODE

**13 levels — covers ALL use cases. Never hardcode typography in components.**

#### Structural (hierarchy teks)

| # | Class | Size/Weight | Color | Usage |
|---|-------|-------------|-------|-------|
| 1 | `ds-heading` | 24px / 700 | foreground | Judul halaman (1 per page) |
| 2 | `ds-title` | 15px / 600 | foreground | Judul card, section, container |
| 3 | `ds-label` | 13px / 500 | foreground | Label data row, nama item, navigasi |
| 4 | `ds-body` | 13px / 400 | muted | Deskripsi, penjelasan |
| 5 | `ds-small` | 11px / 600 UPPER | muted | Header tabel, kategori |
| 6 | `ds-caption` | 11px / 400 | muted | Keterangan, footnote, pagination info |

#### Data (angka & nilai)

| # | Class | Size/Weight | Font | Usage |
|---|-------|-------------|------|-------|
| 7 | `ds-kpi` | 28px / 800 | mono | Angka KPI utama |
| 8 | `ds-kpi-label` | 11px / 600 UPPER | sans | Label di bawah KPI |
| 9 | `ds-data` | 13px / 400 | mono | Nilai data, angka di tabel |
| 10 | `ds-badge` | 11px / 700 | mono | Angka kecil di pill/badge |

#### Overlay & Navigation

| # | Class | Size/Weight | Color | Usage |
|---|-------|-------------|-------|-------|
| 11 | `ds-overlay` | 11px / 700 | white | Teks di atas bar/segment berwarna |
| 12 | `ds-breadcrumb` | 12px / 400 | foreground | Breadcrumb path |
| 13 | `ds-tree` | 13px / 400 | foreground | Tree/hierarchy item |

#### Cara Menentukan Class Mana

```
Tanya: "Teks ini FUNGSINYA apa?"
  ├── Judul halaman?                    → ds-heading
  ├── Judul card/section/container?     → ds-title
  ├── Nama item di list / label row?    → ds-label
  ├── Deskripsi / penjelasan?           → ds-body
  ├── Header tabel / kategori?          → ds-small
  ├── Footnote / keterangan / pagination? → ds-caption
  ├── Angka KPI besar?                  → ds-kpi
  ├── Label di bawah KPI?              → ds-kpi-label
  ├── Angka data biasa?                → ds-data
  ├── Angka di badge/pill?             → ds-badge
  ├── Teks di atas colored bar?        → ds-overlay
  ├── Breadcrumb?                      → ds-breadcrumb
  └── Item di tree/hierarchy?          → ds-tree
```

#### Override Rules

- **Warna dinamis (per-data):** `className="ds-label" style={{ color: COLORS.x }}` — OK
- **Weight override:** `className="ds-body font-semibold"` — OK
- **DILARANG:** `className="text-[13px] font-medium"` — NEVER hardcode

### Interaction Classes (globals.css)

| Class | Duration | Usage |
|-------|----------|-------|
| `ds-transition` | 200ms ease-out | Standard: color, bg, opacity, shadow |
| `ds-transition-fast` | 150ms ease-out | Filter toggle, button feedback |
| `ds-transition-slow` | 300ms ease-out | Collapse/expand, panel slide |

### ECharts Canvas Tokens (design-tokens.ts)

ECharts renders to `<canvas>` — cannot use CSS classes. Use `ECHART_FONT` + `COLORS` + `CHART`:

| Token | Value | Maps to |
|-------|-------|---------|
| `ECHART_FONT.label` | 11px | ds-small / ds-caption |
| `ECHART_FONT.tooltip` | 12px | — |
| `ECHART_FONT.data` | 13px | ds-data / ds-body |
| `ECHART_FONT.title` | 15px | ds-title |
| `ECHART_FONT.kpi` | 18px | centre donut number |
| `ECHART_FONT.hero` | 28px | ds-kpi |
| `CHART.tooltip` | preset object | Spread into ECharts option |

### Spacing Variables

| Token | Value | Usage |
|-------|-------|-------|
| `--space-xs` | `4px` / `0.25rem` | Tight gaps |
| `--space-sm` | `8px` / `0.5rem` | Icon gaps, inline spacing |
| `--space-md` | `16px` / `1rem` | Standard padding |
| `--space-lg` | `24px` / `1.5rem` | Section padding |
| `--space-xl` | `32px` / `2rem` | Large gaps |
| `--space-2xl` | `48px` / `3rem` | Section margins |
| `--space-3xl` | `64px` / `4rem` | Hero padding |

### Shadow Depths

| Level | Value | Usage |
|-------|-------|-------|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | Subtle lift |
| `--shadow-md` | `0 4px 6px rgba(0,0,0,0.1)` | Cards, buttons |
| `--shadow-lg` | `0 10px 15px rgba(0,0,0,0.1)` | Modals, dropdowns |
| `--shadow-xl` | `0 20px 25px rgba(0,0,0,0.15)` | Hero images, featured cards |

---

## Component Specs

### Buttons

```css
/* Primary Button */
.btn-primary {
  background: #F59E0B;
  color: white;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  transition: all 200ms ease;
  cursor: pointer;
}

.btn-primary:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

/* Secondary Button */
.btn-secondary {
  background: transparent;
  color: #1E40AF;
  border: 2px solid #1E40AF;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  transition: all 200ms ease;
  cursor: pointer;
}
```

### Cards

```css
.card {
  background: #F8FAFC;
  border-radius: 12px;
  padding: 24px;
  box-shadow: var(--shadow-md);
  transition: all 200ms ease;
  cursor: pointer;
}

.card:hover {
  box-shadow: var(--shadow-lg);
  transform: translateY(-2px);
}
```

### Inputs

```css
.input {
  padding: 12px 16px;
  border: 1px solid #E2E8F0;
  border-radius: 8px;
  font-size: 16px;
  transition: border-color 200ms ease;
}

.input:focus {
  border-color: #1E40AF;
  outline: none;
  box-shadow: 0 0 0 3px #1E40AF20;
}
```

### Modals

```css
.modal-overlay {
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}

.modal {
  background: white;
  border-radius: 16px;
  padding: 32px;
  box-shadow: var(--shadow-xl);
  max-width: 500px;
  width: 90%;
}
```

---

## Style Guidelines

**Style:** Dark Mode (OLED)

**Keywords:** Dark theme, low light, high contrast, deep black, midnight blue, eye-friendly, OLED, night mode, power efficient

**Best For:** Night-mode apps, coding platforms, entertainment, eye-strain prevention, OLED devices, low-light

**Key Effects:** Minimal glow (text-shadow: 0 0 10px), dark-to-light transitions, low white emission, high readability, visible focus

### Page Pattern

**Pattern Name:** Horizontal Scroll Journey

- **Conversion Strategy:** Immersive product discovery. High engagement. Keep navigation visible.
28,Bento Grid Showcase,bento,  grid,  features,  modular,  apple-style,  showcase", 1. Hero, 2. Bento Grid (Key Features), 3. Detail Cards, 4. Tech Specs, 5. CTA, Floating Action Button or Bottom of Grid, Card backgrounds: #F5F5F7 or Glass. Icons: Vibrant brand colors. Text: Dark., Hover card scale (1.02), video inside cards, tilt effect, staggered reveal, Scannable value props. High information density without clutter. Mobile stack.
29,Interactive 3D Configurator,3d,  configurator,  customizer,  interactive,  product", 1. Hero (Configurator), 2. Feature Highlight (synced), 3. Price/Specs, 4. Purchase, Inside Configurator UI + Sticky Bottom Bar, Neutral studio background. Product: Realistic materials. UI: Minimal overlay., Real-time rendering, material swap animation, camera rotate/zoom, light reflection, Increases ownership feeling. 360 view reduces return rates. Direct add-to-cart.
30,AI-Driven Dynamic Landing,ai,  dynamic,  personalized,  adaptive,  generative", 1. Prompt/Input Hero, 2. Generated Result Preview, 3. How it Works, 4. Value Prop, Input Field (Hero) + 'Try it' Buttons, Adaptive to user input. Dark mode for compute feel. Neon accents., Typing text effects, shimmering generation loaders, morphing layouts, Immediate value demonstration. 'Show, don't tell'. Low friction start.
- **CTA Placement:** Floating Sticky CTA or End of Horizontal Track
- **Section Order:** 1. Intro (Vertical), 2. The Journey (Horizontal Track), 3. Detail Reveal, 4. Vertical Footer

---

## Anti-Patterns (Do NOT Use)

- ❌ Slow updates
- ❌ No automation

### Additional Forbidden Patterns

- ❌ **Emojis as icons** — Use SVG icons (Heroicons, Lucide, Simple Icons)
- ❌ **Missing cursor:pointer** — All clickable elements must have cursor:pointer
- ❌ **Layout-shifting hovers** — Avoid scale transforms that shift layout
- ❌ **Low contrast text** — Maintain 4.5:1 minimum contrast ratio
- ❌ **Instant state changes** — Always use transitions (150-300ms)
- ❌ **Invisible focus states** — Focus states must be visible for a11y

---

## Pre-Delivery Checklist

Before delivering any UI code, verify:

- [ ] No emojis used as icons (use SVG instead)
- [ ] All icons from consistent icon set (Heroicons/Lucide)
- [ ] `cursor-pointer` on all clickable elements
- [ ] Hover states with smooth transitions (150-300ms)
- [ ] Light mode: text contrast 4.5:1 minimum
- [ ] Focus states visible for keyboard navigation
- [ ] `prefers-reduced-motion` respected
- [ ] Responsive: 375px, 768px, 1024px, 1440px
- [ ] No content hidden behind fixed navbars
- [ ] No horizontal scroll on mobile
