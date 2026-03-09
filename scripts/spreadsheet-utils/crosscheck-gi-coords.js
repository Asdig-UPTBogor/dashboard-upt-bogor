const { google } = require('googleapis');

async function crossCheckCoords() {
    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: '/home/server-01/Workspace/GCP Project/Dashboard-UPT-Bogor/Google Auth/automaticspreadsheet-de108e1d5b56.json',
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });
        const sheets = google.sheets({ version: 'v4', auth });

        // Spreadsheet 1
        const ss1Id = '1UiVv0mwnvbhtBZiJUczQkVUJcr22B48edfc17w3WuUQ';
        const ss1Range = 'Master GI!A1:Z';

        // Spreadsheet 2
        const ss2Id = '1A-x4WiaSazBdtx051TdhCBqNKpPpcbMWVFVyWSFUdo4';

        // Find correct sheet name for SS2
        const meta2 = await sheets.spreadsheets.get({ spreadsheetId: ss2Id });
        const sheet2Name = meta2.data.sheets.map(s => s.properties.title).find(t => t.toUpperCase().includes('GARDU INDUK') || t.toUpperCase().includes('GRADU INDUK')) || 'GARDU INDUK';
        const ss2Range = `'${sheet2Name}'!A1:Z`;

        console.log(`Fetching data from Spreadsheet 1 [${ss1Id}], Sheet: Master GI...`);
        const res1 = await sheets.spreadsheets.values.get({ spreadsheetId: ss1Id, range: ss1Range });
        const data1 = res1.data.values || [];

        console.log(`Fetching data from Spreadsheet 2 [${ss2Id}], Sheet: ${sheet2Name}...`);
        const res2 = await sheets.spreadsheets.values.get({ spreadsheetId: ss2Id, range: ss2Range });
        const data2 = res2.data.values || [];

        // Parse Data 1
        const header1 = data1[0] || [];
        const giIndex1 = header1.findIndex(h => h && h.toLowerCase().includes('gi name'));
        const latIndex1 = header1.findIndex(h => h && h.toLowerCase().includes('latitude'));
        const longIndex1 = header1.findIndex(h => h && h.toLowerCase().includes('longitude'));

        console.log(`Spreadsheet 1 Found GI Index: ${giIndex1}, Lat Index: ${latIndex1}, Long Index: ${longIndex1}`);

        const map1 = new Map();
        for (let i = 1; i < data1.length; i++) {
            const row = data1[i];
            if (!row || row.length === 0) continue;
            const gi = row[giIndex1];
            const lat = row[latIndex1] ? row[latIndex1].trim() : '';
            const long = row[longIndex1] ? row[longIndex1].trim() : '';

            let coord = '';
            if (lat && long) {
                coord = `${lat},${long}`;
            }

            if (gi) {
                map1.set(gi.trim().toUpperCase(), coord ? coord : null);
            }
        }

        // Parse Data 2
        const header2 = data2[0] || [];
        const giIndex2 = header2.findIndex(h => h && h.toLowerCase().includes('nama gi'));
        const latIndex2 = header2.findIndex(h => h && h.toLowerCase().includes('latitude'));
        const longIndex2 = header2.findIndex(h => h && h.toLowerCase().includes('longitude'));

        console.log(`Spreadsheet 2 Found GI Index: ${giIndex2}, Lat Index: ${latIndex2}, Long Index: ${longIndex2}`);

        const map2 = new Map();
        for (let i = 1; i < data2.length; i++) {
            const row = data2[i];
            if (!row || row.length === 0) continue;
            const gi = row[giIndex2];
            const lat = row[latIndex2] ? row[latIndex2].trim() : '';
            const long = row[longIndex2] ? row[longIndex2].trim() : '';

            let coord = '';
            if (lat && long) {
                coord = `${lat},${long}`;
            }

            if (gi) {
                map2.set(gi.trim().toUpperCase(), coord ? coord : null);
            }
        }

        // Smart mapping function to ignore spaces and specific words like GUNUNG or PLTU
        const normalizeName = (name) => {
            return name
                .replace(/GUNUNG/g, '')
                .replace(/PLTU/g, '')
                .replace(/\s+/g, '')
                .toUpperCase();
        };

        const map2Obj = Array.from(map2.entries()).map(([k, v]) => ({ original: k, normal: normalizeName(k), coord: v }));

        console.log(`\n--- Cross Checking Coordinates (Smart Mapping) ---`);
        let matchCount = 0;
        let mismatchCount = 0;
        let missingIn2Count = 0;

        for (const [gi1, coord1] of map1.entries()) {
            const normal1 = normalizeName(gi1);

            // Cari di Map 2 menggunakan nama yang dinormalisasi
            const match2 = map2Obj.find(m => m.normal === normal1);

            if (match2) {
                const coord2 = match2.coord;
                if (coord1 === coord2) {
                    matchCount++;
                } else {
                    console.log(`[MISMATCH] ${match2.original} | S1: ${coord1} | S2: ${coord2}`);
                    mismatchCount++;
                }
            } else {
                console.log(`[MISSING_IN_S2] ${gi1}`);
                missingIn2Count++;
            }
        }

        console.log(`\n--- Summary ---`);
        console.log(`Total Unique GIs checked: ${map1.size}`);
        console.log(`Matches                : ${matchCount}`);
        console.log(`Mismatches             : ${mismatchCount}`);
        console.log(`Missing in S2          : ${missingIn2Count}`);

    } catch (e) {
        console.error("Error API:", e.message);
    }
}

crossCheckCoords();
