# 🏗️ Tentang Project Ini

Dashboard PLN UPT Bogor menampilkan data asset gardu induk dari Google Sheets secara visual (chart, tabel, peta).

---

## Cara Kerja (Simpel)

```
Google Sheets (data)  →  API (ambil data)  →  Web Page (tampilkan chart/tabel)
```

1. Data disimpan oleh operator di **Google Sheets**
2. Dashboard **mengambil data otomatis** dari Google Sheets
3. Data ditampilkan sebagai **chart, tabel, dan peta**

---

## Struktur Folder

Yang perlu kamu tau:

```
src/app/
├── page.tsx                   ← Halaman utama (Overview)
├── gardu-induk/page.tsx       ← Halaman Gardu Induk ← CONTOH referensi
├── asset-maps/page.tsx        ← Halaman Peta Asset
├── api/                       ← Folder API (ambil data dari Sheets)
│   ├── overview/route.ts
│   ├── gardu-induk/route.ts
│   └── ...
└── maintenance/               ← Halaman admin/tools
    └── data-source/page.tsx
```

**Kalau mau bikin page baru**, buat folder baru di `src/app/`, contoh:
```
src/app/proteksi/page.tsx      ← otomatis jadi http://localhost:3000/proteksi
```

---

## Alur Kerja Kamu

```
1. Bikin branch baru
2. Coding page baru di laptop kamu
3. Test di localhost (http://localhost:3000)
4. Push ke GitHub
5. Buat Pull Request
6. Lead review & approve
7. Lead yang deploy ke server production
```

> Kamu **tidak perlu** deploy sendiri. Fokus bikin page aja.
> Setelah di-merge, lead yang akan deploy ke server.

---

## Cara Bikin Page Baru (Pakai Antigravity)

Buka Antigravity Agent, lalu ketik seperti ini:

> "Bikin halaman dashboard untuk data Relay Proteksi.
> Ambil data dari spreadsheet 'Asset Relay UPT Bogor' sheet 'Asset Relay'.
> Tampilkan: KPI cards (total relay, total merk), bar chart per GI,
> donut chart status, dan data table.
> Ikutin pattern dari gardu-induk/page.tsx."

Antigravity akan buatkan:
1. File API: `src/app/api/nama-page/route.ts`
2. File Page: `src/app/nama-page/page.tsx`

Test di browser → kalau oke → push ke GitHub!

---

## Referensi

- **Contoh page terbaik:** `src/app/gardu-induk/page.tsx`
- **Aturan lengkap:** Baca `CONTRIBUTING.md`
- **Repo:** https://github.com/Asdig-UPTBogor/dashboard-upt-bogor
