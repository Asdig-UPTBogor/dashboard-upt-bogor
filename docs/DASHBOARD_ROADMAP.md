# Dashboard UPT Bogor — Work Tracker

> SSOT progress menuju platform perfect.
> Setiap sesi kerja: (1) baca file ini, (2) ambil scope, (3) kerjakan, (4) update status di sini.
> Agent berbeda bisa ambil scope berbeda secara paralel.

---

## Cara Pakai

1. **Mulai sesi** → baca file ini, pilih scope yang statusnya `ready` atau `in-progress`
2. **Ambil scope** → ubah status jadi `in-progress`, tulis sesi ke log
3. **Selesai kerja** → update status tiap item, tulis catatan di session log
4. **Handoff** → kalau belum selesai, tulis catatan "lanjut dari mana" di session log

---

## Session Log

| Sesi | Tanggal | Agent | Scope | Catatan |
|------|---------|-------|-------|---------|
| S01 | 2026-04-12 | Claude Opus | SCOPE-00: Audit & Cleanup | Audit stack lengkap, hapus 9 dependency + 5 shadcn files, build clean. Temukan BQ SDK inconsistency. |
| S02 | 2026-04-12 | Claude Opus 4.6 | SCOPE-04 + SCOPE-03 audit | Hapus 28 shadcn (keep sheet→sidebar dep), build clean. Audit ds-*/chart-tokens semua page — temuan 630+ violasi. |
| S03 | - | - | - | - |

---

## Scope Pekerjaan

### SCOPE-00: Audit Stack & Dependency Cleanup — `done`

<details>
<summary>Detail (klik expand)</summary>

**Sesi:** S01 (2026-04-12)

**Temuan:**
- 13 gap CLAUDE.md vs realita (Next.js 16 bukan 15, 3 chart lib, dll)
- 9 dependency tidak terpakai → dihapus
- 5 shadcn boilerplate files → dihapus
- BigQuery data layer masih REST manual, padahal 6 GCP service lain sudah pakai SDK
- ~29 shadcn component files masih 0 import (belum dihapus, perlu audit lebih detail)

**Dihapus:**
- Packages: chart.js, react-chartjs-2, recharts, yet-another-react-lightbox, zod, react-hook-form, @hookform/resolvers, embla-carousel-react, input-otp, react-day-picker
- Files: chart.tsx, carousel.tsx, calendar.tsx, input-otp.tsx, form.tsx

**Hasil:** Build clean, 33 packages (dari 42).

</details>

---

### SCOPE-01: Update CLAUDE.md — `ready`

**Apa:** Update `CLAUDE.md` dengan definisi stack lengkap dan akurat berdasarkan hasil audit SCOPE-00.
**Kenapa:** CLAUDE.md adalah instruksi utama agent — kalau outdated, agent kerja dengan asumsi salah.
**File:** `/Dashboard-UPT-Bogor/CLAUDE.md`
**Estimasi:** Kecil, 1 sesi.

---

### SCOPE-02: Refactor BigQuery Data Layer ke SDK — `ready`

**Apa:** Refactor `src/lib/bigquery-data-layer.ts` dari REST API manual ke `@google-cloud/bigquery` SDK.
**Kenapa:** 6 GCP service lain sudah pakai SDK. BigQuery (yang paling sering dipakai) masih REST manual 300+ baris.
**File utama:** `src/lib/bigquery-data-layer.ts`
**Risiko:** Ini data layer inti — semua page dashboard baca data dari sini. Harus test menyeluruh.
**Estimasi:** 1 sesi fokus.

---

### SCOPE-03: Refactor FE Pages — ds-* + chart-tokens + layout — `audited`

**Apa:** Audit & refactor setiap page agar konsisten pakai `ds-*` class, `chart-tokens.ts`, dan layout pattern dari Healthy Index.
**Kenapa:** Banyak page masih hardcode typography (`text-sm font-semibold`), hardcode ECharts config, dan layout tidak konsisten.
**Reference:** `src/app/gardu-induk/healthy-index/` adalah gold standard.
**Audit:** S02 (2026-04-12) — semua page di-audit, total ~630+ violasi ditemukan.

**Checklist per page:**
- `ds-*` → typography pakai ds-heading, ds-title, ds-label, ds-body, ds-small, ds-kpi, ds-data
- `chart-tokens` → ECharts pakai ECHART_COLORS, ECHART_FONT, CHART, getTooltipPreset
- `layout` → spacing, card gap, header pattern konsisten dengan Healthy Index

**Temuan Global (S02):**
- `ds-heading` sudah dipakai hampir semua page
- `ds-body/small/label/title/data/kpi` hampir TIDAK dipakai — semua hardcode `text-sm font-semibold` dll
- `chart-tokens` hanya dipakai di 3 file CE Next Level, sisanya 100% hardcode ECharts config
- Pola hardcode paling umum: `#d4d4d8`, `rgba(129,140,248,0.3)`, `rgba(15,15,30,0.95)`, `rgba(255,255,255,0.06)`

#### Gardu Induk

| Page | Path | ds-* | chart-tokens | layout | Status |
|------|------|------|-------------|--------|--------|
| Healthy Index | `gardu-induk/healthy-index/` | ok | ok | ok | `reference` (gold standard) |
| Program Kerja GI | `gardu-induk/program-kerja/` | fix | fix | fix | `audited` |
| HI Trafo | `gardu-induk/hi-trafo/` | fix | fix | fix | `audited` |

<details>
<summary>Detail temuan Gardu Induk (61 violasi)</summary>

**Program Kerja GI — GarduIndukContent.tsx:**
- L56: `text-base md:text-lg font-bold` → `ds-heading`
- L61: `text-xs text-muted-foreground` → `ds-small`
- L82: `text-sm font-medium` → `ds-label`

**Program Kerja GI — HargiTab.tsx (12 violasi):**
- L128,291,324: tooltip `color: "#d4d4d8"` → `ECHART_COLORS`
- L141,325: `shadowColor: "rgba(129,140,248,0.4)"` → chart-tokens
- L145,150-152: label `color: "#d4d4d8"` hardcode → `ECHART_COLORS`
- L301: tooltip HR `border-color:#3f3f46` → chart-tokens
- L365: `color: "#fff"` → chart-tokens
- L372: `backgroundStyle` hardcode colors → chart-tokens
- L438: inline `background: "rgba(255,255,255,0.06)"` → chart-tokens

**Program Kerja GI — TrafoTab.tsx (19 violasi):**
- L146,206: tooltip `color: "#d4d4d8"` → `ECHART_COLORS`
- L157: `shadowColor: "rgba(129,140,248,0.4)"` → chart-tokens
- L161,166: label colors hardcode → `ECHART_COLORS`
- L234,237,258: bar background/emphasis hardcode → chart-tokens
- L277,379,402,444,465,472,501,517,581,601,715: inline `rgba()` backgrounds → chart-tokens/CSS var

**HI Trafo — page.tsx (27 violasi):**
- L352: `text-destructive font-semibold` → `ds-body`
- L353: `text-sm text-muted-foreground` → `ds-small`
- L368: `text-xs text-muted-foreground` → `ds-small`
- L393: `text-xl md:text-2xl font-bold` → `ds-kpi`
- L394: `text-xs uppercase tracking-wider` → `ds-small`
- L155-243: 2 donut configs 100% hardcode (colors, tooltip, label) → chart-tokens
- L258-311: bar + prioritas charts hardcode → chart-tokens
- L442,446: `text-xs` → `ds-small`
- L458-508: CardTitle `text-sm` → `ds-title` (5x)
- L460,510: Badge `text-xs` → `ds-small`
- L541-601: TableCell `text-xs` (15+ instances) → `ds-small`/`ds-data`
- L582,594,601: Button `text-xs` → `ds-small`

</details>

#### Transmisi

| Page | Path | ds-* | chart-tokens | layout | Status |
|------|------|------|-------------|--------|--------|
| Program Kerja | `transmisi/program-kerja/` | fix | fix | fix | `audited` |
| Petir | `transmisi/petir/` | fix | fix | ok | `audited` |
| Anomali | `transmisi/anomali/` | fix | fix | ok | `audited` |
| SLD Tower | `transmisi/sld-tower/` | fix | fix | fix | `audited` |
| Asset | `transmisi/asset/` | fix | fix | fix | `audited` |
| Healthy Index TX | `transmisi/healthy-index/` | fix | fix | ok | `audited` |
| Monitoring Tower Kritis | `transmisi/monitoring-tower-kritis/` | fix | fix | fix | `audited` |
| Kerawanan | `transmisi/kerawanan/` | fix | fix | fix | `audited` |
| ROW | `transmisi/row/` | fix | fix | ok | `audited` |

<details>
<summary>Detail temuan Transmisi (87+ violasi)</summary>

**Pola umum semua 9 page:**
- 0 import dari `@/lib/chart-tokens` — semua ECharts config hardcode
- `ds-heading` dipakai (kecuali Asset) — tapi `ds-*` lain tidak
- Hardcode: `"rgba(129,140,248,0.3)"`, `"#d4d4d8"`, `fontFamily: "ui-sans-serif, system-ui, sans-serif"`

**program-kerja/page.tsx:**
- L477: `font-semibold` hardcode
- L503,507: custom styled dropdown bukan SelectNative
- L565: `text-2xl font-bold` → `ds-kpi`
- L605,621,637: `text-xs font-semibold` chart title (3x)
- L672-707: TableHead `text-xs font-semibold/bold` (21x)

**petir/page.tsx:**
- L472: `text-2xl font-bold` → `ds-kpi`
- L473: `text-xs font-semibold uppercase` → `ds-small`
- L518-519: `text-xl font-bold`, `text-xs font-medium`

**anomali/page.tsx:**
- L367: `text-xl md:text-2xl font-bold` → `ds-kpi`
- L523: `text-xs font-mono font-medium`

**asset/page.tsx:**
- L258: `text-2xl font-bold` (NO ds-heading!) → `ds-heading`
- L336: `text-2xl font-bold` → `ds-kpi`
- L400-413: TableHead `text-xs font-semibold/bold` (14x)

**healthy-index/page.tsx:**
- L524: `text-2xl font-bold` → `ds-kpi`
- L624: `text-sm font-bold` TableCell

**monitoring-tower-kritis/page.tsx:**
- L334: custom button styling → Button component
- L415: `text-xl md:text-2xl font-bold` → `ds-kpi`
- L498: `text-xs font-mono font-medium`

**kerawanan/page.tsx:**
- L140,153,168: `text-sm font-medium` (3x)
- L190-195: `text-xs/xl font-bold` KPI (4x)
- L211,222: `text-xs font-bold` Badge
- L274-286: `text-sm/xs font-bold` table (4x)
- L156-164: custom `<select>` → SelectNative

**sld-tower/page.tsx:**
- L290: `text-sm font-semibold`
- L330: `text-xs font-semibold uppercase`
- L464: `text-xl md:text-2xl font-bold` → `ds-kpi`
- L489: `text-sm font-semibold` → `ds-label`
- L582: `text-xs font-medium`

**row/page.tsx:**
- L695: `text-xl font-bold` → `ds-kpi`
- L696: `text-xs font-semibold uppercase`
- L888: `text-xs font-semibold`

</details>

#### Proteksi

| Page | Path | ds-* | chart-tokens | layout | Status |
|------|------|------|-------------|--------|--------|
| Program Kerja | `proteksi/program-kerja/` | fix | fix | ok | `audited` |
| Asset | `proteksi/asset/` | fix | n/a | fix | `audited` |

<details>
<summary>Detail temuan Proteksi</summary>

**proteksi/program-kerja/page.tsx:**
- L133,136: tooltip `color: "#d4d4d8"` hardcode
- L150-160: label fontSize/color hardcode
- L206: `fontFamily: "ui-sans-serif, system-ui, sans-serif"` hardcode
- Pola sama dengan gardu-induk/program-kerja (shared design-tokens local)

**proteksi/asset/page.tsx:**
- L164: `text-lg font-bold` → `ds-title`
- L165: `text-sm text-muted-foreground` → `ds-body`
- L181: `ds-heading` ok
- L185: `text-xs text-muted-foreground` → `ds-small`

</details>

#### Overview & General

| Page | Path | ds-* | chart-tokens | layout | Status |
|------|------|------|-------------|--------|--------|
| Overview | `overview/` | fix | fix | ok | `audited` |
| CE Next Level | `ce-next-level/` | ok | ok | ok | `done` |
| Jadwal Pekerjaan | `jadwal-pekerjaan/` | fix | n/a | ok | `audited` |
| Program Kerja (root) | `program-kerja/` | fix | n/a | ok | `audited` |
| Asset Maps | `asset-maps/` | n/a | n/a | ok | `audited` (map only) |

<details>
<summary>Detail temuan Overview & General</summary>

**overview/ (5 component files, ~60+ violasi):**
- kpi-cards.tsx L41: `text-xl font-bold tabular-nums` → `ds-kpi`
- kpi-cards.tsx L42: `text-xs text-muted-foreground uppercase` → `ds-small`
- donut-panel.tsx L89-223: 2 donut configs 100% hardcode → chart-tokens
- donut-panel.tsx L237: `text-base font-bold` → `ds-title`
- donut-panel.tsx L270,278,336: `text-xs font-bold` → `ds-data`
- gi-panel.tsx L151: `text-base font-bold` → `ds-title`
- gi-panel.tsx L160: `text-lg font-bold tabular-nums` → `ds-kpi`
- gi-panel.tsx L203,215: `text-sm font-bold` → `ds-label`/`ds-data`
- gi-panel.tsx L425,481,487: hardcode font
- equipment-panel.tsx L46-126: 8x `text-xs font-bold` → `ds-data`/`ds-label`
- detail-table.tsx L39,41: `text-sm`/`text-xs` → `ds-label`/`ds-small`

**CE Next Level (BEST compliance — 40%):**
- page.tsx: `ds-heading`, `ds-body`, `ds-small` dipakai — ok
- 3 component files import `@/lib/chart-tokens` — satu-satunya area yang pakai!
- Masih ada beberapa hardcode minor di component files

**jadwal-pekerjaan/:**
- page.tsx L239: `text-xs text-muted-foreground` → `ds-small`
- page.tsx L310: `text-sm` → `ds-label`
- event-list.tsx L30: `text-xs font-bold` → `ds-data`

**program-kerja/ (root):**
- page.tsx L52: `text-sm font-medium` → `ds-label`
- page.tsx L92: `text-sm font-medium` → `ds-body`
- page.tsx L93: `text-xs text-muted-foreground` → `ds-small`

**asset-maps/:** Map only, no typography/chart violations.

</details>

#### Cloud Console

| Page | Path | ds-* | chart-tokens | layout | Status |
|------|------|------|-------------|--------|--------|
| Console Overview | `cloud-console/overview/` | fix | n/a | ok | `audited` |
| Thor Vaisala | `cloud-console/thor-vaisala/` | fix | n/a | ok | `audited` |
| Notifier | `cloud-console/notifier/` | fix | n/a | ok | `audited` |
| Spreadsheet Sync | `cloud-console/spreadsheet-sync/` | fix | n/a | ok | `audited` |

<details>
<summary>Detail temuan Cloud Console</summary>

**cloud-console/overview/page.tsx:**
- L89: `text-sm text-muted-foreground` → `ds-body`
- L135: `text-sm font-semibold` → `ds-label`
- L141: `text-xs text-muted-foreground` → `ds-small`

**cloud-console/thor-vaisala/page.tsx:**
- L91: `text-xs text-muted-foreground` → `ds-small`
- Hardcode status badge inline colors

**cloud-console/notifier/ & spreadsheet-sync/:**
- Similar pattern — hardcoded typography, no ds-* classes

</details>

#### Maintenance (Internal Tools)

| Page | Path | ds-* | chart-tokens | layout | Status |
|------|------|------|-------------|--------|--------|
| Data Source | `maintenance/data-source/` | fix | n/a | fix | `audited` |
| Data Connector | `maintenance/data-connector/` | fix | n/a | fix | `audited` |
| Master Data | `maintenance/master-data/` | fix | n/a | fix | `audited` |
| Dashboard Data | `maintenance/dashboard-data/` | fix | n/a | fix | `audited` |
| Page Builder | `maintenance/page-builder/` | fix | n/a | fix | `audited` |
| Design Dictionary | `maintenance/design-dictionary/` | fix | n/a | ok | `audited` |

<details>
<summary>Detail temuan Maintenance</summary>

**Maintenance = area paling parah (30+ files, ~10% compliance)**
- ZERO ds-* class dipakai
- Semua typography hardcode
- Heavy inline styling di grid, table, form components
- Prioritas rendah karena internal tools — fix terakhir

</details>

#### System Pages

| Page | Path | ds-* | chart-tokens | layout | Status |
|------|------|------|-------------|--------|--------|
| Root (/) | `page.tsx` | fix | - | ok | `audited` |
| Catch-all [...slug] | `[...slug]/page.tsx` | fix | - | ok | `audited` |
| Preview shadcn | `preview-shadcn/` | - | - | - | `skip` (dev only) |
| Test Page | `maintenance/test-page/` | - | - | - | `skip` (dev only) |

**Legend status per page:**
- `?` = belum di-audit
- `ok` = sudah sesuai standard
- `fix` = perlu perbaikan (detail di catatan)
- `done` = sudah diperbaiki & verified
- `skip` = tidak perlu (dev/test page)
- `n/a` = tidak relevan (misal page tanpa chart → chart-tokens = n/a)
- `audited` = sudah di-audit, menunggu fix
- `partial` = sebagian sudah pakai, sebagian belum

**Rekomendasi urutan fix (S02):**
1. CE Next Level — paling dekat compliance, tinggal polish
2. Gardu Induk — reference area, fix di sini jadi contoh
3. Transmisi — volume terbesar, tapi pola sama
4. Overview — high-visibility page
5. Proteksi, Jadwal, Program Kerja — medium
6. Cloud Console — no charts, ds-* only
7. Maintenance — internal tools, prioritas terakhir

---

### SCOPE-04: Cleanup shadcn Components — `done`

<details>
<summary>Detail (klik expand)</summary>

**Sesi:** S02 (2026-04-12)

**Proses:**
- Audit 29 komponen dengan 0 direct import dari app code
- Cek cross-dependency: `sheet.tsx` di-import oleh `sidebar.tsx` (sidebar dipakai 3 files)
- Hapus 28 komponen, keep `sheet.tsx`
- Build clean (exit code 0)

**Dihapus (28 files):**
accordion, aspect-ratio, breadcrumb, button-group, combobox, command, context-menu, direction, drawer, dropdown-menu, empty, field, hover-card, input-group, item, kbd, label, menubar, navigation-menu, pagination, popover, radio-group, resizable, slider, spinner, textarea, toggle, toggle-group

**Dipertahankan (1 file):**
- `sheet.tsx` — dependency dari `sidebar.tsx` yang aktif dipakai

**Hasil:** 23 shadcn components tersisa (dari 52 awal, total cleanup S01+S02 = 29 files).

</details>

---

### SCOPE-05: Shared Components & Layout System — `ready`

**Apa:** Audit shared components (AppSidebar, AppHeader, ThemeProvider) dan layout pattern.
**File:**
- `src/app/layout.tsx` — root layout
- `src/app/cloud-console/layout.tsx` — console layout
- `src/components/AppSidebar.tsx`
- `src/components/AppHeader.tsx`
- `src/components/ThemeProvider.tsx`
- `src/components/ThemeToggle.tsx`

---

## Stack Aktual (Post S01)

```
Framework    : Next.js 16.1.6 + React 19.2.3 + TypeScript 5
Styling      : Tailwind CSS v4 + shadcn/ui 4.2.0 (radix-mira) + CVA + clsx + tailwind-merge
Charts       : ECharts 6 + echarts-for-react (SATU-SATUNYA chart lib)
Maps         : MapLibre GL 5 + react-map-gl 8 + Turf.js 7
Animation    : Framer Motion 12
GCP SDK      : BigQuery*, Firestore, Logging, Pub/Sub, Cloud Run, Scheduler, Secret Manager
               *BigQuery SDK installed tapi belum dipakai — masih REST manual (lihat SCOPE-02)
Firebase     : Client SDK (real-time) + Admin SDK (server)
Google APIs  : googleapis + google-auth-library
Layout       : @xyflow/react + react-grid-layout + react-resizable-panels + @dnd-kit
Data Grid    : react-data-grid
UI Extras    : Lucide icons, next-themes, Sonner, Vaul, cmdk, date-fns
Deployment   : Docker (node:20-alpine) → Cloud Run (standalone)
Dependencies : 33 packages (dari 42, cleanup 9 di S01)
```
