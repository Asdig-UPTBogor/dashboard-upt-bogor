const { google } = require('googleapis');

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

async function checkTransmisiToBayCoverage() {
    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: '/home/server-01/Workspace/GCP Project/Dashboard-UPT-Bogor/Google Auth/automaticspreadsheet-de108e1d5b56.json',
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });
        const sheets = google.sheets({ version: 'v4', auth });
        const spreadsheetId = '1A-x4WiaSazBdtx051TdhCBqNKpPpcbMWVFVyWSFUdo4';

        // 1. Build Bay Set (To check if a Transmisi end exists)
        const resBay = await sheets.spreadsheets.values.get({ spreadsheetId, range: "'BAY'!A1:Z1000" });
        const rowsBay = resBay.data.values || [];
        const headersBay = rowsBay[0] || [];

        let bayGIIdx = headersBay.findIndex(h => h.toLowerCase().includes('gardu induk') || h.toLowerCase().includes('nama gi/gis'));
        let bayNameIdx = headersBay.findIndex(h => h.toLowerCase() === 'nama bay' || h.toLowerCase() === 'master bay');
        let funcIdx = headersBay.findIndex(h => h.toLowerCase() === 'bay function');

        const activeBays = new Set();

        rowsBay.slice(1).forEach(row => {
            if (row.length === 0) return;
            const func = (row[funcIdx] || "").trim().toLowerCase();
            const bayName = (row[bayNameIdx] || "").trim();
            const giName = (row[bayGIIdx] || "").trim();

            // Anggap semua Penghantar, Konsumen (UGC), T/L Bay berpotensi jadi ujung kabel
            if (func.includes('penghantar') || func.includes('t/l bay') || func.includes('konsumen') || func.includes('pembangkit')) {
                const baseGI = getBaseLocation(giName);
                if (baseGI) activeBays.add(baseGI);

                // UGC cases (Semen Lama, dll) handling
                if (bayName.includes('UGC')) {
                    const fakeDest = baseGI === 'SEMENBARU' ? 'SEMENLAMA' : 'UNKNOWN';
                    activeBays.add(fakeDest); // add implicit destination
                }
            }
        });

        // 2. Scan Transmisi Sheet
        const resTrans = await sheets.spreadsheets.values.get({ spreadsheetId, range: "'TRANSMISI'!A1:Z500" });
        const rowsTrans = resTrans.data.values || [];
        const headersTrans = rowsTrans[0] || [];

        let transDariIdx = headersTrans.findIndex(h => h.toLowerCase() === 'dari');
        let transKeIdx = headersTrans.findIndex(h => h.toLowerCase() === 'ke');

        const totalTransmisi = rowsTrans.length - 1; // minus header
        let fullCoverage = 0;
        let partialCoverage = 0;
        let zeroCoverageList = [];

        rowsTrans.slice(1).forEach((row, idx) => {
            const dari = (row[transDariIdx] || "").trim();
            const ke = (row[transKeIdx] || "").trim();

            if (dari && ke) {
                const baseDari = getBaseLocation(dari);
                const baseKe = getBaseLocation(ke);

                // Dianggap punya Penghantar jika SALAH SATU ujungnya (GI-nya) ada di activeBays
                const hasA = activeBays.has(baseDari);
                const hasB = activeBays.has(baseKe);

                // Handling Semen Lama special case where Bay is named "UGC#1"
                if (baseDari === 'SEMENBARU' && baseKe === 'SEMENLAMA') {
                    fullCoverage++;
                } else if (hasA && hasB) {
                    fullCoverage++;
                } else if (hasA || hasB) {
                    partialCoverage++;
                } else {
                    zeroCoverageList.push(`Baris ${idx + 2}: ${dari} <--> ${ke}`);
                }
            }
        });

        console.log(`\n=== PEMERIKSAAN COVERAGE: TRANSMISI -> MASTER BAY ===`);
        console.log(`Total Jalur Transmisi: ${totalTransmisi}`);
        console.log(`✅ Tertutup Sempurna (Kedua ujung / Minimal 1 ujung ada Bay-nya di UPT Bogor) : ${fullCoverage + partialCoverage} Jalur`);
        console.log(`   - Lengkap 2 Ujung (Internal UPT) : ${fullCoverage}`);
        console.log(`   - Sebelah Ujung (Milik UPT Lain) : ${partialCoverage}`);
        console.log(`\n❌ SAMA SEKALI TIDAK ADA PENGHANTARNYA DI MASTER BAY (Gagal Total): ${zeroCoverageList.length} Jalur`);

        if (zeroCoverageList.length > 0) {
            zeroCoverageList.forEach(item => console.log(`   ${item}`));
        } else {
            console.log(`   -> LUAAR BIASA! 100% Seluruh baris di Sheet Transmisi SUDAH PUNYA minimal satu slot Bay Penghantar di Master Bay!`);
        }

    } catch (error) {
        console.error("Error:", error.message);
    }
}

checkTransmisiToBayCoverage();
