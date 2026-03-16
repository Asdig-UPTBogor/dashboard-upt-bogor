#!/bin/bash
# create-master-hierarchy.sh
# Creates MASTER_HIERARCHY_UPT_Bogor dataset with e_, v_, n_ tables
# Uses bq CLI (has Drive credentials via gcloud auth)

PROJECT="gcp-bridge-meshvpn"
LOC="asia-southeast2"
DATASET="MASTER_HIERARCHY_UPT_Bogor"
SS="https://docs.google.com/spreadsheets/d/1vpVUczVs8GB-VHbqxrHpl-EZI66HO2e2fWdU3qfLzeI"

run_ddl() {
  local label="$1"
  local sql="$2"
  echo -n "  $label ... "
  result=$(bq query --use_legacy_sql=false --project_id=$PROJECT "$sql" 2>&1)
  if echo "$result" | grep -qi "error"; then
    echo "❌ $(echo $result | grep -oi 'error.*' | head -1 | cut -c1-100)"
  else
    echo "✅"
  fi
}

echo ""
echo "📦 Dataset: $DATASET"
bq --project_id=$PROJECT mk --dataset --location=$LOC $DATASET 2>/dev/null && echo "  ✅ Created" || echo "  ⏭ Already exists"

# === External Tables (ALL 7 sheets) ===
echo ""
echo "📋 External Tables (7):"
run_ddl "e_Master_UPT" \
  "CREATE OR REPLACE EXTERNAL TABLE \`$PROJECT.$DATASET.e_Master_UPT\` OPTIONS(format='GOOGLE_SHEETS',uris=['$SS'],sheet_range='Master UPT',skip_leading_rows=1)"

run_ddl "e_Master_ULTG" \
  "CREATE OR REPLACE EXTERNAL TABLE \`$PROJECT.$DATASET.e_Master_ULTG\` OPTIONS(format='GOOGLE_SHEETS',uris=['$SS'],sheet_range='Master ULTG',skip_leading_rows=1)"

run_ddl "e_Master_Gardu_Induk" \
  "CREATE OR REPLACE EXTERNAL TABLE \`$PROJECT.$DATASET.e_Master_Gardu_Induk\` OPTIONS(format='GOOGLE_SHEETS',uris=['$SS'],sheet_range='Master Gardu Induk',skip_leading_rows=1)"

run_ddl "e_Master_Bay" \
  "CREATE OR REPLACE EXTERNAL TABLE \`$PROJECT.$DATASET.e_Master_Bay\` OPTIONS(format='GOOGLE_SHEETS',uris=['$SS'],sheet_range='Master Bay',skip_leading_rows=1)"

run_ddl "e_Alias_Bay" \
  "CREATE OR REPLACE EXTERNAL TABLE \`$PROJECT.$DATASET.e_Alias_Bay\` OPTIONS(format='GOOGLE_SHEETS',uris=['$SS'],sheet_range='Alias Bay',skip_leading_rows=1)"

run_ddl "e_Koordinat_Gardu_Induk" \
  "CREATE OR REPLACE EXTERNAL TABLE \`$PROJECT.$DATASET.e_Koordinat_Gardu_Induk\` OPTIONS(format='GOOGLE_SHEETS',uris=['$SS'],sheet_range='Koordinat Gardu Induk',skip_leading_rows=1)"

run_ddl "e_Single_Line_Diagram_Gardu_Induk" \
  "CREATE OR REPLACE EXTERNAL TABLE \`$PROJECT.$DATASET.e_Single_Line_Diagram_Gardu_Induk\` OPTIONS(format='GOOGLE_SHEETS',uris=['$SS'],sheet_range='Single Line Diagram Gardu Induk',skip_leading_rows=1)"

# === Views (5 active sheets — master views, no JOIN) ===
echo ""
echo "🔍 Views (5):"
run_ddl "v_Master_UPT" \
  "CREATE OR REPLACE VIEW \`$PROJECT.$DATASET.v_Master_UPT\` AS SELECT * FROM \`$PROJECT.$DATASET.e_Master_UPT\` WHERE Master_UPT IS NOT NULL"

run_ddl "v_Master_ULTG" \
  "CREATE OR REPLACE VIEW \`$PROJECT.$DATASET.v_Master_ULTG\` AS SELECT * FROM \`$PROJECT.$DATASET.e_Master_ULTG\` WHERE Master_ULTG IS NOT NULL"

run_ddl "v_Master_Gardu_Induk" \
  "CREATE OR REPLACE VIEW \`$PROJECT.$DATASET.v_Master_Gardu_Induk\` AS SELECT * FROM \`$PROJECT.$DATASET.e_Master_Gardu_Induk\` WHERE Master_Gardu_Induk IS NOT NULL"

run_ddl "v_Master_Bay" \
  "CREATE OR REPLACE VIEW \`$PROJECT.$DATASET.v_Master_Bay\` AS SELECT * FROM \`$PROJECT.$DATASET.e_Master_Bay\` WHERE Master_Gardu_Induk IS NOT NULL OR Master_Bay IS NOT NULL"

run_ddl "v_Koordinat_Gardu_Induk" \
  "CREATE OR REPLACE VIEW \`$PROJECT.$DATASET.v_Koordinat_Gardu_Induk\` AS SELECT * FROM \`$PROJECT.$DATASET.e_Koordinat_Gardu_Induk\` WHERE Master_Gardu_Induk IS NOT NULL"

# === Native Tables (5 — materialized from views) ===
echo ""
echo "💾 Native Tables (5):"
run_ddl "n_Master_UPT" \
  "CREATE OR REPLACE TABLE \`$PROJECT.$DATASET.n_Master_UPT\` AS SELECT * FROM \`$PROJECT.$DATASET.v_Master_UPT\`"

run_ddl "n_Master_ULTG" \
  "CREATE OR REPLACE TABLE \`$PROJECT.$DATASET.n_Master_ULTG\` AS SELECT * FROM \`$PROJECT.$DATASET.v_Master_ULTG\`"

run_ddl "n_Master_Gardu_Induk" \
  "CREATE OR REPLACE TABLE \`$PROJECT.$DATASET.n_Master_Gardu_Induk\` AS SELECT * FROM \`$PROJECT.$DATASET.v_Master_Gardu_Induk\`"

run_ddl "n_Master_Bay" \
  "CREATE OR REPLACE TABLE \`$PROJECT.$DATASET.n_Master_Bay\` AS SELECT * FROM \`$PROJECT.$DATASET.v_Master_Bay\`"

run_ddl "n_Koordinat_Gardu_Induk" \
  "CREATE OR REPLACE TABLE \`$PROJECT.$DATASET.n_Koordinat_Gardu_Induk\` AS SELECT * FROM \`$PROJECT.$DATASET.v_Koordinat_Gardu_Induk\`"

echo ""
echo "📊 Verification:"
bq ls --project_id=$PROJECT $DATASET
echo ""
echo "Done!"
