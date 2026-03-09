# 📋 Dashboard UPT Bogor — RULES

> **SSOT (Single Source of Truth) Rules** — Ikuti semua aturan ini saat membuat atau mengedit halaman.

---

## 1. Data Flow: `usePageData` Hook

**WAJIB** — Semua page fetch data via `usePageData("/route")`, **BUKAN** custom API route (`/api/xxx`).

```
Google Sheet → Background Worker → Cache → /api/page-data → usePageData("/route")
```

```tsx
// ✅ BENAR
const { sheets, loading, error } = usePageData("/transmisi/sld-tower");
const rawData = sheets[0]?.rows ?? [];

// ❌ SALAH — jangan fetch langsung ke API custom
const res = await fetch("/api/sld-tower");
```

> **Pengecualian:** API untuk resource non-spreadsheet (contoh: `/api/sld-images` untuk Google Drive files) diperbolehkan.

---

## 2. `DataFreshness` Component

**WAJIB** ada di **setiap** page — menunjukkan kapan data terakhir di-fetch.

```tsx
import { DataFreshness } from "@/components/DataFreshness";

// Di dalam JSX, biasanya di header area
<DataFreshness />
```

---

## 3. `useChartTheme` Hook

**WAJIB** — Semua chart warna harus pakai theme-aware colors dari `useChartTheme()`. **JANGAN** hardcode hex colors untuk elemen chart.

```tsx
import { useChartTheme } from "@/components/page-builder/widgets/use-chart-theme";

const theme = useChartTheme();

// ✅ BENAR — pakai theme object
tooltip: { backgroundColor: theme.tooltipBg, textStyle: { color: theme.tooltipText } }
graphic: { style: { fill: theme.emphasisText } }
label: { color: theme.textMuted }

// ❌ SALAH — hardcoded hex
tooltip: { backgroundColor: "rgba(15,15,30,0.95)", textStyle: { color: "#e4e4e7" } }
```

**Theme properties:** `text`, `textMuted`, `emphasisText`, `tooltipBg`, `tooltipText`, `gridLine`

> **Catatan:** Accent/brand colors (palette `C.indigo`, `C.teal`, dll.) boleh tetap hardcoded — yang wajib theme-aware adalah colors untuk text, tooltip, grid, dan background chart.

---

## 4. Page Config

Setiap page **WAJIB** punya config JSON di:

```
src/lib/page-configs/{module}--{page-name}.json
```

Contoh: `transmisi--sld-tower.json`

Config berisi: `dataSources`, `columnsUsed`, `hierarchyMapping`, `relations`. Di-manage via **Data Connector** UI.

---

## 5. Spreadsheet Config

Semua sheet yang dipakai **WAJIB** terdaftar di:

```
src/lib/spreadsheet-config.json
```

Harus lengkap: `sheetName`, `label`, `usedBy`, `columnsUsed`, `hierarchyPresent`, `hierarchyMapping`.

---

## 6. Sidebar Config

Semua page **WAJIB** terdaftar di:

```
src/lib/sidebar-config.ts
```

Format:
```ts
{ href: "/transmisi/sld-tower", label: "SLD Tower", iconName: "FileImage" }
```

---

## 7. Hierarchy QC — Exact Column Names

Kolom hierarchy **WAJIB exact match**, case-sensitive:

| Hierarchy | Column Name (EXACT) |
|-----------|-------------------|
| ULTG | `Master ULTG` |
| Gardu Induk | `Master Gardu Induk` |
| Bay | `Master Bay` |

```tsx
// ✅ BENAR
r["Master ULTG"]
r["Master Gardu Induk"]

// ❌ SALAH
r["ULTG"]
r["master ultg"]
r["Gardu Induk"]
```

---

## 8. Column Names = Exact Match

Nama kolom di `page.tsx` **harus persis sama** dengan header di Google Sheet. Tidak boleh ada perbedaan huruf besar/kecil atau spasi.

Best practice — definisikan sebagai constants:
```tsx
const COL = {
    ULTG: "Master ULTG",
    GI: "Master Gardu Induk",
    PENGHANTAR: "PENGHANTAR",
} as const;
```

---

## 9. No Custom API Routes untuk Data

**DILARANG** membuat `/api/xxx` untuk fetch data spreadsheet. Semua lewat `usePageData`.

> API route hanya boleh untuk resource non-spreadsheet (Google Drive, external service, dll).

---

## 10. Data Connector (DC)

Kolom dan sheet connections di-manage visual lewat **Data Connector** canvas UI (`/maintenance/data-source`). Jangan edit page-config JSON secara manual kecuali diperlukan.

---

## 🎨 Chart Style Standard

### Donut Chart (Overview-matched)
- Dual series: outer labels + inside value numbers
- Radius: `["38%", "72%"]`
- Center: `["50%", "50%"]`
- `padAngle: 3`, `borderRadius: 6`
- Graphic centered: total count (fontSize 22) + subtitle (fontSize 9)
- Animation: `elasticOut`

### Color Palette
```tsx
const C = {
    indigo: "#818cf8", teal: "#2dd4bf", amber: "#fbbf24",
    purple: "#c084fc", pink: "#f472b6", emerald: "#34d399",
    rose: "#fb7185", blue: "#60a5fa", cyan: "#22d3ee", orange: "#fb923c",
};
```

---

## 📁 UI Component Library

Gunakan **shadcn/ui** components:
- `Card`, `CardContent`, `CardHeader`, `CardTitle`
- `Button`, `Badge`, `Input`, `Skeleton`
- `SelectNative` (bukan `Select`)
- `Table`, `TableBody`, `TableCell`, `TableHead`, `TableHeader`, `TableRow`
- `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`

Icons: **lucide-react**

Charts: **echarts-for-react** (dynamic import, `ssr: false`)

---

## 🏗️ Page Structure Template

```tsx
"use client";

import { usePageData } from "@/hooks/usePageData";
import { DataFreshness } from "@/components/DataFreshness";
import { useChartTheme } from "@/components/page-builder/widgets/use-chart-theme";

export default function PageName() {
    const theme = useChartTheme();
    const { sheets, loading, error } = usePageData("/module/page-name");
    const rawData = sheets[0]?.rows ?? [];

    if (loading) return <Skeleton />;
    if (error) return <ErrorCard message={error} />;

    return (
        <div className="space-y-4">
            {/* Header + DataFreshness */}
            {/* KPI Cards */}
            {/* Charts */}
            {/* Filters */}
            {/* Data Table */}
        </div>
    );
}
```

---

## ✅ Checklist Sebelum Push

- [ ] `usePageData` dipakai (bukan custom API)
- [ ] `DataFreshness` ada di page
- [ ] `useChartTheme` dipakai untuk chart colors
- [ ] Page config JSON ada di `page-configs/`
- [ ] Sheet terdaftar di `spreadsheet-config.json`
- [ ] Page terdaftar di `sidebar-config.ts`
- [ ] Kolom hierarchy exact match (`Master ULTG`, `Master Gardu Induk`)
- [ ] Column names match Google Sheet headers
- [ ] `npx next build` sukses tanpa error
