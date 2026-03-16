#!/bin/bash
set -e

echo "=========================================================="
echo "🔥 Membangun TRINITAS 24 Tabel BQ dengan 3-Level Hierarki"
echo "=========================================================="

echo "[+] Memproses Sheet: 'MASTER ASSET TOWER' -> e_, v_, dan n_"
cat << 'EOF' > /tmp/def_e_master_asset_tower.json
{
  "sourceFormat": "GOOGLE_SHEETS",
  "sourceUris": ["https://docs.google.com/spreadsheets/d/13xm0SqMP5EYbLyYnt5jUPUx1BzhaDffkX4iippq_LuM"],
  "googleSheetsOptions": { "range": "MASTER ASSET TOWER" },
  "autodetect": true
}
EOF
bq rm -f -t gcp-bridge-meshvpn:Dashboard_Gardu_Induk_UPT_Bogor.e_master_asset_tower || true
bq mk --table --external_table_definition=/tmp/def_e_master_asset_tower.json gcp-bridge-meshvpn:Dashboard_Gardu_Induk_UPT_Bogor.e_master_asset_tower

cat << 'EOSQL' | bq query --use_legacy_sql=false --project_id=gcp-bridge-meshvpn
CREATE OR REPLACE VIEW `gcp-bridge-meshvpn.Dashboard_Gardu_Induk_UPT_Bogor.v_master_asset_tower` AS
SELECT
  t.*, g.ID_GI, g.Master_ULTG AS Parent_ULTG,
    CASE
      WHEN t.MASTER_ULTG IS NULL OR TRIM(t.MASTER_ULTG) = '' THEN 'MISSING_ULTG'
      ELSE 'OK'
    END AS qc_ultg_hierarchy,
    CASE
      WHEN t.MASTER_GARDU_INDUK IS NULL OR TRIM(t.MASTER_GARDU_INDUK) = '' THEN 'MISSING_GI'
      WHEN g.ID_GI IS NULL THEN 'ORPHAN_GI'
      ELSE 'OK'
    END AS qc_hierarchy
FROM `gcp-bridge-meshvpn.Dashboard_Gardu_Induk_UPT_Bogor.e_master_asset_tower` t
LEFT JOIN (SELECT DISTINCT Master_Gardu_Induk, ID_GI, Master_ULTG FROM `gcp-bridge-meshvpn.MASTER_HIERARCHY_UPT_Bogor.e_Master_Gardu_Induk` WHERE Master_Gardu_Induk IS NOT NULL) g ON UPPER(TRIM(t.MASTER_GARDU_INDUK)) = UPPER(TRIM(g.Master_Gardu_Induk))

EOSQL

echo "    -> Melakukan Data Pump ke Native Table: n_master_asset_tower"
cat << 'EOSQL' | bq query --use_legacy_sql=false --project_id=gcp-bridge-meshvpn
CREATE OR REPLACE TABLE `gcp-bridge-meshvpn.Dashboard_Gardu_Induk_UPT_Bogor.n_master_asset_tower` AS
SELECT * FROM `gcp-bridge-meshvpn.Dashboard_Gardu_Induk_UPT_Bogor.v_master_asset_tower`
EOSQL

echo "[+] Memproses Sheet: '1.DATA PETIR' -> e_, v_, dan n_"
cat << 'EOF' > /tmp/def_e_1_data_petir.json
{
  "sourceFormat": "GOOGLE_SHEETS",
  "sourceUris": ["https://docs.google.com/spreadsheets/d/13xm0SqMP5EYbLyYnt5jUPUx1BzhaDffkX4iippq_LuM"],
  "googleSheetsOptions": { "range": "1.DATA PETIR" },
  "autodetect": true
}
EOF
bq rm -f -t gcp-bridge-meshvpn:Dashboard_Gardu_Induk_UPT_Bogor.e_1_data_petir || true
bq mk --table --external_table_definition=/tmp/def_e_1_data_petir.json gcp-bridge-meshvpn:Dashboard_Gardu_Induk_UPT_Bogor.e_1_data_petir

cat << 'EOSQL' | bq query --use_legacy_sql=false --project_id=gcp-bridge-meshvpn
CREATE OR REPLACE VIEW `gcp-bridge-meshvpn.Dashboard_Gardu_Induk_UPT_Bogor.v_1_data_petir` AS
SELECT
  t.*
FROM `gcp-bridge-meshvpn.Dashboard_Gardu_Induk_UPT_Bogor.e_1_data_petir` t

EOSQL

echo "    -> Melakukan Data Pump ke Native Table: n_1_data_petir"
cat << 'EOSQL' | bq query --use_legacy_sql=false --project_id=gcp-bridge-meshvpn
CREATE OR REPLACE TABLE `gcp-bridge-meshvpn.Dashboard_Gardu_Induk_UPT_Bogor.n_1_data_petir` AS
SELECT * FROM `gcp-bridge-meshvpn.Dashboard_Gardu_Induk_UPT_Bogor.v_1_data_petir`
EOSQL

echo "[+] Memproses Sheet: 'Master Gardu Induk' -> e_, v_, dan n_"
cat << 'EOF' > /tmp/def_e_master_gardu_induk.json
{
  "sourceFormat": "GOOGLE_SHEETS",
  "sourceUris": ["https://docs.google.com/spreadsheets/d/1vpVUczVs8GB-VHbqxrHpl-EZI66HO2e2fWdU3qfLzeI"],
  "googleSheetsOptions": { "range": "Master Gardu Induk" },
  "autodetect": true
}
EOF
bq rm -f -t gcp-bridge-meshvpn:Dashboard_Gardu_Induk_UPT_Bogor.e_master_gardu_induk || true
bq mk --table --external_table_definition=/tmp/def_e_master_gardu_induk.json gcp-bridge-meshvpn:Dashboard_Gardu_Induk_UPT_Bogor.e_master_gardu_induk

cat << 'EOSQL' | bq query --use_legacy_sql=false --project_id=gcp-bridge-meshvpn
CREATE OR REPLACE VIEW `gcp-bridge-meshvpn.Dashboard_Gardu_Induk_UPT_Bogor.v_master_gardu_induk` AS
SELECT
  t.*,
    CASE
      WHEN t.Master_ULTG IS NULL OR TRIM(t.Master_ULTG) = '' THEN 'MISSING_ULTG'
      ELSE 'OK'
    END AS qc_ultg_hierarchy
FROM `gcp-bridge-meshvpn.Dashboard_Gardu_Induk_UPT_Bogor.e_master_gardu_induk` t

EOSQL

echo "    -> Melakukan Data Pump ke Native Table: n_master_gardu_induk"
cat << 'EOSQL' | bq query --use_legacy_sql=false --project_id=gcp-bridge-meshvpn
CREATE OR REPLACE TABLE `gcp-bridge-meshvpn.Dashboard_Gardu_Induk_UPT_Bogor.n_master_gardu_induk` AS
SELECT * FROM `gcp-bridge-meshvpn.Dashboard_Gardu_Induk_UPT_Bogor.v_master_gardu_induk`
EOSQL

echo "[+] Memproses Sheet: 'Master Bay' -> e_, v_, dan n_"
cat << 'EOF' > /tmp/def_e_master_bay.json
{
  "sourceFormat": "GOOGLE_SHEETS",
  "sourceUris": ["https://docs.google.com/spreadsheets/d/1vpVUczVs8GB-VHbqxrHpl-EZI66HO2e2fWdU3qfLzeI"],
  "googleSheetsOptions": { "range": "Master Bay" },
  "autodetect": true
}
EOF
bq rm -f -t gcp-bridge-meshvpn:Dashboard_Gardu_Induk_UPT_Bogor.e_master_bay || true
bq mk --table --external_table_definition=/tmp/def_e_master_bay.json gcp-bridge-meshvpn:Dashboard_Gardu_Induk_UPT_Bogor.e_master_bay

cat << 'EOSQL' | bq query --use_legacy_sql=false --project_id=gcp-bridge-meshvpn
CREATE OR REPLACE VIEW `gcp-bridge-meshvpn.Dashboard_Gardu_Induk_UPT_Bogor.v_master_bay` AS
SELECT
  t.*, g.ID_GI, g.Master_ULTG AS Parent_ULTG,
    CASE
      WHEN t.Master_ULTG IS NULL OR TRIM(t.Master_ULTG) = '' THEN 'MISSING_ULTG'
      ELSE 'OK'
    END AS qc_ultg_hierarchy,
    CASE
      WHEN t.Master_Gardu_Induk IS NULL OR TRIM(t.Master_Gardu_Induk) = '' THEN 'MISSING_GI'
      WHEN g.ID_GI IS NULL THEN 'ORPHAN_GI'
      ELSE 'OK'
    END AS qc_hierarchy
FROM `gcp-bridge-meshvpn.Dashboard_Gardu_Induk_UPT_Bogor.e_master_bay` t
LEFT JOIN (SELECT DISTINCT Master_Gardu_Induk, ID_GI, Master_ULTG FROM `gcp-bridge-meshvpn.MASTER_HIERARCHY_UPT_Bogor.e_Master_Gardu_Induk` WHERE Master_Gardu_Induk IS NOT NULL) g ON UPPER(TRIM(t.Master_Gardu_Induk)) = UPPER(TRIM(g.Master_Gardu_Induk))

EOSQL

echo "    -> Melakukan Data Pump ke Native Table: n_master_bay"
cat << 'EOSQL' | bq query --use_legacy_sql=false --project_id=gcp-bridge-meshvpn
CREATE OR REPLACE TABLE `gcp-bridge-meshvpn.Dashboard_Gardu_Induk_UPT_Bogor.n_master_bay` AS
SELECT * FROM `gcp-bridge-meshvpn.Dashboard_Gardu_Induk_UPT_Bogor.v_master_bay`
EOSQL

echo "[+] Memproses Sheet: 'Koordinat Gardu Induk' -> e_, v_, dan n_"
cat << 'EOF' > /tmp/def_e_koordinat_gardu_induk.json
{
  "sourceFormat": "GOOGLE_SHEETS",
  "sourceUris": ["https://docs.google.com/spreadsheets/d/1vpVUczVs8GB-VHbqxrHpl-EZI66HO2e2fWdU3qfLzeI"],
  "googleSheetsOptions": { "range": "Koordinat Gardu Induk" },
  "autodetect": true
}
EOF
bq rm -f -t gcp-bridge-meshvpn:Dashboard_Gardu_Induk_UPT_Bogor.e_koordinat_gardu_induk || true
bq mk --table --external_table_definition=/tmp/def_e_koordinat_gardu_induk.json gcp-bridge-meshvpn:Dashboard_Gardu_Induk_UPT_Bogor.e_koordinat_gardu_induk

cat << 'EOSQL' | bq query --use_legacy_sql=false --project_id=gcp-bridge-meshvpn
CREATE OR REPLACE VIEW `gcp-bridge-meshvpn.Dashboard_Gardu_Induk_UPT_Bogor.v_koordinat_gardu_induk` AS
SELECT
  t.*, g.ID_GI, g.Master_ULTG AS Parent_ULTG,
    CASE
      WHEN t.Master_ULTG IS NULL OR TRIM(t.Master_ULTG) = '' THEN 'MISSING_ULTG'
      ELSE 'OK'
    END AS qc_ultg_hierarchy,
    CASE
      WHEN t.Master_Gardu_Induk IS NULL OR TRIM(t.Master_Gardu_Induk) = '' THEN 'MISSING_GI'
      WHEN g.ID_GI IS NULL THEN 'ORPHAN_GI'
      ELSE 'OK'
    END AS qc_hierarchy
FROM `gcp-bridge-meshvpn.Dashboard_Gardu_Induk_UPT_Bogor.e_koordinat_gardu_induk` t
LEFT JOIN (SELECT DISTINCT Master_Gardu_Induk, ID_GI, Master_ULTG FROM `gcp-bridge-meshvpn.MASTER_HIERARCHY_UPT_Bogor.e_Master_Gardu_Induk` WHERE Master_Gardu_Induk IS NOT NULL) g ON UPPER(TRIM(t.Master_Gardu_Induk)) = UPPER(TRIM(g.Master_Gardu_Induk))

EOSQL

echo "    -> Melakukan Data Pump ke Native Table: n_koordinat_gardu_induk"
cat << 'EOSQL' | bq query --use_legacy_sql=false --project_id=gcp-bridge-meshvpn
CREATE OR REPLACE TABLE `gcp-bridge-meshvpn.Dashboard_Gardu_Induk_UPT_Bogor.n_koordinat_gardu_induk` AS
SELECT * FROM `gcp-bridge-meshvpn.Dashboard_Gardu_Induk_UPT_Bogor.v_koordinat_gardu_induk`
EOSQL

echo "[+] Memproses Sheet: 'MTU TRAFO' -> e_, v_, dan n_"
cat << 'EOF' > /tmp/def_e_mtu_trafo.json
{
  "sourceFormat": "GOOGLE_SHEETS",
  "sourceUris": ["https://docs.google.com/spreadsheets/d/1aSi-mBeRnpUvSuNQ_U4HZbLxpmqwt2Fwh8koJVslqIg"],
  "googleSheetsOptions": { "range": "MTU TRAFO" },
  "autodetect": true
}
EOF
bq rm -f -t gcp-bridge-meshvpn:Dashboard_Gardu_Induk_UPT_Bogor.e_mtu_trafo || true
bq mk --table --external_table_definition=/tmp/def_e_mtu_trafo.json gcp-bridge-meshvpn:Dashboard_Gardu_Induk_UPT_Bogor.e_mtu_trafo

cat << 'EOSQL' | bq query --use_legacy_sql=false --project_id=gcp-bridge-meshvpn
CREATE OR REPLACE VIEW `gcp-bridge-meshvpn.Dashboard_Gardu_Induk_UPT_Bogor.v_mtu_trafo` AS
SELECT
  t.*, g.ID_GI, g.Master_ULTG AS Parent_ULTG, b.ID_Bay,
    CASE
      WHEN t.Master_ULTG IS NULL OR TRIM(t.Master_ULTG) = '' THEN 'MISSING_ULTG'
      ELSE 'OK'
    END AS qc_ultg_hierarchy,
    CASE
      WHEN t.Master_Gardu_Induk IS NULL OR TRIM(t.Master_Gardu_Induk) = '' THEN 'MISSING_GI'
      WHEN g.ID_GI IS NULL THEN 'ORPHAN_GI'
      ELSE 'OK'
    END AS qc_hierarchy,
    CASE
      WHEN t.Master_Bay IS NOT NULL AND TRIM(t.Master_Bay) != '' AND b.ID_Bay IS NULL THEN 'ORPHAN_BAY'
      WHEN t.Master_Bay IS NOT NULL AND TRIM(t.Master_Bay) != '' THEN 'OK_BAY'
      ELSE 'NO_BAY_PROVIDED'
    END AS qc_bay_hierarchy
FROM `gcp-bridge-meshvpn.Dashboard_Gardu_Induk_UPT_Bogor.e_mtu_trafo` t
LEFT JOIN (SELECT DISTINCT Master_Gardu_Induk, ID_GI, Master_ULTG FROM `gcp-bridge-meshvpn.MASTER_HIERARCHY_UPT_Bogor.e_Master_Gardu_Induk` WHERE Master_Gardu_Induk IS NOT NULL) g ON UPPER(TRIM(t.Master_Gardu_Induk)) = UPPER(TRIM(g.Master_Gardu_Induk))
LEFT JOIN (SELECT DISTINCT Master_Gardu_Induk, Master_Bay, ID_Bay FROM `gcp-bridge-meshvpn.MASTER_HIERARCHY_UPT_Bogor.e_Master_Bay` WHERE Master_Bay IS NOT NULL) b ON UPPER(TRIM(t.Master_Bay)) = UPPER(TRIM(b.Master_Bay)) AND UPPER(TRIM(t.Master_Gardu_Induk)) = UPPER(TRIM(b.Master_Gardu_Induk))

EOSQL

echo "    -> Melakukan Data Pump ke Native Table: n_mtu_trafo"
cat << 'EOSQL' | bq query --use_legacy_sql=false --project_id=gcp-bridge-meshvpn
CREATE OR REPLACE TABLE `gcp-bridge-meshvpn.Dashboard_Gardu_Induk_UPT_Bogor.n_mtu_trafo` AS
SELECT * FROM `gcp-bridge-meshvpn.Dashboard_Gardu_Induk_UPT_Bogor.v_mtu_trafo`
EOSQL

echo "[+] Memproses Sheet: 'PROGRAM STRATEGIS TRAFO' -> e_, v_, dan n_"
cat << 'EOF' > /tmp/def_e_program_strategis_trafo.json
{
  "sourceFormat": "GOOGLE_SHEETS",
  "sourceUris": ["https://docs.google.com/spreadsheets/d/1aSi-mBeRnpUvSuNQ_U4HZbLxpmqwt2Fwh8koJVslqIg"],
  "googleSheetsOptions": { "range": "PROGRAM STRATEGIS TRAFO" },
  "autodetect": true
}
EOF
bq rm -f -t gcp-bridge-meshvpn:Dashboard_Gardu_Induk_UPT_Bogor.e_program_strategis_trafo || true
bq mk --table --external_table_definition=/tmp/def_e_program_strategis_trafo.json gcp-bridge-meshvpn:Dashboard_Gardu_Induk_UPT_Bogor.e_program_strategis_trafo

cat << 'EOSQL' | bq query --use_legacy_sql=false --project_id=gcp-bridge-meshvpn
CREATE OR REPLACE VIEW `gcp-bridge-meshvpn.Dashboard_Gardu_Induk_UPT_Bogor.v_program_strategis_trafo` AS
SELECT
  t.*, g.ID_GI, g.Master_ULTG AS Parent_ULTG, b.ID_Bay,
    CASE
      WHEN t.Master_ULTG IS NULL OR TRIM(t.Master_ULTG) = '' THEN 'MISSING_ULTG'
      ELSE 'OK'
    END AS qc_ultg_hierarchy,
    CASE
      WHEN t.Master_Gardu_Induk IS NULL OR TRIM(t.Master_Gardu_Induk) = '' THEN 'MISSING_GI'
      WHEN g.ID_GI IS NULL THEN 'ORPHAN_GI'
      ELSE 'OK'
    END AS qc_hierarchy,
    CASE
      WHEN t.Master_Bay IS NOT NULL AND TRIM(t.Master_Bay) != '' AND b.ID_Bay IS NULL THEN 'ORPHAN_BAY'
      WHEN t.Master_Bay IS NOT NULL AND TRIM(t.Master_Bay) != '' THEN 'OK_BAY'
      ELSE 'NO_BAY_PROVIDED'
    END AS qc_bay_hierarchy
FROM `gcp-bridge-meshvpn.Dashboard_Gardu_Induk_UPT_Bogor.e_program_strategis_trafo` t
LEFT JOIN (SELECT DISTINCT Master_Gardu_Induk, ID_GI, Master_ULTG FROM `gcp-bridge-meshvpn.MASTER_HIERARCHY_UPT_Bogor.e_Master_Gardu_Induk` WHERE Master_Gardu_Induk IS NOT NULL) g ON UPPER(TRIM(t.Master_Gardu_Induk)) = UPPER(TRIM(g.Master_Gardu_Induk))
LEFT JOIN (SELECT DISTINCT Master_Gardu_Induk, Master_Bay, ID_Bay FROM `gcp-bridge-meshvpn.MASTER_HIERARCHY_UPT_Bogor.e_Master_Bay` WHERE Master_Bay IS NOT NULL) b ON UPPER(TRIM(t.Master_Bay)) = UPPER(TRIM(b.Master_Bay)) AND UPPER(TRIM(t.Master_Gardu_Induk)) = UPPER(TRIM(b.Master_Gardu_Induk))

EOSQL

echo "    -> Melakukan Data Pump ke Native Table: n_program_strategis_trafo"
cat << 'EOSQL' | bq query --use_legacy_sql=false --project_id=gcp-bridge-meshvpn
CREATE OR REPLACE TABLE `gcp-bridge-meshvpn.Dashboard_Gardu_Induk_UPT_Bogor.n_program_strategis_trafo` AS
SELECT * FROM `gcp-bridge-meshvpn.Dashboard_Gardu_Induk_UPT_Bogor.v_program_strategis_trafo`
EOSQL

echo "[+] Memproses Sheet: 'PROGRAM KERJA HARGI' -> e_, v_, dan n_"
cat << 'EOF' > /tmp/def_e_program_kerja_hargi.json
{
  "sourceFormat": "GOOGLE_SHEETS",
  "sourceUris": ["https://docs.google.com/spreadsheets/d/1aSi-mBeRnpUvSuNQ_U4HZbLxpmqwt2Fwh8koJVslqIg"],
  "googleSheetsOptions": { "range": "PROGRAM KERJA HARGI" },
  "autodetect": true
}
EOF
bq rm -f -t gcp-bridge-meshvpn:Dashboard_Gardu_Induk_UPT_Bogor.e_program_kerja_hargi || true
bq mk --table --external_table_definition=/tmp/def_e_program_kerja_hargi.json gcp-bridge-meshvpn:Dashboard_Gardu_Induk_UPT_Bogor.e_program_kerja_hargi

cat << 'EOSQL' | bq query --use_legacy_sql=false --project_id=gcp-bridge-meshvpn
CREATE OR REPLACE VIEW `gcp-bridge-meshvpn.Dashboard_Gardu_Induk_UPT_Bogor.v_program_kerja_hargi` AS
SELECT
  t.*, g.ID_GI, g.Master_ULTG AS Parent_ULTG, b.ID_Bay,
    CASE
      WHEN t.Master_ULTG IS NULL OR TRIM(t.Master_ULTG) = '' THEN 'MISSING_ULTG'
      ELSE 'OK'
    END AS qc_ultg_hierarchy,
    CASE
      WHEN t.Master_Gardu_Induk IS NULL OR TRIM(t.Master_Gardu_Induk) = '' THEN 'MISSING_GI'
      WHEN g.ID_GI IS NULL THEN 'ORPHAN_GI'
      ELSE 'OK'
    END AS qc_hierarchy,
    CASE
      WHEN t.Master_Bay IS NOT NULL AND TRIM(t.Master_Bay) != '' AND b.ID_Bay IS NULL THEN 'ORPHAN_BAY'
      WHEN t.Master_Bay IS NOT NULL AND TRIM(t.Master_Bay) != '' THEN 'OK_BAY'
      ELSE 'NO_BAY_PROVIDED'
    END AS qc_bay_hierarchy
FROM `gcp-bridge-meshvpn.Dashboard_Gardu_Induk_UPT_Bogor.e_program_kerja_hargi` t
LEFT JOIN (SELECT DISTINCT Master_Gardu_Induk, ID_GI, Master_ULTG FROM `gcp-bridge-meshvpn.MASTER_HIERARCHY_UPT_Bogor.e_Master_Gardu_Induk` WHERE Master_Gardu_Induk IS NOT NULL) g ON UPPER(TRIM(t.Master_Gardu_Induk)) = UPPER(TRIM(g.Master_Gardu_Induk))
LEFT JOIN (SELECT DISTINCT Master_Gardu_Induk, Master_Bay, ID_Bay FROM `gcp-bridge-meshvpn.MASTER_HIERARCHY_UPT_Bogor.e_Master_Bay` WHERE Master_Bay IS NOT NULL) b ON UPPER(TRIM(t.Master_Bay)) = UPPER(TRIM(b.Master_Bay)) AND UPPER(TRIM(t.Master_Gardu_Induk)) = UPPER(TRIM(b.Master_Gardu_Induk))

EOSQL

echo "    -> Melakukan Data Pump ke Native Table: n_program_kerja_hargi"
cat << 'EOSQL' | bq query --use_legacy_sql=false --project_id=gcp-bridge-meshvpn
CREATE OR REPLACE TABLE `gcp-bridge-meshvpn.Dashboard_Gardu_Induk_UPT_Bogor.n_program_kerja_hargi` AS
SELECT * FROM `gcp-bridge-meshvpn.Dashboard_Gardu_Induk_UPT_Bogor.v_program_kerja_hargi`
EOSQL

echo "[+] Memproses Sheet: 'Jadwal Padam' -> e_, v_, dan n_"
cat << 'EOF' > /tmp/def_e_jadwal_padam.json
{
  "sourceFormat": "GOOGLE_SHEETS",
  "sourceUris": ["https://docs.google.com/spreadsheets/d/1Ktsov6WR0CRo31T9pZGo4nEBhMW5MoJ7ectXQyqz0vk"],
  "googleSheetsOptions": { "range": "Jadwal Padam" },
  "autodetect": true
}
EOF
bq rm -f -t gcp-bridge-meshvpn:Dashboard_Gardu_Induk_UPT_Bogor.e_jadwal_padam || true
bq mk --table --external_table_definition=/tmp/def_e_jadwal_padam.json gcp-bridge-meshvpn:Dashboard_Gardu_Induk_UPT_Bogor.e_jadwal_padam

cat << 'EOSQL' | bq query --use_legacy_sql=false --project_id=gcp-bridge-meshvpn
CREATE OR REPLACE VIEW `gcp-bridge-meshvpn.Dashboard_Gardu_Induk_UPT_Bogor.v_jadwal_padam` AS
SELECT
  t.*, g.ID_GI, g.Master_ULTG AS Parent_ULTG,
    CASE
      WHEN t.ULTG IS NULL OR TRIM(t.ULTG) = '' THEN 'MISSING_ULTG'
      ELSE 'OK'
    END AS qc_ultg_hierarchy,
    CASE
      WHEN t.Gardu_Induk IS NULL OR TRIM(t.Gardu_Induk) = '' THEN 'MISSING_GI'
      WHEN g.ID_GI IS NULL THEN 'ORPHAN_GI'
      ELSE 'OK'
    END AS qc_hierarchy
FROM `gcp-bridge-meshvpn.Dashboard_Gardu_Induk_UPT_Bogor.e_jadwal_padam` t
LEFT JOIN (SELECT DISTINCT Master_Gardu_Induk, ID_GI, Master_ULTG FROM `gcp-bridge-meshvpn.MASTER_HIERARCHY_UPT_Bogor.e_Master_Gardu_Induk` WHERE Master_Gardu_Induk IS NOT NULL) g ON UPPER(TRIM(t.Gardu_Induk)) = UPPER(TRIM(g.Master_Gardu_Induk))

EOSQL

echo "    -> Melakukan Data Pump ke Native Table: n_jadwal_padam"
cat << 'EOSQL' | bq query --use_legacy_sql=false --project_id=gcp-bridge-meshvpn
CREATE OR REPLACE TABLE `gcp-bridge-meshvpn.Dashboard_Gardu_Induk_UPT_Bogor.n_jadwal_padam` AS
SELECT * FROM `gcp-bridge-meshvpn.Dashboard_Gardu_Induk_UPT_Bogor.v_jadwal_padam`
EOSQL

echo "[+] Memproses Sheet: 'Asset Relay UPT Bogor' -> e_, v_, dan n_"
cat << 'EOF' > /tmp/def_e_asset_relay_upt_bogor.json
{
  "sourceFormat": "GOOGLE_SHEETS",
  "sourceUris": ["https://docs.google.com/spreadsheets/d/1RDb1cBtjCo0rBN1goWXV4-VG75fof_K5ZiFP-L7wwW8"],
  "googleSheetsOptions": { "range": "Asset Relay UPT Bogor" },
  "autodetect": true
}
EOF
bq rm -f -t gcp-bridge-meshvpn:Dashboard_Gardu_Induk_UPT_Bogor.e_asset_relay_upt_bogor || true
bq mk --table --external_table_definition=/tmp/def_e_asset_relay_upt_bogor.json gcp-bridge-meshvpn:Dashboard_Gardu_Induk_UPT_Bogor.e_asset_relay_upt_bogor

cat << 'EOSQL' | bq query --use_legacy_sql=false --project_id=gcp-bridge-meshvpn
CREATE OR REPLACE VIEW `gcp-bridge-meshvpn.Dashboard_Gardu_Induk_UPT_Bogor.v_asset_relay_upt_bogor` AS
SELECT
  t.*, g.ID_GI, g.Master_ULTG AS Parent_ULTG,
    CASE
      WHEN t.ULTG IS NULL OR TRIM(t.ULTG) = '' THEN 'MISSING_ULTG'
      ELSE 'OK'
    END AS qc_ultg_hierarchy,
    CASE
      WHEN t.Gardu_Induk IS NULL OR TRIM(t.Gardu_Induk) = '' THEN 'MISSING_GI'
      WHEN g.ID_GI IS NULL THEN 'ORPHAN_GI'
      ELSE 'OK'
    END AS qc_hierarchy
FROM `gcp-bridge-meshvpn.Dashboard_Gardu_Induk_UPT_Bogor.e_asset_relay_upt_bogor` t
LEFT JOIN (SELECT DISTINCT Master_Gardu_Induk, ID_GI, Master_ULTG FROM `gcp-bridge-meshvpn.MASTER_HIERARCHY_UPT_Bogor.e_Master_Gardu_Induk` WHERE Master_Gardu_Induk IS NOT NULL) g ON UPPER(TRIM(t.Gardu_Induk)) = UPPER(TRIM(g.Master_Gardu_Induk))

EOSQL

echo "    -> Melakukan Data Pump ke Native Table: n_asset_relay_upt_bogor"
cat << 'EOSQL' | bq query --use_legacy_sql=false --project_id=gcp-bridge-meshvpn
CREATE OR REPLACE TABLE `gcp-bridge-meshvpn.Dashboard_Gardu_Induk_UPT_Bogor.n_asset_relay_upt_bogor` AS
SELECT * FROM `gcp-bridge-meshvpn.Dashboard_Gardu_Induk_UPT_Bogor.v_asset_relay_upt_bogor`
EOSQL

echo "[+] Memproses Sheet: 'MTU PMT' -> e_, v_, dan n_"
cat << 'EOF' > /tmp/def_e_mtu_pmt.json
{
  "sourceFormat": "GOOGLE_SHEETS",
  "sourceUris": ["https://docs.google.com/spreadsheets/d/1aSi-mBeRnpUvSuNQ_U4HZbLxpmqwt2Fwh8koJVslqIg"],
  "googleSheetsOptions": { "range": "MTU PMT" },
  "autodetect": true
}
EOF
bq rm -f -t gcp-bridge-meshvpn:Dashboard_Gardu_Induk_UPT_Bogor.e_mtu_pmt || true
bq mk --table --external_table_definition=/tmp/def_e_mtu_pmt.json gcp-bridge-meshvpn:Dashboard_Gardu_Induk_UPT_Bogor.e_mtu_pmt

cat << 'EOSQL' | bq query --use_legacy_sql=false --project_id=gcp-bridge-meshvpn
CREATE OR REPLACE VIEW `gcp-bridge-meshvpn.Dashboard_Gardu_Induk_UPT_Bogor.v_mtu_pmt` AS
SELECT
  t.*, g.ID_GI, g.Master_ULTG AS Parent_ULTG, b.ID_Bay,
    CASE
      WHEN t.Master_ULTG IS NULL OR TRIM(t.Master_ULTG) = '' THEN 'MISSING_ULTG'
      ELSE 'OK'
    END AS qc_ultg_hierarchy,
    CASE
      WHEN t.Master_Gardu_Induk IS NULL OR TRIM(t.Master_Gardu_Induk) = '' THEN 'MISSING_GI'
      WHEN g.ID_GI IS NULL THEN 'ORPHAN_GI'
      ELSE 'OK'
    END AS qc_hierarchy,
    CASE
      WHEN t.Master_Bay IS NOT NULL AND TRIM(t.Master_Bay) != '' AND b.ID_Bay IS NULL THEN 'ORPHAN_BAY'
      WHEN t.Master_Bay IS NOT NULL AND TRIM(t.Master_Bay) != '' THEN 'OK_BAY'
      ELSE 'NO_BAY_PROVIDED'
    END AS qc_bay_hierarchy
FROM `gcp-bridge-meshvpn.Dashboard_Gardu_Induk_UPT_Bogor.e_mtu_pmt` t
LEFT JOIN (SELECT DISTINCT Master_Gardu_Induk, ID_GI, Master_ULTG FROM `gcp-bridge-meshvpn.MASTER_HIERARCHY_UPT_Bogor.e_Master_Gardu_Induk` WHERE Master_Gardu_Induk IS NOT NULL) g ON UPPER(TRIM(t.Master_Gardu_Induk)) = UPPER(TRIM(g.Master_Gardu_Induk))
LEFT JOIN (SELECT DISTINCT Master_Gardu_Induk, Master_Bay, ID_Bay FROM `gcp-bridge-meshvpn.MASTER_HIERARCHY_UPT_Bogor.e_Master_Bay` WHERE Master_Bay IS NOT NULL) b ON UPPER(TRIM(t.Master_Bay)) = UPPER(TRIM(b.Master_Bay)) AND UPPER(TRIM(t.Master_Gardu_Induk)) = UPPER(TRIM(b.Master_Gardu_Induk))

EOSQL

echo "    -> Melakukan Data Pump ke Native Table: n_mtu_pmt"
cat << 'EOSQL' | bq query --use_legacy_sql=false --project_id=gcp-bridge-meshvpn
CREATE OR REPLACE TABLE `gcp-bridge-meshvpn.Dashboard_Gardu_Induk_UPT_Bogor.n_mtu_pmt` AS
SELECT * FROM `gcp-bridge-meshvpn.Dashboard_Gardu_Induk_UPT_Bogor.v_mtu_pmt`
EOSQL

echo "[+] Memproses Sheet: 'MTU PMS' -> e_, v_, dan n_"
cat << 'EOF' > /tmp/def_e_mtu_pms.json
{
  "sourceFormat": "GOOGLE_SHEETS",
  "sourceUris": ["https://docs.google.com/spreadsheets/d/1aSi-mBeRnpUvSuNQ_U4HZbLxpmqwt2Fwh8koJVslqIg"],
  "googleSheetsOptions": { "range": "MTU PMS" },
  "autodetect": true
}
EOF
bq rm -f -t gcp-bridge-meshvpn:Dashboard_Gardu_Induk_UPT_Bogor.e_mtu_pms || true
bq mk --table --external_table_definition=/tmp/def_e_mtu_pms.json gcp-bridge-meshvpn:Dashboard_Gardu_Induk_UPT_Bogor.e_mtu_pms

cat << 'EOSQL' | bq query --use_legacy_sql=false --project_id=gcp-bridge-meshvpn
CREATE OR REPLACE VIEW `gcp-bridge-meshvpn.Dashboard_Gardu_Induk_UPT_Bogor.v_mtu_pms` AS
SELECT
  t.*, g.ID_GI, g.Master_ULTG AS Parent_ULTG, b.ID_Bay,
    CASE
      WHEN t.Master_ULTG IS NULL OR TRIM(t.Master_ULTG) = '' THEN 'MISSING_ULTG'
      ELSE 'OK'
    END AS qc_ultg_hierarchy,
    CASE
      WHEN t.Master_Gardu_Induk IS NULL OR TRIM(t.Master_Gardu_Induk) = '' THEN 'MISSING_GI'
      WHEN g.ID_GI IS NULL THEN 'ORPHAN_GI'
      ELSE 'OK'
    END AS qc_hierarchy,
    CASE
      WHEN t.Master_Bay IS NOT NULL AND TRIM(t.Master_Bay) != '' AND b.ID_Bay IS NULL THEN 'ORPHAN_BAY'
      WHEN t.Master_Bay IS NOT NULL AND TRIM(t.Master_Bay) != '' THEN 'OK_BAY'
      ELSE 'NO_BAY_PROVIDED'
    END AS qc_bay_hierarchy
FROM `gcp-bridge-meshvpn.Dashboard_Gardu_Induk_UPT_Bogor.e_mtu_pms` t
LEFT JOIN (SELECT DISTINCT Master_Gardu_Induk, ID_GI, Master_ULTG FROM `gcp-bridge-meshvpn.MASTER_HIERARCHY_UPT_Bogor.e_Master_Gardu_Induk` WHERE Master_Gardu_Induk IS NOT NULL) g ON UPPER(TRIM(t.Master_Gardu_Induk)) = UPPER(TRIM(g.Master_Gardu_Induk))
LEFT JOIN (SELECT DISTINCT Master_Gardu_Induk, Master_Bay, ID_Bay FROM `gcp-bridge-meshvpn.MASTER_HIERARCHY_UPT_Bogor.e_Master_Bay` WHERE Master_Bay IS NOT NULL) b ON UPPER(TRIM(t.Master_Bay)) = UPPER(TRIM(b.Master_Bay)) AND UPPER(TRIM(t.Master_Gardu_Induk)) = UPPER(TRIM(b.Master_Gardu_Induk))

EOSQL

echo "    -> Melakukan Data Pump ke Native Table: n_mtu_pms"
cat << 'EOSQL' | bq query --use_legacy_sql=false --project_id=gcp-bridge-meshvpn
CREATE OR REPLACE TABLE `gcp-bridge-meshvpn.Dashboard_Gardu_Induk_UPT_Bogor.n_mtu_pms` AS
SELECT * FROM `gcp-bridge-meshvpn.Dashboard_Gardu_Induk_UPT_Bogor.v_mtu_pms`
EOSQL

echo "[+] Memproses Sheet: 'MTU CT' -> e_, v_, dan n_"
cat << 'EOF' > /tmp/def_e_mtu_ct.json
{
  "sourceFormat": "GOOGLE_SHEETS",
  "sourceUris": ["https://docs.google.com/spreadsheets/d/1aSi-mBeRnpUvSuNQ_U4HZbLxpmqwt2Fwh8koJVslqIg"],
  "googleSheetsOptions": { "range": "MTU CT" },
  "autodetect": true
}
EOF
bq rm -f -t gcp-bridge-meshvpn:Dashboard_Gardu_Induk_UPT_Bogor.e_mtu_ct || true
bq mk --table --external_table_definition=/tmp/def_e_mtu_ct.json gcp-bridge-meshvpn:Dashboard_Gardu_Induk_UPT_Bogor.e_mtu_ct

cat << 'EOSQL' | bq query --use_legacy_sql=false --project_id=gcp-bridge-meshvpn
CREATE OR REPLACE VIEW `gcp-bridge-meshvpn.Dashboard_Gardu_Induk_UPT_Bogor.v_mtu_ct` AS
SELECT
  t.*, g.ID_GI, g.Master_ULTG AS Parent_ULTG, b.ID_Bay,
    CASE
      WHEN t.Master_ULTG IS NULL OR TRIM(t.Master_ULTG) = '' THEN 'MISSING_ULTG'
      ELSE 'OK'
    END AS qc_ultg_hierarchy,
    CASE
      WHEN t.Master_Gardu_Induk IS NULL OR TRIM(t.Master_Gardu_Induk) = '' THEN 'MISSING_GI'
      WHEN g.ID_GI IS NULL THEN 'ORPHAN_GI'
      ELSE 'OK'
    END AS qc_hierarchy,
    CASE
      WHEN t.Master_Bay IS NOT NULL AND TRIM(t.Master_Bay) != '' AND b.ID_Bay IS NULL THEN 'ORPHAN_BAY'
      WHEN t.Master_Bay IS NOT NULL AND TRIM(t.Master_Bay) != '' THEN 'OK_BAY'
      ELSE 'NO_BAY_PROVIDED'
    END AS qc_bay_hierarchy
FROM `gcp-bridge-meshvpn.Dashboard_Gardu_Induk_UPT_Bogor.e_mtu_ct` t
LEFT JOIN (SELECT DISTINCT Master_Gardu_Induk, ID_GI, Master_ULTG FROM `gcp-bridge-meshvpn.MASTER_HIERARCHY_UPT_Bogor.e_Master_Gardu_Induk` WHERE Master_Gardu_Induk IS NOT NULL) g ON UPPER(TRIM(t.Master_Gardu_Induk)) = UPPER(TRIM(g.Master_Gardu_Induk))
LEFT JOIN (SELECT DISTINCT Master_Gardu_Induk, Master_Bay, ID_Bay FROM `gcp-bridge-meshvpn.MASTER_HIERARCHY_UPT_Bogor.e_Master_Bay` WHERE Master_Bay IS NOT NULL) b ON UPPER(TRIM(t.Master_Bay)) = UPPER(TRIM(b.Master_Bay)) AND UPPER(TRIM(t.Master_Gardu_Induk)) = UPPER(TRIM(b.Master_Gardu_Induk))

EOSQL

echo "    -> Melakukan Data Pump ke Native Table: n_mtu_ct"
cat << 'EOSQL' | bq query --use_legacy_sql=false --project_id=gcp-bridge-meshvpn
CREATE OR REPLACE TABLE `gcp-bridge-meshvpn.Dashboard_Gardu_Induk_UPT_Bogor.n_mtu_ct` AS
SELECT * FROM `gcp-bridge-meshvpn.Dashboard_Gardu_Induk_UPT_Bogor.v_mtu_ct`
EOSQL

echo "[+] Memproses Sheet: 'MTU CVT' -> e_, v_, dan n_"
cat << 'EOF' > /tmp/def_e_mtu_cvt.json
{
  "sourceFormat": "GOOGLE_SHEETS",
  "sourceUris": ["https://docs.google.com/spreadsheets/d/1aSi-mBeRnpUvSuNQ_U4HZbLxpmqwt2Fwh8koJVslqIg"],
  "googleSheetsOptions": { "range": "MTU CVT" },
  "autodetect": true
}
EOF
bq rm -f -t gcp-bridge-meshvpn:Dashboard_Gardu_Induk_UPT_Bogor.e_mtu_cvt || true
bq mk --table --external_table_definition=/tmp/def_e_mtu_cvt.json gcp-bridge-meshvpn:Dashboard_Gardu_Induk_UPT_Bogor.e_mtu_cvt

cat << 'EOSQL' | bq query --use_legacy_sql=false --project_id=gcp-bridge-meshvpn
CREATE OR REPLACE VIEW `gcp-bridge-meshvpn.Dashboard_Gardu_Induk_UPT_Bogor.v_mtu_cvt` AS
SELECT
  t.*, g.ID_GI, g.Master_ULTG AS Parent_ULTG, b.ID_Bay,
    CASE
      WHEN t.Master_ULTG IS NULL OR TRIM(t.Master_ULTG) = '' THEN 'MISSING_ULTG'
      ELSE 'OK'
    END AS qc_ultg_hierarchy,
    CASE
      WHEN t.Master_Gardu_Induk IS NULL OR TRIM(t.Master_Gardu_Induk) = '' THEN 'MISSING_GI'
      WHEN g.ID_GI IS NULL THEN 'ORPHAN_GI'
      ELSE 'OK'
    END AS qc_hierarchy,
    CASE
      WHEN t.Master_Bay IS NOT NULL AND TRIM(t.Master_Bay) != '' AND b.ID_Bay IS NULL THEN 'ORPHAN_BAY'
      WHEN t.Master_Bay IS NOT NULL AND TRIM(t.Master_Bay) != '' THEN 'OK_BAY'
      ELSE 'NO_BAY_PROVIDED'
    END AS qc_bay_hierarchy
FROM `gcp-bridge-meshvpn.Dashboard_Gardu_Induk_UPT_Bogor.e_mtu_cvt` t
LEFT JOIN (SELECT DISTINCT Master_Gardu_Induk, ID_GI, Master_ULTG FROM `gcp-bridge-meshvpn.MASTER_HIERARCHY_UPT_Bogor.e_Master_Gardu_Induk` WHERE Master_Gardu_Induk IS NOT NULL) g ON UPPER(TRIM(t.Master_Gardu_Induk)) = UPPER(TRIM(g.Master_Gardu_Induk))
LEFT JOIN (SELECT DISTINCT Master_Gardu_Induk, Master_Bay, ID_Bay FROM `gcp-bridge-meshvpn.MASTER_HIERARCHY_UPT_Bogor.e_Master_Bay` WHERE Master_Bay IS NOT NULL) b ON UPPER(TRIM(t.Master_Bay)) = UPPER(TRIM(b.Master_Bay)) AND UPPER(TRIM(t.Master_Gardu_Induk)) = UPPER(TRIM(b.Master_Gardu_Induk))

EOSQL

echo "    -> Melakukan Data Pump ke Native Table: n_mtu_cvt"
cat << 'EOSQL' | bq query --use_legacy_sql=false --project_id=gcp-bridge-meshvpn
CREATE OR REPLACE TABLE `gcp-bridge-meshvpn.Dashboard_Gardu_Induk_UPT_Bogor.n_mtu_cvt` AS
SELECT * FROM `gcp-bridge-meshvpn.Dashboard_Gardu_Induk_UPT_Bogor.v_mtu_cvt`
EOSQL

echo "[+] Memproses Sheet: 'MTU LA' -> e_, v_, dan n_"
cat << 'EOF' > /tmp/def_e_mtu_la.json
{
  "sourceFormat": "GOOGLE_SHEETS",
  "sourceUris": ["https://docs.google.com/spreadsheets/d/1aSi-mBeRnpUvSuNQ_U4HZbLxpmqwt2Fwh8koJVslqIg"],
  "googleSheetsOptions": { "range": "MTU LA" },
  "autodetect": true
}
EOF
bq rm -f -t gcp-bridge-meshvpn:Dashboard_Gardu_Induk_UPT_Bogor.e_mtu_la || true
bq mk --table --external_table_definition=/tmp/def_e_mtu_la.json gcp-bridge-meshvpn:Dashboard_Gardu_Induk_UPT_Bogor.e_mtu_la

cat << 'EOSQL' | bq query --use_legacy_sql=false --project_id=gcp-bridge-meshvpn
CREATE OR REPLACE VIEW `gcp-bridge-meshvpn.Dashboard_Gardu_Induk_UPT_Bogor.v_mtu_la` AS
SELECT
  t.*, g.ID_GI, g.Master_ULTG AS Parent_ULTG, b.ID_Bay,
    CASE
      WHEN t.Master_ULTG IS NULL OR TRIM(t.Master_ULTG) = '' THEN 'MISSING_ULTG'
      ELSE 'OK'
    END AS qc_ultg_hierarchy,
    CASE
      WHEN t.Master_Gardu_Induk IS NULL OR TRIM(t.Master_Gardu_Induk) = '' THEN 'MISSING_GI'
      WHEN g.ID_GI IS NULL THEN 'ORPHAN_GI'
      ELSE 'OK'
    END AS qc_hierarchy,
    CASE
      WHEN t.Master_Bay IS NOT NULL AND TRIM(t.Master_Bay) != '' AND b.ID_Bay IS NULL THEN 'ORPHAN_BAY'
      WHEN t.Master_Bay IS NOT NULL AND TRIM(t.Master_Bay) != '' THEN 'OK_BAY'
      ELSE 'NO_BAY_PROVIDED'
    END AS qc_bay_hierarchy
FROM `gcp-bridge-meshvpn.Dashboard_Gardu_Induk_UPT_Bogor.e_mtu_la` t
LEFT JOIN (SELECT DISTINCT Master_Gardu_Induk, ID_GI, Master_ULTG FROM `gcp-bridge-meshvpn.MASTER_HIERARCHY_UPT_Bogor.e_Master_Gardu_Induk` WHERE Master_Gardu_Induk IS NOT NULL) g ON UPPER(TRIM(t.Master_Gardu_Induk)) = UPPER(TRIM(g.Master_Gardu_Induk))
LEFT JOIN (SELECT DISTINCT Master_Gardu_Induk, Master_Bay, ID_Bay FROM `gcp-bridge-meshvpn.MASTER_HIERARCHY_UPT_Bogor.e_Master_Bay` WHERE Master_Bay IS NOT NULL) b ON UPPER(TRIM(t.Master_Bay)) = UPPER(TRIM(b.Master_Bay)) AND UPPER(TRIM(t.Master_Gardu_Induk)) = UPPER(TRIM(b.Master_Gardu_Induk))

EOSQL

echo "    -> Melakukan Data Pump ke Native Table: n_mtu_la"
cat << 'EOSQL' | bq query --use_legacy_sql=false --project_id=gcp-bridge-meshvpn
CREATE OR REPLACE TABLE `gcp-bridge-meshvpn.Dashboard_Gardu_Induk_UPT_Bogor.n_mtu_la` AS
SELECT * FROM `gcp-bridge-meshvpn.Dashboard_Gardu_Induk_UPT_Bogor.v_mtu_la`
EOSQL

echo "[+] Memproses Sheet: 'MTU KABEL POWER' -> e_, v_, dan n_"
cat << 'EOF' > /tmp/def_e_mtu_kabel_power.json
{
  "sourceFormat": "GOOGLE_SHEETS",
  "sourceUris": ["https://docs.google.com/spreadsheets/d/1aSi-mBeRnpUvSuNQ_U4HZbLxpmqwt2Fwh8koJVslqIg"],
  "googleSheetsOptions": { "range": "MTU KABEL POWER" },
  "autodetect": true
}
EOF
bq rm -f -t gcp-bridge-meshvpn:Dashboard_Gardu_Induk_UPT_Bogor.e_mtu_kabel_power || true
bq mk --table --external_table_definition=/tmp/def_e_mtu_kabel_power.json gcp-bridge-meshvpn:Dashboard_Gardu_Induk_UPT_Bogor.e_mtu_kabel_power

cat << 'EOSQL' | bq query --use_legacy_sql=false --project_id=gcp-bridge-meshvpn
CREATE OR REPLACE VIEW `gcp-bridge-meshvpn.Dashboard_Gardu_Induk_UPT_Bogor.v_mtu_kabel_power` AS
SELECT
  t.*, g.ID_GI, g.Master_ULTG AS Parent_ULTG, b.ID_Bay,
    CASE
      WHEN t.Master_ULTG IS NULL OR TRIM(t.Master_ULTG) = '' THEN 'MISSING_ULTG'
      ELSE 'OK'
    END AS qc_ultg_hierarchy,
    CASE
      WHEN t.Master_Gardu_Induk IS NULL OR TRIM(t.Master_Gardu_Induk) = '' THEN 'MISSING_GI'
      WHEN g.ID_GI IS NULL THEN 'ORPHAN_GI'
      ELSE 'OK'
    END AS qc_hierarchy,
    CASE
      WHEN t.Master_Bay IS NOT NULL AND TRIM(t.Master_Bay) != '' AND b.ID_Bay IS NULL THEN 'ORPHAN_BAY'
      WHEN t.Master_Bay IS NOT NULL AND TRIM(t.Master_Bay) != '' THEN 'OK_BAY'
      ELSE 'NO_BAY_PROVIDED'
    END AS qc_bay_hierarchy
FROM `gcp-bridge-meshvpn.Dashboard_Gardu_Induk_UPT_Bogor.e_mtu_kabel_power` t
LEFT JOIN (SELECT DISTINCT Master_Gardu_Induk, ID_GI, Master_ULTG FROM `gcp-bridge-meshvpn.MASTER_HIERARCHY_UPT_Bogor.e_Master_Gardu_Induk` WHERE Master_Gardu_Induk IS NOT NULL) g ON UPPER(TRIM(t.Master_Gardu_Induk)) = UPPER(TRIM(g.Master_Gardu_Induk))
LEFT JOIN (SELECT DISTINCT Master_Gardu_Induk, Master_Bay, ID_Bay FROM `gcp-bridge-meshvpn.MASTER_HIERARCHY_UPT_Bogor.e_Master_Bay` WHERE Master_Bay IS NOT NULL) b ON UPPER(TRIM(t.Master_Bay)) = UPPER(TRIM(b.Master_Bay)) AND UPPER(TRIM(t.Master_Gardu_Induk)) = UPPER(TRIM(b.Master_Gardu_Induk))

EOSQL

echo "    -> Melakukan Data Pump ke Native Table: n_mtu_kabel_power"
cat << 'EOSQL' | bq query --use_legacy_sql=false --project_id=gcp-bridge-meshvpn
CREATE OR REPLACE TABLE `gcp-bridge-meshvpn.Dashboard_Gardu_Induk_UPT_Bogor.n_mtu_kabel_power` AS
SELECT * FROM `gcp-bridge-meshvpn.Dashboard_Gardu_Induk_UPT_Bogor.v_mtu_kabel_power`
EOSQL

echo "[+] Memproses Sheet: 'SEALING END' -> e_, v_, dan n_"
cat << 'EOF' > /tmp/def_e_sealing_end.json
{
  "sourceFormat": "GOOGLE_SHEETS",
  "sourceUris": ["https://docs.google.com/spreadsheets/d/1aSi-mBeRnpUvSuNQ_U4HZbLxpmqwt2Fwh8koJVslqIg"],
  "googleSheetsOptions": { "range": "SEALING END" },
  "autodetect": true
}
EOF
bq rm -f -t gcp-bridge-meshvpn:Dashboard_Gardu_Induk_UPT_Bogor.e_sealing_end || true
bq mk --table --external_table_definition=/tmp/def_e_sealing_end.json gcp-bridge-meshvpn:Dashboard_Gardu_Induk_UPT_Bogor.e_sealing_end

cat << 'EOSQL' | bq query --use_legacy_sql=false --project_id=gcp-bridge-meshvpn
CREATE OR REPLACE VIEW `gcp-bridge-meshvpn.Dashboard_Gardu_Induk_UPT_Bogor.v_sealing_end` AS
SELECT
  t.*, g.ID_GI, g.Master_ULTG AS Parent_ULTG, b.ID_Bay,
    CASE
      WHEN t.Master_ULTG IS NULL OR TRIM(t.Master_ULTG) = '' THEN 'MISSING_ULTG'
      ELSE 'OK'
    END AS qc_ultg_hierarchy,
    CASE
      WHEN t.Master_Gardu_Induk IS NULL OR TRIM(t.Master_Gardu_Induk) = '' THEN 'MISSING_GI'
      WHEN g.ID_GI IS NULL THEN 'ORPHAN_GI'
      ELSE 'OK'
    END AS qc_hierarchy,
    CASE
      WHEN t.Master_Bay IS NOT NULL AND TRIM(t.Master_Bay) != '' AND b.ID_Bay IS NULL THEN 'ORPHAN_BAY'
      WHEN t.Master_Bay IS NOT NULL AND TRIM(t.Master_Bay) != '' THEN 'OK_BAY'
      ELSE 'NO_BAY_PROVIDED'
    END AS qc_bay_hierarchy
FROM `gcp-bridge-meshvpn.Dashboard_Gardu_Induk_UPT_Bogor.e_sealing_end` t
LEFT JOIN (SELECT DISTINCT Master_Gardu_Induk, ID_GI, Master_ULTG FROM `gcp-bridge-meshvpn.MASTER_HIERARCHY_UPT_Bogor.e_Master_Gardu_Induk` WHERE Master_Gardu_Induk IS NOT NULL) g ON UPPER(TRIM(t.Master_Gardu_Induk)) = UPPER(TRIM(g.Master_Gardu_Induk))
LEFT JOIN (SELECT DISTINCT Master_Gardu_Induk, Master_Bay, ID_Bay FROM `gcp-bridge-meshvpn.MASTER_HIERARCHY_UPT_Bogor.e_Master_Bay` WHERE Master_Bay IS NOT NULL) b ON UPPER(TRIM(t.Master_Bay)) = UPPER(TRIM(b.Master_Bay)) AND UPPER(TRIM(t.Master_Gardu_Induk)) = UPPER(TRIM(b.Master_Gardu_Induk))

EOSQL

echo "    -> Melakukan Data Pump ke Native Table: n_sealing_end"
cat << 'EOSQL' | bq query --use_legacy_sql=false --project_id=gcp-bridge-meshvpn
CREATE OR REPLACE TABLE `gcp-bridge-meshvpn.Dashboard_Gardu_Induk_UPT_Bogor.n_sealing_end` AS
SELECT * FROM `gcp-bridge-meshvpn.Dashboard_Gardu_Induk_UPT_Bogor.v_sealing_end`
EOSQL

echo "[+] Memproses Sheet: '6.ASSESMENT TOWER DAN VENOM' -> e_, v_, dan n_"
cat << 'EOF' > /tmp/def_e_6_assesment_tower_dan_venom.json
{
  "sourceFormat": "GOOGLE_SHEETS",
  "sourceUris": ["https://docs.google.com/spreadsheets/d/13xm0SqMP5EYbLyYnt5jUPUx1BzhaDffkX4iippq_LuM"],
  "googleSheetsOptions": { "range": "6.ASSESMENT TOWER DAN VENOM" },
  "autodetect": true
}
EOF
bq rm -f -t gcp-bridge-meshvpn:Dashboard_Gardu_Induk_UPT_Bogor.e_6_assesment_tower_dan_venom || true
bq mk --table --external_table_definition=/tmp/def_e_6_assesment_tower_dan_venom.json gcp-bridge-meshvpn:Dashboard_Gardu_Induk_UPT_Bogor.e_6_assesment_tower_dan_venom

cat << 'EOSQL' | bq query --use_legacy_sql=false --project_id=gcp-bridge-meshvpn
CREATE OR REPLACE VIEW `gcp-bridge-meshvpn.Dashboard_Gardu_Induk_UPT_Bogor.v_6_assesment_tower_dan_venom` AS
SELECT
  t.*, g.ID_GI, g.Master_ULTG AS Parent_ULTG,
    CASE
      WHEN t.Master_ULTG IS NULL OR TRIM(t.Master_ULTG) = '' THEN 'MISSING_ULTG'
      ELSE 'OK'
    END AS qc_ultg_hierarchy,
    CASE
      WHEN t.Master_Gardu_Induk IS NULL OR TRIM(t.Master_Gardu_Induk) = '' THEN 'MISSING_GI'
      WHEN g.ID_GI IS NULL THEN 'ORPHAN_GI'
      ELSE 'OK'
    END AS qc_hierarchy
FROM `gcp-bridge-meshvpn.Dashboard_Gardu_Induk_UPT_Bogor.e_6_assesment_tower_dan_venom` t
LEFT JOIN (SELECT DISTINCT Master_Gardu_Induk, ID_GI, Master_ULTG FROM `gcp-bridge-meshvpn.MASTER_HIERARCHY_UPT_Bogor.e_Master_Gardu_Induk` WHERE Master_Gardu_Induk IS NOT NULL) g ON UPPER(TRIM(t.Master_Gardu_Induk)) = UPPER(TRIM(g.Master_Gardu_Induk))

EOSQL

echo "    -> Melakukan Data Pump ke Native Table: n_6_assesment_tower_dan_venom"
cat << 'EOSQL' | bq query --use_legacy_sql=false --project_id=gcp-bridge-meshvpn
CREATE OR REPLACE TABLE `gcp-bridge-meshvpn.Dashboard_Gardu_Induk_UPT_Bogor.n_6_assesment_tower_dan_venom` AS
SELECT * FROM `gcp-bridge-meshvpn.Dashboard_Gardu_Induk_UPT_Bogor.v_6_assesment_tower_dan_venom`
EOSQL

echo "[+] Memproses Sheet: '0.RESUME JARINGAN' -> e_, v_, dan n_"
cat << 'EOF' > /tmp/def_e_0_resume_jaringan.json
{
  "sourceFormat": "GOOGLE_SHEETS",
  "sourceUris": ["https://docs.google.com/spreadsheets/d/13xm0SqMP5EYbLyYnt5jUPUx1BzhaDffkX4iippq_LuM"],
  "googleSheetsOptions": { "range": "0.RESUME JARINGAN" },
  "autodetect": true
}
EOF
bq rm -f -t gcp-bridge-meshvpn:Dashboard_Gardu_Induk_UPT_Bogor.e_0_resume_jaringan || true
bq mk --table --external_table_definition=/tmp/def_e_0_resume_jaringan.json gcp-bridge-meshvpn:Dashboard_Gardu_Induk_UPT_Bogor.e_0_resume_jaringan

cat << 'EOSQL' | bq query --use_legacy_sql=false --project_id=gcp-bridge-meshvpn
CREATE OR REPLACE VIEW `gcp-bridge-meshvpn.Dashboard_Gardu_Induk_UPT_Bogor.v_0_resume_jaringan` AS
SELECT
  t.*, g.ID_GI, g.Master_ULTG AS Parent_ULTG,
    CASE
      WHEN t.Master_ULTG IS NULL OR TRIM(t.Master_ULTG) = '' THEN 'MISSING_ULTG'
      ELSE 'OK'
    END AS qc_ultg_hierarchy,
    CASE
      WHEN t.Master_Gardu_Induk IS NULL OR TRIM(t.Master_Gardu_Induk) = '' THEN 'MISSING_GI'
      WHEN g.ID_GI IS NULL THEN 'ORPHAN_GI'
      ELSE 'OK'
    END AS qc_hierarchy
FROM `gcp-bridge-meshvpn.Dashboard_Gardu_Induk_UPT_Bogor.e_0_resume_jaringan` t
LEFT JOIN (SELECT DISTINCT Master_Gardu_Induk, ID_GI, Master_ULTG FROM `gcp-bridge-meshvpn.MASTER_HIERARCHY_UPT_Bogor.e_Master_Gardu_Induk` WHERE Master_Gardu_Induk IS NOT NULL) g ON UPPER(TRIM(t.Master_Gardu_Induk)) = UPPER(TRIM(g.Master_Gardu_Induk))

EOSQL

echo "    -> Melakukan Data Pump ke Native Table: n_0_resume_jaringan"
cat << 'EOSQL' | bq query --use_legacy_sql=false --project_id=gcp-bridge-meshvpn
CREATE OR REPLACE TABLE `gcp-bridge-meshvpn.Dashboard_Gardu_Induk_UPT_Bogor.n_0_resume_jaringan` AS
SELECT * FROM `gcp-bridge-meshvpn.Dashboard_Gardu_Induk_UPT_Bogor.v_0_resume_jaringan`
EOSQL

echo "[+] Memproses Sheet: '5.HEALTHY INDEX TOWER' -> e_, v_, dan n_"
cat << 'EOF' > /tmp/def_e_5_healthy_index_tower.json
{
  "sourceFormat": "GOOGLE_SHEETS",
  "sourceUris": ["https://docs.google.com/spreadsheets/d/13xm0SqMP5EYbLyYnt5jUPUx1BzhaDffkX4iippq_LuM"],
  "googleSheetsOptions": { "range": "5.HEALTHY INDEX TOWER" },
  "autodetect": true
}
EOF
bq rm -f -t gcp-bridge-meshvpn:Dashboard_Gardu_Induk_UPT_Bogor.e_5_healthy_index_tower || true
bq mk --table --external_table_definition=/tmp/def_e_5_healthy_index_tower.json gcp-bridge-meshvpn:Dashboard_Gardu_Induk_UPT_Bogor.e_5_healthy_index_tower

cat << 'EOSQL' | bq query --use_legacy_sql=false --project_id=gcp-bridge-meshvpn
CREATE OR REPLACE VIEW `gcp-bridge-meshvpn.Dashboard_Gardu_Induk_UPT_Bogor.v_5_healthy_index_tower` AS
SELECT
  t.*, g.ID_GI, g.Master_ULTG AS Parent_ULTG,
    CASE
      WHEN t.Master_ULTG IS NULL OR TRIM(t.Master_ULTG) = '' THEN 'MISSING_ULTG'
      ELSE 'OK'
    END AS qc_ultg_hierarchy,
    CASE
      WHEN t.Master_Gardu_Induk IS NULL OR TRIM(t.Master_Gardu_Induk) = '' THEN 'MISSING_GI'
      WHEN g.ID_GI IS NULL THEN 'ORPHAN_GI'
      ELSE 'OK'
    END AS qc_hierarchy
FROM `gcp-bridge-meshvpn.Dashboard_Gardu_Induk_UPT_Bogor.e_5_healthy_index_tower` t
LEFT JOIN (SELECT DISTINCT Master_Gardu_Induk, ID_GI, Master_ULTG FROM `gcp-bridge-meshvpn.MASTER_HIERARCHY_UPT_Bogor.e_Master_Gardu_Induk` WHERE Master_Gardu_Induk IS NOT NULL) g ON UPPER(TRIM(t.Master_Gardu_Induk)) = UPPER(TRIM(g.Master_Gardu_Induk))

EOSQL

echo "    -> Melakukan Data Pump ke Native Table: n_5_healthy_index_tower"
cat << 'EOSQL' | bq query --use_legacy_sql=false --project_id=gcp-bridge-meshvpn
CREATE OR REPLACE TABLE `gcp-bridge-meshvpn.Dashboard_Gardu_Induk_UPT_Bogor.n_5_healthy_index_tower` AS
SELECT * FROM `gcp-bridge-meshvpn.Dashboard_Gardu_Induk_UPT_Bogor.v_5_healthy_index_tower`
EOSQL

echo "[+] Memproses Sheet: '3.PROTEKSI PETIR TAMBAHAN' -> e_, v_, dan n_"
cat << 'EOF' > /tmp/def_e_3_proteksi_petir_tambahan.json
{
  "sourceFormat": "GOOGLE_SHEETS",
  "sourceUris": ["https://docs.google.com/spreadsheets/d/13xm0SqMP5EYbLyYnt5jUPUx1BzhaDffkX4iippq_LuM"],
  "googleSheetsOptions": { "range": "3.PROTEKSI PETIR TAMBAHAN" },
  "autodetect": true
}
EOF
bq rm -f -t gcp-bridge-meshvpn:Dashboard_Gardu_Induk_UPT_Bogor.e_3_proteksi_petir_tambahan || true
bq mk --table --external_table_definition=/tmp/def_e_3_proteksi_petir_tambahan.json gcp-bridge-meshvpn:Dashboard_Gardu_Induk_UPT_Bogor.e_3_proteksi_petir_tambahan

cat << 'EOSQL' | bq query --use_legacy_sql=false --project_id=gcp-bridge-meshvpn
CREATE OR REPLACE VIEW `gcp-bridge-meshvpn.Dashboard_Gardu_Induk_UPT_Bogor.v_3_proteksi_petir_tambahan` AS
SELECT
  t.*, g.ID_GI, g.Master_ULTG AS Parent_ULTG,
    CASE
      WHEN t.Master_ULTG IS NULL OR TRIM(t.Master_ULTG) = '' THEN 'MISSING_ULTG'
      ELSE 'OK'
    END AS qc_ultg_hierarchy,
    CASE
      WHEN t.Master_Gardu_Induk IS NULL OR TRIM(t.Master_Gardu_Induk) = '' THEN 'MISSING_GI'
      WHEN g.ID_GI IS NULL THEN 'ORPHAN_GI'
      ELSE 'OK'
    END AS qc_hierarchy
FROM `gcp-bridge-meshvpn.Dashboard_Gardu_Induk_UPT_Bogor.e_3_proteksi_petir_tambahan` t
LEFT JOIN (SELECT DISTINCT Master_Gardu_Induk, ID_GI, Master_ULTG FROM `gcp-bridge-meshvpn.MASTER_HIERARCHY_UPT_Bogor.e_Master_Gardu_Induk` WHERE Master_Gardu_Induk IS NOT NULL) g ON UPPER(TRIM(t.Master_Gardu_Induk)) = UPPER(TRIM(g.Master_Gardu_Induk))

EOSQL

echo "    -> Melakukan Data Pump ke Native Table: n_3_proteksi_petir_tambahan"
cat << 'EOSQL' | bq query --use_legacy_sql=false --project_id=gcp-bridge-meshvpn
CREATE OR REPLACE TABLE `gcp-bridge-meshvpn.Dashboard_Gardu_Induk_UPT_Bogor.n_3_proteksi_petir_tambahan` AS
SELECT * FROM `gcp-bridge-meshvpn.Dashboard_Gardu_Induk_UPT_Bogor.v_3_proteksi_petir_tambahan`
EOSQL

echo "[+] Memproses Sheet: '14.LM JARINGAN 2026' -> e_, v_, dan n_"
cat << 'EOF' > /tmp/def_e_14_lm_jaringan_2026.json
{
  "sourceFormat": "GOOGLE_SHEETS",
  "sourceUris": ["https://docs.google.com/spreadsheets/d/13xm0SqMP5EYbLyYnt5jUPUx1BzhaDffkX4iippq_LuM"],
  "googleSheetsOptions": { "range": "14.LM JARINGAN 2026" },
  "autodetect": true
}
EOF
bq rm -f -t gcp-bridge-meshvpn:Dashboard_Gardu_Induk_UPT_Bogor.e_14_lm_jaringan_2026 || true
bq mk --table --external_table_definition=/tmp/def_e_14_lm_jaringan_2026.json gcp-bridge-meshvpn:Dashboard_Gardu_Induk_UPT_Bogor.e_14_lm_jaringan_2026

cat << 'EOSQL' | bq query --use_legacy_sql=false --project_id=gcp-bridge-meshvpn
CREATE OR REPLACE VIEW `gcp-bridge-meshvpn.Dashboard_Gardu_Induk_UPT_Bogor.v_14_lm_jaringan_2026` AS
SELECT
  t.*
FROM `gcp-bridge-meshvpn.Dashboard_Gardu_Induk_UPT_Bogor.e_14_lm_jaringan_2026` t

EOSQL

echo "    -> Melakukan Data Pump ke Native Table: n_14_lm_jaringan_2026"
cat << 'EOSQL' | bq query --use_legacy_sql=false --project_id=gcp-bridge-meshvpn
CREATE OR REPLACE TABLE `gcp-bridge-meshvpn.Dashboard_Gardu_Induk_UPT_Bogor.n_14_lm_jaringan_2026` AS
SELECT * FROM `gcp-bridge-meshvpn.Dashboard_Gardu_Induk_UPT_Bogor.v_14_lm_jaringan_2026`
EOSQL

echo "[+] Memproses Sheet: '12.KONDISI ROW' -> e_, v_, dan n_"
cat << 'EOF' > /tmp/def_e_12_kondisi_row.json
{
  "sourceFormat": "GOOGLE_SHEETS",
  "sourceUris": ["https://docs.google.com/spreadsheets/d/13xm0SqMP5EYbLyYnt5jUPUx1BzhaDffkX4iippq_LuM"],
  "googleSheetsOptions": { "range": "12.KONDISI ROW" },
  "autodetect": true
}
EOF
bq rm -f -t gcp-bridge-meshvpn:Dashboard_Gardu_Induk_UPT_Bogor.e_12_kondisi_row || true
bq mk --table --external_table_definition=/tmp/def_e_12_kondisi_row.json gcp-bridge-meshvpn:Dashboard_Gardu_Induk_UPT_Bogor.e_12_kondisi_row

cat << 'EOSQL' | bq query --use_legacy_sql=false --project_id=gcp-bridge-meshvpn
CREATE OR REPLACE VIEW `gcp-bridge-meshvpn.Dashboard_Gardu_Induk_UPT_Bogor.v_12_kondisi_row` AS
SELECT
  t.*, g.ID_GI, g.Master_ULTG AS Parent_ULTG,
    CASE
      WHEN t.Master_ULTG IS NULL OR TRIM(t.Master_ULTG) = '' THEN 'MISSING_ULTG'
      ELSE 'OK'
    END AS qc_ultg_hierarchy,
    CASE
      WHEN t.Master_Gardu_Induk IS NULL OR TRIM(t.Master_Gardu_Induk) = '' THEN 'MISSING_GI'
      WHEN g.ID_GI IS NULL THEN 'ORPHAN_GI'
      ELSE 'OK'
    END AS qc_hierarchy
FROM `gcp-bridge-meshvpn.Dashboard_Gardu_Induk_UPT_Bogor.e_12_kondisi_row` t
LEFT JOIN (SELECT DISTINCT Master_Gardu_Induk, ID_GI, Master_ULTG FROM `gcp-bridge-meshvpn.MASTER_HIERARCHY_UPT_Bogor.e_Master_Gardu_Induk` WHERE Master_Gardu_Induk IS NOT NULL) g ON UPPER(TRIM(t.Master_Gardu_Induk)) = UPPER(TRIM(g.Master_Gardu_Induk))

EOSQL

echo "    -> Melakukan Data Pump ke Native Table: n_12_kondisi_row"
cat << 'EOSQL' | bq query --use_legacy_sql=false --project_id=gcp-bridge-meshvpn
CREATE OR REPLACE TABLE `gcp-bridge-meshvpn.Dashboard_Gardu_Induk_UPT_Bogor.n_12_kondisi_row` AS
SELECT * FROM `gcp-bridge-meshvpn.Dashboard_Gardu_Induk_UPT_Bogor.v_12_kondisi_row`
EOSQL

echo "[+] Memproses Sheet: '17.SLD TOWER' -> e_, v_, dan n_"
cat << 'EOF' > /tmp/def_e_17_sld_tower.json
{
  "sourceFormat": "GOOGLE_SHEETS",
  "sourceUris": ["https://docs.google.com/spreadsheets/d/13xm0SqMP5EYbLyYnt5jUPUx1BzhaDffkX4iippq_LuM"],
  "googleSheetsOptions": { "range": "17.SLD TOWER" },
  "autodetect": true
}
EOF
bq rm -f -t gcp-bridge-meshvpn:Dashboard_Gardu_Induk_UPT_Bogor.e_17_sld_tower || true
bq mk --table --external_table_definition=/tmp/def_e_17_sld_tower.json gcp-bridge-meshvpn:Dashboard_Gardu_Induk_UPT_Bogor.e_17_sld_tower

cat << 'EOSQL' | bq query --use_legacy_sql=false --project_id=gcp-bridge-meshvpn
CREATE OR REPLACE VIEW `gcp-bridge-meshvpn.Dashboard_Gardu_Induk_UPT_Bogor.v_17_sld_tower` AS
SELECT
  t.*, g.ID_GI, g.Master_ULTG AS Parent_ULTG,
    CASE
      WHEN t.Master_ULTG IS NULL OR TRIM(t.Master_ULTG) = '' THEN 'MISSING_ULTG'
      ELSE 'OK'
    END AS qc_ultg_hierarchy,
    CASE
      WHEN t.Master_Gardu_Induk IS NULL OR TRIM(t.Master_Gardu_Induk) = '' THEN 'MISSING_GI'
      WHEN g.ID_GI IS NULL THEN 'ORPHAN_GI'
      ELSE 'OK'
    END AS qc_hierarchy
FROM `gcp-bridge-meshvpn.Dashboard_Gardu_Induk_UPT_Bogor.e_17_sld_tower` t
LEFT JOIN (SELECT DISTINCT Master_Gardu_Induk, ID_GI, Master_ULTG FROM `gcp-bridge-meshvpn.MASTER_HIERARCHY_UPT_Bogor.e_Master_Gardu_Induk` WHERE Master_Gardu_Induk IS NOT NULL) g ON UPPER(TRIM(t.Master_Gardu_Induk)) = UPPER(TRIM(g.Master_Gardu_Induk))

EOSQL

echo "    -> Melakukan Data Pump ke Native Table: n_17_sld_tower"
cat << 'EOSQL' | bq query --use_legacy_sql=false --project_id=gcp-bridge-meshvpn
CREATE OR REPLACE TABLE `gcp-bridge-meshvpn.Dashboard_Gardu_Induk_UPT_Bogor.n_17_sld_tower` AS
SELECT * FROM `gcp-bridge-meshvpn.Dashboard_Gardu_Induk_UPT_Bogor.v_17_sld_tower`
EOSQL

echo "=========================================================="
echo "✅ Seluruh Pipa Trinitas BQ (e, v, n) Sukses Berdiri !    "
echo "=========================================================="
