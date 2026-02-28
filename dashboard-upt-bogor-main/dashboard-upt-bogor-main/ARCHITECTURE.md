# 🏗️ Arsitektur Project — Dashboard UPT Bogor

---

## Cara Kerja Dashboard Ini

Dashboard ini menampilkan data dari **Google Sheets** sebagai halaman web — berisi chart, tabel, dan peta.

```
┌────────────────┐       ┌─────────────────┐       ┌──────────────────┐
│  Google Sheets  │──────▶│   API (Backend)  │──────▶│  Halaman Web     │
│  (data mentah)  │       │  ambil & olah    │       │  chart + tabel   │
└────────────────┘       └─────────────────┘       └──────────────────┘
```

Setiap halaman di dashboard terdiri dari **2 file**:

| File | Fungsi | Contoh |
|------|--------|--------|
| `src/app/api/xxx/route.ts` | Ambil data dari Google Sheets | `api/gardu-induk/route.ts` |
| `src/app/xxx/page.tsx` | Tampilkan data di browser | `gardu-induk/page.tsx` |

> 💡 **Halaman contoh terbaik:** `src/app/gardu-induk/page.tsx` — jadikan referensi saat bikin halaman baru.

---

## Alur Kerja Tim

```
         Kamu                                    Lead
          │                                        │
   1. Pilih halaman                                │
      yang mau dikerjakan                          │
          │                                        │
   2. Bikin branch baru                            │
      git checkout -b feat/nama-halaman            │
          │                                        │
   3. Coding di laptop kamu                        │
      (test di localhost:3000)                     │
          │                                        │
   4. Sudah oke? Push ke GitHub                    │
      git add . → git commit → git push            │
          │                                        │
   5. Buat Pull Request ──────────────────▶  6. Lead review code
      di GitHub                                    │
          │                                  7. Jika oke, approve
          │                                     & merge ke main
          │                                        │
          │                                  8. Lead deploy ke
          │                                     server production
          │                                        │
          ▼                                        ▼
     ✅ Selesai!                        🌐 Live di internet
```

**Yang kamu lakukan:** Langkah 1–5 saja.
**Yang lead lakukan:** Langkah 6–8.

---

## Bikin Halaman Baru Pakai Antigravity

Kamu bisa minta Antigravity untuk membuatkan halaman. Contoh perintah:

> "Bikin halaman dashboard untuk data Relay Proteksi.
> Ambil data dari spreadsheet 'Asset Relay UPT Bogor' sheet 'Asset Relay'.
> Tampilkan: 4 KPI cards di atas, bar chart distribusi per GI,
> donut chart per status, dan tabel data di bawah.
> Ikuti pattern dari file gardu-induk/page.tsx."

Antigravity akan buatkan 2 file:
1. **API:** `src/app/api/proteksi/route.ts` — ambil data
2. **Page:** `src/app/proteksi/page.tsx` — tampilkan data

Setelah jadi, test di browser `http://localhost:3000/proteksi` — kalau bagus, push!

---

## Struktur Folder

```
src/app/
├── page.tsx                       ← Halaman utama (Overview)
├── gardu-induk/page.tsx           ← Halaman Gardu Induk ⭐ CONTOH
├── asset-maps/page.tsx            ← Halaman Peta
├── maintenance/data-source/       ← Data Source Manager (admin)
└── api/                           ← Semua API ada di sini
    ├── overview/route.ts
    ├── gardu-induk/route.ts
    └── ...
```

**Mau bikin halaman baru?** Tinggal buat folder baru:
```
src/app/proteksi/page.tsx     → otomatis jadi localhost:3000/proteksi
src/app/api/proteksi/route.ts → otomatis jadi API data-nya
```

---

## Aturan Penting

- ✅ Selalu bikin **branch** — jangan langsung edit di main
- ✅ Test di **localhost** dulu sebelum push
- ✅ Pakai `gardu-induk/page.tsx` sebagai **referensi**
- ❌ Jangan edit file yang bukan bagian kamu
- ❌ Jangan deploy sendiri — serahkan ke lead

> Baca `CONTRIBUTING.md` untuk aturan lengkap dan panduan Git.
