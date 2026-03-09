const { google } = require('googleapis');

async function getUGCDetails() {
    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: '/home/server-01/Workspace/GCP Project/Dashboard-UPT-Bogor/Google Auth/automaticspreadsheet-de108e1d5b56.json',
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });

        const sheets = google.sheets({ version: 'v4', auth });
        const spreadsheetId = '1A-x4WiaSazBdtx051TdhCBqNKpPpcbMWVFVyWSFUdo4';

        const resBay = await sheets.spreadsheets.values.get({ spreadsheetId, range: "'BAY'!A1:Z1000" });
        const rowsBay = resBay.data.values || [];
        const headers = rowsBay[0] || [];

        let bayGIIdx = headers.findIndex(h => h.toLowerCase().includes('gardu induk') || h.toLowerCase().includes('nama gi/gis'));
        let bayNameIdx = headers.findIndex(h => h.toLowerCase() === 'nama bay' || h.toLowerCase() === 'master bay');
        let funcIdx = headers.findIndex(h => h.toLowerCase() === 'bay function');
        let condIdx = headers.findIndex(h => h.toLowerCase().includes('konduktor')); // Mencari kolom konduktor

        if (condIdx === -1) {
            // Coba cari kata kunci lain jika "konduktor" tidak ada
            condIdx = headers.findIndex(h => h.toLowerCase().includes('kabel') || h.toLowerCase().includes('penampang'));
        }

        console.log(`Menemukan Header Kolom Pencarian -> GI: [${headers[bayGIIdx]}], Bay: [${headers[bayNameIdx]}], Fungsi: [${headers[funcIdx]}], Konduktor: [${condIdx !== -1 ? headers[condIdx] : 'TIDAK DITEMUKAN'}]`);

        console.log("\n=== RINCIAN BAY UGC ===");
        let count = 1;
        rowsBay.slice(1).forEach((row) => {
            const rowStr = row.join(" ").toUpperCase();
            if (rowStr.includes("UGC")) {
                const gi = row[bayGIIdx] || "-";
                const bay = row[bayNameIdx] || "-";
                const func = row[funcIdx] || "-";
                const konduktor = condIdx !== -1 ? (row[condIdx] || "-") : "-";

                console.log(`${count}. Gardu Induk : ${gi}`);
                console.log(`   Nama Bay    : ${bay}`);
                console.log(`   Bay Function: ${func}`);
                console.log(`   Konduktor   : ${konduktor}`);
                console.log(`   Data Row Lengkap: ${row.filter(v => v.trim() !== "").join(" | ")}\n`);
                count++;
            }
        });

    } catch (error) {
        console.error("Error:", error.message);
    }
}

getUGCDetails();
