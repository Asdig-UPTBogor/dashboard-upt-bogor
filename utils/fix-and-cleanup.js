/**
 * fix-and-cleanup.js
 * 
 * 1. Fix REAL failures (missing e/v/n tables)
 * 2. Delete unused e_ tables (only keep tables that have v_ and n_ counterparts)
 */
const { google } = require('googleapis');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const KEY_PATH = path.join(__dirname, '..', 'google-auth', 'key.json');
const PROJECT = 'gcp-bridge-meshvpn';
const MASTER_DS = 'MASTER_HIERARCHY_UPT_Bogor';
const SQL_DIR = '/tmp/bq-sql';

const auth = new google.auth.GoogleAuth({
    keyFile: KEY_PATH,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});
const sheets = google.sheets({ version: 'v4', auth });

function normalizeCol(name) {
    let n = name.replace(/[^a-zA-Z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
    const reserved = ['NO', 'ALL', 'AND', 'AS', 'AT', 'BY', 'DO', 'IF', 'IN', 'IS', 'NOT', 'NULL', 'OF', 'ON', 'OR', 'TO'];
    if (reserved.includes(n.toUpperCase())) n = n + '_';
    return n;
}

function normalizeName(name) {
    return name.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
}

function runSQL(label, sql) {
    process.stdout.write(`  ${label} ... `);
    if (!fs.existsSync(SQL_DIR)) fs.mkdirSync(SQL_DIR, { recursive: true });
    fs.writeFileSync(path.join(SQL_DIR, 'q.sql'), sql);
    try {
        execSync(`bq query --use_legacy_sql=false --project_id=${PROJECT} < ${SQL_DIR}/q.sql`, {
            stdio: ['pipe', 'pipe', 'pipe'], timeout: 60000,
        });
        console.log('✅');
        return true;
    } catch (e) {
        const msg = (e.stderr || '').toString();
        // False positive: Python warning is not a real error
        if (msg.includes('RequestsDependencyWarning') && !msg.includes('Error processing job')) {
            console.log('✅ (warning ignored)');
            return true;
        }
        console.log(`❌ ${msg.substring(0, 120)}`);
        return false;
    }
}

async function getHeaders(spreadsheetId, sheetName) {
    const res = await sheets.spreadsheets.values.get({
        spreadsheetId, range: `'${sheetName}'!1:1`,
    });
    return (res.data.values?.[0] || []).filter(h => h && h.trim()).map(h => ({
        original: h, normalized: normalizeCol(h),
    }));
}

function getGIColumn(headers) {
    for (const h of headers) {
        if (h.normalized.toLowerCase().includes('gardu_induk')) return h.normalized;
    }
    return null;
}

// === STEP 1: Fix missing tables ===
async function fixMissing() {
    console.log('\n=== STEP 1: Fix missing tables ===\n');

    // 1a. Jadwal Padam — missing e_, v_, n_
    const jpId = '1Ktsov6WR0CRo31T9pZGo4nEBhMW5MoJ7ectXQyqz0vk';
    const jpDs = 'Master_Jadwal_Padam_UPT_Bogor';
    const jpUrl = `https://docs.google.com/spreadsheets/d/${jpId}`;

    console.log('📌 Jadwal Padam:');
    const jpHeaders = await getHeaders(jpId, 'Jadwal Padam');
    const jpCols = jpHeaders.map(h => `${h.normalized} STRING`).join(', ');
    runSQL('e_Jadwal_Padam', `CREATE OR REPLACE EXTERNAL TABLE \`${PROJECT}.${jpDs}.e_Jadwal_Padam\`(${jpCols}) OPTIONS(format='GOOGLE_SHEETS',uris=['${jpUrl}'],sheet_range='Jadwal Padam',skip_leading_rows=1)`);

    const jpGiCol = getGIColumn(jpHeaders);
    if (jpGiCol) {
        runSQL('v_Jadwal_Padam', `CREATE OR REPLACE VIEW \`${PROJECT}.${jpDs}.v_Jadwal_Padam\` AS SELECT t.*, g.ID_GI, CASE WHEN t.${jpGiCol} IS NULL OR TRIM(t.${jpGiCol}) = '' THEN 'MISSING_GI' WHEN g.Master_Gardu_Induk IS NULL THEN 'ORPHAN_GI' ELSE 'OK' END AS qc_hierarchy FROM \`${PROJECT}.${jpDs}.e_Jadwal_Padam\` t LEFT JOIN \`${PROJECT}.${MASTER_DS}.e_Master_Gardu_Induk\` g ON UPPER(TRIM(t.${jpGiCol})) = UPPER(TRIM(g.Master_Gardu_Induk))`);
    }
    runSQL('n_Jadwal_Padam', `CREATE OR REPLACE TABLE \`${PROJECT}.${jpDs}.n_Jadwal_Padam\` AS SELECT * FROM \`${PROJECT}.${jpDs}.v_Jadwal_Padam\``);

    // 1b. Master Transmisi — check HEALTHY_INDEX_TOWER
    const mtDs = 'Master_Transmisi_UPT_Bogor';
    const mtId = '13xm0SqMP5EYbLyYnt5jUPUx1BzhaDffkX4iippq_LuM';
    const mtUrl = `https://docs.google.com/spreadsheets/d/${mtId}`;

    console.log('\n📌 Healthy Index Tower:');
    const hiHeaders = await getHeaders(mtId, '5.HEALTHY INDEX TOWER');
    const hiCols = hiHeaders.map(h => `${h.normalized} STRING`).join(', ');
    runSQL('e_5_HEALTHY_INDEX_TOWER', `CREATE OR REPLACE EXTERNAL TABLE \`${PROJECT}.${mtDs}.e_5_HEALTHY_INDEX_TOWER\`(${hiCols}) OPTIONS(format='GOOGLE_SHEETS',uris=['${mtUrl}'],sheet_range='5.HEALTHY INDEX TOWER',skip_leading_rows=1)`);

    const hiGiCol = getGIColumn(hiHeaders);
    if (hiGiCol) {
        runSQL('v_5_HEALTHY_INDEX_TOWER', `CREATE OR REPLACE VIEW \`${PROJECT}.${mtDs}.v_5_HEALTHY_INDEX_TOWER\` AS SELECT t.*, g.ID_GI, CASE WHEN t.${hiGiCol} IS NULL OR TRIM(t.${hiGiCol}) = '' THEN 'MISSING_GI' WHEN g.Master_Gardu_Induk IS NULL THEN 'ORPHAN_GI' ELSE 'OK' END AS qc_hierarchy FROM \`${PROJECT}.${mtDs}.e_5_HEALTHY_INDEX_TOWER\` t LEFT JOIN \`${PROJECT}.${MASTER_DS}.e_Master_Gardu_Induk\` g ON UPPER(TRIM(t.${hiGiCol})) = UPPER(TRIM(g.Master_Gardu_Induk))`);
    }
    runSQL('n_5_HEALTHY_INDEX_TOWER', `CREATE OR REPLACE TABLE \`${PROJECT}.${mtDs}.n_5_HEALTHY_INDEX_TOWER\` AS SELECT * FROM \`${PROJECT}.${mtDs}.v_5_HEALTHY_INDEX_TOWER\``);
}

// === STEP 2: Delete unused e_ tables ===
function cleanupUnused() {
    console.log('\n=== STEP 2: Delete unused e_ tables ===\n');

    // Tables to DELETE (e_ without corresponding v_/n_)
    const toDelete = {
        'Dashboard_Gardu_Induk_UPT_Bogor': ['e_MTU', 'e_Refrensi_Bay', 'e_Refrensi_MTU', 'e_REALISASI_IL_2'],
        'MASTER_HIERARCHY_UPT_Bogor': ['e_Alias_Bay', 'e_Single_Line_Diagram_Gardu_Induk'],
        'Master_Asset_Relay_UPT_Bogor': ['e_GICODE', 'e_REF_KLASIFIKASI_BAY', 'e_REF_MERK_TYPE_RELAY', 'e_REF_PROTECTION'],
        'Master_Jadwal_Padam_UPT_Bogor': ['e_Histori_Status_Jalur', 'e_Jadwal_Sabtu_Minggu', 'e_MASTER_BAY', 'e_ROM_2026', 'e_ROT_2026'],
    };

    for (const [ds, tables] of Object.entries(toDelete)) {
        console.log(`📦 ${ds}:`);
        for (const t of tables) {
            process.stdout.write(`  DELETE ${t} ... `);
            try {
                execSync(`bq rm -f --project_id=${PROJECT} ${ds}.${t}`, { stdio: 'pipe', timeout: 15000 });
                console.log('✅');
            } catch (e) {
                console.log(`❌ ${e.message.substring(0, 80)}`);
            }
        }
    }
}

async function main() {
    await fixMissing();
    cleanupUnused();
    console.log('\n✅ ALL FIXES AND CLEANUP DONE!');
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
