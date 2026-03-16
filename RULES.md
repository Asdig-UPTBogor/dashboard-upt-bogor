# 📋 Dashboard UPT Bogor — RULES

> **SSOT (Single Source of Truth) Rules** — Ikuti semua aturan ini saat membuat atau mengedit halaman, data layer, dan infrastruktur.

---

## 🏗️ Data Architecture (BQ Data Layer v2.1)

### Data Flow

```
Google Spreadsheet
    ↓
External Table (1 per sheet)
    ↓
BQ View (1 per SHEET — QC + filter + JOIN hierarchy)
    ↓
Native Table (1 per SHEET — snapshot, auto-refresh periodik)
    ↓
Dashboard API (SELECT kolom_spesifik per page, dari config)
    ↓
Frontend (usePageData — dumb, terima data jadi)
```

### Prinsip Utama

| Prinsip | Detail |
|---|---|
| **View = per SHEET** | 1 view per sheet sumber. BUKAN per page. View = "resep" QC |
| **Native Table = per SHEET** | 1 native table per sheet. Copy semua kolom dari View |
| **Config = per PAGE** | Config menentukan native table mana + kolom mana yang di-SELECT per page |
| **FE = Dumb** | Frontend hanya render data yang sudah di-filter oleh backend |
| **View gratis** | View tidak pakai storage, hanya SQL logic |
| **Native Table = data jadi** | Query cepat (<1s), di-refresh otomatis tiap 15 menit |

### Layer Responsibility

| Layer | Tanggung Jawab | Lokasi |
|---|---|---|
| External Table | Link/shortcut ke Google Spreadsheet | BQ datasets |
| View | QC: filter empty rows, JOIN hierarchy, UPPER(TRIM) | `dashboard_views` dataset |
| Native Table | Data snapshot (cache cepat) | `dashboard_native` dataset |
| Config | Mapping page → native table + kolom | Firestore (target) / JSON (current) |
| API `/api/page-data` | Baca config, SELECT kolom spesifik dari native table | Next.js API route |
| Frontend | Render data via `usePageData()` | React components |

### Contoh Mapping

```
Sheet: MASTER ASSET TOWER
  → View:         v_master_asset_tower
  → Native Table: n_master_asset_tower

Page /asset-maps       → SELECT LAT, LONG, NAMA_TOWER, ... FROM n_master_asset_tower
Page /transmisi/kerawanan → SELECT MASTER_ULTG, GARDU_INDUK, ... FROM n_master_asset_tower
```

> **Dua page bisa query native table yang sama, beda kolom. Tidak ada duplikasi.**

---

## 1. Data Flow: `usePageData` Hook

**WAJIB** — Semua page fetch data via `usePageData("/route")`, **BUKAN** custom API route (`/api/xxx`).

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

// ❌ SALAH — hardcoded hex
tooltip: { backgroundColor: "rgba(15,15,30,0.95)" }
```

**Theme properties:** `text`, `textMuted`, `emphasisText`, `tooltipBg`, `tooltipText`, `gridLine`

> **Catatan:** Accent/brand colors (palette `C.indigo`, `C.teal`, dll.) boleh tetap hardcoded — yang wajib theme-aware adalah colors untuk text, tooltip, grid, dan background chart.

---

## 4. Page Config

Setiap page **WAJIB** punya config yang menentukan:
- `nativeTable` — native table mana yang di-query
- `columns` — kolom spesifik yang dibutuhkan page
- `hierarchyMapping` — mapping kolom untuk cross-filtering

**Saat ini:** JSON di `src/lib/page-configs/{module}--{page-name}.json`
**Target:** Firestore collection `page_configs`

---

## 5. Sidebar Config

Semua page **WAJIB** terdaftar di `src/lib/sidebar-config.ts`:

```ts
{ href: "/transmisi/sld-tower", label: "SLD Tower", iconName: "FileImage" }
```

---

## 6. Hierarchy QC — Exact Column Names

Kolom hierarchy **WAJIB exact match**, case-sensitive:

| Hierarchy | Column Name (EXACT) |
|-----------|-------------------|
| ULTG | `Master ULTG` |
| Gardu Induk | `Master Gardu Induk` |
| Bay | `Master Bay` |

> **Catatan:** Di BQ, underscore replace spasi (`Master_ULTG`). Data layer melakukan normalisasi otomatis `_` → ` ` saat kirim ke frontend.

---

## 7. Column Names = Exact Match

Nama kolom di `page.tsx` **harus persis sama** dengan header di Google Sheet (setelah normalisasi BQ `_` → ` `).

```tsx
const COL = {
    ULTG: "Master ULTG",
    GI: "Master Gardu Induk",
    PENGHANTAR: "PENGHANTAR",
} as const;
```

---

## 8. No Custom API Routes untuk Data

**DILARANG** membuat `/api/xxx` untuk fetch data spreadsheet. Semua lewat `usePageData`.

> API route hanya boleh untuk resource non-spreadsheet (Google Drive, external service, dll).

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

- **shadcn/ui**: `Card`, `Button`, `Badge`, `Input`, `Skeleton`, `SelectNative`, `Table`, `Tabs`
- **Icons**: lucide-react
- **Charts**: echarts-for-react (dynamic import, `ssr: false`)

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

## ⚙️ Deployment: Local ↔ Cloud Run Consistency

| Aspek | Rule |
|---|---|
| **Environment Variables** | Semua config via env vars. Tidak boleh ada hardcoded path lokal |
| **Auth** | Lokal: SA key file via `GOOGLE_APPLICATION_CREDENTIALS`. CR: ADC otomatis |
| **Port** | Selalu pakai `process.env.PORT`. Default 3000 (Next.js), CR set 8080 |
| **File System** | CR = ephemeral. Jangan persist state ke filesystem. Pakai Firestore/BQ |
| **Build** | `npx next build` WAJIB sukses sebelum deploy |

---

## 🔒 Implementation Rules (WAJIB DIIKUTI)

> Rules ini berlaku untuk SEMUA implementasi — backend, frontend, script, dan infrastructure.

### 1. Jangan Sembrono

- **DILARANG** langsung run command/script tanpa memahami dampaknya
- Pahami sistem dan codebase yang ada SEBELUM membuat perubahan
- Baca file terkait, trace data flow, pahami dependency

### 2. Verify Before & After

- **WAJIB** verify state SEBELUM perubahan (apa yang akan berubah, dampak apa)
- **WAJIB** verify state SESUDAH perubahan (build, test, data integrity)
- Jangan anggap perubahan berhasil tanpa bukti verifikasi

### 3. Clean Code

- Code harus **bersih, rapih, dan tidak ambigu**
- Tidak boleh ada dead code, commented-out code, atau placeholder yang tertinggal
- Naming harus jelas dan deskriptif — variabel, fungsi, file

### 4. Debuggable & Extensible

- Code harus **mudah di-debug**: log yang informatif, error messages yang jelas
- Code harus **mudah di-trace**: alur eksekusi harus bisa diikuti dari entry point
- Code harus **mudah di-extend**: modular, tidak tightly coupled
- **Zero tolerance untuk bug** — test sebelum commit

### 5. No Silent Fallback

- **DILARANG** membuat fallback yang menyembunyikan error
- Lebih baik **throw error yang exact dan deskriptif** daripada fallback diam-diam
- Error message harus mencantumkan: apa yang gagal, kenapa, dan di mana

```typescript
// ✅ BENAR — error exact
if (!config) throw new Error(`[page-data] Config not found for page: ${page}. Check Firestore collection 'page_configs'.`);

// ❌ SALAH — silent fallback yang bikin bingung
const config = loadConfig(page) ?? DEFAULT_CONFIG; // user tidak tahu config-nya missing
```

### 6. Konsistensi

- Naming convention harus konsisten di seluruh codebase
- Pattern yang sama harus diimplementasikan dengan cara yang sama
- Jangan mix pattern (misal: sebagian pakai async/await, sebagian pakai .then())

### 7. Production & Enterprise Grade

- Code harus siap production — bukan prototype atau quick hack
- Proper error handling, input validation, edge case handling
- Logging yang terstruktur (JSON format untuk Cloud Logging)
- Perhatikan performance, memory usage, dan security

### 8. Konsisten dengan FE/UI Design

- **WAJIB** pahami design FE dan UI yang sudah ada sebelum membuat komponen baru
- Tanyakan jika ada kebingungan tentang design pattern atau UX flow
- Jangan membuat keputusan design FE sendiri tanpa diskusi

### 9. Local ↔ Cloud Run Inline

- Config harus **inline dan konsisten** antara local dev dan Cloud Run deployment
- Test di local HARUS representatif terhadap behavior di CR
- **DILARANG** ada config yang works di local tapi gagal di CR (atau sebaliknya)
- Env vars, auth flow, dan port WAJIB align

---

## 🔄 Iteration Rules (CARA KERJA KOLABORASI)

> Rules ini mengatur bagaimana agent berinteraksi dan berkolaborasi dengan user.

### 1. Tawarkan Opsi yang Jelas

- Saat iterasi, tawarkan opsi yang **mudah di-maintenance dan mudah di-debug**
- User tidak menulis code/script — user memahami **flow sistem dan memverifikasi output**
- Jelaskan pro/cons setiap opsi dengan bahasa yang mudah dipahami

### 2. Enterprise Grade First

- Selalu tawarkan solusi **enterprise grade** terlebih dahulu
- Baru kemudian iterasi untuk membuat keputusan design dan arsitektur/infrastruktur bersama
- Jangan tawarkan solusi "quick and dirty" kecuali diminta

### 3. Tech Stack Terupdate

- Gunakan tech stack yang **update dan modern**
- Riset best practices terbaru sebelum merekomendasikan solusi
- Jangan gunakan library/pattern yang sudah deprecated atau outdated

### 4. GCP Native First

- Jika ada solusi **GCP native** (BQ, Firestore, Cloud Run, Cloud Tasks, dll.) — prioritaskan itu
- Lebih baik pakai managed service Google daripada self-hosted/third-party jika tersedia
- Pertimbangkan cost dan free tier GCP

### 5. Proaktif Suggest Improvement

- Jika ada tech stack baru, pattern baru, atau cara yang lebih canggih — **buka diskusi iterasi**
- Jangan diam saja kalau ada improvement yang bisa ditawarkan
- Tapi tetap tanyakan dulu, jangan langsung implementasi

---

## ✅ Checklist Sebelum Push

- [ ] `usePageData` dipakai (bukan custom API)
- [ ] `DataFreshness` ada di page
- [ ] `useChartTheme` dipakai untuk chart colors
- [ ] Page config ada (JSON / Firestore)
- [ ] Page terdaftar di `sidebar-config.ts`
- [ ] Kolom hierarchy exact match (`Master ULTG`, `Master Gardu Induk`)
- [ ] Column names match Google Sheet headers (setelah BQ normalisasi)
- [ ] `npx next build` sukses tanpa error
- [ ] Tidak ada silent fallback — semua error explicit
- [ ] Code bersih, tidak ada dead code
- [ ] Config inline antara local dan Cloud Run
