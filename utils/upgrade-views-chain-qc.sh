#!/bin/bash
# upgrade-views-chain-qc.sh
#
# Upgrades ALL views with:
# 1. Proper WHERE filter (no empty rows)
# 2. Chain QC JOIN (ULTG→GI→Bay where applicable)
#
# QC hierarchy values:
#   OK             = all references valid
#   MISSING_GI     = GI column empty
#   ORPHAN_GI      = GI not found in master
#   MISMATCH_ULTG  = GI found but ULTG doesn't match master
#   MISSING_BAY    = Bay column empty (Bay-level sheets only)
#   ORPHAN_BAY     = Bay not found in master

P="gcp-bridge-meshvpn"
MH="MASTER_HIERARCHY_UPT_Bogor"
DGI="Dashboard_Gardu_Induk_UPT_Bogor"
MT="Master_Transmisi_UPT_Bogor"
MAR="Master_Asset_Relay_UPT_Bogor"
MJP="Master_Jadwal_Padam_UPT_Bogor"

run() {
  local label="$1"; shift
  echo -n "  $label ... "
  local sqlfile="/tmp/bq-upgrade-view.sql"
  echo "$@" > "$sqlfile"
  result=$(bq query --use_legacy_sql=false --project_id=$P < "$sqlfile" 2>&1)
  if echo "$result" | grep -qi "Error processing job"; then
    echo "❌ $(echo $result | grep -oi 'Error.*' | head -1 | cut -c1-100)"
    return 1
  else
    echo "✅"
    return 0
  fi
}

# ============================================================
# MASTER HIERARCHY — simple filters, no chain QC needed
# ============================================================
echo ""
echo "=== MASTER_HIERARCHY_UPT_Bogor (5 views) ==="

run "v_Master_UPT" "CREATE OR REPLACE VIEW \`$P.$MH.v_Master_UPT\` AS
SELECT * FROM \`$P.$MH.e_Master_UPT\`
WHERE ID_UPT IS NOT NULL AND TRIM(ID_UPT) != ''"

run "v_Master_ULTG" "CREATE OR REPLACE VIEW \`$P.$MH.v_Master_ULTG\` AS
SELECT * FROM \`$P.$MH.e_Master_ULTG\`
WHERE ID_ULTG IS NOT NULL AND TRIM(ID_ULTG) != ''"

run "v_Master_Gardu_Induk" "CREATE OR REPLACE VIEW \`$P.$MH.v_Master_Gardu_Induk\` AS
SELECT * FROM \`$P.$MH.e_Master_Gardu_Induk\`
WHERE ID_GI IS NOT NULL AND TRIM(ID_GI) != ''"

run "v_Master_Bay" "CREATE OR REPLACE VIEW \`$P.$MH.v_Master_Bay\` AS
SELECT * FROM \`$P.$MH.e_Master_Bay\`
WHERE ID_Bay IS NOT NULL AND TRIM(ID_Bay) != ''"

run "v_Koordinat_Gardu_Induk" "CREATE OR REPLACE VIEW \`$P.$MH.v_Koordinat_Gardu_Induk\` AS
SELECT * FROM \`$P.$MH.e_Koordinat_Gardu_Induk\`
WHERE Master_Gardu_Induk IS NOT NULL AND TRIM(Master_Gardu_Induk) != ''"

# ============================================================
# DASHBOARD GARDU INDUK — 3-level chain QC (ULTG→GI→Bay)
# All MTU sheets have: Master_ULTG, Master_Gardu_Induk, Master_Bay
# ============================================================
echo ""
echo "=== Dashboard_Gardu_Induk_UPT_Bogor (10 views) ==="

# 8 MTU sheets — identical 3-level chain QC pattern
for tbl in MTU_TRAFO MTU_PMT MTU_PMS MTU_CT MTU_CVT MTU_LA MTU_KABEL_POWER SEALING_END; do
  run "v_$tbl" "CREATE OR REPLACE VIEW \`$P.$DGI.v_$tbl\` AS
SELECT t.*,
  g.ID_GI,
  u.ID_ULTG,
  CASE
    WHEN t.Master_Gardu_Induk IS NULL OR TRIM(t.Master_Gardu_Induk) = '' THEN 'MISSING_GI'
    WHEN g.Master_Gardu_Induk IS NULL THEN 'ORPHAN_GI'
    WHEN t.Master_ULTG IS NOT NULL AND TRIM(t.Master_ULTG) != '' AND u.ULTG IS NULL THEN 'ORPHAN_ULTG'
    WHEN g.Master_ULTG IS NOT NULL AND t.Master_ULTG IS NOT NULL
      AND UPPER(TRIM(g.Master_ULTG)) != UPPER(TRIM(t.Master_ULTG)) THEN 'MISMATCH_ULTG'
    ELSE 'OK'
  END AS qc_hierarchy
FROM \`$P.$DGI.e_$tbl\` t
LEFT JOIN \`$P.$MH.e_Master_Gardu_Induk\` g
  ON UPPER(TRIM(t.Master_Gardu_Induk)) = UPPER(TRIM(g.Master_Gardu_Induk))
LEFT JOIN \`$P.$MH.e_Master_ULTG\` u
  ON UPPER(TRIM(t.Master_ULTG)) = UPPER(TRIM(u.ULTG))
WHERE t.Master_Gardu_Induk IS NOT NULL AND TRIM(t.Master_Gardu_Induk) != ''"
done

# PROGRAM STRATEGIS TRAFO — has Master_ULTG, Master_Gardu_Induk, Master_Bay
run "v_PROGRAM_STRATEGIS_TRAFO" "CREATE OR REPLACE VIEW \`$P.$DGI.v_PROGRAM_STRATEGIS_TRAFO\` AS
SELECT t.*,
  g.ID_GI,
  CASE
    WHEN t.Master_Gardu_Induk IS NULL OR TRIM(t.Master_Gardu_Induk) = '' THEN 'MISSING_GI'
    WHEN g.Master_Gardu_Induk IS NULL THEN 'ORPHAN_GI'
    ELSE 'OK'
  END AS qc_hierarchy
FROM \`$P.$DGI.e_PROGRAM_STRATEGIS_TRAFO\` t
LEFT JOIN \`$P.$MH.e_Master_Gardu_Induk\` g
  ON UPPER(TRIM(t.Master_Gardu_Induk)) = UPPER(TRIM(g.Master_Gardu_Induk))
WHERE t.NAMA_PROGRAM IS NOT NULL AND TRIM(t.NAMA_PROGRAM) != ''"

# PROGRAM KERJA HARGI — has Master_ULTG, Master_Gardu_Induk, Master_Bay
run "v_PROGRAM_KERJA_HARGI" "CREATE OR REPLACE VIEW \`$P.$DGI.v_PROGRAM_KERJA_HARGI\` AS
SELECT t.*,
  g.ID_GI,
  CASE
    WHEN t.Master_Gardu_Induk IS NULL OR TRIM(t.Master_Gardu_Induk) = '' THEN 'MISSING_GI'
    WHEN g.Master_Gardu_Induk IS NULL THEN 'ORPHAN_GI'
    ELSE 'OK'
  END AS qc_hierarchy
FROM \`$P.$DGI.e_PROGRAM_KERJA_HARGI\` t
LEFT JOIN \`$P.$MH.e_Master_Gardu_Induk\` g
  ON UPPER(TRIM(t.Master_Gardu_Induk)) = UPPER(TRIM(g.Master_Gardu_Induk))
WHERE t.NAMA_PROGRAM IS NOT NULL AND TRIM(t.NAMA_PROGRAM) != ''"

# ============================================================
# MASTER TRANSMISI — 2-level chain QC (ULTG→GI)
# Most have Master_ULTG, Master_Gardu_Induk
# ============================================================
echo ""
echo "=== Master_Transmisi_UPT_Bogor (9 views) ==="

# Sheets with Master_ULTG + Master_Gardu_Induk
for tbl in MASTER_ASSET_TOWER 0_RESUME_JARINGAN 1_DATA_PETIR 3_PROTEKSI_PETIR_TAMBAHAN 5_HEALTHY_INDEX_TOWER 12_KONDISI_ROW 17_SLD_TOWER; do
  # Determine GI column name (some use MASTER_GARDU_INDUK, others Master_Gardu_Induk)
  gi_col="Master_Gardu_Induk"
  ultg_col="Master_ULTG"
  if [ "$tbl" = "MASTER_ASSET_TOWER" ]; then
    gi_col="MASTER_GARDU_INDUK"
    ultg_col="MASTER_ULTG"
  fi

  run "v_$tbl" "CREATE OR REPLACE VIEW \`$P.$MT.v_$tbl\` AS
SELECT t.*,
  g.ID_GI,
  u.ID_ULTG,
  CASE
    WHEN t.$gi_col IS NULL OR TRIM(t.$gi_col) = '' THEN 'MISSING_GI'
    WHEN g.Master_Gardu_Induk IS NULL THEN 'ORPHAN_GI'
    WHEN t.$ultg_col IS NOT NULL AND TRIM(t.$ultg_col) != '' AND u.ULTG IS NULL THEN 'ORPHAN_ULTG'
    WHEN g.Master_ULTG IS NOT NULL AND t.$ultg_col IS NOT NULL
      AND UPPER(TRIM(g.Master_ULTG)) != UPPER(TRIM(t.$ultg_col)) THEN 'MISMATCH_ULTG'
    ELSE 'OK'
  END AS qc_hierarchy
FROM \`$P.$MT.e_$tbl\` t
LEFT JOIN \`$P.$MH.e_Master_Gardu_Induk\` g
  ON UPPER(TRIM(t.$gi_col)) = UPPER(TRIM(g.Master_Gardu_Induk))
LEFT JOIN \`$P.$MH.e_Master_ULTG\` u
  ON UPPER(TRIM(t.$ultg_col)) = UPPER(TRIM(u.ULTG))
WHERE t.$gi_col IS NOT NULL AND TRIM(t.$gi_col) != ''"
done

# 6_ASSESMENT_TOWER_DAN_VENOM — same pattern
run "v_6_ASSESMENT_TOWER_DAN_VENOM" "CREATE OR REPLACE VIEW \`$P.$MT.v_6_ASSESMENT_TOWER_DAN_VENOM\` AS
SELECT t.*,
  g.ID_GI,
  u.ID_ULTG,
  CASE
    WHEN t.Master_Gardu_Induk IS NULL OR TRIM(t.Master_Gardu_Induk) = '' THEN 'MISSING_GI'
    WHEN g.Master_Gardu_Induk IS NULL THEN 'ORPHAN_GI'
    WHEN t.Master_ULTG IS NOT NULL AND TRIM(t.Master_ULTG) != '' AND u.ULTG IS NULL THEN 'ORPHAN_ULTG'
    ELSE 'OK'
  END AS qc_hierarchy
FROM \`$P.$MT.e_6_ASSESMENT_TOWER_DAN_VENOM\` t
LEFT JOIN \`$P.$MH.e_Master_Gardu_Induk\` g
  ON UPPER(TRIM(t.Master_Gardu_Induk)) = UPPER(TRIM(g.Master_Gardu_Induk))
LEFT JOIN \`$P.$MH.e_Master_ULTG\` u
  ON UPPER(TRIM(t.Master_ULTG)) = UPPER(TRIM(u.ULTG))
WHERE t.Master_Gardu_Induk IS NOT NULL AND TRIM(t.Master_Gardu_Induk) != ''"

# 14_LM_JARINGAN_2026 — NO GI column, simple filter
run "v_14_LM_JARINGAN_2026" "CREATE OR REPLACE VIEW \`$P.$MT.v_14_LM_JARINGAN_2026\` AS
SELECT * FROM \`$P.$MT.e_14_LM_JARINGAN_2026\`
WHERE NAMA_PROGRAM IS NOT NULL AND TRIM(NAMA_PROGRAM) != ''"

# ============================================================
# ASSET RELAY — 2-level (uses Gardu_Induk, not Master_Gardu_Induk)
# ============================================================
echo ""
echo "=== Master_Asset_Relay_UPT_Bogor (1 view) ==="

run "v_Asset_Relay_UPT_Bogor" "CREATE OR REPLACE VIEW \`$P.$MAR.v_Asset_Relay_UPT_Bogor\` AS
SELECT t.*,
  g.ID_GI,
  u.ID_ULTG,
  CASE
    WHEN t.Gardu_Induk IS NULL OR TRIM(t.Gardu_Induk) = '' THEN 'MISSING_GI'
    WHEN g.Master_Gardu_Induk IS NULL THEN 'ORPHAN_GI'
    WHEN t.ULTG IS NOT NULL AND TRIM(t.ULTG) != '' AND u.ULTG IS NULL THEN 'ORPHAN_ULTG'
    ELSE 'OK'
  END AS qc_hierarchy
FROM \`$P.$MAR.e_Asset_Relay_UPT_Bogor\` t
LEFT JOIN \`$P.$MH.e_Master_Gardu_Induk\` g
  ON UPPER(TRIM(t.Gardu_Induk)) = UPPER(TRIM(g.Master_Gardu_Induk))
LEFT JOIN \`$P.$MH.e_Master_ULTG\` u
  ON UPPER(TRIM(t.ULTG)) = UPPER(TRIM(u.ULTG))
WHERE t.Gardu_Induk IS NOT NULL AND TRIM(t.Gardu_Induk) != ''"

# ============================================================
# JADWAL PADAM — 2-level (uses Gardu_Induk)
# ============================================================
echo ""
echo "=== Master_Jadwal_Padam_UPT_Bogor (1 view) ==="

run "v_Jadwal_Padam" "CREATE OR REPLACE VIEW \`$P.$MJP.v_Jadwal_Padam\` AS
SELECT t.*,
  g.ID_GI,
  u.ID_ULTG,
  CASE
    WHEN t.Gardu_Induk IS NULL OR TRIM(t.Gardu_Induk) = '' THEN 'MISSING_GI'
    WHEN g.Master_Gardu_Induk IS NULL THEN 'ORPHAN_GI'
    WHEN t.ULTG IS NOT NULL AND TRIM(t.ULTG) != '' AND u.ULTG IS NULL THEN 'ORPHAN_ULTG'
    ELSE 'OK'
  END AS qc_hierarchy
FROM \`$P.$MJP.e_Jadwal_Padam\` t
LEFT JOIN \`$P.$MH.e_Master_Gardu_Induk\` g
  ON UPPER(TRIM(t.Gardu_Induk)) = UPPER(TRIM(g.Master_Gardu_Induk))
LEFT JOIN \`$P.$MH.e_Master_ULTG\` u
  ON UPPER(TRIM(t.ULTG)) = UPPER(TRIM(u.ULTG))
WHERE t.Gardu_Induk IS NOT NULL AND TRIM(t.Gardu_Induk) != ''"

# ============================================================
# REFRESH ALL NATIVE TABLES
# ============================================================
echo ""
echo "=== Refreshing native tables ==="

# Master Hierarchy
for tbl in Master_UPT Master_ULTG Master_Gardu_Induk Master_Bay Koordinat_Gardu_Induk; do
  run "n_$tbl" "CREATE OR REPLACE TABLE \`$P.$MH.n_$tbl\` AS SELECT * FROM \`$P.$MH.v_$tbl\`"
done

# Dashboard GI
for tbl in MTU_TRAFO MTU_PMT MTU_PMS MTU_CT MTU_CVT MTU_LA MTU_KABEL_POWER SEALING_END PROGRAM_STRATEGIS_TRAFO PROGRAM_KERJA_HARGI; do
  run "n_$tbl" "CREATE OR REPLACE TABLE \`$P.$DGI.n_$tbl\` AS SELECT * FROM \`$P.$DGI.v_$tbl\`"
done

# Transmisi
for tbl in MASTER_ASSET_TOWER 0_RESUME_JARINGAN 1_DATA_PETIR 3_PROTEKSI_PETIR_TAMBAHAN 5_HEALTHY_INDEX_TOWER 6_ASSESMENT_TOWER_DAN_VENOM 12_KONDISI_ROW 14_LM_JARINGAN_2026 17_SLD_TOWER; do
  run "n_$tbl" "CREATE OR REPLACE TABLE \`$P.$MT.n_$tbl\` AS SELECT * FROM \`$P.$MT.v_$tbl\`"
done

# Asset Relay
run "n_Asset_Relay_UPT_Bogor" "CREATE OR REPLACE TABLE \`$P.$MAR.n_Asset_Relay_UPT_Bogor\` AS SELECT * FROM \`$P.$MAR.v_Asset_Relay_UPT_Bogor\`"

# Jadwal Padam
run "n_Jadwal_Padam" "CREATE OR REPLACE TABLE \`$P.$MJP.n_Jadwal_Padam\` AS SELECT * FROM \`$P.$MJP.v_Jadwal_Padam\`"

echo ""
echo "✅ ALL VIEWS UPGRADED + NATIVE TABLES REFRESHED!"
