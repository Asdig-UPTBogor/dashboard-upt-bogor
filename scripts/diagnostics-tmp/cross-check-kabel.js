const { google } = require('googleapis');

async function crossCheckTransmisi() {
    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: '/home/server-01/Workspace/GCP Project/Dashboard-UPT-Bogor/Google Auth/automaticspreadsheet-de108e1d5b56.json',
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });

        const sheets = google.sheets({ version: 'v4', auth });
        const spreadsheetId = '1A-x4WiaSazBdtx051TdhCBqNKpPpcbMWVFVyWSFUdo4';

        console.log("Fetching Spreadsheet Data...");

        const resBay = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: "'BAY'!A1:Z500"
        });
        const rowsBay = resBay.data.values || [];
        const headersBay = rowsBay[0] || [];

        const resTransmisi = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: "'TRANSMISI'!A1:Z500"
        });
        const rowsTransmisi = resTransmisi.data.values || [];
        const headersTransmisi = rowsTransmisi[0] || [];

        console.log(`\n=== SHEET BAY (Total ${rowsBay.length - 1} baris) ===`);

        let bayGIIdx = headersBay.findIndex(h => h.toLowerCase().includes('gardu induk') || h.toLowerCase().includes('nama gi/gis'));
        let bayNameIdx = headersBay.findIndex(h => h.toLowerCase() === 'nama bay' || h.toLowerCase() === 'master bay');
        let bayFuncIdx = headersBay.findIndex(h => h.toLowerCase() === 'bay function');

        console.log(`\n=== SHEET TRANSMISI (Total ${rowsTransmisi.length - 1} baris) ===`);

        let transDariIdx = headersTransmisi.findIndex(h => h.toLowerCase() === 'dari');
        let transKeIdx = headersTransmisi.findIndex(h => h.toLowerCase() === 'ke');
        let transJenisIdx = headersTransmisi.findIndex(h => h.toLowerCase().includes('jenis sutt') || h.toLowerCase().includes('sutt/sutet/sktt'));

        const transmisiSet = [];
        let totalKabel = 0;
        let totalUdara = 0;

        if (transDariIdx !== -1 && transKeIdx !== -1 && transJenisIdx !== -1) {
            rowsTransmisi.slice(1).forEach(row => {
                if (row.length === 0) return;
                const dari = (row[transDariIdx] || "").trim();
                const ke = (row[transKeIdx] || "").trim();
                const jenis = (row[transJenisIdx] || "").trim().toUpperCase();

                const nama = `${dari} - ${ke}`;

                if (dari && ke && jenis) {
                    transmisiSet.push({ nama, jenis, dari, ke });
                    if (jenis.includes('SKTT') || jenis.includes('KABEL')) totalKabel++;
                    else if (jenis.includes('SUTT') || jenis.includes('SUTET') || jenis.includes('UDARA')) totalUdara++;
                }
            });

            console.log(`\n--- Analisis Kolom "Jenis Transmisi" di Sheet TRANSMISI ---`);
            console.log(`Total SKTT (Kabel) terdeteksi: ${totalKabel}`);
            console.log(`Total SUTT/SUTET (Udara) terdeteksi: ${totalUdara}`);
        } else {
            console.log(`⚠️ Tidak bisa menemukan kolom Dari/Ke/Jenis. transDariIdx: ${transDariIdx}, transKeIdx: ${transKeIdx}, transJenisIdx: ${transJenisIdx}`);
        }

        console.log(`\n--- Analisis Silang ke Sheet BAY ---`);
        let matchKabelCount = 0;
        let kabelBays = [];

        rowsBay.slice(1).forEach(row => {
            const func = (row[bayFuncIdx] || "").trim().toLowerCase();
            const bayName = (row[bayNameIdx] || "").trim();
            const giName = (row[bayGIIdx] || "").trim();

            if (func.includes('penghantar') || func.includes('t/l bay')) {
                // Heuristic matching
                const cleanBay = bayName.toLowerCase().replace('penghantar', '').replace('sutt', '').replace('sktt', '').trim();
                const words = cleanBay.split(' ').filter(w => w.length > 3); // Significant words

                let isKabel = false;
                let matchingTransmisi = null;

                // 1. Direct word match
                if (bayName.toLowerCase().includes('sktt') || bayName.toLowerCase().includes('kabel')) {
                    isKabel = true;
                } else if (words.length > 0) {
                    // Try to match keywords against transmisi
                    const hit = transmisiSet.find(t =>
                        words.some(w => t.dari.toLowerCase().includes(w) || t.ke.toLowerCase().includes(w))
                    );
                    if (hit && (hit.jenis.includes('SKTT') || hit.jenis.includes('KABEL'))) {
                        isKabel = true;
                        matchingTransmisi = hit;
                    }
                }

                if (isKabel) {
                    let logStr = `[${giName}] Bay: "${bayName}"`;
                    if (matchingTransmisi) logStr += ` -> Relasi dgn Transmisi: [${matchingTransmisi.nama}] (${matchingTransmisi.jenis})`;
                    else logStr += ` -> Relasi Langsung dari Teks`;

                    kabelBays.push(logStr);
                    matchKabelCount++;
                }
            }
        });

        console.log(`Total Bay Penghantar Kabel (SKTT) yang berhasil dipetakan: ${matchKabelCount}`);
        if (matchKabelCount > 0) {
            console.log("Daftar Bay Kabel:");
            kabelBays.forEach(k => console.log("   - " + k));
        }

    } catch (error) {
        console.error("Error:", error.message);
    }
}

crossCheckTransmisi();
