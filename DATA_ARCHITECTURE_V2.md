# 🏛️ Data Architecture V2.2 (Enterprise Data Layer)

> **DOKUMEN WAJIB BACA UNTUK SEMUA AI AGENT DAN DEVELOPER**
> Catatan Arsitektur Resmi Dashboard UPT Bogor.
> Pendamping file `RULES.md`.

Dokumen ini mendefinisikan arsitektur "BigQuery Data Layer v2.2" yang **WAJIB dipatuhi** saat melakukan refaktor, perbaikan *bug*, atau penambahan halaman dan sumber data baru di Dashboard UPT Bogor. Desain ini dibuat secara khusus untuk memisahkan beban kerja (*decoupling*) antara Backend (Google Cloud) dan Frontend (Next.js *client-side*) layaknya aplikasi skala *Enterprise BUMN*.

---

## 🗺️ Visualisasi Arsitektur "Resilient DSM v2.2" (ASCII Flow)

```text
[ TAHAP PENGIRIMAN DATA (The Source) ]
   ┌────────────────────┐               ┌──────────────────────┐
   │ 📝 Google Sheets   │               │ 🔑 Spreadsheet       │
   │ (Data Transaksi:   │               │ MASTER HIERARCHY     │
   │ Misal: Uji Trafo,  │               │ (ID UPT, ID ULTG,    │
   │ Anomali, MTU)      │               │  ID GI, ID Bay)      │
   └─────────┬──────────┘               └──────────┬───────────┘
             │                                     │
             v                                     v
   ┌────────────────────┐               ┌──────────────────────┐
   │ 🗄️ BQ External    │               │ 🗄️ BQ External      │
   │    Table (Raw)     │               │    Table (Master)    │
   └─────────┬──────────┘               └──────────┬───────────┘
             │                                     │
             └──────────────────┐ ┌────────────────┘
                                v v
[ TAHAP QUALITY CONTROL TINGKAT TINGGI (The Kitchen) ]
                   ┌────────────────────────────┐
                   │ 🧠 BQ VIEW (LOGIC LAYER)   │
                   │ Tugas:                     │
                   │ 1. JOIN (Mencocokkan baris │
                   │    data dengan Master IDs) │
                   │ 2. UPPER(), TRIM() strings │
                   │ 3. Buang Baris Kosong      │
                   └──────────────┬─────────────┘
                                  │
      (Inilah Proses Baru yang Menggantikan Scheduled Query Biasa!)
                                  v
[ TAHAP KETAHANAN DATA & DSM (The Bouncer / Satpam) ]
=======================================================================
   🤖 CLOUD RUN WORKER / SCRIPT CRON (Berjalan BUKAN sebagai pure SQL)
   
   [1. Cek Kolom] Mengintip ke BQ View: "Kolom apa yg tersedia hari ini?"
   [2. Bandingkan] Melirik Config API: "Apakah sesuai yg diminta UI?"
   [3. EKSEKUSI TERPISAH]
       ├─ Jika SESUAI: Tarik semua kolom -> Simpan ke Native Table
       └─ Jika BEDA / HILANG:
            a. Tarik hanya kolom yang ADA (Jangan error-kan proses)
            b. Lempar Notifikasi Error -> Simpan ke FIRESTORE LOGS
=======================================================================
                                  │
                                  v
[ TAHAP SERVERLESS STORAGE & PENYAJIAN (The Ready Data) ]
                       ┌────────────────────┐
     ┌────────────────>│ 🗃️ FIRESTORE LOGS │ (Log Error Kolom Hilang)
     │                 └──────────┬─────────┘      
     │                            │                
   ┌─┴────────────────┐           │     
   │ 🚀 NATIVE TABLE  │<──────────┘ (Data Matang, Ber-ID Master, Cepat)
   └─────────┬────────┘
             │
             v
[ TAHAP FRONTEND - DUMB UI & SMART ORCHESTRATOR (The Restaurant Table) ]
   ┌────────────────────────────────────────────────────────┐
   │ 💻 NEXT.JS DASHBOARD (Client Browser)                  │
   │                                                        │
   │ 1. API: Fetch Native Table sekencang kilat (<50ms).    │
   │ 2. VISUAL: Render Echarts, Donut, MapLibre.            │
   │ 3. ORCHESTRATOR: Filter & Drill down dilakukan 100%    │
   │    di sini (Javascript) tanpa beban server/BQ.         │
   │                                                        │
   │ 🚨 UI TAMBAHAN DSM: Membaca Firestore. Jika ada log  │
   │    "Notif Kolom Hilang", muncul Banner Merah ke Admin! │
   └────────────────────────────────────────────────────────┘
```

---

## 🏗️ 1. Pondasi: The Master Hierarchy & String-to-ID Enrichment

Alasan kenapa data sering rusak di dasbor biasa adalah karena operator mengisi teks (*string*) bebas di lembar transaksi, tanpa ada relasi ID (*Primary Key*). Pada arsitektur V2.2, hal tersebut dipecahkan secara elegan di BigQuery.

### Konsep Transaksi vs Master
1.  **Child Sheets (Lembar Transaksi):** Berisi entri harian operator (misal: Anomali, MTU Trafo). Lembar ini **TIDAK PERLU** memiliki kolom ID. Operator cukup mengetik atau memilih nama teks biasa (misal: `Master Gardu Induk` = `"GI SENTUL"`).
2.  **Master Hierarchy Spreadsheet:** Lembar khusus yang bertindak bagaikan pangkalan data relasional. Berisi tabel kebenaran absolut: `ID UPT`, `ID ULTG`, `ID GI`, `ID Bay` berserta nama teksnya.

### Proses "Penyulapan" Teks Menjadi ID (Tugas Mutlak BQ View)
Script SQL di dalam `BQ View` bertugas menangkap teks dari lembar transaksi, lalu menjodohkannya (`LEFT JOIN`) dengan teks di *Master Hierarchy*.
```sql
-- DILARANG MENGUBAH POLA INI
SELECT 
   child.*,            -- Semua data operasional ditarik
   master.ID_UPT,      -- ID UPT di-inject otomatis
   master.ID_ULTG,     -- ID ULTG di-inject otomatis
   master.ID_GI        -- ID GI di-inject otomatis
FROM 
   `dataset.external_transaksi` child
LEFT JOIN
   `dataset.external_master` master
   ON TRIM(UPPER(child.Master_Gardu_Induk)) = TRIM(UPPER(master.Nama_GI)) 
   -- JOIN Wajib Menggunakan fungsi pembersih teks
```
**Hasilnya:** *Native Table* (kuki siap saji) yang keluar dari BigQuery sudah dilengkapi dengan jalinan hierarki ID yang sempurna, siap disantap *Frontend* tanpa ambigu.

---

## ⚖️ 2. Boundary: Tanggung Jawab BQ vs Frontend

Arsitektur ini melarang percampuran tugas. Batasannya tegas:

| Komponen | Peran & Batasan Tanggung Jawab |
| :--- | :--- |
| **BigQuery (Backend ETL)** | **Si Koki Preparation.**<br>Hanya bertugas membersihkan teks (UPPER/TRIM), menyaring baris kosong, dan meng-inject ID hierarki. **DILARANG** melakukan komputasi dinamis berdasarkan interaksi pengguna (misal: *query string parameter*). Hasil akhirnya harus 1 buah `Native Table` datar per lembar Google Sheet utama. |
| **API Route / Edge (`/api`)** | **Si Pelayan Bisu.**<br>Hanya melayani perintah `SELECT col_A, col_B FROM Native_Table` berdasarkan *Config JSON/Firestore*. Tidak boleh ada manipulasi susunan data di level ini. |
| **Frontend UI (Next.js)** | **The Smart Orchestrator.**<br>Fitur *Drill-Down*, *Cross-Filtering*, perhitungan agregasi *chart*, dan sinkronisasi tampilan komponen **100% DIKERJAKAN DI CLIENT MEMORY BROWSER (JavaScript Array Filter)**.<br>*(Alasan Bisnis: Mencegah latensi BQ dan menjaga response time seketika < 50ms bagi pengguna eksklusif).* |

---

## 🛡️ 3. "Resilient Sync" System (Arsitektur Anti-Kiamat V2.2)

Bahaya terbesar dari Google Sheets adalah operator iseng mengubah nama kolom (Header), yang menyebabkan SQL View hancur dan *Scheduled Query* BQ berhenti membarui data. Arsitektur V2.2 mengatasi ini dengan **Data System Management (DSM)**.

### Aturan Sinkronisasi V2.2:
1.  **DILARANG** menggunakan fasilitas klik "Scheduled Query" murni milik BQ console untuk sinkronisasi Sheet ke Native Table.
2.  Sinkronisasi BQ (Sheet -> Native Table) harus dijalankan oleh sebuah *Worker Script* (misal: Cloud Run Job, Cloud Functions, atau Cron API khusus).
3.  **Protokol "Skip & Warn" (Resilient Protocol):**
    *   *Worker* harus mendeteksi skema External Table terlebih dahulu.
    *   *Worker* membandingkannya dengan *Golden Schema / Config*.
    *   Jika ada Anomali (misal: kolom "Kondisi" berganti menjadi "Status"): *Worker* **TETAP HARUS** men-generate Native Table dengan sisa kolom yang ada (jangan *error throw* yang menghentikan pipa data).
4.  **Umpan Balik DSM (Firestore Logs):**
    *   Setiap kegagalan (*missing column*) harus dicatatkan ke koleksi `dsm_system_logs` di Firestore.
    *   Halaman Administrator di *Frontend* harus memiliki komponen Banner Merah (Notifikasi DSM) mendengarkan koleksi *log* ini untuk memperingatkan pengguna, dilengkapi fitur *"Fix Mapping"* agar perbaikan konfigurasi bisa dilakukan langsung di web (tanpa IDE koding).

---

> **Penutup untuk AI Agent:** Jika Anda (*Model*) diminta menambahkan fitur ke dasbor ini, **baca aturan di lembar `RULES.md` dan pastikan alur implementasi Anda menghormati konsep Master Enrichment dan batas Dumb API di atas.** Menulis API kustom per laporan atau membuat BQ bekerja dua kali demi *filtering* dianggap sebagai pelacuran arsitektur (*Anti-Pattern*). Mengerti? Bagus. Lanjutkan eksekusi.
