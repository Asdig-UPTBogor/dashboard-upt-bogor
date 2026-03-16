#!/bin/bash
PROJECT="gcp-bridge-meshvpn"
DS="Dashboard_Gardu_Induk_UPT_Bogor"
SS="https://docs.google.com/spreadsheets/d/1aSi-mBeRnpUvSuNQ_U4HZbLxpmqwt2Fwh8koJVslqIg"

run_ddl() {
  local label="$1"; local sql="$2"
  echo -n "  $label ... "
  result=$(bq query --use_legacy_sql=false --project_id=$PROJECT "$sql" 2>&1)
  if echo "$result" | grep -qi "error"; then
    echo "❌ $(echo $result | grep -oi 'error.*' | head -1 | cut -c1-120)"
  else echo "✅"; fi
}

echo "📋 Fix external tables:"
run_ddl "e_PROGRAM_KERJA_HARGI" \
  "CREATE OR REPLACE EXTERNAL TABLE \`$PROJECT.$DS.e_PROGRAM_KERJA_HARGI\`(NO STRING, NAMA_PROGRAM STRING, Master_ULTG STRING, Master_Gardu_Induk STRING, Master_Bay STRING, POS_ANGGARAN STRING, REALIASASI STRING, JUSTIFIKASI STRING, LINK_BA STRING, KETERANGAN STRING) OPTIONS(format='GOOGLE_SHEETS',uris=['$SS'],sheet_range='PROGRAM KERJA HARGI',skip_leading_rows=1)"

run_ddl "e_REALISASI_IL_2" \
  "CREATE OR REPLACE EXTERNAL TABLE \`$PROJECT.$DS.e_REALISASI_IL_2\`(NO STRING, ULTG STRING, NAMA_PROGRAM STRING, TARGET STRING, REALISASI STRING, PROGRESS STRING) OPTIONS(format='GOOGLE_SHEETS',uris=['$SS'],sheet_range='REALISASI IL 2',skip_leading_rows=1)"

echo ""
echo "🔍 Fix views:"
run_ddl "v_PROGRAM_KERJA_HARGI" \
  "CREATE OR REPLACE VIEW \`$PROJECT.$DS.v_PROGRAM_KERJA_HARGI\` AS SELECT * FROM \`$PROJECT.$DS.e_PROGRAM_KERJA_HARGI\` WHERE 1=1"

echo ""
echo "💾 Fix native:"
run_ddl "n_PROGRAM_KERJA_HARGI" \
  "CREATE OR REPLACE TABLE \`$PROJECT.$DS.n_PROGRAM_KERJA_HARGI\` AS SELECT * FROM \`$PROJECT.$DS.v_PROGRAM_KERJA_HARGI\`"

echo ""
echo "✅ Done!"
