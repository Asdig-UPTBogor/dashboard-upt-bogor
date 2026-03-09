const { google } = require('googleapis');
const path = require('path');

const credentialsPath = path.join(__dirname, '../../../Google Auth/automaticspreadsheet-de108e1d5b56.json');
const auth = new google.auth.GoogleAuth({
    keyFile: credentialsPath,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
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

// Function to normalize Indonesian/Spreadsheet number formatting back to raw coordinate string
function normalizeCoordValue(val) {
    if (!val) return '';
    let str = String(val).replace(/^'/, '').trim();
    // Remove all periods (which are thousand separators in ID locale)
    str = str.replace(/\./g, '');
    // Replace the comma (which is decimal separator in ID locale) with a period (Standard decimal)
    str = str.replace(/,/g, '.');
    // If it now looks like "1068208270" without a decimal point but was meant to be 106.8208270
    // Because some coords lost the decimal point during copy paste:
    // e.g., Target: "-65.938.680" -> "-65938680"
    // Source: "-6.5938680" 
    // We will just strip all punctuation from BOTH source and target to do a pure digits match
    str = str.replace(/[^0-9\-]/g, '');
    return str;
}


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
    const ingestSpreadsheetId = '1UiVv0mwnvbhtBZiJUczQkVUJcr22B48edfc17w3WuUQ';
    const targetSpreadsheetId = '1vpVUczVs8GB-VHbqxrHpl-EZI66HO2e2fWdU3qfLzeI';

    try {
        const sourceRes = await sheets.spreadsheets.values.get({
            spreadsheetId: ingestSpreadsheetId,
            range: "'Master GI'!A:Z",
        });
        const sourceRows = sourceRes.data.values || [];
        const sourceMap = new Map();

        for (let i = 1; i < sourceRows.length; i++) {
            let giName = sourceRows[i][2];
            if (!giName) continue;
            const lat = sourceRows[i][5] || '';
            const lon = sourceRows[i][6] || '';
            if (normalizeName(giName) && lat && lon) {
                sourceMap.set(normalizeName(giName), { originalName: giName, lat, lon });
            }
        }

        const targetRes = await sheets.spreadsheets.values.get({
            spreadsheetId: targetSpreadsheetId,
            range: "'Koordinat Gardu Induk'!C2:E", // Skip header, get C,D,E (Name, Lat, Lon)
        });
        const targetRows = targetRes.data.values || [];

        const reportData = [];

        for (const row of targetRows) {
            let targetName = row[0] || '';
            let targetLat = row[1] || '';
            let targetLon = row[2] || '';

            let targetNorm = normalizeName(targetName);
            if (manualRemap[targetNorm]) targetNorm = manualRemap[targetNorm];

            const sourceData = sourceMap.get(targetNorm);

            if (sourceData) {
                // Compare stripping all punctuation to prove the digits match perfectly
                const tLatNorm = normalizeCoordValue(targetLat);
                const tLonNorm = normalizeCoordValue(targetLon);
                const sLatNorm = normalizeCoordValue(sourceData.lat);
                const sLonNorm = normalizeCoordValue(sourceData.lon);

                const isLatMatch = sLatNorm === tLatNorm;
                const isLonMatch = sLonNorm === tLonNorm;

                reportData.push({
                    'Source Name (Ingest)': sourceData.originalName,
                    'Target Name (Master)': targetName,
                    'Status': (isLatMatch && isLonMatch) ? '✅ PERFECT' : '❌ MISMATCH',
                    'Source Coord': `${sourceData.lat}, ${sourceData.lon}`,
                    'Target Coord': `${targetLat}, ${targetLon}`
                });
            } else {
                reportData.push({
                    'Source Name (Ingest)': 'NOT FOUND IN SOURCE',
                    'Target Name (Master)': targetName,
                    'Status': '⚠️ NO DATA',
                    'Source Coord': '-',
                    'Target Coord': `${targetLat}, ${targetLon}`
                });
            }
        }

        console.table(reportData);

    } catch (e) {
        console.error(e);
    }
}
main();
