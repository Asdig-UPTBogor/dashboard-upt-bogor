/**
 * create-remaining-datasets.js
 * 
 * Creates 3 remaining datasets using SQL files (no shell escaping issues).
 * Reads headers from Sheets API, generates explicit schema (all STRING).
 * Writes SQL to temp files, executes via `bq query < file.sql`.
 */
const { google } = require('googleapis');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const KEY_PATH = path.join(__dirname, '..', 'google-auth', 'key.json');
const PROJECT = 'gcp-bridge-meshvpn';
const LOCATION = 'asia-southeast2';
const MASTER_DS = 'MASTER_HIERARCHY_UPT_Bogor';
const SQL_DIR = '/tmp/bq-sql';

const auth = new google.auth.GoogleAuth({
    keyFile: KEY_PATH,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});
const sheets = google.sheets({ version: 'v4', auth });

function normalizeCol(name) {
    let n = name.replace(/[^a-zA-Z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
    // BQ reserved words — append underscore
    const reserved = ['NO', 'ALL', 'AND', 'AS', 'AT', 'BY', 'DO', 'IF', 'IN', 'IS', 'NOT', 'NULL', 'OF', 'ON', 'OR', 'TO'];
    if (reserved.includes(n.toUpperCase())) n = n + '_';
    return n;
}

function normalizeName(name) {
    return name.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
}

function runSQL(label, sql) {
    process.stdout.write(`  ${label} ... `);
    const sqlFile = path.join(SQL_DIR, 'query.sql');
    fs.writeFileSync(sqlFile, sql);
    try {
        execSync(`bq query --use_legacy_sql=false --project_id=${PROJECT} < ${sqlFile}`, {
            stdio: ['pipe', 'pipe', 'pipe'],
            timeout: 60000,
        });
        console.log('✅');
        return true;
    } catch (e) {
        const errMsg = (e.stderr || e.stdout || e.message || '').toString().substring(0, 150);
        console.log(`❌ ${errMsg.match(/error.*/i)?.[0]?.substring(0, 120) || errMsg.substring(0, 120)}`);
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

function getGIColumn(headers) {
    for (const h of headers) {
        if (['Master_Gardu_Induk', 'Gardu_Induk', 'GARDU_INDUK'].includes(h.normalized)) return h.normalized;
        if (h.normalized.toLowerCase().includes('gardu_induk')) return h.normalized;
    }
    return null;
}

// === CONFIGURATION ===
const DATASETS = [
    {
        id: '13xm0SqMP5EYbLyYnt5jUPUx1BzhaDffkX4iippq_LuM',
        datasetName: 'Master_Transmisi_UPT_Bogor',
        allSheets: [
            'MASTER ASSET TOWER', '0.RESUME JARINGAN', '1.DATA PETIR',
            '3.PROTEKSI PETIR TAMBAHAN', '5.HEALTHY INDEX TOWER',
            '6.ASSESMENT TOWER DAN VENOM', '12.KONDISI ROW',
            '14.LM JARINGAN 2026', '17.SLD TOWER',
        ],
        activeSheets: [
            'MASTER ASSET TOWER', '0.RESUME JARINGAN', '1.DATA PETIR',
            '3.PROTEKSI PETIR TAMBAHAN', '5.HEALTHY INDEX TOWER',
            '6.ASSESMENT TOWER DAN VENOM', '12.KONDISI ROW',
            '14.LM JARINGAN 2026', '17.SLD TOWER',
        ],
        // Sheets with GI QC JOIN
        qcSheets: [
            'MASTER ASSET TOWER', '1.DATA PETIR', '3.PROTEKSI PETIR TAMBAHAN',
            '5.HEALTHY INDEX TOWER', '6.ASSESMENT TOWER DAN VENOM',
            '12.KONDISI ROW', '17.SLD TOWER',
        ],
        // Simple views (no JOIN)
        simpleSheets: ['0.RESUME JARINGAN', '14.LM JARINGAN 2026'],
        simpleFilters: {
            '0.RESUME JARINGAN': 'Master_ULTG IS NOT NULL OR Master_Gardu_Induk IS NOT NULL',
            '14.LM JARINGAN 2026': 'NO_ IS NOT NULL OR JENIS_PROGRAM IS NOT NULL OR NAMA_PROGRAM IS NOT NULL',
        },
    },
    {
        id: '1RDb1cBtjCo0rBN1goWXV4-VG75fof_K5ZiFP-L7wwW8',
        datasetName: 'Master_Asset_Relay_UPT_Bogor',
        allSheets: [
            'Asset Relay UPT Bogor', 'REF_MERK_TYPE_RELAY', 'REF_PROTECTION',
            'REF_KLASIFIKASI_BAY', 'MASTER_BAY', 'GICODE',
        ],
        activeSheets: ['Asset Relay UPT Bogor'],
        qcSheets: ['Asset Relay UPT Bogor'],
        simpleSheets: [],
        simpleFilters: {},
    },
    {
        id: '1Ktsov6WR0CRo31T9pZGo4nEBhMW5MoJ7ectXQyqz0vk',
        datasetName: 'Master_Jadwal_Padam_UPT_Bogor',
        allSheets: [
            'Jadwal Padam', 'Histori Status Jalur', 'ROH 2026',
            'ROM 2026', 'Jadwal Sabtu - Minggu', 'ROT 2026', 'MASTER_BAY',
        ],
        activeSheets: ['Jadwal Padam'],
        qcSheets: ['Jadwal Padam'],
        simpleSheets: [],
        simpleFilters: {},
    },
];

async function processDataset(config) {
    const { id, datasetName, allSheets, activeSheets, qcSheets, simpleSheets, simpleFilters } = config;
    const ssUrl = `https://docs.google.com/spreadsheets/d/${id}`;

    // 1. Create dataset
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📦 Dataset: ${datasetName}`);
    try {
        execSync(`bq --project_id=${PROJECT} mk --dataset --location=${LOCATION} ${datasetName}`, { stdio: 'pipe' });
        console.log('  ✅ Created');
    } catch { console.log('  ⏭ Already exists'); }

    // 2. External tables
    console.log(`\n📋 External Tables (${allSheets.length}):`);
    const headerCache = {};
    for (const sheet of allSheets) {
        const tableName = `e_${normalizeName(sheet)}`;
        try {
            const headers = await getHeaders(id, sheet);
            headerCache[sheet] = headers;
            if (headers.length === 0) { console.log(`  ${tableName} ... ⏭ No headers`); continue; }

            const colDefs = headers.map(h => `${h.normalized} STRING`).join(', ');
            const sql = `CREATE OR REPLACE EXTERNAL TABLE \`${PROJECT}.${datasetName}.${tableName}\`(${colDefs}) OPTIONS(format='GOOGLE_SHEETS',uris=['${ssUrl}'],sheet_range='${sheet}',skip_leading_rows=1)`;
            runSQL(tableName, sql);
        } catch (e) {
            console.log(`  ${tableName} ... ❌ Sheets API: ${e.message.substring(0, 80)}`);
        }
    }

    // 3. Views
    console.log(`\n🔍 Views (${activeSheets.length}):`);
    for (const sheet of activeSheets) {
        const norm = normalizeName(sheet);
        const viewName = `v_${norm}`;
        const extName = `e_${norm}`;
        const headers = headerCache[sheet] || [];

        let sql;
        if (qcSheets.includes(sheet)) {
            const giCol = getGIColumn(headers);
            if (giCol) {
                sql = `CREATE OR REPLACE VIEW \`${PROJECT}.${datasetName}.${viewName}\` AS
SELECT t.*, g.ID_GI,
  CASE
    WHEN t.${giCol} IS NULL OR TRIM(t.${giCol}) = '' THEN 'MISSING_GI'
    WHEN g.Master_Gardu_Induk IS NULL THEN 'ORPHAN_GI'
    ELSE 'OK'
  END AS qc_hierarchy
FROM \`${PROJECT}.${datasetName}.${extName}\` t
LEFT JOIN \`${PROJECT}.${MASTER_DS}.e_Master_Gardu_Induk\` g
  ON UPPER(TRIM(t.${giCol})) = UPPER(TRIM(g.Master_Gardu_Induk))`;
            } else {
                sql = `CREATE OR REPLACE VIEW \`${PROJECT}.${datasetName}.${viewName}\` AS SELECT * FROM \`${PROJECT}.${datasetName}.${extName}\` WHERE 1=1`;
                console.log(`    ⚠️ No GI column for ${sheet}, using simple view`);
            }
        } else if (simpleSheets.includes(sheet)) {
            const filter = simpleFilters[sheet] || '1=1';
            sql = `CREATE OR REPLACE VIEW \`${PROJECT}.${datasetName}.${viewName}\` AS SELECT * FROM \`${PROJECT}.${datasetName}.${extName}\` WHERE ${filter}`;
        } else {
            sql = `CREATE OR REPLACE VIEW \`${PROJECT}.${datasetName}.${viewName}\` AS SELECT * FROM \`${PROJECT}.${datasetName}.${extName}\` WHERE 1=1`;
        }

        runSQL(viewName, sql);
    }

    // 4. Native tables
    console.log(`\n💾 Native Tables (${activeSheets.length}):`);
    for (const sheet of activeSheets) {
        const norm = normalizeName(sheet);
        const sql = `CREATE OR REPLACE TABLE \`${PROJECT}.${datasetName}.n_${norm}\` AS SELECT * FROM \`${PROJECT}.${datasetName}.v_${norm}\``;
        runSQL(`n_${norm}`, sql);
    }

    // 5. Show column sample
    console.log(`\n📋 Column check (first active sheet):`);
    if (activeSheets.length > 0) {
        const h = headerCache[activeSheets[0]] || [];
        console.log(`  e_${normalizeName(activeSheets[0])}: ${h.map(x => x.normalized).join(', ')}`);
    }
}

async function main() {
    // Create temp dir for SQL files
    if (!fs.existsSync(SQL_DIR)) fs.mkdirSync(SQL_DIR, { recursive: true });

    for (const config of DATASETS) {
        await processDataset(config);
    }

    // Final verification
    console.log(`\n${'='.repeat(60)}`);
    console.log('📊 FINAL VERIFICATION — All datasets:');
    const output = execSync(`bq ls --project_id=${PROJECT} --datasets`, { encoding: 'utf-8' });
    const datasets = output.match(/\S+/g)?.filter(d => !d.includes('datasetId') && !d.includes('---')) || [];
    for (const ds of datasets) {
        try {
            const tables = execSync(`bq ls --project_id=${PROJECT} ${ds.trim()} 2>/dev/null | grep -c '^ '`, { encoding: 'utf-8' }).trim();
            console.log(`  ${ds.trim().padEnd(40)} ${tables} tables`);
        } catch { console.log(`  ${ds.trim().padEnd(40)} ?`); }
    }

    console.log('\n✅ ALL DONE!');
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
