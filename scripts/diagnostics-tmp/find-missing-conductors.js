const { google } = require('googleapis');

// Fungsi pembersih nama yang sama seperti dipakai sblmnya
function getBaseLocation(text) {
    if (!text) return "";
    return text.toUpperCase()
        .replace(/GI\s*\d+KV/g, '')
        .replace(/GIS\s*\d+KV/g, '')
        .replace(/GITET\s*\d+KV/g, '')
        .replace(/-\d+/g, '')
        .replace(/#\d+/g, '')
        .replace(/\s\d+$/g, '')
        .replace(/PENGHANTAR/g, '')
        .replace(/PHT/g, '')
        .replace(/150KV/gi, '')
        .replace(/70KV/gi, '')
        .replace(/500KV/gi, '')
        .replace(/\s+/g, '')
        .trim();
}

async function findMissingConductorsInMatchedBays() {
    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: '/home/server-01/Workspace/GCP Project/Dashboard-UPT-Bogor/Google Auth/automaticspreadsheet-de108e1d5b56.json',
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });

        const sheets = google.sheets({ version: 'v4', auth });
        const spreadsheetId = '1A-x4WiaSazBdtx051TdhCBqNKpPpcbMWVFVyWSFUdo4';

        // 1. Build Transmisi Map
        const resTrans = await sheets.spreadsheets.values.get({ spreadsheetId, range: "'TRANSMISI'!A1:Z500" });
        const rowsTrans = resTrans.data.values || [];
        const headersTrans = rowsTrans[0] || [];

        let transDariIdx = headersTrans.findIndex(h => h.toLowerCase() === 'dari');
        let transKeIdx = headersTrans.findIndex(h => h.toLowerCase() === 'ke');
        let transJenisIdx = headersTrans.findIndex(h => h.toLowerCase().includes('jenis sutt') || h.toLowerCase().includes('sutt/sutet/sktt'));
        let transBahanIdx = headersTrans.findIndex(h => h.toLowerCase().includes('bahan')); // kolom bahan konduktor

        const routeMap = new Map();

        if (transDariIdx !== -1 && transKeIdx !== -1) {
            rowsTrans.slice(1).forEach(row => {
                if (row.length === 0) return;
                const dari = (row[transDariIdx] || "").trim();
                const ke = (row[transKeIdx] || "").trim();
                const jenis = transJenisIdx !== -1 ? (row[transJenisIdx] || "UNKNOWN").trim().toUpperCase() : "UNKNOWN";
                const bahan = transBahanIdx !== -1 ? (row[transBahanIdx] || "TIDAK ADA DATA").trim() : "TIDAK ADA DATA";

                if (dari && ke) {
                    const baseA = getBaseLocation(dari);
                    const baseB = getBaseLocation(ke);
                    if (baseA && baseB) {
                        const routeKey = [baseA, baseB].sort().join("<->");
                        routeMap.set(routeKey, { jenis, bahan, rawRute: `${dari} <-> ${ke}` });
                    }
                }
            });
        }

        // 2. Scan BAY sheet
        const resBay = await sheets.spreadsheets.values.get({ spreadsheetId, range: "'BAY'!A1:Z1000" });
        const rowsBay = resBay.data.values || [];
        const headersBay = rowsBay[0] || [];

        let bayGIIdx = headersBay.findIndex(h => h.toLowerCase().includes('gardu induk') || h.toLowerCase().includes('nama gi/gis'));
        let bayNameIdx = headersBay.findIndex(h => h.toLowerCase() === 'nama bay' || h.toLowerCase() === 'master bay');
        let bayFuncIdx = headersBay.findIndex(h => h.toLowerCase() === 'bay function');
        let condIdx = headersBay.findIndex(h => h.toLowerCase().includes('konduktor'));

        let faultyBays = [];

        rowsBay.slice(1).forEach((row, rowIndex) => {
            const func = (row[bayFuncIdx] || "").trim().toLowerCase();
            const bayName = (row[bayNameIdx] || "").trim();
            const giName = (row[bayGIIdx] || "").trim();
            const konduktor = condIdx !== -1 ? (row[condIdx] || "").trim() : "";

            const isBlankConductor = konduktor === "" || konduktor === "-" || konduktor === "BELUM ADA";
            const isPenghantarLike = func.includes('penghantar') || func.includes('t/l bay');

            // Kita cari HANYA Bay Penghantar yang:
            // 1. Konduktornya KOSONG di sheet BAY
            // 2. TAPI ternyata PUNYA rute di sheet TRANSMISI (berarti harusnya punya info konduktor)
            if (isPenghantarLike && isBlankConductor) {
                const baseGI = getBaseLocation(giName);
                const baseDest = getBaseLocation(bayName);

                if (baseGI && baseDest) {
                    const routeKey = [baseGI, baseDest].sort().join("<->");
                    const routeData = routeMap.get(routeKey);

                    if (routeData) {
                        faultyBays.push({
                            gi: giName,
                            bay: bayName,
                            expectedBahan: routeData.bahan,
                            ruteTransmisi: routeData.rawRute,
                            rowExcel: rowIndex + 2 // +2 karena slice(1) dan 1-based row index
                        });
                    }
                }
            }
        });

        console.log(`\n=================== DAFTAR BAY PENGHANTAR YANG "LUPA" DICATAT KONDUKTORNYA ===================`);
        console.log(`Total ditemukan: ${faultyBays.length} Bay (Konduktor kosong di BAY, tapi sebenarnya tercatat di TRANSMISI)\n`);

        faultyBays.forEach((b, i) => {
            console.log(`${("" + (i + 1)).padStart(2, "0")}. GI: ${b.gi.padEnd(25)} | Bay: ${b.bay.padEnd(28)}`);
            console.log(`    ⚠️ Status  : Di Master Bay kolom konduktor kosong ("-")`);
            console.log(`    🔍 Solusi  : Harusnya diisi konduktor tipe "[ ${b.expectedBahan} ]" (berdasarkan sheet Transmisi jalur ${b.ruteTransmisi})`);
            console.log(`    📋 Baris   : Cek Sheet BAY baris ke-${b.rowExcel}\n`);
        });

    } catch (error) {
        console.error("Error:", error.message);
    }
}

findMissingConductorsInMatchedBays();
