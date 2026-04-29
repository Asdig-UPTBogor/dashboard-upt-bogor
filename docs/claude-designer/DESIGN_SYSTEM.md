# UPT Bogor — Design System
## Visual Language: "CE Next Level" Theme

> Handoff document untuk Claude Code. Baca seluruh file ini sebelum mulai.
> Target: apply ke semua halaman di `src/app/` secara konsisten.

---

## 1. DESIGN PHILOSOPHY

**3 prinsip utama:**
1. **Cool slate, bukan hitam** — background `#0b0d10` terasa lebih dalam dari pure black, lebih profesional
2. **Amber sebagai satu-satunya accent** — `#f3c14b` dipakai konsisten untuk highlight, active state, dan aksen tipografi. Tidak boleh ada warna "random" lain sebagai accent
3. **Typography hierarchy ketat** — `Inter` untuk semua teks, `JetBrains Mono` untuk angka/data/code. Ukuran teks selalu lebih kecil dari yang kamu kira perlu

---

## 2. GLOBALS.CSS — DROP-IN REPLACEMENT

Ganti seluruh isi bagian `:root` dan `.dark` di `src/app/globals.css` dengan ini:

```css
:root {
  /* ── Neutrals: cool slate, never pure black ── */
  --background:        #f6f7f9;
  --foreground:        #0e1319;
  --card:              #ffffff;
  --card-foreground:   #0e1319;
  --popover:           #ffffff;
  --popover-foreground:#0e1319;
  --border:            #e6e9ef;
  --input:             #f0f2f5;
  --muted:             #f0f2f5;
  --muted-foreground:  #70788a;

  /* ── Primary: amber (PLN brand) ── */
  --primary:           oklch(0.6420 0.1691 38.5815);
  --primary-foreground:#1a1300;
  --ring:              oklch(0.6397 0.1720 36.4421);

  /* ── Accent ── */
  --accent:            #fef3c7;
  --accent-foreground: #92400e;

  /* ── Semantic ── */
  --secondary:         oklch(0.9119 0.0222 243.8174);
  --secondary-foreground: oklch(0.3791 0.1378 265.5222);
  --destructive:       oklch(0.6368 0.2078 25.3313);
  --destructive-foreground: #fff;

  /* ── Chart palette (from CE Next Level) ── */
  --chart-1: #5b8def;   /* blue */
  --chart-2: #3ecf8e;   /* emerald */
  --chart-3: #f3c14b;   /* amber */
  --chart-4: #f08a3e;   /* orange */
  --chart-5: #b07cf0;   /* purple */
  --chart-6: #4cc9c0;   /* teal */
  --chart-7: #e5484d;   /* red/critical */

  /* ── Sidebar ── */
  --sidebar:            oklch(0.9030 0.0046 258.3257);
  --sidebar-foreground: oklch(0.3211 0 0);
  --sidebar-primary:    oklch(0.6397 0.1720 36.4421);
  --sidebar-primary-foreground: #fff;
  --sidebar-accent:     oklch(0.9119 0.0222 243.8174);
  --sidebar-accent-foreground: oklch(0.3791 0.1378 265.5222);
  --sidebar-border:     oklch(0.9276 0.0058 264.5313);
  --sidebar-ring:       oklch(0.6397 0.1720 36.4421);

  /* ── Fonts ── */
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', ui-monospace, monospace;
  --font-serif: 'Instrument Serif', Georgia, serif;

  /* ── Radius ── */
  --radius: 0.5rem;

  /* ── Shadows ── */
  --shadow-sm: 0 1px 0 0 rgba(255,255,255,0.02) inset, 0 1px 2px rgba(0,0,0,0.08);
  --shadow:    0 1px 3px rgba(16,24,40,0.06), 0 1px 2px rgba(16,24,40,0.04);
  --shadow-md: 0 4px 12px rgba(16,24,40,0.08), 0 2px 4px rgba(16,24,40,0.04);
}

.dark {
  /* ── Neutrals: CE Next Level exact ── */
  --background:        #0b0d10;
  --foreground:        #e6eaf0;
  --card:              #12151a;
  --card-foreground:   #e6eaf0;
  --popover:           #12151a;
  --popover-foreground:#e6eaf0;
  --border:            #262c35;
  --input:             #1f242c;
  --muted:             #171b21;
  --muted-foreground:  #6b7380;

  /* ── Primary: amber stays same ── */
  --primary:           oklch(0.6420 0.1691 38.5815);
  --primary-foreground:#1a1300;
  --ring:              oklch(0.6397 0.1720 36.4421);

  /* ── Accent ── */
  --accent:            #1f242c;
  --accent-foreground: #e6eaf0;

  /* ── Semantic ── */
  --secondary:         #1f242c;
  --secondary-foreground: #a8b0bd;
  --destructive:       oklch(0.6368 0.2078 25.3313);
  --destructive-foreground: #fff;

  /* ── Chart palette (same as light) ── */
  --chart-1: #5b8def;
  --chart-2: #3ecf8e;
  --chart-3: #f3c14b;
  --chart-4: #f08a3e;
  --chart-5: #b07cf0;
  --chart-6: #4cc9c0;
  --chart-7: #e5484d;

  /* ── Sidebar ── */
  --sidebar:            #12151a;
  --sidebar-foreground: #e6eaf0;
  --sidebar-primary:    oklch(0.6397 0.1720 36.4421);
  --sidebar-primary-foreground: #1a1300;
  --sidebar-accent:     #1f242c;
  --sidebar-accent-foreground: #a8b0bd;
  --sidebar-border:     #262c35;
  --sidebar-ring:       oklch(0.6397 0.1720 36.4421);

  /* ── Shadows (darker) ── */
  --shadow-sm: 0 1px 0 0 rgba(255,255,255,0.02) inset, 0 1px 2px rgba(0,0,0,0.3);
  --shadow:    0 1px 3px rgba(0,0,0,0.2), 0 1px 2px rgba(0,0,0,0.15);
  --shadow-md: 0 4px 16px rgba(0,0,0,0.3);
}
```

---

## 3. DESIGN TOKENS — `src/app/gardu-induk/program-kerja/_components/design-tokens.ts`

Update `COLORS` object:

```typescript
export const COLORS = {
  // Chart palette
  indigo:  "#5b8def",    // was "#818cf8" — CE Next Level blue
  teal:    "#4cc9c0",
  amber:   "#f3c14b",    // primary accent
  emerald: "#3ecf8e",
  rose:    "#e5484d",    // critical/destructive
  blue:    "#5b8def",
  purple:  "#b07cf0",
  cyan:    "#4cc9c0",
  orange:  "#f08a3e",
  pink:    "#f08a3e",

  selesai: "#3ecf8e",    // was "#34d399"
  belum:   "#e5484d",    // was "#fb7185"

  palette: [
    "#5b8def", "#4cc9c0", "#f3c14b",
    "#f08a3e", "#b07cf0", "#3ecf8e",
    "#e5484d", "#8dd884"
  ],

  cardBorder: "rgba(255,255,255,0.06)",
  cardBg:     "rgba(255,255,255,0.03)",
  tooltipBg:  "rgba(11,13,16,0.97)",
  tooltipBorder: "rgba(243,193,75,0.25)",
  gridLine:   "rgba(255,255,255,0.04)",
  accentGlow: "rgba(243,193,75,0.3)",
} as const;
```

---

## 4. COMPONENT PATTERNS

### 4.1 KPI Strip (horizontal, borderless)

**Jangan pakai** shadcn `<Card>` untuk KPI. Pakai strip horizontal:

```tsx
// ✅ CORRECT — CE Next Level style
<div className="rounded-md overflow-hidden border border-transparent hover:shadow-md transition-all"
     style={{ background: COLORS.cardBg }}>
  <div className="flex items-stretch divide-x divide-border/20">
    {kpis.map((kpi, i) => (
      <div key={i} className="flex-1 px-5 py-4 cursor-pointer hover:bg-muted/30 transition-colors">
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-2">
          {kpi.label}
        </p>
        <p className="text-2xl font-extrabold tabular-nums leading-none" style={{ color: kpi.color }}>
          {kpi.value}
        </p>
        <p className="text-xs text-muted-foreground mt-1.5 font-mono">{kpi.sub}</p>
      </div>
    ))}
  </div>
</div>

// ❌ AVOID — terlalu banyak card terpisah dengan shadow
<div className="grid grid-cols-4 gap-2">
  {kpis.map(kpi => <Card key={kpi.label}><CardContent>...</CardContent></Card>)}
</div>
```

### 4.2 Card Header pattern

```tsx
// ✅ CORRECT
<div className="rounded-md border border-transparent hover:shadow-md transition-all"
     style={{ background: COLORS.cardBg }}>
  {/* Header */}
  <div className="flex items-center gap-2 px-3 py-2 border-b border-border/30">
    <span className="text-sm font-semibold">{title}</span>
    <span className="text-xs text-muted-foreground">{subtitle}</span>
    <div className="ml-auto flex items-center gap-1.5">{actions}</div>
  </div>
  {/* Body */}
  <div className="p-3">{children}</div>
</div>
```

### 4.3 Badge / Status

```tsx
// Semantic badges — pakai warna dari COLORS
const conditionBadge = {
  'very-good': 'bg-emerald-500/12 text-emerald-400 border-emerald-500/30',
  'good':      'bg-green-500/12 text-green-400 border-green-500/30',
  'fair':      'bg-amber-500/12 text-amber-400 border-amber-500/30',
  'poor':      'bg-orange-500/12 text-orange-400 border-orange-500/30',
  'critical':  'bg-red-500/12 text-red-400 border-red-500/30',
  'close':     'bg-emerald-500/12 text-emerald-400 border-emerald-500/30',
  'open':      'bg-red-500/12 text-red-400 border-red-500/30',
};

<span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${conditionBadge[status]}`}>
  {label}
</span>
```

### 4.4 Donut Chart — Pakai ECharts dengan makeDonutOption

**Tetap pakai ECharts** untuk semua donut di dashboard. Jangan ganti ke SVG — ECharts punya labelLine, hover effect, animasi, dan rich text yang jauh lebih bagus.

Yang perlu dilakukan: ganti donut factory lama dengan `makeDonutOption` dari `@/lib/chart-theme`:

```typescript
// ✅ CORRECT — pakai makeDonutOption dari chart-theme
import { makeDonutOption } from "@/lib/chart-theme";

const option = makeDonutOption(
  [
    { name: "ULTG Bogor",    value: 26, color: "#5b8def" },
    { name: "ULTG Sukabumi", value: 21, color: "#4cc9c0" },
  ],
  {
    centerLabel: "Gardu Induk",
    selected: selectedUltg,   // atau null
    showLabels: true,
  }
);

<ReactECharts option={option} onEvents={{ click: handleClick }} />
```

**Fitur yang sudah ada di makeDonutOption:**
- Center number besar + label kecil (update otomatis saat slice dipilih)
- LabelLine rapi, tidak tumpang tindih
- Hover scale + glow amber
- Slice dimming (non-selected jadi transparan)
- Rich text label (nama + angka + %)
- Animasi smooth (cubicOut 700ms)
- Tooltip styled CE Next Level

**Untuk mini donut di KPI strip** (tanpa label):
```typescript
import { makeProgressDonut } from "@/lib/chart-theme";

// Mini ring: value/max, warna, ukuran px
const option = makeProgressDonut(663, 2467, "#3ecf8e", 40);
```

**SVG Donut.tsx** — HANYA untuk:
- Social media poster (WA/Instagram export)
- Satori server-side image generation
- Bukan untuk dashboard UI

```tsx
// Custom donut — ringan, Satori-compatible, no ECharts dependency
interface DonutProps {
  data: { name: string; value: number; color: string }[];
  size?: number;
  label?: string;
}

export function Donut({ data, size = 160, label }: DonutProps) {
  const total = data.reduce((a, b) => a + b.value, 0);
  const r = size / 2 - size * 0.12;
  const circ = 2 * Math.PI * r;
  const cx = size / 2, cy = size / 2;

  let offset = 0;
  const slices = data.map((d) => {
    const len = (d.value / total) * circ;
    const slice = { ...d, len, offset };
    offset += len;
    return slice;
  });

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill="none"
          stroke="rgba(255,255,255,0.04)" strokeWidth={size * 0.12} />
        {slices.map((s, i) => (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none"
            stroke={s.color} strokeWidth={size * 0.12}
            strokeDasharray={`${s.len} ${circ}`}
            strokeDashoffset={-s.offset}
            strokeLinecap="butt"
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        ))}
      </svg>
      {label && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'grid', placeItems: 'center', textAlign: 'center',
        }}>
          <div>
            <div style={{ fontSize: size * 0.15, fontWeight: 700, lineHeight: 1 }}>
              {total.toLocaleString('id-ID')}
            </div>
            <div style={{ fontSize: size * 0.08, color: 'var(--muted-foreground)', marginTop: 2 }}>
              {label}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

**Kapan tetap pakai ECharts:**
- Combo bar + line chart (timeline rencana)
- Stacked bar dengan banyak seri (>5)
- Drill-down chart yang kompleks

**Ganti dengan SVG custom:**
- Semua donut 2–5 kategori → `<Donut>`
- Progress bar horizontal → CSS biasa
- KPI sparkline → SVG sederhana

### 4.5 Table pattern

```tsx
// Gunakan di semua halaman — sticky header, compact, sortable
<div className="overflow-auto max-h-[50vh]">
  <table className="w-full border-collapse text-xs">
    <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm">
      <tr>
        {cols.map(col => (
          <th key={col.key}
              className="px-2.5 py-2 text-left font-semibold text-muted-foreground
                         uppercase tracking-wider text-[10.5px] border-b border-border
                         cursor-pointer select-none hover:text-foreground whitespace-nowrap"
              onClick={() => onSort(col.key)}>
            {col.label}
          </th>
        ))}
      </tr>
    </thead>
    <tbody>
      {rows.map((row, i) => (
        <tr key={i}
            className="border-b border-border/30 hover:bg-muted/30 transition-colors">
          {/* cells */}
        </tr>
      ))}
    </tbody>
  </table>
</div>
```

---

## 5. ECHARTS CONFIG — Unified theme

Pakai config ini untuk **semua** ECharts di seluruh halaman:

```typescript
// src/lib/chart-theme.ts — buat file ini baru
export const CHART_BASE = {
  backgroundColor: "transparent",
  textStyle: {
    fontFamily: "'JetBrains Mono', 'Inter', sans-serif",
    color: "var(--muted-foreground)",
  },
};

export const TOOLTIP_STYLE = {
  backgroundColor: "#0b0d10",
  borderColor: "rgba(243,193,75,0.25)",
  borderWidth: 1,
  borderRadius: 6,
  padding: [8, 12],
  textStyle: { color: "#e6eaf0", fontSize: 12 },
};

export const AXIS_STYLE = {
  axisLine: { show: false },
  axisTick: { show: false },
  axisLabel: {
    fontSize: 11,
    color: "var(--muted-foreground)",
    fontFamily: "'JetBrains Mono', monospace",
  },
  splitLine: {
    lineStyle: { color: "rgba(255,255,255,0.04)", type: "dashed" as const },
  },
};

// Bar gradient helper
export function barGradient(pct: number) {
  if (pct >= 100) return { from: "#059669", to: "#3ecf8e" };
  if (pct >= 50)  return { from: "#3b82f6", to: "#4cc9c0" };
  if (pct > 0)    return { from: "#5b4fd4", to: "#5b8def" };
  return { from: "#374151", to: "#4b5563" };
}
```

---

## 6. PAGE-BY-PAGE MIGRATION CHECKLIST

### Priority 1 — Paling sering dikunjungi
- [ ] `src/app/overview/page.tsx` — Update KPI cards ke strip horizontal, 3 donuts → SVG custom
- [ ] `src/app/ce-next-level/` — Update donut factory, ganti 3 donut ECharts → SVG custom
- [ ] `src/app/proteksi/program-kerja/page.tsx` — Update bar gradient, donut KPI

### Priority 2 — Program kerja halaman lain
- [ ] `src/app/transmisi/` — Apply design tokens
- [ ] `src/app/gardu-induk/` — Update design-tokens.ts (sudah ada, tinggal update COLORS)

### Priority 3 — Halaman admin
- [ ] `src/app/jadwal-pekerjaan/` — Badge colors, table pattern
- [ ] `src/app/program-kerja/` — KPI strip pattern
- [ ] `src/app/maintenance/` — Apply tokens
- [ ] `src/app/cloud-console/` — Minimal changes

### Tidak perlu diubah
- `src/app/api/` — Backend routes
- `src/app/[...slug]/` — Dynamic slug handler

---

## 7. INSTRUCTIONS FOR CLAUDE CODE

```
Read DESIGN_SYSTEM.md completely.

Step 1: Update src/app/globals.css
- Replace :root and .dark blocks with the exact CSS from section 2
- Keep all @keyframes, utility classes, and other sections as-is

Step 2: Update design-tokens.ts
- Replace COLORS object with values from section 3
- Keep LAYOUT, TEXT, CHART, ANIM objects as-is

Step 3: Create src/lib/chart-theme.ts
- Create new file with content from section 5

Step 4: Apply KPI strip pattern (section 4.1)
- Find all pages that use grid of <Card> for KPI (4 or 6 cards)
- Replace with horizontal strip pattern
- Files: overview/page.tsx, all program-kerja pages

Step 5: Unify all donut charts to use makeDonutOption (section 4.4)
- Create src/lib/chart-theme.ts (from chart-theme.ts file)
- In ce-next-level/_components/ce-donut-factory.ts:
    Replace useMkDonut with useDonutFactory from @/lib/chart-theme
- In overview/_components/donut-panel.tsx:
    Replace inline donut ECharts options with makeDonutOption calls
- In all program-kerja pages with donut:
    Replace custom donut option builders with makeDonutOption
- DO NOT replace with SVG — keep ECharts for all dashboard donuts

Step 6: Apply badge colors (section 4.3)
- Find all status/kondisi badge rendering
- Replace with semantic color mapping

Step 7: Apply table pattern (section 4.5)
- All pages with data tables: use sticky thead, compact padding, hover state

Work page by page in Priority order from section 6.
After each page, confirm what was changed.
Do NOT change business logic, data fetching, or API calls.
Only change visual/styling code.
```

---

## 8. QUICK REFERENCE

| Token | Dark value | Light value | Usage |
|-------|-----------|-------------|-------|
| `--background` | `#0b0d10` | `#f6f7f9` | App background |
| `--card` | `#12151a` | `#ffffff` | Card background |
| `--border` | `#262c35` | `#e6e9ef` | All borders |
| `--muted` | `#171b21` | `#f0f2f5` | Hover, inner bg |
| `--muted-foreground` | `#6b7380` | `#70788a` | Labels, subtitles |
| `--primary` | `oklch(0.6420 0.1691 38.5815)` | same | Amber — buttons, active |
| `--chart-1` | `#5b8def` | same | Blue — ULTG Bogor |
| `--chart-2` | `#3ecf8e` | same | Emerald — selesai/close |
| `--chart-3` | `#f3c14b` | same | Amber — amber accent |
| `--chart-7` | `#e5484d` | same | Red — critical/open |

| Font | Usage |
|------|-------|
| `Inter` | Semua teks body, heading, label |
| `JetBrains Mono` | Angka, tanggal, kode, KPI values |
| `Instrument Serif` | Hero title (landing page only) |

---

*Generated from CE Next Level Dashboard visual language — UPT Bogor 2026*
