# 📖 Panduan Tim — Dashboard UPT Bogor

> Panduan lengkap untuk developer yang baru bergabung ke project ini.
> Harap baca dari awal sampai akhir sebelum mulai coding.

---

## 1. Tentang Project Ini

Dashboard PLN UPT Bogor = aplikasi web untuk menampilkan data asset gardu induk dari Google Sheets secara visual (chart, tabel, peta).

**Tech Stack:**
| Teknologi | Fungsi |
|-----------|--------|
| Next.js 16 | Framework web (React) |
| TypeScript | Bahasa pemrograman |
| Tailwind CSS | Styling |
| Apache ECharts | Visualisasi chart |
| shadcn/ui | Komponen UI (Card, Table, Badge, dll) |
| Google Sheets API | Sumber data |

---

## 2. Yang Harus di-Install

### Wajib:
1. **Node.js** (v20+) → https://nodejs.org/
2. **Git** → https://git-scm.com/
3. **VS Code** → https://code.visualstudio.com/
4. **Akun GitHub** → https://github.com/signup

### Opsional (sangat direkomendasikan):
5. **Antigravity Agent** (AI coding assistant) — minta setup ke lead

---

## 3. Setup Project (1x saja)

```bash
# 1. Clone repo
git clone https://github.com/Asdig-UPTBogor/dashboard-upt-bogor.git

# 2. Masuk folder
cd dashboard-upt-bogor

# 3. Install dependencies
npm install

# 4. Jalankan di localhost
npm run dev

# 5. Buka browser → http://localhost:3000
```

### Setup Google Credentials
Minta file credential Google dari lead, lalu simpan di path yang sama.
Set environment variable:
```bash
export GOOGLE_CREDS_PATH=/path/ke/credential.json
```

---

## 4. Git Workflow (WAJIB DIIKUTI)

### Aturan Utama
> ⚠️ **JANGAN PERNAH push langsung ke `main`!**
> Selalu bikin branch baru untuk setiap fitur/page.

### Alur Kerja:

```bash
# 1. Pastikan di branch main dan up-to-date
git checkout main
git pull origin main

# 2. Bikin branch baru (nama sesuai fitur)
git checkout -b feat/page-nama-page

# 3. Coding... test... selesai...

# 4. Cek perubahan
git status

# 5. Tambah semua file yang berubah
git add .

# 6. Commit dengan pesan yang jelas
git commit -m "feat: tambah page proteksi relay"

# 7. Push ke GitHub
git push origin feat/page-nama-page

# 8. Buka GitHub → buat Pull Request → minta review
```

### Format Nama Branch:
| Prefix | Kapan Dipakai | Contoh |
|--------|---------------|--------|
| `feat/` | Fitur/page baru | `feat/page-proteksi` |
| `fix/` | Perbaikan bug | `fix/chart-error` |
| `style/` | Perubahan tampilan | `style/dark-mode-fix` |

### Format Commit Message:
```
feat: tambah page proteksi          ← fitur baru
fix: perbaiki error chart donut     ← fix bug
style: update warna header          ← tampilan
refactor: pisah komponen tabel      ← refactor code
```

---

## 5. Struktur Project

```
src/
├── app/
│   ├── page.tsx                    ← Halaman Overview (home)
│   ├── gardu-induk/page.tsx        ← Halaman Gardu Induk
│   ├── asset-maps/page.tsx         ← Halaman Peta Asset
│   ├── maintenance/
│   │   └── data-source/page.tsx    ← Data Source Manager
│   ├── api/
│   │   ├── overview/route.ts       ← API untuk overview
│   │   ├── gardu-induk/route.ts    ← API untuk gardu induk
│   │   ├── towers/route.ts         ← API untuk tower
│   │   ├── strikes/route.ts        ← API untuk petir
│   │   └── data-sources/route.ts   ← API sumber data
│   └── layout.tsx                  ← Layout utama + sidebar
├── components/
│   └── ui/                         ← Komponen shadcn/ui
├── lib/
│   ├── dashboard-config.ts         ← Config Google credentials
│   ├── spreadsheet-config.json     ← Registry semua spreadsheet
│   ├── data-source-registry.ts     ← Load/save registry
│   └── data-source-resolver.ts     ← Resolve data source
```

---

## 6. Cara Membuat Page Baru

### Langkah 1: Buat API Route
Buat file `src/app/api/nama-page/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { getGoogleAuth, GOOGLE_SCOPES } from "@/lib/dashboard-config";
import { google } from "googleapis";

export const revalidate = 300; // cache 5 menit

export async function GET() {
  const auth = await getGoogleAuth();
  const sheets = google.sheets({ version: "v4", auth });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: "ID_SPREADSHEET_DARI_CONFIG",
    range: "NamaSheet!A:Z",
  });

  const [headers, ...rows] = res.data.values || [];
  const data = rows.map((row) =>
    Object.fromEntries(headers.map((h, i) => [h, row[i] || ""]))
  );

  return NextResponse.json({ data });
}
```

### Langkah 2: Buat Page
Buat file `src/app/nama-page/page.tsx`:

```tsx
"use client";

import { useEffect, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

// Warna standar (WAJIB pakai ini)
const C = {
  indigo: "#818cf8", teal: "#2dd4bf", amber: "#fbbf24",
  purple: "#c084fc", pink: "#f472b6", emerald: "#34d399",
  rose: "#fb7185", blue: "#60a5fa", cyan: "#22d3ee",
};

// ECharts theme standar
const echartBase = {
  backgroundColor: "transparent",
  textStyle: { fontFamily: "Inter, sans-serif", color: "#a1a1aa" },
};

export default function NamaPage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/nama-page")
      .then((r) => r.json())
      .then((json) => { setData(json.data || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <Skeleton className="h-96" />;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Judul Page</h1>
      {/* KPI Cards, Charts, Tables di sini */}
    </div>
  );
}
```

### Langkah 3: Tambah ke Sidebar
Edit `src/components/app-sidebar.tsx` → tambah link ke page baru.

### Langkah 4: Test
```bash
npm run dev
# Buka http://localhost:3000/nama-page
```

---

## 7. Pakai Antigravity Agent

Kamu bisa minta AI Antigravity untuk membuat page. Contoh prompt:

> "Buat halaman dashboard untuk data Relay Proteksi.
> Ambil data dari spreadsheet 'Asset Relay UPT Bogor' sheet 'Asset Relay'.
> Tampilkan: KPI cards (total relay, total merk), bar chart distribusi per GI,
> donut chart status, dan data table. Pakai pattern yang sama seperti
> gardu-induk/page.tsx."

**Tips pakai Antigravity:**
- Selalu sebutkan **nama spreadsheet** dan **sheet** yang mau dipakai
- Sebutkan **jenis chart** yang diinginkan
- Minta ikuti **pattern dari gardu-induk/page.tsx** sebagai referensi
- Test hasilnya di browser sebelum push

---

## 8. Rules — DO ✅ dan DON'T ❌

### ✅ DO (Lakukan)
- ✅ Selalu bikin **branch baru** untuk setiap fitur
- ✅ Selalu `git pull origin main` sebelum mulai kerja
- ✅ Commit sering dengan pesan yang jelas
- ✅ Test di `localhost` sebelum push
- ✅ Pakai warna dari objek `C` (jangan bikin warna sendiri)
- ✅ Pakai komponen shadcn/ui (Card, Badge, Table, dll)
- ✅ Pakai `echarts-for-react` untuk chart (bukan chart.js/recharts)
- ✅ Fetch data via API route, bukan langsung dari Google Sheets
- ✅ Gunakan `"use client"` di awal setiap page
- ✅ Pastikan `npm run build` sukses sebelum push

### ❌ DON'T (Jangan)
- ❌ **JANGAN** push langsung ke `main`
- ❌ **JANGAN** edit file orang lain tanpa diskusi
- ❌ **JANGAN** commit `node_modules/` atau `.next/`
- ❌ **JANGAN** hardcode warna — pakai objek `C`
- ❌ **JANGAN** simpan credential/password di code
- ❌ **JANGAN** pakai `git push --force` (bahaya!)
- ❌ **JANGAN** edit `spreadsheet-config.json` manual — pakai UI Data Source Manager
- ❌ **JANGAN** edit `layout.tsx` atau `globals.css` tanpa izin lead

---

## 9. Troubleshooting

| Masalah | Solusi |
|---------|--------|
| `npm install` error | Hapus `node_modules` lalu `npm install` ulang |
| Port 3000 sudah dipakai | `npx kill-port 3000` lalu `npm run dev` |
| Git conflict | Minta bantuan lead atau Antigravity |
| Chart tidak muncul | Pastikan pakai `dynamic import` untuk ECharts |
| Data kosong | Cek apakah Google credential sudah di-setup |

---

## 10. Kontak / Bantuan
- **Lead:** (isi nama lead)
- **Repo:** https://github.com/Asdig-UPTBogor/dashboard-upt-bogor
- **AI Assistant:** Gunakan Antigravity Agent untuk bantuan coding
