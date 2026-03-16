const fs = require('fs');
const path = require('path');

const PROJECT_ID = "gcp-bridge-meshvpn";
const DATASET_GI = "Dashboard_Gardu_Induk_UPT_Bogor";

function getBQTableName(prefix, sheetName) {
    const clean = sheetName.toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
    return `${prefix}_${clean}`;
}

function normalizeBQColumn(name) {
    return name.replace(/[^a-zA-Z0-9_ ]/g, "").replace(/ /g, "_");
}

function processFirestoreDump() {
    const raw = fs.readFileSync(path.join(__dirname, 'fs_dump.json'), 'utf-8');
    const db = JSON.parse(raw);

    const uniqueSheets = new Map();

    const docs = db.documents || [];
    for (const doc of docs) {
        if (!doc.fields || !doc.fields.dataSources || !doc.fields.dataSources.arrayValue) continue;
        const dataSources = doc.fields.dataSources.arrayValue.values || [];

        for (const ds of dataSources) {
            if (!ds.mapValue || !ds.mapValue.fields) continue;
            const fields = ds.mapValue.fields;

            const sheetName = fields.sheetName?.stringValue;
            const spreadsheetId = fields.spreadsheetId?.stringValue;
            if (!sheetName || !spreadsheetId) continue;

            const hierarchyMappingSource = fields.hierarchyMapping?.mapValue?.fields || {};
            const hpArray = fields.hierarchyPresent?.arrayValue?.values || [];
            const hierarchyPresent = hpArray.map(v => v.stringValue).filter(v => v);

            const hierarchyMapping = {};
            for (const [k, v] of Object.entries(hierarchyMappingSource)) {
                if (v.stringValue) hierarchyMapping[k] = v.stringValue;
            }

            if (!uniqueSheets.has(sheetName)) {
                uniqueSheets.set(sheetName, {
                    sheetName,
                    spreadsheetId,
                    hierarchyPresent,
                    hierarchyMapping
                });
            } else {
                const existing = uniqueSheets.get(sheetName);
                for (const h of hierarchyPresent) {
                    if (!existing.hierarchyPresent.includes(h)) existing.hierarchyPresent.push(h);
                }
                for (const [k, v] of Object.entries(hierarchyMapping)) {
                    existing.hierarchyMapping[k] = v;
                }
            }
        }
    }

    let bashScript = `#!/bin/bash\nset -e\n\n`;
    bashScript += `echo "=========================================================="\n`;
    bashScript += `echo "🔥 Membangun TRINITAS 24 Tabel BQ dengan 3-Level Hierarki"\n`;
    bashScript += `echo "=========================================================="\n\n`;

    for (const [sheetName, config] of uniqueSheets.entries()) {
        const extTableName = getBQTableName("e", sheetName);
        const viewName = getBQTableName("v", sheetName);
        const nativeTableName = getBQTableName("n", sheetName);

        // PENCEGAHAN EROR UNTUK TABEL MASTER DAN SETTING 3 LEVEL HIERARKI
        let hasULTG = config.hierarchyPresent.includes("ultg");
        let hasGI = config.hierarchyPresent.includes("gi");
        let hasBay = config.hierarchyPresent.includes("bay");

        // Master Gardu Induk BOLEH punya ULTG, tapi tidak boleh join diri sendiri (gi/bay flag dimatikan)
        if (sheetName.toLowerCase() === "master gardu induk") {
            hasGI = false;
            hasBay = false;
        }
        // Master Bay BOLEH punya ULTG dan GI, tapi tidak boleh join diri sendiri (bay flag dimatikan)
        else if (sheetName.toLowerCase() === "master bay") {
            hasBay = false;
        }

        bashScript += `echo "[+] Memproses Sheet: '${sheetName}' -> e_, v_, dan n_"\n`;
        // 1. DDL EXTERNAL TABLE
        bashScript += `cat << 'EOF' > /tmp/def_${extTableName}.json\n`;
        bashScript += `{
  "sourceFormat": "GOOGLE_SHEETS",
  "sourceUris": ["https://docs.google.com/spreadsheets/d/${config.spreadsheetId}"],
  "googleSheetsOptions": { "range": "${sheetName}" },
  "autodetect": true
}\nEOF\n`;
        bashScript += `bq rm -f -t ${PROJECT_ID}:${DATASET_GI}.${extTableName} || true\n`;
        bashScript += `bq mk --table --external_table_definition=/tmp/def_${extTableName}.json ${PROJECT_ID}:${DATASET_GI}.${extTableName}\n\n`;

        // 2. DDL VIEW TABLE
        let selectItems = [`t.*`];
        let joins = "";

        const colULTG = config.hierarchyMapping["ultg"] ? normalizeBQColumn(config.hierarchyMapping["ultg"]) : "Master_ULTG";
        const colGI = config.hierarchyMapping["gi"] ? normalizeBQColumn(config.hierarchyMapping["gi"]) : "Master_Gardu_Induk";
        const colBay = config.hierarchyMapping["bay"] ? normalizeBQColumn(config.hierarchyMapping["bay"]) : "Master_Bay";

        // Level 1: ULTG Checks (tanpa join karena master ultg tak punya tabel dedicated, cukup validasi kolom)
        if (hasULTG) {
            selectItems.push(`    CASE
      WHEN t.${colULTG} IS NULL OR TRIM(t.${colULTG}) = '' THEN 'MISSING_ULTG'
      ELSE 'OK'
    END AS qc_ultg_hierarchy`);
        }

        // Level 2: GI Checks (JOIN dengan e_Master_Gardu_Induk)
        if (hasGI) {
            selectItems[0] += `, g.ID_GI, g.Master_ULTG AS Parent_ULTG`;
            joins += `LEFT JOIN (SELECT DISTINCT Master_Gardu_Induk, ID_GI, Master_ULTG FROM \`${PROJECT_ID}.MASTER_HIERARCHY_UPT_Bogor.e_Master_Gardu_Induk\` WHERE Master_Gardu_Induk IS NOT NULL) g ON UPPER(TRIM(t.${colGI})) = UPPER(TRIM(g.Master_Gardu_Induk))\n`;

            selectItems.push(`    CASE
      WHEN t.${colGI} IS NULL OR TRIM(t.${colGI}) = '' THEN 'MISSING_GI'
      WHEN g.ID_GI IS NULL THEN 'ORPHAN_GI'
      ELSE 'OK'
    END AS qc_hierarchy`);
        }

        // Level 3: Bay Checks (JOIN dengan e_Master_Bay)
        if (hasBay) {
            selectItems[0] += `, b.ID_Bay`;
            joins += `LEFT JOIN (SELECT DISTINCT Master_Gardu_Induk, Master_Bay, ID_Bay FROM \`${PROJECT_ID}.MASTER_HIERARCHY_UPT_Bogor.e_Master_Bay\` WHERE Master_Bay IS NOT NULL) b ON UPPER(TRIM(t.${colBay})) = UPPER(TRIM(b.Master_Bay)) AND UPPER(TRIM(t.${colGI})) = UPPER(TRIM(b.Master_Gardu_Induk))\n`;

            selectItems.push(`    CASE
      WHEN t.${colBay} IS NOT NULL AND TRIM(t.${colBay}) != '' AND b.ID_Bay IS NULL THEN 'ORPHAN_BAY'
      WHEN t.${colBay} IS NOT NULL AND TRIM(t.${colBay}) != '' THEN 'OK_BAY'
      ELSE 'NO_BAY_PROVIDED'
    END AS qc_bay_hierarchy`);
        }

        bashScript += `cat << 'EOSQL' | bq query --use_legacy_sql=false --project_id=${PROJECT_ID}\n`;
        bashScript += `CREATE OR REPLACE VIEW \`${PROJECT_ID}.${DATASET_GI}.${viewName}\` AS\n`;
        bashScript += `SELECT\n  ${selectItems.join(",\n")}\n`;
        bashScript += `FROM \`${PROJECT_ID}.${DATASET_GI}.${extTableName}\` t\n${joins}\nEOSQL\n\n`;

        // 3. SECONDS AFTER VIEW, CREATE NATIVE TABLE
        bashScript += `echo "    -> Melakukan Data Pump ke Native Table: ${nativeTableName}"\n`;
        bashScript += `cat << 'EOSQL' | bq query --use_legacy_sql=false --project_id=${PROJECT_ID}\n`;
        bashScript += `CREATE OR REPLACE TABLE \`${PROJECT_ID}.${DATASET_GI}.${nativeTableName}\` AS\n`;
        bashScript += `SELECT * FROM \`${PROJECT_ID}.${DATASET_GI}.${viewName}\`\nEOSQL\n\n`;
    }

    bashScript += `echo "=========================================================="\n`;
    bashScript += `echo "✅ Seluruh Pipa Trinitas BQ (e, v, n) Sukses Berdiri !    "\n`;
    bashScript += `echo "=========================================================="\n`;

    fs.writeFileSync(path.join(__dirname, 'apply_bq.sh'), bashScript);
    console.log("[✓] utils/apply_bq.sh berhasil di-generate secara DINAMIS dengan fitur 3-Level Hierarki!");
}

processFirestoreDump();
