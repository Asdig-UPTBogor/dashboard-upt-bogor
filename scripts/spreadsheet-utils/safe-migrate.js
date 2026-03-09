const { google } = require('googleapis');

async function safeMigrateCoords() {
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

        const meta2 = await sheets.spreadsheets.get({ spreadsheetId: ss2Id });
        const targetSheet = meta2.data.sheets.find(s => s.properties.title.toUpperCase().includes('GARDU INDUK') || s.properties.title.toUpperCase().includes('GRADU INDUK'));
        if (!targetSheet) throw new Error("Target Sheet 'GARDU INDUK' not found in SS2.");

        const sheet2Name = targetSheet.properties.title;
        const ss2Range = `'${sheet2Name}'!A1:Z`;

        console.log(`[READ] Fetching Source Coordinates from Ingest...`);
        const res1 = await sheets.spreadsheets.values.get({ spreadsheetId: ss1Id, range: ss1Range });
        const data1 = res1.data.values || [];

        console.log(`[READ] Fetching Target General Information...`);
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

        // 3. Parse Target Data & Prepare SAFE Batch Update
        const header2 = data2[0] || [];
        const giIndex2 = header2.findIndex(h => h && h.toLowerCase().includes('nama gi'));
        const latIndex2 = header2.findIndex(h => h && h.toLowerCase().includes('latitude')); // Should be 14 (O)
        const longIndex2 = header2.findIndex(h => h && h.toLowerCase().includes('longitude')); // Should be 15 (P)

        // Utility to convert column index to letter (0 -> A, 1 -> B, ..., 14 -> O, 15 -> P)
        const getColLetter = (idx) => {
            let letter = '';
            while (idx >= 0) {
                letter = String.fromCharCode((idx % 26) + 65) + letter;
                idx = Math.floor(idx / 26) - 1;
            }
            return letter;
        };

        const latColLetter = getColLetter(latIndex2);
        const longColLetter = getColLetter(longIndex2);

        const normalizeName = (name) => name.replace(/GUNUNG/g, '').replace(/PLTU/g, '').replace(/\s+/g, '').toUpperCase();

        const updateData = [];
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

                if (sourceLat !== targetLat || sourceLong !== targetLong) {
                    // Update only specific cells like 'GARDU INDUK'!O2:P2
                    const rangeStr = `'${sheet2Name}'!${latColLetter}${i + 1}:${longColLetter}${i + 1}`;

                    updateData.push({
                        range: rangeStr,
                        values: [[sourceLat, sourceLong]]
                    });

                    modifiedCount++;
                    console.log(`[WILL UPDATE] ${gi2} at ${rangeStr} -> [${sourceLat}, ${sourceLong}]`);
                }
            }
        }

        console.log(`\n=== Safe Migration Summary ===`);
        console.log(`Total rows to be updated: ${modifiedCount}`);

        if (updateData.length > 0) {
            console.log(`Executing values.batchUpdate (SAFE MODE)...`);
            const updateRes = await sheets.spreadsheets.values.batchUpdate({
                spreadsheetId: ss2Id,
                requestBody: {
                    valueInputOption: 'USER_ENTERED',
                    data: updateData
                }
            });
            console.log(`SUCCESS! Only Latitude and Longitude columns were modified.`);
            console.log(updateRes.data.responses.length + " ranges updated.");
        } else {
            console.log(`Data is already identical. No updates needed.`);
        }

    } catch (e) {
        console.error("Error API:", e.message);
    }
}

safeMigrateCoords();
