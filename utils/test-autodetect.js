/**
 * test-autodetect.js (v2)
 * 
 * Uses BQ REST API (tables.insert) to create autodetect external tables.
 * SQL DDL doesn't support autodetect — only the REST API does.
 * 
 * Usage: node utils/test-autodetect.js
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
        'https://www.googleapis.com/auth/drive.readonly',
        'https://www.googleapis.com/auth/spreadsheets.readonly',
    ],
});

function normalizeName(name) {
    return name.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
}

const TESTS = [
    { spreadsheetId: '1vpVUczVs8GB-VHbqxrHpl-EZI66HO2e2fWdU3qfLzeI', dataset: 'MASTER_HIERARCHY_UPT_Bogor', sheet: 'Master Gardu Induk' },
    { spreadsheetId: '1vpVUczVs8GB-VHbqxrHpl-EZI66HO2e2fWdU3qfLzeI', dataset: 'MASTER_HIERARCHY_UPT_Bogor', sheet: 'Master Bay' },
    { spreadsheetId: '1aSi-mBeRnpUvSuNQ_U4HZbLxpmqwt2Fwh8koJVslqIg', dataset: 'Dashboard_Gardu_Induk_UPT_Bogor', sheet: 'MTU TRAFO' },
    { spreadsheetId: '13xm0SqMP5EYbLyYnt5jUPUx1BzhaDffkX4iippq_LuM', dataset: 'Master_Transmisi_UPT_Bogor', sheet: 'MASTER ASSET TOWER' },
    { spreadsheetId: '13xm0SqMP5EYbLyYnt5jUPUx1BzhaDffkX4iippq_LuM', dataset: 'Master_Transmisi_UPT_Bogor', sheet: '5.HEALTHY INDEX TOWER' },
    { spreadsheetId: '1Ktsov6WR0CRo31T9pZGo4nEBhMW5MoJ7ectXQyqz0vk', dataset: 'Master_Jadwal_Padam_UPT_Bogor', sheet: 'Jadwal Padam' },
];

async function getToken() {
    const client = await auth.getClient();
    const token = await client.getAccessToken();
    return typeof token === 'string' ? token : token?.token;
}

async function createAutodetectTable(accessToken, dataset, tableName, spreadsheetId, sheetRange) {
    const url = `https://bigquery.googleapis.com/bigquery/v2/projects/${PROJECT}/datasets/${dataset}/tables`;
    const body = {
        tableReference: { projectId: PROJECT, datasetId: dataset, tableId: tableName },
        externalDataConfiguration: {
            sourceFormat: 'GOOGLE_SHEETS',
            sourceUris: [`https://docs.google.com/spreadsheets/d/${spreadsheetId}`],
            autodetect: true,
            googleSheetsOptions: {
                range: sheetRange,
            },
        },
    };

    const resp = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Create table ${resp.status}: ${text.substring(0, 300)}`);
    }
    return resp.json();
}

async function deleteTable(accessToken, dataset, tableName) {
    const url = `https://bigquery.googleapis.com/bigquery/v2/projects/${PROJECT}/datasets/${dataset}/tables/${tableName}`;
    await fetch(url, { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } });
}

async function getColumns(accessToken, dataset, tableName) {
    const url = `https://bigquery.googleapis.com/bigquery/v2/projects/${PROJECT}/datasets/${dataset}/tables/${tableName}`;
    const resp = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!resp.ok) throw new Error(`Get table ${resp.status}`);
    const data = await resp.json();
    const fields = data.schema?.fields || [];
    return fields.map(f => ({ name: f.name, type: f.type }));
}

async function main() {
    const accessToken = await getToken();

    console.log('='.repeat(90));
    console.log('TEST: Autodetect vs Explicit Schema (BQ REST API)');
    console.log('='.repeat(90));

    for (const test of TESTS) {
        const norm = normalizeName(test.sheet);
        const existingTable = `e_${norm}`;
        const testTable = `test_auto_${norm}`;

        console.log(`\n${'─'.repeat(80)}`);
        console.log(`📊 "${test.sheet}" in ${test.dataset}`);
        console.log(`${'─'.repeat(80)}`);

        try {
            // Delete if exists from previous run
            await deleteTable(accessToken, test.dataset, testTable).catch(() => {});

            // Create with autodetect
            console.log('  Creating autodetect table...');
            await createAutodetectTable(accessToken, test.dataset, testTable, test.spreadsheetId, test.sheet);
            console.log('  ✅ Created');

            // Get columns from both
            const [explicitCols, autodetectCols] = await Promise.all([
                getColumns(accessToken, test.dataset, existingTable),
                getColumns(accessToken, test.dataset, testTable),
            ]);

            // Compare side-by-side
            console.log(`\n  ${'#'.padEnd(4)} ${'Explicit Schema'.padEnd(35)} ${'Autodetect'.padEnd(35)} Match`);
            console.log(`  ${'─'.repeat(4)} ${'─'.repeat(35)} ${'─'.repeat(35)} ─────`);

            const maxLen = Math.max(explicitCols.length, autodetectCols.length);
            let diffs = 0;
            for (let i = 0; i < maxLen; i++) {
                const exp = explicitCols[i];
                const auto = autodetectCols[i];
                const expStr = exp ? `${exp.name} (${exp.type})` : '--- MISSING ---';
                const autoStr = auto ? `${auto.name} (${auto.type})` : '--- MISSING ---';
                const nameMatch = exp && auto && exp.name === auto.name;
                const typeMatch = exp && auto && exp.type === auto.type;
                let icon = '✅';
                if (!nameMatch) { icon = '❌ NAME'; diffs++; }
                else if (!typeMatch) { icon = '⚠️ TYPE'; }
                console.log(`  ${String(i + 1).padEnd(4)} ${expStr.padEnd(35)} ${autoStr.padEnd(35)} ${icon}`);
            }

            console.log(`\n  Result: explicit=${explicitCols.length} | autodetect=${autodetectCols.length} | ${diffs === 0 ? '✅ ALL MATCH' : `⚠️ ${diffs} differences`}`);

            // Cleanup
            await deleteTable(accessToken, test.dataset, testTable);
            console.log('  🗑️  Cleaned up');

        } catch (err) {
            console.log(`  ❌ ERROR: ${err.message.substring(0, 250)}`);
            try { await deleteTable(accessToken, test.dataset, testTable); } catch {}
        }
    }

    console.log(`\n${'='.repeat(90)}`);
    console.log('Done.');
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
