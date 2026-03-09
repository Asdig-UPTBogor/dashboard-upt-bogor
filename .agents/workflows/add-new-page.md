---
description: Cara menambahkan halaman dashboard baru dengan SSOT compliance
---

# Menambah Halaman Dashboard Baru

Setiap halaman baru **WAJIB** mengikuti pattern SSOT. Jangan pakai custom `fetch()` atau API route terpisah.

## Step 1: Buat Page Config JSON

File: `src/lib/page-configs/<module>--<page>.json`

Penamaan: ganti `/` dengan `--`. Contoh: `/transmisi/anomali` → `transmisi--anomali.json`

```json
{
  "page": "/module/page-name",
  "label": "Nama Page",
  "dataSources": [
    {
      "spreadsheetId": "<SPREADSHEET_ID>",
      "sheetName": "<NAMA_SHEET_PERSIS>",
      "label": "<LABEL>",
      "route": "",
      "columnsUsed": [
        { "name": "Master ULTG", "pos": "A" },
        { "name": "Master Gardu Induk", "pos": "B" }
      ],
      "hierarchyPresent": ["ultg", "gi", "bay"],
      "hierarchyMapping": {
        "ultg": "Master ULTG",
        "gi": "Master Gardu Induk",
        "bay": "Master Bay"
      }
    }
  ],
  "relations": []
}
```

> **PENTING**: `sheetName` harus match PERSIS dengan nama di spreadsheet-config.json (case-sensitive).

Referensi contoh: `transmisi--anomali.json`, `gardu-induk--hi-trafo.json`

## Step 2: Update spreadsheet-config.json

File: `src/lib/spreadsheet-config.json`

Cari sheet yang dipakai, tambahkan route page ke array `usedBy`:

```json
"usedBy": [
    "/existing-page",
    "/module/page-baru"    // ← tambah ini
]
```

## Step 3: Buat page.tsx

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
    // ... semua column
} as const;

// Pakai: r[COL.ULTG]  ← BENAR
// Jangan: r["Master ULTG"]  ← SALAH (hardcoded string)
```

### DataFreshness WAJIB di header page:

```tsx
<DataFreshness />
```

### Donut Chart: Monitoring Tower Kritis Pattern

Semua donut chart WAJIB mengikuti pattern ini:

```tsx
series: [{
    type: "pie", radius: ["40%", "68%"], center: ["50%", "45%"],
    padAngle: 2, itemStyle: { borderRadius: 6 },
    label: {
        show: true, fontSize: 11, color: "#d4d4d8",
        formatter: (p) => `{name|${p.name}}\n{val|${p.value}} ({pct|${p.percent.toFixed(0)}%})`,
        rich: {
            name: { fontSize: 11, color: "#e4e4e7", fontWeight: "bold", lineHeight: 16 },
            val: { fontSize: 12, color: "#fbbf24", fontWeight: "bold" },
            pct: { fontSize: 10, color: "#a1a1aa" },
        },
    },
    labelLine: { show: true, length: 15, length2: 12, smooth: 0.3, lineStyle: { color: "#52525b", width: 1.5 } },
    selectedMode: "single", selectedOffset: 10,
    emphasis: { scaleSize: 6, label: { fontSize: 12 } },
    data,
}],
animationType: "scale", animationDuration: 800, animationEasing: "cubicOut",
```

Fitur wajib donut:
- `rich:` labels (name, val, pct)
- `labelLine` smooth 0.3
- `shadowBlur` glow pada active segment
- `cubicOut` animation 800ms

### Bar chart: Pakai useChartTheme

```tsx
tooltip: { backgroundColor: theme.tooltipBg, textStyle: { color: theme.tooltipText } },
splitLine: { lineStyle: { color: theme.gridLine } },
label: { color: theme.emphasisText },
```

## Step 4: Update Sidebar

File: `src/lib/sidebar-config.ts`

Tambahkan entry di section yang sesuai:

```tsx
{ href: "/module/page-name", label: "Nama Page", iconName: "IconName" }
```

Icon dari `lucide-react`. Pilih yang relevan.

## Step 5: Restart Dev Server

Page config baru **tidak auto-reload**. Harus restart:

```bash
# Kill dev server (Ctrl+C), lalu:
npm run dev
```

## Step 6: Verify

1. Buka `localhost:3000/module/page-name`
2. Cek data muncul
3. Cek API: `curl localhost:3000/api/page-data?page=/module/page-name`

## ❌ JANGAN LAKUKAN

- Jangan buat custom API route (`/api/custom-endpoint`)
- Jangan pakai `fetch()` langsung di page component
- Jangan hardcode column names — pakai `COL` constants
- Jangan skip `DataFreshness` component
- Jangan skip `useChartTheme()`
- Jangan pakai `ssr: true` untuk ECharts
