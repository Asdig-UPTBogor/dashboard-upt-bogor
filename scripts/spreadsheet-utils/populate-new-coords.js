const { google } = require('googleapis');
const path = require('path');

const credentialsPath = path.join(__dirname, '../../../Google Auth/automaticspreadsheet-de108e1d5b56.json');
const auth = new google.auth.GoogleAuth({
    keyFile: credentialsPath,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

function normalizeName(name) {
    if (!name) return '';
    let n = name.toUpperCase().trim();
    n = n.replace(/^GI\s+150\s*KV\s+/i, '');
    n = n.replace(/^GI\s+150KV\s+/i, '');
    n = n.replace(/^GI\s+/i, '');
    n = n.replace(/\s+/g, '');
    return n;
}

const manualRemap = {
    'INDOSEMEN': 'ITP',
    'CIBINONG': 'CIBINONG',
    'KELAPANUNGGAL': 'KLAPANUNGGAL'
};

async function main() {
    const sheets = google.sheets({ version: 'v4', auth });

    const sourceSpreadsheetId = '1A-x4WiaSazBdtx051TdhCBqNKpPpcbMWVFVyWSFUdo4'; // General Info
    const targetSpreadsheetId = '1vpVUczVs8GB-VHbqxrHpl-EZI66HO2e2fWdU3qfLzeI'; // Master Hierarchy

    try {
        console.log("1. Fetching source coordinates from General Information...");
        const metaSource = await sheets.spreadsheets.get({ spreadsheetId: sourceSpreadsheetId });
        const sourceSheet = metaSource.data.sheets.find(s => s.properties.title.toUpperCase().includes('GARDU INDUK') || s.properties.title.toUpperCase().includes('GRADU INDUK'));

        const sourceRes = await sheets.spreadsheets.values.get({
            spreadsheetId: sourceSpreadsheetId,
            range: `'${sourceSheet.properties.title}'!A1:Z`,
        });

        const sourceRows = sourceRes.data.values || [];
        const coordMap = new Map();

        const headerSource = sourceRows[0] || [];
        const giIdx = headerSource.findIndex(h => h && h.toLowerCase().includes('nama gi'));
        const latIdx = headerSource.findIndex(h => h && h.toLowerCase().includes('latitude'));
        const lonIdx = headerSource.findIndex(h => h && h.toLowerCase().includes('longitude'));

        for (let i = 1; i < sourceRows.length; i++) {
            let giName = sourceRows[i][giIdx];
            if (!giName) continue;

            const lat = sourceRows[i][latIdx] ? sourceRows[i][latIdx].trim() : '';
            const lon = sourceRows[i][lonIdx] ? sourceRows[i][lonIdx].trim() : '';

            let normName = normalizeName(giName);
            if (manualRemap[normName]) normName = manualRemap[normName];

            if (normName && lat && lon) {
                coordMap.set(normName, { lat, lon, originalName: giName });
            }
        }
        console.log(`   -> Loaded ${coordMap.size} valid coordinates from General Information.`);

        console.log("2. Reading clean Strings from Master Gardu Induk...");
        const masterGiRes = await sheets.spreadsheets.values.get({
            spreadsheetId: targetSpreadsheetId,
            range: "'Master Gardu Induk'!A:Z",
        });
        const masterRows = masterGiRes.data.values || [];

        console.log("3. Building payload for 'Koordinat Gardu Induk'...");
        const coordSheetData = [];
        coordSheetData.push(['Master UPT', 'Master ULTG', 'Master Gardu Induk', 'Latitude', 'Longitude']);

        let matchCount = 0;
        let missingCount = 0;

        for (let i = 1; i < masterRows.length; i++) {
            const upt = masterRows[i][0] || '';
            const ultg = masterRows[i][1] || '';
            const giName = masterRows[i][2] || '';
            if (!giName) continue;

            let normMasterName = normalizeName(giName);
            if (manualRemap[normMasterName]) normMasterName = manualRemap[normMasterName];

            let lat = '';
            let lon = '';
            const coordData = coordMap.get(normMasterName);

            if (coordData) {
                lat = coordData.lat;
                lon = coordData.lon;
                matchCount++;
            } else {
                console.log(`     [MISSING] No coordinate matched for: '${giName}' (Normalized: ${normMasterName})`);
                missingCount++;
            }

            coordSheetData.push([upt, ultg, giName, lat, lon]);
        }

        console.log(`   -> Matched: ${matchCount}, Missing: ${missingCount}`);

        console.log("4. Writing into 'Koordinat Gardu Induk' sheet...");
        await sheets.spreadsheets.values.clear({
            spreadsheetId: targetSpreadsheetId,
            range: "'Koordinat Gardu Induk'!A:Z"
        });

        await sheets.spreadsheets.values.update({
            spreadsheetId: targetSpreadsheetId,
            range: "'Koordinat Gardu Induk'!A1",
            valueInputOption: 'USER_ENTERED',
            resource: { values: coordSheetData }
        });

        console.log("✅ FINISHED: Coordinates successfully migrated to distinct sheet based on pure string hierarchy matching!");

    } catch (e) {
        console.error("FATAL ERROR:", e);
    }
}

main();
