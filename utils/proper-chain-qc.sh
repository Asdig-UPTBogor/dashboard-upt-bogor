#!/bin/bash
# proper-chain-qc.sh
#
# Implements PROPER chain QC per DATA_LAYER_DESIGN_STANDARD.md
#
# GI Level (ULTG → GI → chain):
#   1. ULTG ada? → MISSING_ULTG
#   2. GI ada? → MISSING_GI  
#   3. GI di Master? → ORPHAN_GI
#   4. g.Master_ULTG == t.ULTG? → MISMATCH_ULTG
#   5. All pass → OK
#
# BAY Level (ULTG → GI → chain → Bay):
#   1-4 same as GI level
#   5. Bay ada? → MISSING_BAY
#   6. Bay di Master? → ORPHAN_BAY
#   7. All pass → OK

P="gcp-bridge-meshvpn"
MH="MASTER_HIERARCHY_UPT_Bogor"
DGI="Dashboard_Gardu_Induk_UPT_Bogor"
MT="Master_Transmisi_UPT_Bogor"
MAR="Master_Asset_Relay_UPT_Bogor"
MJP="Master_Jadwal_Padam_UPT_Bogor"

run() {
  local label="$1"; shift
  echo -n "  $label ... "
  echo "$@" > /tmp/bq-chain-qc.sql
  result=$(bq query --use_legacy_sql=false --project_id=$P < /tmp/bq-chain-qc.sql 2>&1)
  if echo "$result" | grep -qi "Error processing job"; then
    echo "❌ $(echo $result | grep -oi 'Error.*' | head -1 | cut -c1-120)"
    return 1
  else
    echo "✅"
    return 0
  fi
}

echo "============================================================"
echo "PROPER CHAIN QC — per Design Standard"
echo "============================================================"

# ============================================================
# MASTER HIERARCHY — simple filters, no chain
# ============================================================
echo ""
echo "=== MASTER HIERARCHY (5 views — simple filter) ==="

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
# DASHBOARD GARDU INDUK — BAY level chain QC
# MTU sheets have: Master_ULTG, Master_Gardu_Induk, Master_Bay
# Chain: ULTG → GI → chain → Bay → chain
# ============================================================
echo ""
echo "=== DASHBOARD GARDU INDUK (10 views — BAY level chain QC) ==="

# 8 MTU sheets — BAY level chain QC
for tbl in MTU_TRAFO MTU_PMT MTU_PMS MTU_CT MTU_CVT MTU_LA MTU_KABEL_POWER SEALING_END; do
  run "v_$tbl" "CREATE OR REPLACE VIEW \`$P.$DGI.v_$tbl\` AS
SELECT t.*,
  g.ID_GI,
  u.ID_ULTG,
  b.ID_Bay,
  CASE
    -- Step 1: ULTG ada?
    WHEN t.Master_ULTG IS NULL OR TRIM(t.Master_ULTG) = '' THEN 'MISSING_ULTG'
    -- Step 2: GI ada?
    WHEN t.Master_Gardu_Induk IS NULL OR TRIM(t.Master_Gardu_Induk) = '' THEN 'MISSING_GI'
    -- Step 3: GI di master?
    WHEN g.Master_Gardu_Induk IS NULL THEN 'ORPHAN_GI'
    -- Step 4: ULTG chain match? (GI punya parent ULTG yg sama?)
    WHEN UPPER(TRIM(g.Master_ULTG)) != UPPER(TRIM(t.Master_ULTG)) THEN 'MISMATCH_ULTG'
    -- Step 5: Bay ada?
    WHEN t.Master_Bay IS NULL OR TRIM(t.Master_Bay) = '' THEN 'MISSING_BAY'
    -- Step 6: Bay di master?
    WHEN b.Master_Bay IS NULL THEN 'ORPHAN_BAY'
    -- Step 7: All pass
    ELSE 'OK'
  END AS qc_hierarchy
FROM \`$P.$DGI.e_$tbl\` t
LEFT JOIN \`$P.$MH.e_Master_Gardu_Induk\` g
  ON UPPER(TRIM(t.Master_Gardu_Induk)) = UPPER(TRIM(g.Master_Gardu_Induk))
LEFT JOIN \`$P.$MH.e_Master_ULTG\` u
  ON UPPER(TRIM(t.Master_ULTG)) = UPPER(TRIM(u.ULTG))
LEFT JOIN \`$P.$MH.e_Master_Bay\` b
  ON UPPER(TRIM(t.Master_Bay)) = UPPER(TRIM(b.Master_Bay))
  AND UPPER(TRIM(t.Master_Gardu_Induk)) = UPPER(TRIM(b.Master_Gardu_Induk))
WHERE t.Master_Gardu_Induk IS NOT NULL AND TRIM(t.Master_Gardu_Induk) != ''"
done

# PROGRAM STRATEGIS TRAFO — GI level (has ULTG+GI+Bay but Bay is less relevant)
run "v_PROGRAM_STRATEGIS_TRAFO" "CREATE OR REPLACE VIEW \`$P.$DGI.v_PROGRAM_STRATEGIS_TRAFO\` AS
SELECT t.*,
  g.ID_GI,
  u.ID_ULTG,
  CASE
    WHEN t.Master_ULTG IS NULL OR TRIM(t.Master_ULTG) = '' THEN 'MISSING_ULTG'
    WHEN t.Master_Gardu_Induk IS NULL OR TRIM(t.Master_Gardu_Induk) = '' THEN 'MISSING_GI'
    WHEN g.Master_Gardu_Induk IS NULL THEN 'ORPHAN_GI'
    WHEN UPPER(TRIM(g.Master_ULTG)) != UPPER(TRIM(t.Master_ULTG)) THEN 'MISMATCH_ULTG'
    ELSE 'OK'
  END AS qc_hierarchy
FROM \`$P.$DGI.e_PROGRAM_STRATEGIS_TRAFO\` t
LEFT JOIN \`$P.$MH.e_Master_Gardu_Induk\` g
  ON UPPER(TRIM(t.Master_Gardu_Induk)) = UPPER(TRIM(g.Master_Gardu_Induk))
LEFT JOIN \`$P.$MH.e_Master_ULTG\` u
  ON UPPER(TRIM(t.Master_ULTG)) = UPPER(TRIM(u.ULTG))
WHERE t.Master_Gardu_Induk IS NOT NULL AND TRIM(t.Master_Gardu_Induk) != ''"

# PROGRAM KERJA HARGI — GI level
run "v_PROGRAM_KERJA_HARGI" "CREATE OR REPLACE VIEW \`$P.$DGI.v_PROGRAM_KERJA_HARGI\` AS
SELECT t.*,
  g.ID_GI,
  u.ID_ULTG,
  CASE
    WHEN t.Master_ULTG IS NULL OR TRIM(t.Master_ULTG) = '' THEN 'MISSING_ULTG'
    WHEN t.Master_Gardu_Induk IS NULL OR TRIM(t.Master_Gardu_Induk) = '' THEN 'MISSING_GI'
    WHEN g.Master_Gardu_Induk IS NULL THEN 'ORPHAN_GI'
    WHEN UPPER(TRIM(g.Master_ULTG)) != UPPER(TRIM(t.Master_ULTG)) THEN 'MISMATCH_ULTG'
    ELSE 'OK'
  END AS qc_hierarchy
FROM \`$P.$DGI.e_PROGRAM_KERJA_HARGI\` t
LEFT JOIN \`$P.$MH.e_Master_Gardu_Induk\` g
  ON UPPER(TRIM(t.Master_Gardu_Induk)) = UPPER(TRIM(g.Master_Gardu_Induk))
LEFT JOIN \`$P.$MH.e_Master_ULTG\` u
  ON UPPER(TRIM(t.Master_ULTG)) = UPPER(TRIM(u.ULTG))
WHERE t.Master_ULTG IS NOT NULL AND TRIM(t.Master_ULTG) != ''"

# ============================================================
# MASTER TRANSMISI — GI level chain QC
# Most have Master_ULTG + Master_Gardu_Induk (no Bay)
# Chain: ULTG → GI → chain
# ============================================================
echo ""
echo "=== MASTER TRANSMISI (9 views — GI level chain QC) ==="

# Standard GI-level sheets (Master_ULTG + Master_Gardu_Induk)
for tbl in 0_RESUME_JARINGAN 1_DATA_PETIR 3_PROTEKSI_PETIR_TAMBAHAN 5_HEALTHY_INDEX_TOWER 6_ASSESMENT_TOWER_DAN_VENOM 12_KONDISI_ROW 17_SLD_TOWER; do
  run "v_$tbl" "CREATE OR REPLACE VIEW \`$P.$MT.v_$tbl\` AS
SELECT t.*,
  g.ID_GI,
  u.ID_ULTG,
  CASE
    WHEN t.Master_ULTG IS NULL OR TRIM(t.Master_ULTG) = '' THEN 'MISSING_ULTG'
    WHEN t.Master_Gardu_Induk IS NULL OR TRIM(t.Master_Gardu_Induk) = '' THEN 'MISSING_GI'
    WHEN g.Master_Gardu_Induk IS NULL THEN 'ORPHAN_GI'
    WHEN UPPER(TRIM(g.Master_ULTG)) != UPPER(TRIM(t.Master_ULTG)) THEN 'MISMATCH_ULTG'
    ELSE 'OK'
  END AS qc_hierarchy
FROM \`$P.$MT.e_$tbl\` t
LEFT JOIN \`$P.$MH.e_Master_Gardu_Induk\` g
  ON UPPER(TRIM(t.Master_Gardu_Induk)) = UPPER(TRIM(g.Master_Gardu_Induk))
LEFT JOIN \`$P.$MH.e_Master_ULTG\` u
  ON UPPER(TRIM(t.Master_ULTG)) = UPPER(TRIM(u.ULTG))
WHERE t.Master_Gardu_Induk IS NOT NULL AND TRIM(t.Master_Gardu_Induk) != ''"
done

# MASTER_ASSET_TOWER — GI level (uses MASTER_ULTG, MASTER_GARDU_INDUK — uppercase)
run "v_MASTER_ASSET_TOWER" "CREATE OR REPLACE VIEW \`$P.$MT.v_MASTER_ASSET_TOWER\` AS
SELECT t.*,
  g.ID_GI,
  u.ID_ULTG,
  CASE
    WHEN t.MASTER_ULTG IS NULL OR TRIM(t.MASTER_ULTG) = '' THEN 'MISSING_ULTG'
    WHEN t.MASTER_GARDU_INDUK IS NULL OR TRIM(t.MASTER_GARDU_INDUK) = '' THEN 'MISSING_GI'
    WHEN g.Master_Gardu_Induk IS NULL THEN 'ORPHAN_GI'
    WHEN UPPER(TRIM(g.Master_ULTG)) != UPPER(TRIM(t.MASTER_ULTG)) THEN 'MISMATCH_ULTG'
    ELSE 'OK'
  END AS qc_hierarchy
FROM \`$P.$MT.e_MASTER_ASSET_TOWER\` t
LEFT JOIN \`$P.$MH.e_Master_Gardu_Induk\` g
  ON UPPER(TRIM(t.MASTER_GARDU_INDUK)) = UPPER(TRIM(g.Master_Gardu_Induk))
LEFT JOIN \`$P.$MH.e_Master_ULTG\` u
  ON UPPER(TRIM(t.MASTER_ULTG)) = UPPER(TRIM(u.ULTG))
WHERE t.MASTER_GARDU_INDUK IS NOT NULL AND TRIM(t.MASTER_GARDU_INDUK) != ''"

# 14_LM_JARINGAN_2026 — no GI column, simple filter
run "v_14_LM_JARINGAN_2026" "CREATE OR REPLACE VIEW \`$P.$MT.v_14_LM_JARINGAN_2026\` AS
SELECT * FROM \`$P.$MT.e_14_LM_JARINGAN_2026\`
WHERE NAMA_PROGRAM IS NOT NULL AND TRIM(NAMA_PROGRAM) != ''"

# ============================================================
# ASSET RELAY — GI level (uses Gardu_Induk, ULTG)
# ============================================================
echo ""
echo "=== ASSET RELAY (1 view — GI level chain QC) ==="

run "v_Asset_Relay_UPT_Bogor" "CREATE OR REPLACE VIEW \`$P.$MAR.v_Asset_Relay_UPT_Bogor\` AS
SELECT t.*,
  g.ID_GI,
  u.ID_ULTG,
  CASE
    WHEN t.ULTG IS NULL OR TRIM(t.ULTG) = '' THEN 'MISSING_ULTG'
    WHEN t.Gardu_Induk IS NULL OR TRIM(t.Gardu_Induk) = '' THEN 'MISSING_GI'
    WHEN g.Master_Gardu_Induk IS NULL THEN 'ORPHAN_GI'
    WHEN UPPER(TRIM(g.Master_ULTG)) != UPPER(TRIM(t.ULTG)) THEN 'MISMATCH_ULTG'
    ELSE 'OK'
  END AS qc_hierarchy
FROM \`$P.$MAR.e_Asset_Relay_UPT_Bogor\` t
LEFT JOIN \`$P.$MH.e_Master_Gardu_Induk\` g
  ON UPPER(TRIM(t.Gardu_Induk)) = UPPER(TRIM(g.Master_Gardu_Induk))
LEFT JOIN \`$P.$MH.e_Master_ULTG\` u
  ON UPPER(TRIM(t.ULTG)) = UPPER(TRIM(u.ULTG))
WHERE t.Gardu_Induk IS NOT NULL AND TRIM(t.Gardu_Induk) != ''"

# ============================================================
# JADWAL PADAM — GI level (uses Gardu_Induk, ULTG)
# ============================================================
echo ""
echo "=== JADWAL PADAM (1 view — GI level chain QC) ==="

run "v_Jadwal_Padam" "CREATE OR REPLACE VIEW \`$P.$MJP.v_Jadwal_Padam\` AS
SELECT t.*,
  g.ID_GI,
  u.ID_ULTG,
  CASE
    WHEN t.ULTG IS NULL OR TRIM(t.ULTG) = '' THEN 'MISSING_ULTG'
    WHEN t.Gardu_Induk IS NULL OR TRIM(t.Gardu_Induk) = '' THEN 'MISSING_GI'
    WHEN g.Master_Gardu_Induk IS NULL THEN 'ORPHAN_GI'
    WHEN UPPER(TRIM(g.Master_ULTG)) != UPPER(TRIM(t.ULTG)) THEN 'MISMATCH_ULTG'
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
echo "=== REFRESHING NATIVE TABLES (26) ==="

for tbl in Master_UPT Master_ULTG Master_Gardu_Induk Master_Bay Koordinat_Gardu_Induk; do
  run "n_$tbl" "CREATE OR REPLACE TABLE \`$P.$MH.n_$tbl\` AS SELECT * FROM \`$P.$MH.v_$tbl\`"
done

for tbl in MTU_TRAFO MTU_PMT MTU_PMS MTU_CT MTU_CVT MTU_LA MTU_KABEL_POWER SEALING_END PROGRAM_STRATEGIS_TRAFO PROGRAM_KERJA_HARGI; do
  run "n_$tbl" "CREATE OR REPLACE TABLE \`$P.$DGI.n_$tbl\` AS SELECT * FROM \`$P.$DGI.v_$tbl\`"
done

for tbl in MASTER_ASSET_TOWER 0_RESUME_JARINGAN 1_DATA_PETIR 3_PROTEKSI_PETIR_TAMBAHAN 5_HEALTHY_INDEX_TOWER 6_ASSESMENT_TOWER_DAN_VENOM 12_KONDISI_ROW 14_LM_JARINGAN_2026 17_SLD_TOWER; do
  run "n_$tbl" "CREATE OR REPLACE TABLE \`$P.$MT.n_$tbl\` AS SELECT * FROM \`$P.$MT.v_$tbl\`"
done

run "n_Asset_Relay" "CREATE OR REPLACE TABLE \`$P.$MAR.n_Asset_Relay_UPT_Bogor\` AS SELECT * FROM \`$P.$MAR.v_Asset_Relay_UPT_Bogor\`"
run "n_Jadwal_Padam" "CREATE OR REPLACE TABLE \`$P.$MJP.n_Jadwal_Padam\` AS SELECT * FROM \`$P.$MJP.v_Jadwal_Padam\`"

# ============================================================
# QC SUMMARY — count per status
# ============================================================
echo ""
echo "=== QC SUMMARY ==="
echo "SELECT qc_hierarchy, COUNT(*) cnt FROM ..." > /tmp/bq-chain-qc.sql
cat > /tmp/bq-chain-qc.sql << 'EOF'
SELECT qc_hierarchy, COUNT(*) cnt FROM (
  SELECT qc_hierarchy FROM `gcp-bridge-meshvpn.Dashboard_Gardu_Induk_UPT_Bogor.n_MTU_CT`
  UNION ALL
  SELECT qc_hierarchy FROM `gcp-bridge-meshvpn.Dashboard_Gardu_Induk_UPT_Bogor.n_MTU_TRAFO`
  UNION ALL
  SELECT qc_hierarchy FROM `gcp-bridge-meshvpn.Master_Transmisi_UPT_Bogor.n_MASTER_ASSET_TOWER`
  UNION ALL
  SELECT qc_hierarchy FROM `gcp-bridge-meshvpn.Master_Asset_Relay_UPT_Bogor.n_Asset_Relay_UPT_Bogor`
  UNION ALL
  SELECT qc_hierarchy FROM `gcp-bridge-meshvpn.Master_Jadwal_Padam_UPT_Bogor.n_Jadwal_Padam`
) GROUP BY qc_hierarchy ORDER BY cnt DESC
EOF
result=$(bq query --use_legacy_sql=false --project_id=$P < /tmp/bq-chain-qc.sql 2>&1 | grep -v RequestsDep | grep -v warnings)
echo "$result"

echo ""
echo "✅ PROPER CHAIN QC COMPLETE!"
