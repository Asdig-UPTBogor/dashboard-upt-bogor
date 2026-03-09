const { google } = require('googleapis');
const path = require('path');

const credentialsPath = path.join(__dirname, '../../../Google Auth/automaticspreadsheet-de108e1d5b56.json');
const auth = new google.auth.GoogleAuth({
    keyFile: credentialsPath,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

async function main() {
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = '1vpVUczVs8GB-VHbqxrHpl-EZI66HO2e2fWdU3qfLzeI';

    try {
        const meta = await sheets.spreadsheets.get({ spreadsheetId });
        const giSheet = meta.data.sheets.find(s => s.properties.title === 'Master Gardu Induk');
        const baySheet = meta.data.sheets.find(s => s.properties.title === 'Master Bay');

        // 1. Clear previous messy columns (G:L)
        console.log("Clearing old multi-column IDs...");
        await sheets.spreadsheets.values.clear({
            spreadsheetId,
            range: `'Master Gardu Induk'!G:L`
        });
        await sheets.spreadsheets.values.clear({
            spreadsheetId,
            range: `'Master Bay'!G:M`
        });

        // 2. Check headers to see if we need to insert Column A
        const giRes = await sheets.spreadsheets.values.get({ spreadsheetId, range: `'Master Gardu Induk'!A:F` });
        const giRows = giRes.data.values || [];
        let giNeedsInsert = giRows.length > 0 && giRows[0][0] !== 'ID_GI';

        const bayRes = await sheets.spreadsheets.values.get({ spreadsheetId, range: `'Master Bay'!A:F` });
        const bayRows = bayRes.data.values || [];
        let bayNeedsInsert = bayRows.length > 0 && bayRows[0][0] !== 'ID_BAY';

        const requests = [];
        if (giNeedsInsert) {
            requests.push({
                insertDimension: {
                    range: { sheetId: giSheet.properties.sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: 1 },
                    inheritFromBefore: false
                }
            });
        }
        if (bayNeedsInsert) {
            requests.push({
                insertDimension: {
                    range: { sheetId: baySheet.properties.sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: 1 },
                    inheritFromBefore: false
                }
            });
        }

        if (requests.length > 0) {
            console.log("Inserting new Column A for ID...");
            await sheets.spreadsheets.batchUpdate({
                spreadsheetId,
                resource: { requests }
            });
            // Refetch after insert
        }

        // 3. Generate IDs
        let dictUPT = { 'BOGOR': '1' };
        let dictULTG = { 'BOGOR': '1', 'SUKABUMI': '2' };
        let dictTypeBay = { 'Trafo': 'T', 'Penghantar': 'L', 'Busbar': 'B', 'Kopel': 'C', 'Capacitor': 'C' };

        // Fetch fresh data now that Column A is the ID column (or empty new column)
        const freshGiRes = await sheets.spreadsheets.values.get({ spreadsheetId, range: `'Master Gardu Induk'!B:G` });
        const freshGiRows = freshGiRes.data.values || [];

        const giDataToWrite = [['ID_GI']];
        const ultgGICounter = {};
        const giMap = {};

        // Because we inserted a column, UPT is now in B (index 0 of freshGiRows), ULTG in C(1), GI in D(2)
        for (let i = 1; i < freshGiRows.length; i++) {
            const uptName = freshGiRows[i][0] ? freshGiRows[i][0].toUpperCase() : '';
            const ultgName = freshGiRows[i][1] ? freshGiRows[i][1].toUpperCase() : '';
            const giName = freshGiRows[i][2] ? freshGiRows[i][2].trim() : '';

            const id_upt = dictUPT[uptName] || '1';
            const id_ultg = dictULTG[ultgName] || '1';

            const ultgKey = `${id_upt}-${id_ultg}`;
            if (!ultgGICounter[ultgKey]) ultgGICounter[ultgKey] = 1;

            const id_gi = String(ultgGICounter[ultgKey]++).padStart(2, '0');
            const id_gabung_gi = `${id_upt}-${id_ultg}-${id_gi}`;

            giMap[giName.toUpperCase()] = { id_upt, id_ultg, id_gi, id_gabung_gi };
            giDataToWrite.push([id_gabung_gi]);
        }

        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `'Master Gardu Induk'!A1:A${giDataToWrite.length}`,
            valueInputOption: 'USER_ENTERED',
            resource: { values: giDataToWrite }
        });

        const freshBayRes = await sheets.spreadsheets.values.get({ spreadsheetId, range: `'Master Bay'!B:G` });
        const freshBayRows = freshBayRes.data.values || [];

        const bayDataToWrite = [['ID_BAY']];
        const bayCounter = {};

        for (let i = 1; i < freshBayRows.length; i++) {
            // UPT (0), ULTG (1), GI (2), Master Bay (3), Bay Function (4), Type Bay (5)
            const giName = freshBayRows[i][2] ? freshBayRows[i][2].trim().toUpperCase() : '';
            const typeBayName = freshBayRows[i][5] ? freshBayRows[i][5].trim() : '';

            const giInfo = giMap[giName] || { id_gabung_gi: '1-1-99' };
            const id_type_bay = dictTypeBay[typeBayName] || 'X';

            const counterKey = `${giInfo.id_gabung_gi}-${id_type_bay}`;
            if (!bayCounter[counterKey]) bayCounter[counterKey] = 1;

            const id_bay = String(bayCounter[counterKey]++).padStart(3, '0');
            const id_gabung_bay = `${giInfo.id_gabung_gi}-${id_type_bay}-${id_bay}`;

            bayDataToWrite.push([id_gabung_bay]);
        }

        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `'Master Bay'!A1:A${bayDataToWrite.length}`,
            valueInputOption: 'USER_ENTERED',
            resource: { values: bayDataToWrite }
        });

        console.log("Successfully wrote clean Single-Column IDs!");

    } catch (e) {
        console.error(e);
    }
}

main();
