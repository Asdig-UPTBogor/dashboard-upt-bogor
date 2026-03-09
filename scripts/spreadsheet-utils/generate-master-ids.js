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

        // 1. Load Dictionaries
        let dictUPT = { 'BOGOR': '1' }; // Default fallback
        let dictULTG = { 'BOGOR': '1', 'SUKABUMI': '2' };

        // Type Bay mapping standard
        let dictTypeBay = {
            'Trafo': 'T',
            'Penghantar': 'L',
            'Busbar': 'B',
            'Kopel': 'C',
            'Capacitor': 'C'
        };

        console.log("Processing Master Gardu Induk...");
        const giRes = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `'Master Gardu Induk'!A:F`,
        });

        const giRows = giRes.data.values || [];
        const giDataToWrite = [];
        const giHeader = ['ID UPT', 'ID ULTG', 'ID GI', 'ID GABUNG GI'];
        giDataToWrite.push(giHeader);

        // Object to track GI IDs inside each ULTG to generate 01, 02...
        const ultgGICounter = {};

        // Map GI Name -> GI ID Gabung (for Master Bay later)
        const giMap = {};

        for (let i = 1; i < giRows.length; i++) {
            const uptName = giRows[i][0] ? giRows[i][0].toUpperCase() : '';
            const ultgName = giRows[i][1] ? giRows[i][1].toUpperCase() : '';
            const giName = giRows[i][2] ? giRows[i][2].trim() : '';

            const id_upt = dictUPT[uptName] || '1';
            const id_ultg = dictULTG[ultgName] || '1';

            const ultgKey = `${id_upt}-${id_ultg}`;
            if (!ultgGICounter[ultgKey]) ultgGICounter[ultgKey] = 1;

            const id_gi_raw = ultgGICounter[ultgKey]++;
            const id_gi = String(id_gi_raw).padStart(2, '0'); // 01, 02

            const id_gabung_gi = `${id_upt}-${id_ultg}-${id_gi}`;

            giMap[giName.toUpperCase()] = { id_upt, id_ultg, id_gi, id_gabung_gi };

            giDataToWrite.push([id_upt, id_ultg, id_gi, id_gabung_gi]);
        }

        // Write to Master Gardu Induk (Columns G, H, I, J)
        console.log(`Writing ${giDataToWrite.length} rows to Master Gardu Induk (G:J)...`);
        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `'Master Gardu Induk'!G1:J${giDataToWrite.length}`,
            valueInputOption: 'USER_ENTERED',
            resource: { values: giDataToWrite }
        });

        console.log("Processing Master Bay...");
        const bayRes = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `'Master Bay'!A:F`,
        });

        const bayRows = bayRes.data.values || [];
        const bayDataToWrite = [];
        const bayHeader = ['ID UPT', 'ID ULTG', 'ID GI', 'ID Tipe Bay', 'ID Bay', 'ID GABUNG BAY'];
        bayDataToWrite.push(bayHeader);

        // Counter to track Bay IDs within a GI and Type
        const bayCounter = {};

        for (let i = 1; i < bayRows.length; i++) {
            // Handle rows that might not have all columns filled
            const reqRow = [
                bayRows[i][0] || '',
                bayRows[i][1] || '',
                bayRows[i][2] || '',
                bayRows[i][3] || '',
                bayRows[i][4] || '',
                bayRows[i][5] || ''
            ];

            const giName = reqRow[2].trim().toUpperCase();
            const typeBayName = reqRow[5].trim();

            // Lookup GI mapping
            const giInfo = giMap[giName] || { id_upt: '1', id_ultg: '1', id_gi: '99', id_gabung_gi: '1-1-99' };

            let id_type_bay = dictTypeBay[typeBayName] || 'X';

            const counterKey = `${giInfo.id_gabung_gi}-${id_type_bay}`;
            if (!bayCounter[counterKey]) bayCounter[counterKey] = 1;

            const id_bay_raw = bayCounter[counterKey]++;
            const id_bay = String(id_bay_raw).padStart(3, '0'); // 001, 002

            const id_gabung_bay = `${giInfo.id_gabung_gi}-${id_type_bay}-${id_bay}`;

            bayDataToWrite.push([
                giInfo.id_upt,
                giInfo.id_ultg,
                giInfo.id_gi,
                id_type_bay,
                id_bay,
                id_gabung_bay
            ]);
        }

        // Write to Master Bay (Columns G, H, I, J, K, L)
        console.log(`Writing ${bayDataToWrite.length} rows to Master Bay (G:L)...`);
        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `'Master Bay'!G1:L${bayDataToWrite.length}`,
            valueInputOption: 'USER_ENTERED',
            resource: { values: bayDataToWrite }
        });

        console.log("Successfully generated all IDs into the Master sheets!");

    } catch (e) {
        console.error(e);
    }
}

main();
