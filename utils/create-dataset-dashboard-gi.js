/**
 * create-dataset-dashboard-gi.js
 * 
 * Creates Dashboard_Gardu_Induk_UPT_Bogor dataset with explicit schema.
 * Views JOIN to MASTER_HIERARCHY_UPT_Bogor for QC hierarchy.
 */
const { google } = require('googleapis');
const { exec } = require('child_process');
const path = require('path');
const util = require('util');
const execAsync = util.promisify(exec);

const KEY_PATH = path.join(__dirname, '..', 'google-auth', 'key.json');
const PROJECT = 'gcp-bridge-meshvpn';
const LOCATION = 'asia-southeast2';
const MASTER_DS = 'MASTER_HIERARCHY_UPT_Bogor';

const auth = new google.auth.GoogleAuth({
    keyFile: KEY_PATH,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});
const sheets = google.sheets({ version: 'v4', auth });

function normalizeCol(name) {
    return name.replace(/[^a-zA-Z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
}
function normalizeName(name) {
    return name.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
}

async function runDDL(label, sql) {
    process.stdout.write(`  ${label} ... `);
    try {
        const { stdout, stderr } = await execAsync(
            `bq query --use_legacy_sql=false --project_id=${PROJECT} "${sql.replace(/"/g, '\\"')}"`,
            { timeout: 60000 }
        );
        const output = stdout + stderr;
        if (output.toLowerCase().includes('error')) {
            console.log(`❌ ${output.match(/error.*/i)?.[0]?.substring(0, 120) || 'unknown'}`);
            return false;
        }
        console.log('✅');
        return true;
    } catch (e) {
        console.log(`❌ ${e.message.substring(0, 120)}`);
        return false;
    }
}

async function getHeaders(spreadsheetId, sheetName) {
    const res = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `'${sheetName}'!1:1`,
    });
    return (res.data.values?.[0] || []).filter(h => h && h.trim()).map(h => ({
        original: h,
        normalized: normalizeCol(h),
    }));
}

const SS_ID = '1aSi-mBeRnpUvSuNQ_U4HZbLxpmqwt2Fwh8koJVslqIg';
const DATASET = 'Dashboard_Gardu_Induk_UPT_Bogor';

// All 14 sheets → external tables
const ALL_SHEETS = [
    'Refrensi_Bay', 'Refrensi MTU', 'MTU',
    'MTU TRAFO', 'MTU PMT', 'MTU PMS', 'MTU CT', 'MTU CVT', 'MTU LA',
    'MTU KABEL POWER', 'SEALING END',
    'PROGRAM STRATEGIS TRAFO', 'PROGRAM KERJA HARGI', 'REALISASI IL 2',
];

// 10 active sheets → views + native
const ACTIVE_SHEETS = [
    'MTU TRAFO', 'MTU PMT', 'MTU PMS', 'MTU CT', 'MTU CVT', 'MTU LA',
    'MTU KABEL POWER', 'SEALING END',
    'PROGRAM STRATEGIS TRAFO', 'PROGRAM KERJA HARGI',
];

// Sheets that need GI-level QC JOIN (most MTU sheets have Master_Gardu_Induk column)
const GI_QC_SHEETS = [
    'MTU TRAFO', 'MTU PMT', 'MTU PMS', 'MTU CT', 'MTU CVT', 'MTU LA',
    'MTU KABEL POWER', 'SEALING END',
];

// GI column name varies per sheet — detect from headers
function getGIColumn(headers) {
    const giCols = ['Master_Gardu_Induk', 'Gardu_Induk', 'GARDU_INDUK', 'GI'];
    for (const h of headers) {
        if (giCols.includes(h.normalized)) return h.normalized;
    }
    // Check partial match
    for (const h of headers) {
        if (h.normalized.toLowerCase().includes('gardu_induk')) return h.normalized;
    }
    return null;
}

async function main() {
    const ssUrl = `https://docs.google.com/spreadsheets/d/${SS_ID}`;

    // 1. Dataset
    console.log(`\n📦 Dataset: ${DATASET}`);
    try {
        await execAsync(`bq --project_id=${PROJECT} mk --dataset --location=${LOCATION} ${DATASET} 2>/dev/null`);
        console.log('  ✅ Created');
    } catch { console.log('  ⏭ Already exists'); }

    // 2. External tables (all 14)
    console.log(`\n📋 External Tables (${ALL_SHEETS.length}):`);
    const headerCache = {};
    for (const sheet of ALL_SHEETS) {
        const tableName = `e_${normalizeName(sheet)}`;
        const headers = await getHeaders(SS_ID, sheet);
        headerCache[sheet] = headers;

        if (headers.length === 0) {
            console.log(`  ${tableName} ... ⏭ No headers`);
            continue;
        }

        const colDefs = headers.map(h => `${h.normalized} STRING`).join(', ');
        const sql = `CREATE OR REPLACE EXTERNAL TABLE \\\`${PROJECT}.${DATASET}.${tableName}\\\`(${colDefs}) OPTIONS(format='GOOGLE_SHEETS',uris=['${ssUrl}'],sheet_range='${sheet}',skip_leading_rows=1)`;
        await runDDL(tableName, sql);
    }

    // 3. Views
    console.log(`\n🔍 Views (${ACTIVE_SHEETS.length}):`);
    for (const sheet of ACTIVE_SHEETS) {
        const norm = normalizeName(sheet);
        const viewName = `v_${norm}`;
        const extName = `e_${norm}`;
        const headers = headerCache[sheet] || [];

        let sql;
        if (GI_QC_SHEETS.includes(sheet)) {
            // QC JOIN with master_gi
            const giCol = getGIColumn(headers);
            if (giCol) {
                sql = `CREATE OR REPLACE VIEW \\\`${PROJECT}.${DATASET}.${viewName}\\\` AS SELECT t.*, g.ID_GI, CASE WHEN t.${giCol} IS NULL OR TRIM(t.${giCol}) = '' THEN 'MISSING_GI' WHEN g.Master_Gardu_Induk IS NULL THEN 'ORPHAN_GI' ELSE 'OK' END AS qc_hierarchy FROM \\\`${PROJECT}.${DATASET}.${extName}\\\` t LEFT JOIN \\\`${PROJECT}.${MASTER_DS}.e_Master_Gardu_Induk\\\` g ON UPPER(TRIM(t.${giCol})) = UPPER(TRIM(g.Master_Gardu_Induk))`;
            } else {
                // No GI column found, simple view
                sql = `CREATE OR REPLACE VIEW \\\`${PROJECT}.${DATASET}.${viewName}\\\` AS SELECT * FROM \\\`${PROJECT}.${DATASET}.${extName}\\\` WHERE 1=1`;
                console.log(`    ⚠️ No GI column found for ${sheet}`);
            }
        } else {
            // Simple view (PROGRAM, etc)
            sql = `CREATE OR REPLACE VIEW \\\`${PROJECT}.${DATASET}.${viewName}\\\` AS SELECT * FROM \\\`${PROJECT}.${DATASET}.${extName}\\\` WHERE 1=1`;
        }

        await runDDL(viewName, sql);
    }

    // 4. Native tables
    console.log(`\n💾 Native Tables (${ACTIVE_SHEETS.length}):`);
    for (const sheet of ACTIVE_SHEETS) {
        const norm = normalizeName(sheet);
        const sql = `CREATE OR REPLACE TABLE \\\`${PROJECT}.${DATASET}.n_${norm}\\\` AS SELECT * FROM \\\`${PROJECT}.${DATASET}.v_${norm}\\\``;
        await runDDL(`n_${norm}`, sql);
    }

    // 5. Verify
    console.log(`\n📊 Column verification (sample):`);
    for (const sheet of ['MTU TRAFO', 'MTU PMT']) {
        const headers = headerCache[sheet] || [];
        console.log(`  e_${normalizeName(sheet)}: ${headers.map(h => h.normalized).join(', ')}`);
    }

    console.log('\n✅ Done!');
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
