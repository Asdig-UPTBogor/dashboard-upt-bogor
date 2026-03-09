const { google } = require('googleapis');

async function getSemenLamaTransmisi() {
    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: '/home/server-01/Workspace/GCP Project/Dashboard-UPT-Bogor/Google Auth/automaticspreadsheet-de108e1d5b56.json',
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });

        const sheets = google.sheets({ version: 'v4', auth });
        const spreadsheetId = '1A-x4WiaSazBdtx051TdhCBqNKpPpcbMWVFVyWSFUdo4';

        const resTrans = await sheets.spreadsheets.values.get({ spreadsheetId, range: "'TRANSMISI'!A1:Z500" });
        const rowsTrans = resTrans.data.values || [];
        const headersTrans = rowsTrans[0] || [];

        console.log(`Menemukan Header Transmisi: [${headersTrans.join(" | ")}]`);
        console.log("\n=== RINCIAN JALUR SEMEN LAMA DI SHEET TRANSMISI ===");

        let count = 1;
        rowsTrans.slice(1).forEach((row) => {
            const rowStr = row.join(" ").toUpperCase();
            if (rowStr.includes("SEMEN LAMA")) {
                console.log(`--- JALUR DITEMUKAN ---`);
                headersTrans.forEach((header, idx) => {
                    const val = row[idx] || "KOSONG";
                    console.log(`${header.padEnd(25)} : ${val}`);
                });
                count++;
            }
        });

    } catch (error) {
        console.error("Error:", error.message);
    }
}

getSemenLamaTransmisi();
