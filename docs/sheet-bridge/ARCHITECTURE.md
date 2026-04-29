# Sheet Bridge — Architecture (Production-Ready)

**Updated:** 2026-04-26  
**Spreadsheet:** `1Q9tb2Yf_IiGOPKoIGgfYHgso2Z7lWqZ1cu51j66KDDo`

## Layer Architecture

```
KI Spreadsheet (kantor induk)
         │ IMPORTRANGE + QUERY (live mirror)
         ▼
┌──────────────────────────────────────────────────────────────┐
│  raw_<item>  (14 tabs — 1 per CE Sub-Item)                    │
│  - Kolom B = GI dari KI                                       │
│  - Kolom C = Bay dari KI                                      │
│  - Kolom Z = PK formula (2-tier lookup)                       │
└──────────────────────────────────────────────────────────────┘
         │
         ▼ resolve via 2-tier lookup
┌──────────────────────────────────────────────────────────────┐
│  TIER 1: Master_Bay (canonical UPT BOGOR dari BQ)             │
│    Named ranges: CEB_MASTER_KEY, CEB_MASTER_GI, CEB_MASTER_BAY │
│    Data sourced from `MASTER_HIERARCHY_UPT_Bogor.n_Master_Bay` │
│                                                                │
│  TIER 2: Mapping (user override untuk yang ❌ tidak match)    │
│    Named ranges: CEB_USER_KEY, CEB_USER_GI, CEB_USER_BAY      │
│                                                                │
│  TIER 3: Fallback "⚠ BELUM DI-MAP" (user perlu intervention)  │
└──────────────────────────────────────────────────────────────┘
         │
         ▼ canonical (GI, Bay) per row
┌──────────────────────────────────────────────────────────────┐
│  UPT_<item>  (14 tabs — clean data ready untuk BQ)             │
│  - Kolom Master GI / Master Bay (canonical via lookup)         │
│  - Kolom data CE (AHI, target, status)                         │
│  - Kolom manual entry (UPT-specific)                            │
│  - PK = bay_id (lookup Master_Bay) — JOIN-able dgn jadwal_pekerjaan │
└──────────────────────────────────────────────────────────────┘
         │
         ▼ push ke BQ
Master_Data.CE_Next_Level_Gardu_Induk.Progress_CE
(multi-period history, append per refresh)
```

## Tab Mapping — Production Layout

```
R1   TITLE: "Mapping — Bridge KI ↔ Master Asset"
R2   Instruction (italic muted)
R3   spacer
R4   KPI banner (formula counter dari raw_*!Z)
R5   spacer
R6   Section 1 banner (amber, dynamic count)
R7   Header: Tab Asal | GI dari KI | Bay dari KI
R8-R67  Auto-detect formula spill (max 60 rows)
R68  spacer
R69  Section 2 banner (emerald, dynamic count)
R70  Header: Tab | GI KI | Bay KI | Master GI | Master Bay | Catatan
R71-R200  User manual input — anchored stable, persistent
```

### Anti-Shift Design

User input di Section 2 (R71+) anchored by USER-TYPED key (B||C). Saat formula spill di Section 1 re-evaluasi (raw_* refresh), Section 2 rows TIDAK shift karena user-typed, bukan formula.

PK lookup tier 2 search Section 2 by concat key (helper col I). Match by KEY, bukan position. Robust.

## Named Ranges (Spreadsheet-wide)

| Name | Range | Purpose |
|---|---|---|
| `CEB_MASTER_KEY` | `Master_Bay!$D$2:$D$338` | Concat key (GI\|Bay) untuk VLOOKUP tier 1 |
| `CEB_MASTER_GI` | `Master_Bay!$A$2:$A$338` | Canonical GI |
| `CEB_MASTER_BAY` | `Master_Bay!$B$2:$B$338` | Canonical Bay |
| `CEB_USER_KEY` | `Mapping!$I$71:$I$200` | User-typed key (helper col I) |
| `CEB_USER_GI` | `Mapping!$D$71:$D$200` | User Master GI dropdown |
| `CEB_USER_BAY` | `Mapping!$E$71:$E$200` | User Master Bay dropdown |

## raw_*!Z PK Formula Pattern (Reusable for 14 Tabs)

```
=ARRAYFORMULA(IF(B2:B="","",
  IFERROR(
    "<KODE>_" & VLOOKUP(B2:B&"|"&C2:C, {CEB_MASTER_KEY,CEB_MASTER_GI,CEB_MASTER_BAY}, 2, FALSE)
            & "_" & VLOOKUP(B2:B&"|"&C2:C, {CEB_MASTER_KEY,CEB_MASTER_GI,CEB_MASTER_BAY}, 3, FALSE),
    IFERROR(
      "<KODE>_" & VLOOKUP(B2:B&"|"&C2:C, {CEB_USER_KEY,CEB_USER_GI,CEB_USER_BAY}, 2, FALSE)
              & "_" & VLOOKUP(B2:B&"|"&C2:C, {CEB_USER_KEY,CEB_USER_GI,CEB_USER_BAY}, 3, FALSE),
      "⚠ BELUM DI-MAP — cek tab Mapping"
    )
  )
))
```

Per tab, ganti `<KODE>_` saja:
- raw_Asset Health Index (AHI)_trafo            → `AHI_TRF`
- raw_Proteksi Anti Binatang_trafo              → `ANTI_BIN_TRF`
- raw_Proteksi relay internal trafo             → `RELAY_TRF`
- raw_(MV) Apparatus_AHI                        → `AHI_MV`
- raw_(MV) Apparatus_Partial Discharge          → `PD_MV`
- raw_(MV) Apparatus_AHI_Hotspot                → `HOTSPOT_MV`
- raw_(MV) Apparatus_AHI_Proteksi Anti          → `ANTI_BIN_MV`
- raw_Level Anomali Switch Yard_AHI MTU         → `AHI_SY`
- raw_Level Anomali Switch Yard_GROUNDING       → `GROUND_SY`
- raw_Level Anomali Switch Yard_PROTEKSI        → `ANTI_BIN_SY`
- raw_Level Anomali Switch Yard_ANTI LAYANG     → `ANTI_LAYANG_SY`
- raw_Level Anomali Switch Yard_HOTSPOT         → `HOTSPOT_SY`
- raw_Level Anomali GIS                         → `GIS`
- raw_Level Anomali Common Facility             → `CF`

## Section 1 Auto-Detect Formula (Extending for 14 Tabs)

Current (1 tab):
```
=IFERROR(QUERY({
  IF(REGEXMATCH('raw_AHI_trafo'!Z2:Z,"BELUM"),"raw_AHI_trafo",""), 'raw_AHI_trafo'!B2:B, 'raw_AHI_trafo'!C2:C
}, "SELECT * WHERE Col1<>'' ORDER BY Col2,Col3 LIMIT 60", 0), "")
```

Extended (14 tabs) — stack vertically dengan `;` separator:
```
=IFERROR(QUERY({
  IF(REGEXMATCH('raw_AHI_trafo'!Z2:Z,"BELUM"),"raw_AHI_trafo",""), 'raw_AHI_trafo'!B2:B, 'raw_AHI_trafo'!C2:C;
  IF(REGEXMATCH('raw_Anti_Binatang_trafo'!Z2:Z,"BELUM"),"raw_Anti_Binatang_trafo",""), 'raw_Anti_Binatang_trafo'!B2:B, 'raw_Anti_Binatang_trafo'!C2:C;
  ... (12 more)
}, "SELECT * WHERE Col1<>'' ORDER BY Col2,Col3 LIMIT 60", 0), "")
```

## Workflow User

1. Buka tab Mapping
2. Lihat KPI banner (R4) — counter total ❌ dari semua raw_*
3. Section 1 (R8-R67) auto-list rows yang ❌ dari semua raw_*
4. Untuk tiap baris ❌:
   - Salin (Tab Asal, GI dari KI, Bay dari KI) ke Section 2 (R71+)
   - Pilih dropdown Master GI + Master Bay (validation pakai named range CEB_MASTER_GI, CEB_MASTER_BAY)
   - Tambah catatan kalau perlu
5. Otomatis raw_*!Z resolve via tier 2 (CEB_USER_*)
6. Section 1 row yang resolved hilang dari list
7. Section 2 row PERSISTENT — tidak hilang saat raw_* refresh

## Maintenance

**Tambah raw_* tab baru:**
1. Tambah block formula di Section 1 (Mapping!A8) per pattern di atas
2. Set PK formula di tab raw_* baru pakai pattern di atas (ganti `<KODE>_`)

**Tambah master asset (kalau ada bay baru di UPT):**
1. INSERT INTO `MASTER_HIERARCHY_UPT_Bogor.n_Master_Bay` di BQ
2. Refresh Master_Bay tab dari BQ

**Audit data integrity:**
- KPI banner R4 = total ❌ saat ini
- Section 2 row count = jumlah override aktif
- raw_*!Z column = primary integrity indicator
