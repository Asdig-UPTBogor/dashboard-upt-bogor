# Mapping Program Kerja Gardu Induk — Sheet ↔ BQ Kamus

> **Created 2026-04-27.** Catatan mapping data sumber ke BQ kategori.
> Status: in-progress. Untuk dipakai saat build page Program Kerja Gardu Induk + ingest BQ.

---

## Sumber Data

### BQ Kamus (Catalog)
- Table: `gcp-bridge-meshvpn.Program_Kerja_Gardu_Induk_UPT_Bogor.Program_Kerja_Gardu_Induk`
- 48 program total, 4 kategori:
  - **ABO** (Anti Blackout) — 5 program
  - **CE** (Common Enemy) — 7 program → **page terpisah** (CE Gardu Induk)
  - **IL 2** (Inservice Level 2) — 9 program
  - **Program Strategis** — 27 program

### Spreadsheet Sources

#### Sheet 1: `PROGRESS IL 2, CE, ABO`
- ID: `1i3QnCsmUUu6c5oaBifJrNTO_tDkW2Y5TwKsx6LS8kEI`
- 34 tabs, **schema beragam tiap tab**:
  - 1 KLASIFIKASI PEKERJAAN (master)
  - 1 LIST IL 2 (master)
  - 10 tab IL 2-* (Inservice Level 2)
  - 17 tab LM-* (Long Maintenance = Program Strategis)
  - 5 tab ABO-* (Anti Blackout)
- **Format**: per-program tab, schema bervariasi (7-11 kolom).
- **Catatan**: kompleks untuk ingestion uniform. Skip dulu, pakai Sheet 2.

#### Sheet 2: `Dashboard Gardu Induk - UPT Bogor` ⭐ RECOMMENDED
- ID: `1aSi-mBeRnpUvSuNQ_U4HZbLxpmqwt2Fwh8koJVslqIg`
- Tabs progress:
  - `PROGRAM KERJA HARGI` (gid 753930573, 136 row) — Strategis
  - `REALISASI IL 2` (gid 650292341) — IL 2
  - `PROGRAM STRATEGIS TRAFO` (gid 641024339) — Strategis × Trafo (drill-down)
- **Format**: schema seragam (NO/NAMA/ULTG/GI/Bay/Realisasi/Status/etc)

---

## Mapping `PROGRAM KERJA HARGI` (Sheet 2) → BQ Kategori

**Tab Sheet 2 gid 753930573** — 16 unique programs, 136 row.

### ✓ Matched ke Kategori "Program Strategis" (14 program)

| Sheet (NAMA PROGRAM)                              | BQ Kamus (nama_program)                                     |
|---|---|
| PENGUJIAN INHIBITOR KONTEN                        | Pengujian Inhibitor Konten                                  |
| Pengecekan bersama celah hewan setelah IL3 (sisi incoming) | BA Pengecekan Bersama Celah Hewan Setelah Pekerjaan Distribusi |
| Pemasangan WAP                                    | Pemasangan Proteksi Anti Binatang (WAP Lokal/Corbuser)      |
| Cheklist Pekerjaan Critical Pasca kontruksi       | Pengawasan Pekerjaan Critical / Progres Konstruksi Critical |
| Pengecetan MTU Korosif                            | Pengecetan MTU Korosif                                      |
| Penggantian Counterl LA Bay Line Critical         | Penggantian Counter LA Bay Line Critical                    |
| Penggantian Gas SF6 PMT                           | Penggantian Gas SF6 PMT                                     |
| Penggantian Isolator dudukan LA                   | Penggantian Isolator Dudukan LA                             |
| Penggantian kabel power                           | Penggantian Kabel Power                                     |
| Penggantian MTU                                   | Penggantian MTU P0                                          |
| Pelaksanaan Penggantian VT Trafindo               | Penggantian PT Merk Trafindo                                |
| Penggantian terminasi kabel power                 | Penggantian Terminasi Kabel Power                           |
| Perbaikan kebocoran komprartemen GIS              | Perbaikan Kebocoran Kompartemen GIS                         |
| Reklamasi Minyak Trafo                            | Reklamasi Minyak Trafo                                      |

### ❓ Orphan / Tidak Match Kamus (2 program)

| Sheet (NAMA PROGRAM)                       | Status | Action |
|---|---|---|
| Inspeksi Visual terminasi dan kabel power  | Tidak ada di kamus | Tambah ke kamus atau skip |
| Pengujian Gas SF6 Compartement             | Tidak persis match (closest: Penggantian Gas SF6 PMT) | Tambah ke kamus atau skip |

### ⚪ Kamus Strategis (27) — Yang BELUM ada di sheet HARGI (13 program)

```
- Filter Minyak / Purifikasi Trafo
- Grebeg Binatang Seluruh GI
- Pemasangan & Peremajaan Jaring (Anti Binatang) di Gardu Induk
- Penambahan Media Isolasi pada Relay Mekanik Bucholz dan Jansen Trafo
- Penanganan Anomali Rembesan Minyak Trafo
- Penggantian/Perbaikan Motor PMS
- Perbaikan / Penggantian CCTV Switchyard
- Perbaikan Anomali DS Macet
- Perkuatan NGR MS Resistance / Peremajaan
- Pest Control & Rodent Control
- Rapat Koordinasi Bulanan / 3 Bulanan Bersama UID / UP2D
- Standarisasi SOP GI dan Update IK GI (Buku Kuning)
- Upskilling TAD OPGI/OPGI
```

Status: belum ada data execution di sheet ini. Mungkin di sheet lain atau belum di-track.

---

## Mapping `REALISASI IL 2` (Sheet 2) → BQ Kategori "IL 2"

**Status:** ⏳ TODO — perlu inspect tab ini (gid 650292341)

Expected mapping target (BQ kamus IL 2, 9 program):
```
- PD Incoming
- PD Kabel Power
- LCM
- Minyak DGA Maintank
- Minyak Karakteristik Maintank
- Minyak DGA OLTC
- Minyak Karakteristik OLTC
- Minyak Karakteristik Tubular
- Pengukuran Thermovisi Tiang Raisepole 1 Tiang Pertama dari GI
```

---

## Mapping `PROGRAM STRATEGIS TRAFO` (Sheet 2)

**Status:** ⏳ TODO — perlu inspect tab ini (gid 641024339)

Hipotesis: data execution Strategis × Trafo specific (drill-down ke aset trafo).

---

## Mapping ABO (Sheet 1)

ABO datanya cuma di Sheet 1 (5 tabs terpisah, schema beragam).

**Tabs:**
- ABO-AHI kondisi Good pada aset kritikal (gid 326588468)
- ABO-Mitigasi gangguan akibat binatang (gid 1766436075)
- ABO-Perbaikan Sistem Pentanahan/Grounding (gid 208765486)
- ABO-REPOSISI LA (gid 376351878)
- ABO-Upskilling Operator simulasi BUKU MERAH (gid 1388144638)

**Mapping ke kamus ABO (5 program, urutan):**
| Tab Sheet 1                                        | Kamus ABO              |
|---|---|
| ABO-REPOSISI LA                                    | Reposisi LA (urutan 1) |
| ABO-Perbaikan Sistem Pentanahan/Grounding          | Perbaikan Sistem Pentanahan/Grounding (urutan 2) |
| ABO-AHI kondisi Good pada aset kritikal            | Status AHI pada Aset Kritikal Kategori Good (urutan 3) |
| ABO-Mitigasi gangguan akibat binatang              | Mitigasi Gangguan Akibat Binatang (urutan 4) |
| ABO-Upskilling Operator simulasi BUKU MERAH        | Upskilling Operator Simulasi Buku Merah (urutan 5) |

**1:1 mapping** — semua 5 ABO match. ✓

---

## Action Plan

### Tonight (deadline jam 6 pagi)
1. ✅ Mapping documented (file ini)
2. ⏳ Inspect REALISASI IL 2 + PROGRAM STRATEGIS TRAFO schema
3. ⏳ Build BQ table `Progress_Program_Kerja_Gardu_Induk` (schema unified)
4. ⏳ Ingest tab `PROGRAM KERJA HARGI` → BQ (14 mapped + 2 orphan tag)
5. ⏳ Ingest tab `REALISASI IL 2` → BQ (kategori IL 2)
6. ⏳ Build page `/gardu-induk/program-kerja-gardu-induk` (clone Transmisi template)
7. ⏳ Wire BQ ↔ page

### Setelah Deadline
- Ingest 5 tab ABO (Sheet 1) → schema mapping per tab
- Reconcile orphan programs (decide: tambah kamus atau skip)
- Sheet 1 ↔ Sheet 2 sync strategy (sumber tunggal vs dual tracking)

---

## File Reference

- BQ kamus: `Program_Kerja_Gardu_Induk_UPT_Bogor.Program_Kerja_Gardu_Induk`
- Sheet 1 (per-program): `1i3QnCsmUUu6c5oaBifJrNTO_tDkW2Y5TwKsx6LS8kEI`
- Sheet 2 (rollup): `1aSi-mBeRnpUvSuNQ_U4HZbLxpmqwt2Fwh8koJVslqIg`
- Reference page (template): `dashboard/src/app/transmisi/program-kerja-transmisi/`
