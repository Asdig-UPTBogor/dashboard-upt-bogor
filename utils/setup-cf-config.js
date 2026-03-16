/**
 * setup-cf-config.js
 * 
 * Creates a clean Firestore config for Cloud Function sync.
 * Reads current SHEET_TO_TABLE registry + live sheet headers → writes to Firestore.
 * 
 * Firestore Structure:
 *   sync_config/
 *     settings      → { syncIntervalMin: 15, enabled: true, lastSync: ... }
 *     spreadsheets  → doc per spreadsheet
 *       └── sheets  → subcollection per sheet with columns, hierarchy level, etc.
 */
const { GoogleAuth } = require('google-auth-library');
const path = require('path');

const KEY_PATH = path.join(__dirname, '..', 'google-auth', 'key.json');
const PROJECT_ID = 'gcp-bridge-meshvpn';
const FS_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

const auth = new GoogleAuth({
    keyFile: KEY_PATH,
    scopes: [
        'https://www.googleapis.com/auth/datastore',
        'https://www.googleapis.com/auth/spreadsheets.readonly',
    ],
});

// ── Current Config (from SHEET_TO_TABLE + create-remaining-datasets.js) ──

const SPREADSHEETS = [
    {
        spreadsheetId: '1vpVUczVs8GB-VHbqxrHpl-EZI66HO2e2fWdU3qfLzeI',
        spreadsheetName: 'Master Hierarchy UPT Bogor',
        dataset: 'MASTER_HIERARCHY_UPT_Bogor',
        sheets: [
            { sheetName: 'Master Gardu Induk', hierarchyLevel: 'MASTER', tablePrefix: 'n_Master_Gardu_Induk' },
            { sheetName: 'Master Bay',         hierarchyLevel: 'MASTER', tablePrefix: 'n_Master_Bay' },
            { sheetName: 'Koordinat Gardu Induk', hierarchyLevel: 'FLAT', tablePrefix: 'n_Koordinat_Gardu_Induk' },
        ],
    },
    {
        spreadsheetId: '1aSi-mBeRnpUvSuNQ_U4HZbLxpmqwt2Fwh8koJVslqIg',
        spreadsheetName: 'Dashboard Gardu Induk UPT Bogor',
        dataset: 'Dashboard_Gardu_Induk_UPT_Bogor',
        sheets: [
            { sheetName: 'MTU TRAFO',              hierarchyLevel: 'GI', tablePrefix: 'n_MTU_TRAFO' },
            { sheetName: 'MTU PMT',                hierarchyLevel: 'GI', tablePrefix: 'n_MTU_PMT' },
            { sheetName: 'MTU PMS',                hierarchyLevel: 'GI', tablePrefix: 'n_MTU_PMS' },
            { sheetName: 'MTU CT',                 hierarchyLevel: 'GI', tablePrefix: 'n_MTU_CT' },
            { sheetName: 'MTU CVT',                hierarchyLevel: 'GI', tablePrefix: 'n_MTU_CVT' },
            { sheetName: 'MTU LA',                 hierarchyLevel: 'GI', tablePrefix: 'n_MTU_LA' },
            { sheetName: 'MTU KABEL POWER',        hierarchyLevel: 'GI', tablePrefix: 'n_MTU_KABEL_POWER' },
            { sheetName: 'SEALING END',            hierarchyLevel: 'GI', tablePrefix: 'n_SEALING_END' },
            { sheetName: 'PROGRAM STRATEGIS TRAFO', hierarchyLevel: 'GI', tablePrefix: 'n_PROGRAM_STRATEGIS_TRAFO' },
            { sheetName: 'PROGRAM KERJA HARGI',    hierarchyLevel: 'GI', tablePrefix: 'n_PROGRAM_KERJA_HARGI' },
        ],
    },
    {
        spreadsheetId: '13xm0SqMP5EYbLyYnt5jUPUx1BzhaDffkX4iippq_LuM',
        spreadsheetName: 'Master Transmisi UPT Bogor',
        dataset: 'Master_Transmisi_UPT_Bogor',
        sheets: [
            { sheetName: 'MASTER ASSET TOWER',          hierarchyLevel: 'GI', tablePrefix: 'n_MASTER_ASSET_TOWER' },
            { sheetName: '0.RESUME JARINGAN',           hierarchyLevel: 'GI', tablePrefix: 'n_0_RESUME_JARINGAN' },
            { sheetName: '1.DATA PETIR',                hierarchyLevel: 'FLAT', tablePrefix: 'n_1_DATA_PETIR' },
            { sheetName: '3.PROTEKSI PETIR TAMBAHAN',   hierarchyLevel: 'GI', tablePrefix: 'n_3_PROTEKSI_PETIR_TAMBAHAN' },
            { sheetName: '5.HEALTHY INDEX TOWER',       hierarchyLevel: 'GI', tablePrefix: 'n_5_HEALTHY_INDEX_TOWER' },
            { sheetName: '6.ASSESMENT TOWER DAN VENOM', hierarchyLevel: 'GI', tablePrefix: 'n_6_ASSESMENT_TOWER_DAN_VENOM' },
            { sheetName: '12.KONDISI ROW',              hierarchyLevel: 'GI', tablePrefix: 'n_12_KONDISI_ROW' },
            { sheetName: '14.LM JARINGAN 2026',        hierarchyLevel: 'GI', tablePrefix: 'n_14_LM_JARINGAN_2026' },
            { sheetName: '17.SLD TOWER',                hierarchyLevel: 'GI', tablePrefix: 'n_17_SLD_TOWER' },
        ],
    },
    {
        spreadsheetId: '1RDb1cBtjCo0rBN1goWXV4-VG75fof_K5ZiFP-L7wwW8',
        spreadsheetName: 'Master Asset Relay UPT Bogor',
        dataset: 'Master_Asset_Relay_UPT_Bogor',
        sheets: [
            { sheetName: 'Asset Relay UPT Bogor', hierarchyLevel: 'BAY', tablePrefix: 'n_Asset_Relay_UPT_Bogor' },
        ],
    },
    {
        spreadsheetId: '1Ktsov6WR0CRo31T9pZGo4nEBhMW5MoJ7ectXQyqz0vk',
        spreadsheetName: 'Master Jadwal Padam UPT Bogor',
        dataset: 'Master_Jadwal_Padam_UPT_Bogor',
        sheets: [
            { sheetName: 'Jadwal Padam', hierarchyLevel: 'GI', tablePrefix: 'n_Jadwal_Padam' },
        ],
    },
];

// ── Helpers ──

function encode(val) {
    if (val === null || val === undefined) return { nullValue: null };
    if (typeof val === 'string') return { stringValue: val };
    if (typeof val === 'number') return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
    if (typeof val === 'boolean') return { booleanValue: val };
    if (Array.isArray(val)) return { arrayValue: { values: val.map(encode) } };
    if (typeof val === 'object') {
        const fields = {};
        for (const [k, v] of Object.entries(val)) fields[k] = encode(v);
        return { mapValue: { fields } };
    }
    return { stringValue: String(val) };
}

async function getToken() {
    const client = await auth.getClient();
    const t = await client.getAccessToken();
    return t.token;
}

async function writeDoc(collection, docId, data) {
    const token = await getToken();
    const fields = {};
    for (const [k, v] of Object.entries(data)) fields[k] = encode(v);

    const url = `${FS_BASE}/${collection}/${docId}`;
    const res = await fetch(url, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields }),
    });
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Firestore write failed: ${res.status} ${err.substring(0, 200)}`);
    }
    return true;
}

async function getSheetHeaders(spreadsheetId, sheetName) {
    try {
        const token = await getToken();
        const range = encodeURIComponent(`'${sheetName}'!1:1`);
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        const res = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
        });
        clearTimeout(timeout);
        if (!res.ok) {
            console.log(`    ⚠️ HTTP ${res.status}: ${(await res.text()).substring(0, 80)}`);
            return [];
        }
        const data = await res.json();
        return (data.values?.[0] || []).filter(h => h && h.trim());
    } catch (e) {
        console.log(`    ⚠️ Cannot read headers: ${e.message.substring(0, 80)}`);
        return [];
    }
}

// ── Main ──

async function main() {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  Setting up Cloud Function Sync Config in Firestore');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // 1. Write global settings
    console.log('📋 Writing sync_config/settings ...');
    await writeDoc('sync_config', 'settings', {
        syncIntervalMinutes: 15,
        enabled: true,
        lastSyncAt: null,
        lastSyncStatus: null,
        lastSyncDurationMs: null,
        totalSheets: SPREADSHEETS.reduce((sum, ss) => sum + ss.sheets.length, 0),
    });
    console.log('  ✅ settings saved\n');

    // 2. Write each spreadsheet config + read live headers
    let totalSheets = 0;

    for (const ss of SPREADSHEETS) {
        console.log(`\n${'─'.repeat(60)}`);
        console.log(`📦 ${ss.spreadsheetName}`);
        console.log(`   ID: ${ss.spreadsheetId}`);
        console.log(`   Dataset: ${ss.dataset}`);

        const sheetsData = [];

        for (const sh of ss.sheets) {
            process.stdout.write(`  📋 "${sh.sheetName}" ... `);

            // Read live headers from sheet
            const headers = await getSheetHeaders(ss.spreadsheetId, sh.sheetName);

            const sheetConfig = {
                sheetName: sh.sheetName,
                tableName: sh.tablePrefix,
                hierarchyLevel: sh.hierarchyLevel,
                columns: headers,
                columnCount: headers.length,
                lastSchemaCheck: new Date().toISOString(),
            };

            sheetsData.push(sheetConfig);
            totalSheets++;
            console.log(`✅ ${headers.length} columns`);
        }

        // Write spreadsheet doc with embedded sheets array
        const ssDocId = ss.dataset; // use dataset name as doc ID (unique, clean)
        await writeDoc('sync_config', ssDocId, {
            spreadsheetId: ss.spreadsheetId,
            spreadsheetName: ss.spreadsheetName,
            dataset: ss.dataset,
            sheetCount: ss.sheets.length,
            sheets: sheetsData,
            createdAt: new Date().toISOString(),
        });
        console.log(`  💾 Saved to sync_config/${ssDocId}`);
    }

    // 3. Summary
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`✅ DONE! ${SPREADSHEETS.length} spreadsheets, ${totalSheets} sheets configured.`);
    console.log(`\nFirestore structure:`);
    console.log(`  sync_config/`);
    console.log(`    settings                           → global sync settings`);
    for (const ss of SPREADSHEETS) {
        console.log(`    ${ss.dataset.padEnd(40)} → ${ss.sheets.length} sheets`);
        for (const sh of ss.sheets) {
            console.log(`      └── ${sh.sheetName.padEnd(35)} [${sh.hierarchyLevel}] → ${sh.tablePrefix}`);
        }
    }
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
