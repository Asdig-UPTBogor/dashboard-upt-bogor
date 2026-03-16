---
description: Cara menjalankan dan mengelola dev server dashboard
---

# Dev Server Dashboard

## Step 0: Baca RULES.md

// turbo
Baca file `RULES.md` di root project dashboard untuk memahami arsitektur, design rules, dan implementation rules sebelum melakukan apapun.

```bash
cat RULES.md
```

## Menjalankan Dev Server

```bash
cd dashboard
npm run dev
```

Server berjalan di `http://localhost:3000`

## Test API Page Data

```bash
# Format:
curl localhost:3000/api/page-data?page=/<module>/<page>

# Contoh:
curl localhost:3000/api/page-data?page=/transmisi/anomali
curl localhost:3000/api/page-data?page=/gardu-induk/hi-trafo
curl localhost:3000/api/page-data?page=/transmisi/monitoring-tower-kritis
```

Response berhasil = JSON dengan `sheets` array berisi `rows` dan `headers`.
Response gagal = `{ "error": "..." }`

## Kapan Harus Restart

Restart dev server **WAJIB** setelah:
- Menambah/edit file di `src/lib/page-configs/`
- Mengedit `bigquery-data-layer.ts` (page mapping)
- Mengedit environment variables

```bash
# Kill (Ctrl+C), lalu jalankan ulang:
npm run dev
```

## Port Konflik

Jika port 3000 sudah dipakai:

```bash
# Cari proses:
lsof -i :3000

# Kill:
kill -9 <PID>

# Atau jalankan di port lain:
PORT=3001 npm run dev
```

## Build Check

Sebelum push, pastikan build berhasil:

```bash
npx next build
```

Build harus exit code 0 tanpa error.

## Git Push

```bash
git add -A
git commit -m "feat: deskripsi perubahan"
git push origin main
```
