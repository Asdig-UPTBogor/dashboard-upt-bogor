const { google } = require('googleapis');
const fs = require('fs');

const SPREADSHEET_ID = '1UiVv0mwnvbhtBZiJUczQkVUJcr22B48edfc17w3WuUQ';
const SERVICE_ACCOUNT_FILE = '/home/server-01/Workspace/GCP Project/Dashboard-UPT-Bogor/Google Auth/automaticspreadsheet-de108e1d5b56.json';

async function crossCheck() {
    try {
        const rescuedData = JSON.parse(fs.readFileSync('rescued_coords.json', 'utf8'));
        const dbCoords = new Map();
        rescuedData.forEach(row => {
            dbCoords.set(row['Master Gardu Induk'], {
                lat: parseFloat(row['Latitude']),
                lng: parseFloat(row['Longitude'])
            });
        });

        const auth = new google.auth.GoogleAuth({
            keyFile: SERVICE_ACCOUNT_FILE,
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });
        const sheets = google.sheets({ version: 'v4', auth });

        // First find the sheet title automatically
        const docInfo = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
        const sheetList = docInfo.data.sheets.map(s => s.properties.title);

        // Find sheet matching "GARDU" or "GI"
        const targetSheet = sheetList.find(s => s.toUpperCase().includes('GARDU') || s.toUpperCase() === 'GI') || sheetList[0];
        console.log(`Using target sheet: "${targetSheet}"`);

        const range = `'${targetSheet}'!A:Z`;
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: range,
        });

        const rows = response.data.values;
        if (!rows || rows.length === 0) {
            console.log('No data found in new spreadsheet.');
            return;
        }

        const headers = rows[0];
        const giIndex = headers.findIndex(h => h && (h.trim().toLowerCase() === 'gi name' || h.trim().toLowerCase().includes('gi/gis') || h.trim().toLowerCase().includes('gardu')));
        const latIndex = headers.findIndex(h => h && h.trim().toLowerCase().includes('latitude'));
        const lngIndex = headers.findIndex(h => h && h.trim().toLowerCase().includes('longitude'));

        if (giIndex === -1 || latIndex === -1 || lngIndex === -1) {
            console.error('Could not find necessary columns in sheet headers:', headers);
            return;
        }

        console.log(`Matching columns - GI: [${giIndex}], Lat: [${latIndex}], Lng: [${lngIndex}]`);
        console.log('--- CROSS CHECK RESULTS ---');

        let matchCount = 0;
        let mismatchCount = 0;
        let missingCount = 0;

        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.length === 0) continue;

            const giName = row[giIndex];
            if (!giName) continue;

            const sheetLat = parseFloat(row[latIndex]?.replace(',', '.') || 0);
            const sheetLng = parseFloat(row[lngIndex]?.replace(',', '.') || 0);

            const dbData = dbCoords.get(giName);

            if (!dbData) {
                console.log(`[?] GI in Sheet NOT FOUND in Database: ${giName}`);
                missingCount++;
            } else {
                const diffLat = Math.abs(dbData.lat - sheetLat);
                const diffLng = Math.abs(dbData.lng - sheetLng);

                // Allow small floating point differences
                if (diffLat < 0.0001 && diffLng < 0.0001) {
                    console.log(`[✓] PERFECT MATCH: ${giName} (Lat: ${sheetLat}, Lng: ${sheetLng})`);
                    matchCount++;
                } else {
                    console.log(`[X] MISMATCH: ${giName}`);
                    console.log(`    - Database : Lat=${dbData.lat}, Lng=${dbData.lng}`);
                    console.log(`    - Sheet    : Lat=${sheetLat}, Lng=${sheetLng}`);
                    mismatchCount++;
                }

                // Remove from map to see what's left
                dbCoords.delete(giName);
            }
        }

        console.log('---------------------------');
        if (dbCoords.size > 0) {
            console.log(`[!] Still missing ${dbCoords.size} GIs in the new sheet from the Database:`);
            for (const [key, val] of dbCoords.entries()) {
                console.log(`    - ${key}`);
            }
        }

        console.log(`\nSUMMARY: ${matchCount} MATCHED | ${mismatchCount} MISMATCHED | ${missingCount} EXTRA IN SHEET | ${dbCoords.size} MISSING IN SHEET`);

    } catch (error) {
        console.error('API Error:', error.message);
    }
}

crossCheck();
