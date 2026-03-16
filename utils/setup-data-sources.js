/**
 * setup-data-sources.js
 * 
 * Populates Firestore `data_sources` collection for CF sync.
 * Reads live sheet headers from Google Sheets API → writes structured config to Firestore.
 * 
 * Firestore Structure:
 *   data_sources/
 *     _settings    → { syncIntervalMinutes: 15, globalEnabled: true }
 *     {dataset}    → 1 doc per spreadsheet with sheets map + sync config
 */
const { GoogleAuth } = require('google-auth-library');
const path = require('path');

const KEY_PATH = path.join(__dirname, '..', 'google-auth', 'key.json');
const PROJECT_ID = 'gcp-bridge-meshvpn';
const FS_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const COLLECTION = 'data_sources';  // ← 2-collection architecture

const auth = new GoogleAuth({
    keyFile: KEY_PATH,
    scopes: [
        'https://www.googleapis.com/auth/datastore',
        'https://www.googleapis.com/auth/spreadsheets.readonly',
    ],
});

// ── Spreadsheet Registry (source of truth for initial setup) ──

const SPREADSHEETS = [
    {
        spreadsheetId: '1vpVUczVs8GB-VHbqxrHpl-EZI66HO2e2fWdU3qfLzeI',
        spreadsheetName: 'MASTER HIERARCHY - UPT Bogor',
        dataset: 'MASTER_HIERARCHY_UPT_Bogor',
        hierarchyDefault: 'MASTER',
        excludeSheets: [],
        knownSheets: [
            { sheetName: 'Master Gardu Induk', hierarchyLevel: 'MASTER', tableName: 'n_Master_Gardu_Induk' },
            { sheetName: 'Master Bay',         hierarchyLevel: 'MASTER', tableName: 'n_Master_Bay' },
            { sheetName: 'Koordinat Gardu Induk', hierarchyLevel: 'FLAT', tableName: 'n_Koordinat_Gardu_Induk' },
        ],
    },
    {
        spreadsheetId: '1aSi-mBeRnpUvSuNQ_U4HZbLxpmqwt2Fwh8koJVslqIg',
        spreadsheetName: 'Dashboard Gardu Induk - UPT Bogor',
        dataset: 'Dashboard_Gardu_Induk_UPT_Bogor',
        hierarchyDefault: 'GI',
        excludeSheets: [],
        knownSheets: [
            { sheetName: 'MTU TRAFO',              hierarchyLevel: 'GI', tableName: 'n_MTU_TRAFO' },
            { sheetName: 'MTU PMT',                hierarchyLevel: 'GI', tableName: 'n_MTU_PMT' },
            { sheetName: 'MTU PMS',                hierarchyLevel: 'GI', tableName: 'n_MTU_PMS' },
            { sheetName: 'MTU CT',                 hierarchyLevel: 'GI', tableName: 'n_MTU_CT' },
            { sheetName: 'MTU CVT',                hierarchyLevel: 'GI', tableName: 'n_MTU_CVT' },
            { sheetName: 'MTU LA',                 hierarchyLevel: 'GI', tableName: 'n_MTU_LA' },
            { sheetName: 'MTU KABEL POWER',        hierarchyLevel: 'GI', tableName: 'n_MTU_KABEL_POWER' },
            { sheetName: 'SEALING END',            hierarchyLevel: 'GI', tableName: 'n_SEALING_END' },
            { sheetName: 'PROGRAM STRATEGIS TRAFO', hierarchyLevel: 'GI', tableName: 'n_PROGRAM_STRATEGIS_TRAFO' },
            { sheetName: 'PROGRAM KERJA HARGI',    hierarchyLevel: 'GI', tableName: 'n_PROGRAM_KERJA_HARGI' },
        ],
    },
    {
        spreadsheetId: '13xm0SqMP5EYbLyYnt5jUPUx1BzhaDffkX4iippq_LuM',
        spreadsheetName: 'Master Transmisi - UPT Bogor',
        dataset: 'Master_Transmisi_UPT_Bogor',
        hierarchyDefault: 'GI',
        excludeSheets: [],
        knownSheets: [
            { sheetName: 'MASTER ASSET TOWER',          hierarchyLevel: 'GI', tableName: 'n_MASTER_ASSET_TOWER' },
            { sheetName: '0.RESUME JARINGAN',           hierarchyLevel: 'GI', tableName: 'n_0_RESUME_JARINGAN' },
            { sheetName: '1.DATA PETIR',                hierarchyLevel: 'FLAT', tableName: 'n_1_DATA_PETIR' },
            { sheetName: '3.PROTEKSI PETIR TAMBAHAN',   hierarchyLevel: 'GI', tableName: 'n_3_PROTEKSI_PETIR_TAMBAHAN' },
            { sheetName: '5.HEALTHY INDEX TOWER',       hierarchyLevel: 'GI', tableName: 'n_5_HEALTHY_INDEX_TOWER' },
            { sheetName: '6.ASSESMENT TOWER DAN VENOM', hierarchyLevel: 'GI', tableName: 'n_6_ASSESMENT_TOWER_DAN_VENOM' },
            { sheetName: '12.KONDISI ROW',              hierarchyLevel: 'GI', tableName: 'n_12_KONDISI_ROW' },
            { sheetName: '14.LM JARINGAN 2026',        hierarchyLevel: 'GI', tableName: 'n_14_LM_JARINGAN_2026' },
            { sheetName: '17.SLD TOWER',                hierarchyLevel: 'GI', tableName: 'n_17_SLD_TOWER' },
        ],
    },
    {
        spreadsheetId: '1RDb1cBtjCo0rBN1goWXV4-VG75fof_K5ZiFP-L7wwW8',
        spreadsheetName: 'Master - Asset Relay UPT Bogor',
        dataset: 'Master_Asset_Relay_UPT_Bogor',
        hierarchyDefault: 'BAY',
        excludeSheets: ['REF_MERK_TYPE_RELAY', 'REF_PROTECTION', 'REF_KLASIFIKASI_BAY', 'MASTER_BAY', 'GICODE'],
        knownSheets: [
            { sheetName: 'Asset Relay UPT Bogor', hierarchyLevel: 'BAY', tableName: 'n_Asset_Relay_UPT_Bogor' },
        ],
    },
    {
        spreadsheetId: '1Ktsov6WR0CRo31T9pZGo4nEBhMW5MoJ7ectXQyqz0vk',
        spreadsheetName: 'Master - Jadwal Padam UPT Bogor',
        dataset: 'Master_Jadwal_Padam_UPT_Bogor',
        hierarchyDefault: 'GI',
        excludeSheets: ['Histori Status Jalur', 'ROH 2026', 'ROM 2026', 'Jadwal Sabtu - Minggu', 'ROT 2026', 'MASTER_BAY'],
        knownSheets: [
            { sheetName: 'Jadwal Padam', hierarchyLevel: 'GI', tableName: 'n_Jadwal_Padam' },
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

async function writeDoc(docId, data) {
    const token = await getToken();
    const fields = {};
    for (const [k, v] of Object.entries(data)) fields[k] = encode(v);

    const url = `${FS_BASE}/${COLLECTION}/${docId}`;
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

function normalizeTableName(sheetName) {
    return 'n_' + sheetName.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
}

// ── Main ──

async function main() {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  Setting up data_sources collection in Firestore');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // 1. Write global settings
    console.log('📋 Writing data_sources/_settings ...');
    await writeDoc('_settings', {
        syncIntervalMinutes: 15,
        globalEnabled: true,
        lastFullSync: null,
        totalSpreadsheets: SPREADSHEETS.length,
    });
    console.log('  ✅ _settings saved\n');

    // 2. Write each spreadsheet config + read live headers
    let totalSheets = 0;

    for (const ss of SPREADSHEETS) {
        console.log(`\n${'─'.repeat(60)}`);
        console.log(`📦 ${ss.spreadsheetName}`);
        console.log(`   ID: ${ss.spreadsheetId}`);
        console.log(`   Dataset: ${ss.dataset}`);

        // Build sheets MAP (key = sheetName) instead of array
        const sheetsMap = {};

        for (const sh of ss.knownSheets) {
            process.stdout.write(`  📋 "${sh.sheetName}" ... `);

            const headers = await getSheetHeaders(ss.spreadsheetId, sh.sheetName);

            sheetsMap[sh.sheetName] = {
                tableName: sh.tableName,
                hierarchyLevel: sh.hierarchyLevel,
                columns: headers,
                columnCount: headers.length,
                rowCount: null,  // will be filled by CF after first sync
            };

            totalSheets++;
            console.log(`✅ ${headers.length} columns`);
        }

        // Write spreadsheet doc
        await writeDoc(ss.dataset, {
            spreadsheetId: ss.spreadsheetId,
            spreadsheetName: ss.spreadsheetName,
            dataset: ss.dataset,
            syncEnabled: true,
            syncMode: 'ALL',
            excludeSheets: ss.excludeSheets,
            hierarchyDefault: ss.hierarchyDefault,
            sheetCount: ss.knownSheets.length,
            sheets: sheetsMap,
            lastSync: null,
            createdAt: new Date().toISOString(),
        });
        console.log(`  💾 Saved to ${COLLECTION}/${ss.dataset}`);
    }

    // 3. Summary
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`✅ DONE! ${SPREADSHEETS.length} spreadsheets, ${totalSheets} sheets configured.`);
    console.log(`\nFirestore structure:`);
    console.log(`  ${COLLECTION}/`);
    console.log(`    _settings                          → global sync settings`);
    for (const ss of SPREADSHEETS) {
        console.log(`    ${ss.dataset.padEnd(40)} → ${ss.knownSheets.length} sheets`);
        for (const sh of ss.knownSheets) {
            console.log(`      └── ${sh.sheetName.padEnd(35)} [${sh.hierarchyLevel}] → ${sh.tableName}`);
        }
        if (ss.excludeSheets.length > 0) {
            console.log(`      🚫 excluded: ${ss.excludeSheets.join(', ')}`);
        }
    }
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
