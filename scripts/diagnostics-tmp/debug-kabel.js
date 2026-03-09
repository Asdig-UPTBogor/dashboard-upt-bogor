const { google } = require('googleapis');

async function debugKabel() {
    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: '/home/server-01/Workspace/GCP Project/Dashboard-UPT-Bogor/Google Auth/automaticspreadsheet-de108e1d5b56.json',
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });

        const sheets = google.sheets({ version: 'v4', auth });
        const spreadsheetId = '1A-x4WiaSazBdtx051TdhCBqNKpPpcbMWVFVyWSFUdo4';

        const resBay = await sheets.spreadsheets.values.get({ spreadsheetId, range: "'BAY'!A1:Z500" });
        const rowsBay = resBay.data.values || [];
        const headersBay = rowsBay[0] || [];

        const resTransmisi = await sheets.spreadsheets.values.get({ spreadsheetId, range: "'TRANSMISI'!A1:Z500" });
        const rowsTransmisi = resTransmisi.data.values || [];
        const headersTransmisi = rowsTransmisi[0] || [];

        let bayGIIdx = headersBay.findIndex(h => h.toLowerCase().includes('gardu induk') || h.toLowerCase().includes('nama gi/gis'));
        let bayNameIdx = headersBay.findIndex(h => h.toLowerCase() === 'nama bay' || h.toLowerCase() === 'master bay');
        let bayFuncIdx = headersBay.findIndex(h => h.toLowerCase() === 'bay function');

        let transDariIdx = headersTransmisi.findIndex(h => h.toLowerCase() === 'dari');
        let transKeIdx = headersTransmisi.findIndex(h => h.toLowerCase() === 'ke');
        let transJenisIdx = headersTransmisi.findIndex(h => h.toLowerCase().includes('jenis sutt') || h.toLowerCase().includes('sutt/sutet/sktt'));

        const skttList = [];

        if (transDariIdx !== -1 && transKeIdx !== -1 && transJenisIdx !== -1) {
            rowsTransmisi.slice(1).forEach(row => {
                if (row.length === 0) return;
                const dari = (row[transDariIdx] || "").trim();
                const ke = (row[transKeIdx] || "").trim();
                const jenis = (row[transJenisIdx] || "").trim().toUpperCase();

                if (jenis.includes('SKTT') || jenis.includes('KABEL')) {
                    skttList.push({ dari, ke, jenis });
                }
            });
            console.log("=== DAFTAR TRANSMISI KABEL (SKTT) ===");
            console.log(skttList);
        }

        console.log(`\n=== DAFTAR NAMA BAY PENGHANTAR DI SHEET "BAY" ===`);
        rowsBay.slice(1).forEach(row => {
            const func = (row[bayFuncIdx] || "").trim().toLowerCase();
            const bayName = (row[bayNameIdx] || "").trim();
            const giName = (row[bayGIIdx] || "").trim();

            if (func.includes('penghantar') || func.includes('t/l bay')) {
                // Try to match manually
                let isMatch = false;
                skttList.forEach(sktt => {
                    // Check if Bay Name contains either "Dari" or "Ke"
                    if (bayName.toLowerCase().includes(sktt.dari.toLowerCase()) ||
                        bayName.toLowerCase().includes(sktt.ke.toLowerCase()) ||
                        sktt.dari.toLowerCase().includes(bayName.toLowerCase().split(' ')[1] || "xxx") ||
                        sktt.ke.toLowerCase().includes(bayName.toLowerCase().split(' ')[1] || "xxx")
                    ) {
                        isMatch = true;
                    }
                });

                // Hanya print yang mungkin nyerempet atau semuanya untuk dianalisa AI
                if (isMatch) {
                    console.log(`[POTENSI SUSPEK KABEL] GI: ${giName} | Bay: ${bayName}`);
                }
            }
        });

        console.log("\nJika log POTENSI SUSPEK KABEL kosong, berarti penamaan di Sheet TRANSMISI sama sekali tidak mirip dengan penamaan di Sheet BAY.");

    } catch (error) {
        console.error("Error:", error.message);
    }
}

debugKabel();
