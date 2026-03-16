#!/bin/bash
# fix-master-hierarchy-tables.sh
# Recreates external tables with explicit schema where autodetect fails
# Then creates views and native tables

PROJECT="gcp-bridge-meshvpn"
DS="MASTER_HIERARCHY_UPT_Bogor"
SS="https://docs.google.com/spreadsheets/d/1vpVUczVs8GB-VHbqxrHpl-EZI66HO2e2fWdU3qfLzeI"

run_ddl() {
  local label="$1"; local sql="$2"
  echo -n "  $label ... "
  result=$(bq query --use_legacy_sql=false --project_id=$PROJECT "$sql" 2>&1)
  if echo "$result" | grep -qi "error"; then
    echo "❌ $(echo $result | grep -oi 'error.*' | head -1 | cut -c1-120)"
  else
    echo "✅"
  fi
}

echo ""
echo "📋 Recreating external tables with explicit schema:"

# Master Gardu Induk - explicit schema
run_ddl "e_Master_Gardu_Induk" \
  "CREATE OR REPLACE EXTERNAL TABLE \`$PROJECT.$DS.e_Master_Gardu_Induk\`(
    ID_GI STRING, Master_UPT STRING, Master_ULTG STRING, Master_Gardu_Induk STRING,
    Type_Gardu_Induk STRING, Tegangan_kV STRING, Status STRING
  ) OPTIONS(format='GOOGLE_SHEETS',uris=['$SS'],sheet_range='Master Gardu Induk',skip_leading_rows=1)"

# Master Bay - explicit schema
run_ddl "e_Master_Bay" \
  "CREATE OR REPLACE EXTERNAL TABLE \`$PROJECT.$DS.e_Master_Bay\`(
    ID_Bay STRING, Master_ULTG STRING, Master_Gardu_Induk STRING,
    Master_Bay STRING, Type_Bay STRING, Bay_Function STRING
  ) OPTIONS(format='GOOGLE_SHEETS',uris=['$SS'],sheet_range='Master Bay',skip_leading_rows=1)"

# Alias Bay - explicit schema (was string_field_*)
run_ddl "e_Alias_Bay" \
  "CREATE OR REPLACE EXTERNAL TABLE \`$PROJECT.$DS.e_Alias_Bay\`(
    string_field_0 STRING, string_field_1 STRING, string_field_2 STRING,
    string_field_3 STRING, string_field_4 STRING, string_field_5 STRING
  ) OPTIONS(format='GOOGLE_SHEETS',uris=['$SS'],sheet_range='Alias Bay',skip_leading_rows=1)"

echo ""
echo "🔍 Creating/fixing views:"

# Master UPT (autodetect worked: ID_UPT, UPT)
run_ddl "v_Master_UPT" \
  "CREATE OR REPLACE VIEW \`$PROJECT.$DS.v_Master_UPT\` AS
   SELECT * FROM \`$PROJECT.$DS.e_Master_UPT\` WHERE UPT IS NOT NULL"

# Master ULTG (autodetect worked: ID_ULTG, UPT, ULTG)
run_ddl "v_Master_ULTG" \
  "CREATE OR REPLACE VIEW \`$PROJECT.$DS.v_Master_ULTG\` AS
   SELECT * FROM \`$PROJECT.$DS.e_Master_ULTG\` WHERE ULTG IS NOT NULL"

# Master Gardu Induk (now has proper columns)
run_ddl "v_Master_Gardu_Induk" \
  "CREATE OR REPLACE VIEW \`$PROJECT.$DS.v_Master_Gardu_Induk\` AS
   SELECT * FROM \`$PROJECT.$DS.e_Master_Gardu_Induk\` WHERE Master_Gardu_Induk IS NOT NULL"

# Master Bay
run_ddl "v_Master_Bay" \
  "CREATE OR REPLACE VIEW \`$PROJECT.$DS.v_Master_Bay\` AS
   SELECT * FROM \`$PROJECT.$DS.e_Master_Bay\`
   WHERE Master_Gardu_Induk IS NOT NULL OR Master_Bay IS NOT NULL"

# Koordinat GI (already works)

echo ""
echo "💾 Creating native tables:"
for sheet in Master_UPT Master_ULTG Master_Gardu_Induk Master_Bay Koordinat_Gardu_Induk; do
  run_ddl "n_$sheet" \
    "CREATE OR REPLACE TABLE \`$PROJECT.$DS.n_$sheet\` AS SELECT * FROM \`$PROJECT.$DS.v_$sheet\`"
done

echo ""
echo "📊 Verification:"
bq query --use_legacy_sql=false --project_id=$PROJECT \
  "SELECT table_name, column_name FROM \`$PROJECT.$DS.INFORMATION_SCHEMA.COLUMNS\`
   WHERE table_name IN ('e_Master_Gardu_Induk','e_Master_Bay','n_Master_UPT','n_Master_ULTG')
   ORDER BY table_name, ordinal_position" 2>&1 | grep -v RequestsDependency
