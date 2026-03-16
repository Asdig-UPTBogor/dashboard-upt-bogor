/**
 * create-dataset-from-spreadsheet.js
 * 
 * Universal script: reads headers from Sheets API, generates explicit schema,
 * creates dataset + e_ + v_ + n_ tables in BQ.
 * 
 * Usage: node utils/create-dataset-from-spreadsheet.js
 * 
 * Configure SPREADSHEETS array below with spreadsheet details.
 */
const { google } = require('googleapis');
const { exec } = require('child_process');
const path = require('path');
const util = require('util');
const execAsync = util.promisify(exec);

const KEY_PATH = path.join(__dirname, '..', 'google-auth', 'key.json');
const PROJECT = 'gcp-bridge-meshvpn';
const LOCATION = 'asia-southeast2';

const auth = new google.auth.GoogleAuth({
    keyFile: KEY_PATH,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});
const sheets = google.sheets({ version: 'v4', auth });

// Normalize column name: spaces → _, special chars → _, collapse multiple _
function normalizeCol(name) {
    return name.replace(/[^a-zA-Z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
}

// Normalize table/dataset name
function normalizeName(name) {
    return name.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
}

// Run bq DDL
async function runDDL(label, sql) {
    process.stdout.write(`  ${label} ... `);
    try {
        const { stdout, stderr } = await execAsync(
            `bq query --use_legacy_sql=false --project_id=${PROJECT} "${sql.replace(/"/g, '\\"')}"`,
            { timeout: 30000 }
        );
        const output = stdout + stderr;
        if (output.toLowerCase().includes('error')) {
            console.log(`❌ ${output.match(/error.*/i)?.[0]?.substring(0, 100) || 'unknown'}`);
            return false;
        }
        console.log('✅');
        return true;
    } catch (e) {
        console.log(`❌ ${e.message.substring(0, 100)}`);
        return false;
    }
}

// Get headers from a sheet via Sheets API
async function getHeaders(spreadsheetId, sheetName) {
    const res = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `'${sheetName}'!1:1`,
    });
    const headers = (res.data.values?.[0] || []).filter(h => h && h.trim());
    return headers.map(h => ({
        original: h,
        normalized: normalizeCol(h),
    }));
}

// === CONFIGURATION ===
// Spreadsheet to process (change this for each spreadsheet)
const SPREADSHEET = {
    id: '1vpVUczVs8GB-VHbqxrHpl-EZI66HO2e2fWdU3qfLzeI',
    datasetName: 'MASTER_HIERARCHY_UPT_Bogor',
    allSheets: [
        'Master UPT',
        'Master ULTG',
        'Master Gardu Induk',
        'Master Bay',
        'Alias Bay',
        'Koordinat Gardu Induk',
        'Single Line Diagram Gardu Induk',
    ],
    // Sheets that get views + native tables (the rest only get external)
    activeSheets: [
        'Master UPT',
        'Master ULTG',
        'Master Gardu Induk',
        'Master Bay',
        'Koordinat Gardu Induk',
    ],
    // View WHERE clause per sheet (null = no filter)
    viewFilters: {
        'Master UPT': 'UPT IS NOT NULL',
        'Master ULTG': 'ULTG IS NOT NULL',
        'Master Gardu Induk': 'Master_Gardu_Induk IS NOT NULL',
        'Master Bay': 'Master_Gardu_Induk IS NOT NULL OR Master_Bay IS NOT NULL',
        'Koordinat Gardu Induk': 'Master_Gardu_Induk IS NOT NULL',
    },
};

async function main() {
    const { id, datasetName, allSheets, activeSheets, viewFilters } = SPREADSHEET;
    const ssUrl = `https://docs.google.com/spreadsheets/d/${id}`;

    // 1. Create dataset
    console.log(`\n📦 Dataset: ${datasetName}`);
    try {
        await execAsync(`bq --project_id=${PROJECT} mk --dataset --location=${LOCATION} ${datasetName} 2>/dev/null`);
        console.log('  ✅ Created');
    } catch {
        console.log('  ⏭ Already exists');
    }

    // 2. Create external tables with explicit schema
    console.log(`\n📋 External Tables (${allSheets.length}):`);
    for (const sheet of allSheets) {
        const tableName = `e_${normalizeName(sheet)}`;
        const headers = await getHeaders(id, sheet);

        if (headers.length === 0) {
            console.log(`  ${tableName} ... ⏭ No headers found, skipping`);
            continue;
        }

        const colDefs = headers.map(h => `${h.normalized} STRING`).join(', ');
        const sql = `CREATE OR REPLACE EXTERNAL TABLE \\\`${PROJECT}.${datasetName}.${tableName}\\\`(${colDefs}) OPTIONS(format='GOOGLE_SHEETS',uris=['${ssUrl}'],sheet_range='${sheet}',skip_leading_rows=1)`;
        await runDDL(tableName, sql);
    }

    // 3. Create views
    console.log(`\n🔍 Views (${activeSheets.length}):`);
    for (const sheet of activeSheets) {
        const norm = normalizeName(sheet);
        const viewName = `v_${norm}`;
        const extName = `e_${norm}`;
        const where = viewFilters[sheet] || '1=1';

        const sql = `CREATE OR REPLACE VIEW \\\`${PROJECT}.${datasetName}.${viewName}\\\` AS SELECT * FROM \\\`${PROJECT}.${datasetName}.${extName}\\\` WHERE ${where}`;
        await runDDL(viewName, sql);
    }

    // 4. Create native tables
    console.log(`\n💾 Native Tables (${activeSheets.length}):`);
    for (const sheet of activeSheets) {
        const norm = normalizeName(sheet);
        const nativeName = `n_${norm}`;
        const viewName = `v_${norm}`;

        const sql = `CREATE OR REPLACE TABLE \\\`${PROJECT}.${datasetName}.${nativeName}\\\` AS SELECT * FROM \\\`${PROJECT}.${datasetName}.${viewName}\\\``;
        await runDDL(nativeName, sql);
    }

    // 5. Verify
    console.log(`\n📊 Final count:`);
    const { stdout } = await execAsync(
        `bq ls --project_id=${PROJECT} ${datasetName} 2>/dev/null | grep -c '^  [env]_' || echo "0"`
    );

    // Show column check for key tables
    console.log('\n📋 Column verification (key tables):');
    for (const sheet of activeSheets.slice(0, 3)) {
        const norm = normalizeName(sheet);
        const headers = await getHeaders(id, sheet);
        console.log(`  e_${norm}: ${headers.map(h => h.normalized).join(', ')}`);
    }

    console.log('\n✅ Done!');
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
