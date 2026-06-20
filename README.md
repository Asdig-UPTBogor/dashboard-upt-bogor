# 📊 Dashboard UPT Bogor

Aplikasi web visualisasi data untuk PLN UPT Bogor — menampilkan data dari Google Sheets dalam bentuk chart, tabel, dan peta interaktif.

## Tech Stack

| Teknologi | Fungsi |
|-----------|--------|
| [Next.js](https://nextjs.org) | Framework web (React) |
| TypeScript | Bahasa pemrograman |
| Tailwind CSS | Styling |
| Apache ECharts | Visualisasi chart |
| shadcn/ui | Komponen UI |
| Google Sheets API | Sumber data |

## Memulai

### Prasyarat

- Node.js v20+
- Git
- File credential Google Sheets (minta ke lead)

### Instalasi

```bash
# Clone repo
git clone https://github.com/Asdig-UPTBogor/dashboard-upt-bogor.git
cd dashboard-upt-bogor

# Install dependencies
npm install

# Set Google Sheets credential
export GOOGLE_CREDS_PATH=/path/ke/credential.json

# Jalankan di localhost
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000) di browser.

## Halaman yang Tersedia

| Halaman | URL |
|---------|-----|
| Overview | `/overview` |
| Gardu Induk | `/gardu-induk` |
| Peta Asset | `/asset-maps` |
| Transmisi | `/transmisi` |
| Proteksi | `/proteksi` |
| Program Kerja | `/program-kerja` |
| Jadwal Pekerjaan | `/jadwal-pekerjaan` |
| CE Next Level | `/ce-next-level` |

## Dokumentasi

- [ARCHITECTURE.md](./ARCHITECTURE.md) — Cara kerja dan struktur project
- [CONTRIBUTING.md](./CONTRIBUTING.md) — Panduan lengkap untuk developer
- [RULES.md](./RULES.md) — Aturan coding
