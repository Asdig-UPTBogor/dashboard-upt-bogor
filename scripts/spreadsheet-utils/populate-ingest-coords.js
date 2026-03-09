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
    n = n.replace(/^GITET\s+500\s*KV\s+/i, '');
    n = n.replace(/^GITET\s+500KV\s+/i, '');
    n = n.replace(/^GIS\s+150\s*KV\s+/i, '');
    n = n.replace(/^GIS\s+150KV\s+/i, '');
    n = n.replace(/^GI\s+150\s*KV\s+/i, '');
    n = n.replace(/^GI\s+150KV\s+/i, '');
    n = n.replace(/^GI\s+70\s*KV\s+/i, '');
    n = n.replace(/^GI\s+70KV\s+/i, '');
    n = n.replace(/^GI\s+/i, '');
    n = n.replace(/\s+/g, '');
    return n;
}

// Map Target -> Source
const manualRemap = {
    'INDOSEMEN': 'ITP',
    'CIBINONG': 'CIBINONG',
    'KELAPANUNGGAL': 'KLAPANUNGGAL',
    'PLTUPELABUHANRATU': 'PELABUHANRATU',
    'GUNUNGSALAKBARU': 'SALAKBARU',
    'GUNUNGSALAKLAMA': 'SALAKLAMA'
};

async function main() {
    const sheets = google.sheets({ version: 'v4', auth });

    const ingestSpreadsheetId = '1UiVv0mwnvbhtBZiJUczQkVUJcr22B48edfc17w3WuUQ'; // Ingest Server
    const targetSpreadsheetId = '1vpVUczVs8GB-VHbqxrHpl-EZI66HO2e2fWdU3qfLzeI'; // Target Master Hierarki

    try {
        console.log("1. Fetching source coordinates from Ingest Server (Master GI)...");
        const sourceRes = await sheets.spreadsheets.values.get({
            spreadsheetId: ingestSpreadsheetId,
            range: "'Master GI'!A:Z",
        });

        const sourceRows = sourceRes.data.values || [];
        const coordMap = new Map();

        // In Ingest Master GI:
        // Col 2: GI Name
        // Col 5: Latitude
        // Col 6: Longitude (Based on previous dump, Lat is 5, Lon is 6)

        for (let i = 1; i < sourceRows.length; i++) {
            let giName = sourceRows[i][2]; // GI Name is index 2
            if (!giName) continue;

            const lat = sourceRows[i][5] ? sourceRows[i][5].trim() : '';
            const lon = sourceRows[i][6] ? sourceRows[i][6].trim() : '';

            let normName = normalizeName(giName);
            if (normName && lat && lon) {
                coordMap.set(normName, { lat, lon, originalName: giName });
            }
        }
        console.log(`   -> Loaded ${coordMap.size} valid coordinates from Ingest Server.`);

        console.log("2. Reading clean Strings from Target Master Gardu Induk...");
        const masterGiRes = await sheets.spreadsheets.values.get({
            spreadsheetId: targetSpreadsheetId,
            range: "'Master Gardu Induk'!A:E",
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
            if (manualRemap[normMasterName]) normMasterName = manualRemap[normMasterName]; // Map Target to Source Normalization

            let lat = '';
            let lon = '';
            const coordData = coordMap.get(normMasterName);

            if (coordData) {
                lat = coordData.lat;
                lon = coordData.lon;
                matchCount++;
            } else {
                console.log(`     [MISSING] No coordinate matched for: '${giName}' (Normalized asking for: ${normMasterName})`);
                missingCount++;
            }

            coordSheetData.push([upt, ultg, giName, lat, lon]);
        }

        console.log(`   -> Matched: ${matchCount}, Missing: ${missingCount}`);

        console.log("4. Writing into 'Koordinat Gardu Induk' target sheet...");
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

        console.log("✅ FINISHED: Coordinates migrated perfectly from Ingest Master GI!");

    } catch (e) {
        console.error("FATAL ERROR:", e);
    }
}

main();
