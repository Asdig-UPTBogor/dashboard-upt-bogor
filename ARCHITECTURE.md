# 🏗️ Arsitektur Project — Dashboard UPT Bogor

> Dokumen ini menjelaskan bagaimana project ini dibuat dari nol sampai di-deploy ke Google Cloud Run.

---

## 1. Sejarah Pembuatan

### Inisialisasi Project
```bash
npx create-next-app@latest dashboard --typescript --tailwind --app --src-dir
```

### Library yang Ditambahkan
```bash
# UI Components
npx shadcn@latest init          # shadcn/ui design system
npx shadcn@latest add card badge table skeleton sidebar sheet

# Visualisasi
npm install echarts echarts-for-react    # chart utama
npm install maplibre-gl                   # peta

# Data
npm install googleapis                    # Google Sheets API

# Tema
npm install next-themes                   # dark/light mode
```

---

## 2. Arsitektur Sistem

```
                    ┌─────────────────────┐
                    │    Google Sheets     │
                    │  (Sumber Data Utama) │
                    └──────────┬──────────┘
                               │ Google Sheets API
                    ┌──────────▼──────────┐
                    │   Next.js API Routes │
                    │  /api/overview       │
                    │  /api/gardu-induk    │
                    │  /api/towers         │
                    │  /api/strikes        │
                    │  /api/data-sources   │
                    └──────────┬──────────┘
                               │ JSON response
                    ┌──────────▼──────────┐
                    │   Next.js Frontend   │
                    │  React + ECharts     │
                    │  + shadcn/ui         │
                    └──────────┬──────────┘
                               │
               ┌───────────────┼───────────────┐
               ▼               ▼               ▼
          localhost:3000   Cloud Run      uptbogor-dashboard.biz.id
           (dev)          (production)    (custom domain)
```

### Alur Data:
1. Data disimpan di **Google Sheets** (dikelola oleh operator PLN)
2. **API Routes** (Next.js) fetch data dari Google Sheets via API
3. **Frontend** (React) fetch dari API Routes dan render chart/tabel
4. Data di-cache oleh Next.js ISR (`revalidate = 300` = 5 menit)

---

## 3. Konfigurasi Data Source

### File: `src/lib/spreadsheet-config.json`
Registry semua spreadsheet yang terhubung ke dashboard:
```json
[
  {
    "spreadsheetId": "1vpVUczVs8...",
    "title": "General Information UPT Bogor",
    "sheets": [
      {
        "sheetName": "Asset GI",
        "route": "gardu-induk",
        "headerRow": 1,
        "active": true
      }
    ]
  }
]
```

### File: `src/lib/dashboard-config.ts`
Google credentials + scopes untuk akses spreadsheet.

### Cara Tambah Spreadsheet Baru:
Gunakan UI **Data Source Manager** di `/maintenance/data-source`:
1. Klik "+ Tambah Spreadsheet"
2. Paste URL Google Sheet
3. Pilih sheet yang mau dipakai
4. Otomatis terdaftar di `spreadsheet-config.json`

---

## 4. Google Sheets Credential

### Cara Setup:
1. Buat project di **Google Cloud Console**
2. Enable **Google Sheets API**
3. Buat **Service Account** dengan role "Viewer"
4. Download JSON key file
5. **Share** setiap Google Sheet ke email service account
6. Set environment variable:
   ```bash
   export GOOGLE_CREDS_PATH=/path/ke/credential.json
   ```

### Path Default (Development):
```
/home/server-01/google-auth/automaticspreadsheet-de108e1d5b56.json
```

> ⚠️ File credential ini **JANGAN** di-commit ke Git!

---

## 5. Cara Run di Local

### Development:
```bash
npm install         # install dependencies (1x saja)
npm run dev         # jalankan di http://localhost:3000
```

### Production Build (test sebelum deploy):
```bash
npm run build       # build production bundle
npm start           # jalankan production di localhost:3000
```

---

## 6. Deploy ke Cloud Run

### Prerequisites:
- Google Cloud SDK (`gcloud`) terinstall
- Project GCP sudah ada
- Service account credential sudah ada

### Cara Deploy:

#### Opsi A: Deploy Langsung (Paling Gampang)
```bash
gcloud run deploy dashboard-upt-bogor \
  --source . \
  --region asia-southeast2 \
  --allow-unauthenticated \
  --set-env-vars GOOGLE_CREDS_PATH=/app/credentials.json
```

#### Opsi B: Pakai Docker Manual
```bash
# 1. Build image
docker build -t dashboard-upt-bogor .

# 2. Test local
docker run -p 3000:3000 dashboard-upt-bogor

# 3. Tag untuk GCR
docker tag dashboard-upt-bogor gcr.io/PROJECT_ID/dashboard-upt-bogor

# 4. Push ke Google Container Registry
docker push gcr.io/PROJECT_ID/dashboard-upt-bogor

# 5. Deploy ke Cloud Run
gcloud run deploy dashboard-upt-bogor \
  --image gcr.io/PROJECT_ID/dashboard-upt-bogor \
  --region asia-southeast2 \
  --allow-unauthenticated
```

### Dockerfile yang Dipakai:
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

> Next.js dikonfigurasi dengan `output: "standalone"` di `next.config.ts`
> agar bisa di-deploy sebagai container tanpa node_modules penuh.

---

## 7. Custom Domain

Dashboard diakses via: **https://uptbogor-dashboard.biz.id**

Setup custom domain:
1. Cloud Run → Service → Custom Domains
2. Tambah domain → ikuti verifikasi DNS
3. Tambah record CNAME di domain registrar

---

## 8. Environment Variables

| Variable | Deskripsi | Wajib |
|----------|-----------|-------|
| `GOOGLE_CREDS_PATH` | Path ke file credential Google | ✅ |
| `NODE_ENV` | `production` atau `development` | Auto |
| `HOSTNAME` | `0.0.0.0` untuk container | Di Dockerfile |

---

## 9. Alur Development → Deploy

```
Developer bikin fitur baru
    │
    ├── 1. git checkout -b feat/nama-fitur
    ├── 2. coding + test di localhost
    ├── 3. git add . && git commit && git push
    ├── 4. Buat Pull Request di GitHub
    ├── 5. Lead review & approve
    ├── 6. Merge ke main
    │
    └── 7. Deploy ke Cloud Run:
          gcloud run deploy dashboard-upt-bogor --source .
```

> Di fase awal, deploy dilakukan **manual** oleh lead.
> Nanti bisa di-otomasi pakai Cloud Build (auto deploy saat merge ke main).
