const { google } = require('googleapis');

async function getBlankConductors() {
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
        let condIdx = headers.findIndex(h => h.toLowerCase().includes('konduktor'));

        let blankList = [];

        rowsBay.slice(1).forEach((row, idx) => {
            if (row.length === 0) return;
            const func = (row[funcIdx] || "").trim().toLowerCase();
            const konduktor = condIdx !== -1 ? (row[condIdx] || "").trim() : "";
            const isBlank = konduktor === "" || konduktor === "-" || konduktor === "BELUM ADA";

            // Kita cek yg fungsinya sebagai jalur keluar-masuk (Penghantar, T/L Bay, Konsumen, Pembangkit)
            const isPenghantarLike = func.includes('penghantar') || func.includes('t/l bay') || func.includes('pembangkit') || func.includes('konsumen');

            if (isPenghantarLike && isBlank) {
                const gi = row[bayGIIdx] || "-";
                const bay = row[bayNameIdx] || "-";
                blankList.push({ gi, bay, func: row[funcIdx] || "-" });
            }
        });

        console.log(`\n=== DAFTAR BAY PENGHANTAR / KONSUMEN / PEMBANGKIT YANG KONDUKTOR-NYA KOSONG ===`);
        console.log(`Total ditemukan: ${blankList.length} Bay\n`);

        blankList.forEach((b, i) => {
            console.log(`${i + 1}. GI: ${b.gi.padEnd(30)} | Bay: ${b.bay.padEnd(30)} | Fungsi: ${b.func}`);
        });

    } catch (error) {
        console.error("Error:", error.message);
    }
}

getBlankConductors();
