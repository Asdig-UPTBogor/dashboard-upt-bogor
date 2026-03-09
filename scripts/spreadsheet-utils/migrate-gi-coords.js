const { google } = require('googleapis');

async function migrateCoordsWithComments() {
    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: '/home/server-01/Workspace/GCP Project/Dashboard-UPT-Bogor/Google Auth/automaticspreadsheet-de108e1d5b56.json',
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });
        const sheets = google.sheets({ version: 'v4', auth });

        // Spreadsheet 1 (Ingest) -> SOURCE OF TRUTH
        const ss1Id = '1UiVv0mwnvbhtBZiJUczQkVUJcr22B48edfc17w3WuUQ';
        const ss1Range = 'Master GI!A1:Z';

        // Spreadsheet 2 (General Info) -> TARGET TO BE UPDATED
        const ss2Id = '1A-x4WiaSazBdtx051TdhCBqNKpPpcbMWVFVyWSFUdo4';

        // 1. Fetch metadata to get the actual sheet ID for SS2 (needed for batchUpdate notes)
        const meta2 = await sheets.spreadsheets.get({ spreadsheetId: ss2Id });
        const targetSheet = meta2.data.sheets.find(s => s.properties.title.toUpperCase().includes('GARDU INDUK') || s.properties.title.toUpperCase().includes('GRADU INDUK'));
        if (!targetSheet) throw new Error("Target Sheet 'GARDU INDUK' not found in SS2.");

        const sheet2Name = targetSheet.properties.title;
        const sheet2Id = targetSheet.properties.sheetId;
        const ss2Range = `'${sheet2Name}'!A1:Z`;

        console.log(`[READ] Fetching Source Coordinates from Ingest [${ss1Id}], Sheet: Master GI...`);
        const res1 = await sheets.spreadsheets.values.get({ spreadsheetId: ss1Id, range: ss1Range });
        const data1 = res1.data.values || [];

        console.log(`[READ] Fetching Target General Information [${ss2Id}], Sheet: ${sheet2Name}...`);
        const res2 = await sheets.spreadsheets.values.get({ spreadsheetId: ss2Id, range: ss2Range });
        const data2 = res2.data.values || [];

        // 2. Parse Source Data
        const header1 = data1[0] || [];
        const giIndex1 = header1.findIndex(h => h && h.toLowerCase().includes('gi name'));
        const latIndex1 = header1.findIndex(h => h && h.toLowerCase().includes('latitude'));
        const longIndex1 = header1.findIndex(h => h && h.toLowerCase().includes('longitude'));

        const sourceCoords = new Map();
        for (let i = 1; i < data1.length; i++) {
            const row = data1[i];
            if (!row || row.length === 0) continue;
            const gi = row[giIndex1];
            const lat = row[latIndex1] ? row[latIndex1].trim() : '';
            const long = row[longIndex1] ? row[longIndex1].trim() : '';
            if (gi && lat && long) {
                sourceCoords.set(gi.trim().toUpperCase(), { lat, long });
            }
        }

        // 3. Parse Target Data & Prepare Batch Update
        const header2 = data2[0] || [];
        const giIndex2 = header2.findIndex(h => h && h.toLowerCase().includes('nama gi'));
        const latIndex2 = header2.findIndex(h => h && h.toLowerCase().includes('latitude'));
        const longIndex2 = header2.findIndex(h => h && h.toLowerCase().includes('longitude'));

        console.log(`\n--- Preparing Smart Map & Batch Updates ---`);
        const normalizeName = (name) => name.replace(/GUNUNG/g, '').replace(/PLTU/g, '').replace(/\s+/g, '').toUpperCase();

        const updateRequests = [];
        let modifiedCount = 0;

        for (let i = 1; i < data2.length; i++) {
            const row = data2[i];
            if (!row || row.length === 0) continue;

            const gi2 = row[giIndex2];
            if (!gi2) continue;

            const targetLat = row[latIndex2] ? row[latIndex2].trim() : '';
            const targetLong = row[longIndex2] ? row[longIndex2].trim() : '';

            // Find matching GI from source
            const gi2Normal = normalizeName(gi2);
            let matchEntry = null;
            for (const [gi1, coords1] of sourceCoords.entries()) {
                if (normalizeName(gi1) === gi2Normal) {
                    matchEntry = { original: gi1, coords: coords1 };
                    break;
                }
            }

            if (matchEntry) {
                const sourceLat = matchEntry.coords.lat;
                const sourceLong = matchEntry.coords.long;

                // Check if different
                if (sourceLat !== targetLat || sourceLong !== targetLong) {
                    console.log(`[UPDATE SCHEDULED] ${gi2} (Row ${i + 1}): Lat/Long changing.`);
                    modifiedCount++;

                    // Add request to update the values
                    updateRequests.push({
                        updateCells: {
                            range: {
                                sheetId: sheet2Id,
                                startRowIndex: i, // 0-based
                                endRowIndex: i + 1,
                                startColumnIndex: latIndex2,
                                endColumnIndex: latIndex2 + 2 // Update Lat & Long consecutive columns
                            },
                            rows: [{
                                values: [
                                    {
                                        userEnteredValue: { stringValue: sourceLat },
                                        note: `di perbaiki server dashboard\n(S1: ${sourceLat})`
                                    },
                                    {
                                        userEnteredValue: { stringValue: sourceLong },
                                        note: `di perbaiki server dashboard\n(S1: ${sourceLong})`
                                    }
                                ]
                            }],
                            fields: "userEnteredValue,note"
                        }
                    });
                }
            }
        }

        console.log(`\n=== Migration Summary ===`);
        console.log(`Total rows to be updated: ${modifiedCount}`);

        if (updateRequests.length > 0) {
            console.log(`Executing Batch Update...`);
            await sheets.spreadsheets.batchUpdate({
                spreadsheetId: ss2Id,
                requestBody: {
                    requests: updateRequests
                }
            });
            console.log(`SUCCESS! All cells modified and commented.`);
        } else {
            console.log(`Data is already identical. No updates needed.`);
        }

    } catch (e) {
        console.error("Error API:", e.message);
    }
}

migrateCoordsWithComments();
