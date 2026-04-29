# Kategori Common Enemy Next Level — 3 Bidang 2026

> Source: kantor induk (3 spreadsheet terpisah per bidang)
> Total: **36 sub-item** CE, disebar ke **3 bidang**.
> Updated: 2026-04-26

## Distribusi 36 Item per Bidang

| Bidang | Item | Source Spreadsheet |
|--------|------|-------------------|
| **Gardu Induk (HARGI)** | 23 | `KK_GARDU_INDUK_CE_2026.xlsx` ✓ ada |
| **Jaringan (HARJAR)** | 9 | `KK_JARINGAN_CE_2026.xlsx` ⏳ belum |
| **Proteksi (HARPRO)** | 4 | `KK_PROTEKSI_CE_2026.xlsx` ⏳ belum |
| **TOTAL** | **36** | |

### Bidang Gardu Induk (23 item)
- Trafo (3)
- MV Apparatus (4)
- Switchyard (5)
- GIS (6 — combined 1 tab)
- Common Facility (5 — combined 1 tab)

### Bidang Jaringan (9 item)
- SKTT/SKLT (5)
- SUTT/SUTET (4)

### Bidang Proteksi (4 item)
- Proteksi (2)
- Catu Daya (2)

Discriminator field di BQ `CE_Next_Level_Gardu_Induk.Progress_CE`:
`item_ce` STRING — pakai slug snake_case dari sub-item label.

---

## 1. Level Anomali Trafo  (3 item)

| # | Sub-item | item_ce slug |
|---|----------|--------------|
| 1 | Asset Health Index (AHI) | `trafo_ahi` |
| 2 | Proteksi Anti Binatang | `trafo_proteksi_anti_binatang` |
| 3 | Proteksi relay internal trafo | `trafo_proteksi_relay_internal` |

Source tab di sheet induk:
- AHI → `Asset Health Index (AHI)_trafo`
- Anti Binatang → `Proteksi Anti Binatang_trafo`
- Relay internal → `Proteksi relay internal trafo`

---

## 2. Level Anomali Medium Voltage (MV) Apparatus  (4 item)

| # | Sub-item | item_ce slug |
|---|----------|--------------|
| 1 | Asset Health Index (AHI) | `mv_ahi` |
| 2 | Partial Discharge | `mv_pd_kabel` |
| 3 | Hotspot (delta Temp.) | `mv_hotspot` |
| 4 | Proteksi Anti Binatang | `mv_proteksi_anti_binatang` |

Source tab:
- AHI → `(MV) Apparatus_AHI`
- PD → `(MV) Apparatus_Partial Discharge`
- Hotspot → `(MV) Apparatus_AHI_Hotspot (delete?)`  ← cek nama tab
- Anti Binatang → `(MV) Apparatus_AHI_Proteksi Ant`

---

## 3. Level Anomali Switch Yard  (5 item)

| # | Sub-item | item_ce slug |
|---|----------|--------------|
| 1 | Asset Health Index (AHI) | `sy_ahi` |
| 2 | Grounding Mesh | `sy_grounding_mesh` |
| 3 | Proteksi Anti Binatang | `sy_proteksi_anti_binatang` |
| 4 | Anti Layang-layang | `sy_anti_layang_layang` |
| 5 | Hotspot Switchyard | `sy_hotspot` |

Source tab:
- `Level Anomali Switch Yard_AHI M`
- `Level Anomali Switch Yard_GROUN`
- `Level Anomali Switch Yard_PROTE`
- `Level Anomali Switch Yard_ANTI` (anti layang)
- `Level Anomali Switch Yard_HOTSP`

---

## 4. Level Anomali GIS  (6 item)

| # | Sub-item | item_ce slug |
|---|----------|--------------|
| 1 | Kebocoran Gas SF6 | `gis_kebocoran_sf6` |
| 2 | Kualitas Gas SF6 (SO2) | `gis_kualitas_sf6_so2` |
| 3 | Partial Discharge | `gis_pd` |
| 4 | Jumlah mekanik beroperasi (limit pabrikan) | `gis_mekanik_count` |
| 5 | Sistem Hidrolis Mekanik Penggerak | `gis_hidrolis_mekanik` |
| 6 | Grounding | `gis_grounding` |

Source tab: `Level Anomali GIS`

---

## 5. Level Anomali SKTT/SKLT  (5 item)

| # | Sub-item | item_ce slug |
|---|----------|--------------|
| 1 | Kebocoran Minyak / Leakage Rate | `sktt_kebocoran_minyak` |
| 2 | Cable Sheath | `sktt_cable_sheath` |
| 3 | Joint Cable | `sktt_joint_cable` |
| 4 | Penanda Jalur | `sktt_penanda_jalur` |
| 5 | Buoy | `sktt_buoy` |

Source tab: belum dicek

---

## 6. Level Anomali SUTT/SUTET  (4 item)

| # | Sub-item | item_ce slug |
|---|----------|--------------|
| 1 | AHI | `sutt_ahi` |
| 2 | ROW | `sutt_row` |
| 3 | Proteksi Anti Binatang | `sutt_proteksi_anti_binatang` |
| 4 | Kondisi Tanah Tapak Tower | `sutt_kondisi_tapak_tower` |

Source tab: belum dicek

---

## 7. Level Anomali Proteksi  (2 item)

| # | Sub-item | item_ce slug |
|---|----------|--------------|
| 1 | Asset Health Index (AHI) | `proteksi_ahi` |
| 2 | Desain | `proteksi_desain` |

Source tab: belum dicek

---

## 8. Level Anomali Catu Daya  (2 item)

| # | Sub-item | item_ce slug |
|---|----------|--------------|
| 1 | AHI (Baterai + Rectifier) | `catu_daya_ahi` |
| 2 | Desain (SPLN T4.002-1: 2022) | `catu_daya_desain` |

Source tab: belum dicek

---

## 9. Level Anomali Common Facility  (5 item)

| # | Sub-item | item_ce slug |
|---|----------|--------------|
| 1 | Atap Gedung | `cf_atap_gedung` |
| 2 | Pagar GI | `cf_pagar_gi` |
| 3 | Air Conditioner | `cf_air_conditioner` |
| 4 | Dak Kabel | `cf_dak_kabel` |
| 5 | Pondasi (selain MTU) | `cf_pondasi` |

Source tab: `Level Anomali Common Facility`

---

## Implikasi Skema BQ

Tabel `CE_Next_Level_Gardu_Induk.Progress_CE`:
- 36 unique nilai untuk kolom `item_ce`
- Multi-period via `period STRING` ("YYYY-MM")
- PK: `(period, item_ce, gi_name, bay_name)` atau `(period, item_ce, bay_id)` kalau ke-resolve

Implikasi Sheet Bridge:
- 9 group tab (atau 36 individual tab) — depending preference
- Atau 1 sheet master per kategori dengan sub-tab per item
- IMPORTRANGE per source tab di induk

## Pattern History (multi-period)

User intent: hasil refresh tiap bulan TIDAK overwrite, tapi APPEND sebagai snapshot baru.
- Sheet Bridge → push ke BQ
- BQ append row baru per (period, item_ce, bay)
- View AHI_CE_Latest = snapshot bulan terkini
- View AHI_CE_History = lifetime trend per asset
- VIEW dgn LAG() bisa hitung "bay X masuk target dari bulan apa"

Bay yg jadi status "Achieved" / keluar dari target tetap PERSIST di history,
tidak hilang.

## Status Source Tab di Sheet Induk (cek 2026-04-26)

**Tab dedicated 1:1 (12 item langsung mappable):**
- Trafo: AHI ✓, Anti Binatang ✓, Relay Internal ✓ (3/3)
- MV Apparatus: AHI ✓, PD ✓, Hotspot ✓, Anti Binatang ✓ (4/4)
- Switchyard: AHI ✓, Grounding ✓, Proteksi ✓, Anti Layang ✓, Hotspot ✓ (5/5)

**Tab combined (perlu filter sub-item dari kolom dalam tab):**
- GIS: 1 tab "Level Anomali GIS" untuk 6 sub-item
- Common Facility: 1 tab "Level Anomali Common Facility" untuk 5 sub-item

**TIDAK ADA tab di sheet induk (13 item BLOCKED):**
- SKTT/SKLT (5 item)
- SUTT/SUTET (4 item)
- Proteksi (2 item)
- Catu Daya (2 item)

→ Untuk yg blocked: tunggu kantor induk publish atau buat data sendiri.

## TODO

- [ ] Cek isi tab "(MV) Apparatus_AHI_" (tab duplikat MV — apakah berisi data tambahan)
- [ ] Cek struktur kolom tab GIS — apakah ada kolom kategori untuk filter 6 sub-item
- [ ] Cek struktur kolom tab Common Facility — sama
- [ ] Sheet Bridge Phase 1 (Trafo + MV + Switchyard = 12 item)
- [ ] BQ DDL Progress_CE + view Latest + view History
