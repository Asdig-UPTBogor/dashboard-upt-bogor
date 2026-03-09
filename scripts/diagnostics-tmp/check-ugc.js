const { google } = require('googleapis');

async function checkUGC() {
    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: '/home/server-01/Workspace/GCP Project/Dashboard-UPT-Bogor/Google Auth/automaticspreadsheet-de108e1d5b56.json',
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });

        const sheets = google.sheets({ version: 'v4', auth });
        const spreadsheetId = '1A-x4WiaSazBdtx051TdhCBqNKpPpcbMWVFVyWSFUdo4';

        console.log("Mencari kata kunci 'UGC' di Sheet BAY...");
        const resBay = await sheets.spreadsheets.values.get({ spreadsheetId, range: "'BAY'!A1:Z1000" });
        const rowsBay = resBay.data.values || [];

        let foundBay = false;
        rowsBay.forEach((row, idx) => {
            const rowStr = row.join(" ").toUpperCase();
            if (rowStr.includes("UGC")) {
                console.log(`[Baris ${idx + 1}] Ditemukan di BAY: ${rowStr}`);
                foundBay = true;
            }
        });
        if (!foundBay) console.log("-> Teks 'UGC' TIDAK DITEMUKAN di Sheet BAY.");

        console.log("\nMencari kata kunci 'UGC' di Sheet TRANSMISI...");
        const resTrans = await sheets.spreadsheets.values.get({ spreadsheetId, range: "'TRANSMISI'!A1:Z500" });
        const rowsTrans = resTrans.data.values || [];

        let foundTrans = false;
        rowsTrans.forEach((row, idx) => {
            const rowStr = row.join(" ").toUpperCase();
            if (rowStr.includes("UGC")) {
                console.log(`[Baris ${idx + 1}] Ditemukan di TRANSMISI: ${rowStr}`);
                foundTrans = true;
            }
        });
        if (!foundTrans) console.log("-> Teks 'UGC' TIDAK DITEMUKAN di Sheet TRANSMISI.");

    } catch (error) {
        console.error("Error:", error.message);
    }
}

checkUGC();
