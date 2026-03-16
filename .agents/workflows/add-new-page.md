---
description: Cara menambahkan halaman dashboard baru dengan SSOT compliance
---

# Menambah Halaman Dashboard Baru

Setiap halaman baru **WAJIB** mengikuti pattern SSOT dan arsitektur BQ Data Layer v2.1.

## Step 0: Baca RULES.md

// turbo
Baca file `RULES.md` di root project dashboard untuk memahami arsitektur, design rules, dan implementation rules sebelum melakukan apapun.

```bash
cat RULES.md
```

## Step 1: Identifikasi Data Source

Cek apakah sheet yang dibutuhkan **sudah ada** sebagai:
1. External Table di BQ
2. View di `dashboard_views`
3. Native Table di `dashboard_native`

Jika belum ada, buat dulu di BQ sebelum lanjut.

## Step 2: Tambah Page Mapping di `bigquery-data-layer.ts`

File: `src/lib/bigquery-data-layer.ts`

Tambahkan entry di `PAGE_VIEW_MAP`:

```typescript
"/module/page-name": [
    {
        viewName: "v_nama_sheet",       // nama view (per SHEET, bukan per page)
        sheetName: "NAMA SHEET ASLI",   // harus match nama di spreadsheet
        hierarchyMapping: { ultg: "Master ULTG", gi: "Master Gardu Induk" },
        hierarchyPresent: ["ultg", "gi"],
    },
],
```

> **PENTING**: `viewName` merujuk ke view per SHEET. Jika sheet sudah ada di mapping page lain, pakai view yang sama.

## Step 3: Buat Page Config JSON

File: `src/lib/page-configs/<module>--<page>.json`

Penamaan: ganti `/` dengan `--`. Contoh: `/transmisi/anomali` → `transmisi--anomali.json`

```json
{
  "page": "/module/page-name",
  "label": "Nama Page",
  "dataSources": [
    {
      "sheetName": "NAMA SHEET PERSIS",
      "label": "Label",
      "columnsUsed": [
        { "name": "Master ULTG", "pos": "A" },
        { "name": "Master Gardu Induk", "pos": "B" }
      ],
      "hierarchyPresent": ["ultg", "gi"],
      "hierarchyMapping": {
        "ultg": "Master ULTG",
        "gi": "Master Gardu Induk"
      }
    }
  ],
  "relations": []
}
```

## Step 4: Buat page.tsx

File: `src/app/<module>/<page>/page.tsx`

### Import WAJIB (3 pilar SSOT):

```tsx
import { usePageData } from "@/hooks/usePageData";
import { DataFreshness } from "@/components/DataFreshness";
import { useChartTheme } from "@/components/page-builder/widgets/use-chart-theme";
```

### ECharts WAJIB pakai dynamic import:

```tsx
const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });
```

### Data fetching WAJIB pakai usePageData:

```tsx
const theme = useChartTheme();
const { sheets, loading, error } = usePageData("/module/page-name");
const rawData = useMemo(() => sheets[0]?.rows || [], [sheets]);
```

### Column names WAJIB pakai COL constants:

```tsx
const COL = {
    ULTG: "Master ULTG",
    GI: "Master Gardu Induk",
    BAY: "Master Bay",
} as const;

// Pakai: r[COL.ULTG]  ← BENAR
// Jangan: r["Master ULTG"]  ← SALAH (hardcoded string)
```

### DataFreshness WAJIB di header page:

```tsx
<DataFreshness />
```

## Step 5: Update Sidebar

File: `src/lib/sidebar-config.ts`

```tsx
{ href: "/module/page-name", label: "Nama Page", iconName: "IconName" }
```

Icon dari `lucide-react`. Pilih yang relevan.

## Step 6: Restart Dev Server & Verify

```bash
# Restart:
npm run dev

# Verify API:
curl localhost:3000/api/page-data?page=/module/page-name

# Verify page:
# Buka localhost:3000/module/page-name
```

## Step 7: Build Check

```bash
npx next build
```

Build harus exit code 0.

## ❌ JANGAN LAKUKAN

- Jangan buat custom API route (`/api/custom-endpoint`)
- Jangan pakai `fetch()` langsung di page component
- Jangan hardcode column names — pakai `COL` constants
- Jangan skip `DataFreshness` component
- Jangan skip `useChartTheme()`
- Jangan pakai `ssr: true` untuk ECharts
- Jangan buat view/native table per PAGE — harus per SHEET
