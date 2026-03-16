/**
 * verify-bq-columns.js (v2)
 * 
 * Compare ALL BQ native table columns vs Google Sheet headers.
 * Shows side-by-side: Sheet column → BQ column → status
 * 
 * Usage: node utils/verify-bq-columns.js
 */
const { google } = require('googleapis');
const path = require('path');

const KEY_PATH = path.join(__dirname, '..', 'google-auth', 'key.json');
const PROJECT = 'gcp-bridge-meshvpn';
const LOCATION = 'asia-southeast2';

const auth = new google.auth.GoogleAuth({
    keyFile: KEY_PATH,
    scopes: [
        'https://www.googleapis.com/auth/bigquery',
        'https://www.googleapis.com/auth/spreadsheets.readonly',
    ],
});
const sheetsApi = google.sheets({ version: 'v4', auth });

// BQ reserved words (same list as create scripts)
const RESERVED = ['NO', 'ALL', 'AND', 'AS', 'AT', 'BY', 'DO', 'IF', 'IN', 'IS', 'NOT', 'NULL', 'OF', 'ON', 'OR', 'TO'];

function toBQ(name) {
    let n = name.replace(/[^a-zA-Z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
    if (RESERVED.includes(n.toUpperCase())) n = n + '_';
    return n;
}

function normalizeName(name) {
    return name.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
}

// ALL datasets — complete config
const DATASETS = [
    {
        spreadsheetId: '1vpVUczVs8GB-VHbqxrHpl-EZI66HO2e2fWdU3qfLzeI',
        dataset: 'MASTER_HIERARCHY_UPT_Bogor',
        sheets: ['Master UPT', 'Master ULTG', 'Master Gardu Induk', 'Master Bay', 'Koordinat Gardu Induk'],
    },
    {
        spreadsheetId: '1aSi-mBeRnpUvSuNQ_U4HZbLxpmqwt2Fwh8koJVslqIg',
        dataset: 'Dashboard_Gardu_Induk_UPT_Bogor',
        sheets: ['MTU TRAFO', 'MTU PMT', 'MTU PMS', 'MTU CT', 'MTU CVT', 'MTU LA',
                 'MTU KABEL POWER', 'SEALING END', 'PROGRAM STRATEGIS TRAFO', 'PROGRAM KERJA HARGI'],
    },
    {
        spreadsheetId: '13xm0SqMP5EYbLyYnt5jUPUx1BzhaDffkX4iippq_LuM',
        dataset: 'Master_Transmisi_UPT_Bogor',
        sheets: ['MASTER ASSET TOWER', '0.RESUME JARINGAN', '1.DATA PETIR',
                 '3.PROTEKSI PETIR TAMBAHAN', '5.HEALTHY INDEX TOWER',
                 '6.ASSESMENT TOWER DAN VENOM', '12.KONDISI ROW',
                 '14.LM JARINGAN 2026', '17.SLD TOWER'],
    },
    {
        spreadsheetId: '1RDb1cBtjCo0rBN1goWXV4-VG75fof_K5ZiFP-L7wwW8',
        dataset: 'Master_Asset_Relay_UPT_Bogor',
        sheets: ['Asset Relay UPT Bogor'],
    },
    {
        spreadsheetId: '1Ktsov6WR0CRo31T9pZGo4nEBhMW5MoJ7ectXQyqz0vk',
        dataset: 'Master_Jadwal_Padam_UPT_Bogor',
        sheets: ['Jadwal Padam'],
    },
];

async function queryBQ(sql) {
    const client = await auth.getClient();
    const token = await client.getAccessToken();
    const accessToken = typeof token === 'string' ? token : token?.token;
    const resp = await fetch(`https://bigquery.googleapis.com/bigquery/v2/projects/${PROJECT}/queries`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: sql, useLegacySql: false, location: LOCATION }),
    });
    if (!resp.ok) throw new Error(`BQ: ${resp.status} ${(await resp.text()).substring(0, 200)}`);
    return resp.json();
}

async function getBQColumns(dataset, tableName) {
    const sql = `SELECT column_name FROM \`${PROJECT}.${dataset}.INFORMATION_SCHEMA.COLUMNS\` WHERE table_name = '${tableName}' ORDER BY ordinal_position`;
    const data = await queryBQ(sql);
    return (data.rows || []).map(r => r.f[0].v);
}

async function getSheetHeaders(spreadsheetId, sheetName) {
    const res = await sheetsApi.spreadsheets.values.get({
        spreadsheetId,
        range: `'${sheetName}'!1:1`,
    });
    return (res.data.values?.[0] || []).filter(Boolean);
}

async function main() {
    console.log('='.repeat(100));
    console.log('FULL VERIFICATION: Sheet Headers vs BQ e_/n_ Columns (ALL 26 sheets)');
    console.log('='.repeat(100));

    const summary = [];

    for (const ds of DATASETS) {
        console.log(`\n${'█'.repeat(100)}`);
        console.log(`📦 DATASET: ${ds.dataset}`);
        console.log(`   Spreadsheet: ${ds.spreadsheetId}`);
        console.log(`${'█'.repeat(100)}`);

        for (const sheetName of ds.sheets) {
            const norm = normalizeName(sheetName);
            const eTable = `e_${norm}`;
            const nTable = `n_${norm}`;

            console.log(`\n  ${'─'.repeat(90)}`);
            console.log(`  📊 Sheet: "${sheetName}"`);
            console.log(`     e_: ${eTable} | n_: ${nTable}`);
            console.log(`  ${'─'.repeat(90)}`);

            try {
                const [sheetHeaders, eCols, nCols] = await Promise.all([
                    getSheetHeaders(ds.spreadsheetId, sheetName),
                    getBQColumns(ds.dataset, eTable).catch(() => []),
                    getBQColumns(ds.dataset, nTable).catch(() => []),
                ]);

                const eSet = new Set(eCols);
                const nSet = new Set(nCols);

                // Side-by-side comparison
                console.log(`\n  ${'Sheet Header'.padEnd(35)} ${'→ Expected BQ'.padEnd(30)} e_    n_`);
                console.log(`  ${'─'.repeat(35)} ${'─'.repeat(30)} ───── ─────`);

                let missingE = 0, missingN = 0;
                for (const h of sheetHeaders) {
                    const bq = toBQ(h);
                    const inE = eSet.has(bq);
                    const inN = nSet.has(bq);
                    if (!inE) missingE++;
                    if (!inN) missingN++;
                    const eIcon = inE ? '  ✅ ' : '  ❌ ';
                    const nIcon = inN ? '  ✅ ' : '  ❌ ';
                    console.log(`  ${('"' + h + '"').padEnd(35)} ${bq.padEnd(30)} ${eIcon} ${nIcon}`);
                }

                // Extra columns in n_ (injected by view)
                const sheetBQNames = new Set(sheetHeaders.map(toBQ));
                const injected = nCols.filter(c => !sheetBQNames.has(c) && !eCols.includes(c));
                if (injected.length > 0) {
                    console.log(`\n  ℹ️  Injected by view: ${injected.join(', ')}`);
                }

                // Also check: BQ columns that don't match any sheet header (renamed?)
                const unmatchedE = eCols.filter(c => !sheetBQNames.has(c));
                if (unmatchedE.length > 0) {
                    console.log(`  ⚠️  e_ columns NOT matching any sheet header: ${unmatchedE.join(', ')}`);
                }

                const status = (missingE === 0 && missingN === 0) ? '✅ OK' : `❌ Missing: e_=${missingE} n_=${missingN}`;
                summary.push({ sheet: sheetName, dataset: ds.dataset, sheetCols: sheetHeaders.length, eCols: eCols.length, nCols: nCols.length, missingE, missingN, status });
                console.log(`\n  Result: ${sheetHeaders.length} sheet cols | e_: ${eCols.length} cols | n_: ${nCols.length} cols | ${status}`);

            } catch (err) {
                summary.push({ sheet: sheetName, dataset: ds.dataset, sheetCols: '?', eCols: '?', nCols: '?', missingE: '?', missingN: '?', status: `❌ ERROR: ${err.message.substring(0, 60)}` });
                console.log(`  ❌ ERROR: ${err.message.substring(0, 200)}`);
            }
        }
    }

    // Final summary table
    console.log(`\n${'='.repeat(100)}`);
    console.log('SUMMARY TABLE');
    console.log('='.repeat(100));
    console.log(`${'Sheet'.padEnd(35)} ${'Dataset'.padEnd(35)} Sheet  e_   n_   Status`);
    console.log(`${'─'.repeat(35)} ${'─'.repeat(35)} ───── ──── ──── ──────────`);
    for (const s of summary) {
        console.log(`${s.sheet.padEnd(35)} ${s.dataset.substring(0, 34).padEnd(35)} ${String(s.sheetCols).padEnd(5)} ${String(s.eCols).padEnd(4)} ${String(s.nCols).padEnd(4)} ${s.status}`);
    }
    console.log(`\nTotal: ${summary.length} sheets checked`);
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
