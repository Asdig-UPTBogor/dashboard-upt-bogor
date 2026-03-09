const { google } = require('googleapis');

function getBaseLocation(text) {
    if (!text) return "";
    return text.toUpperCase()
        .replace(/GI\s*\d+KV/g, '')
        .replace(/GIS\s*\d+KV/g, '')
        .replace(/GITET\s*\d+KV/g, '')
        .replace(/\s+/g, '')
        .trim();
}

function getBaseBay(text) {
    if (!text) return "";
    return text.toUpperCase()
        .replace(/\s+/g, '')
        .trim();
}

async function crossCheckTrafo() {
    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: '/home/server-01/Workspace/GCP Project/Dashboard-UPT-Bogor/Google Auth/automaticspreadsheet-de108e1d5b56.json',
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });
        const sheets = google.sheets({ version: 'v4', auth });
        const spreadsheetId = '1A-x4WiaSazBdtx051TdhCBqNKpPpcbMWVFVyWSFUdo4';

        // 1. Ekstrak Data dari Sheet 'TRAFO' (Data Detail Aset Trafo)
        const resTrafo = await sheets.spreadsheets.values.get({ spreadsheetId, range: "'TRAFO'!A1:Z500" });
        const rowsTrafo = resTrafo.data.values || [];
        const headersTrafo = rowsTrafo[0] || [];

        let trafoGiIdx = 3; // Nama GI/GIS
        let trafoBayIdx = 4; // Nama Bay
        let trafoMerkIdx = headersTrafo.findIndex(h => h.toLowerCase().includes('merk trafo') || h.toLowerCase().replace(/\s/g, '').includes('merk'));

        const trafoMap = new Map();
        rowsTrafo.slice(1).forEach(row => {
            if (row.length === 0) return;
            const gi = (row[trafoGiIdx] || "").trim();
            const bay = (row[trafoBayIdx] || "").trim();
            const merk = (row[trafoMerkIdx] || "").trim();

            if (gi && bay) {
                const mapKey = `${getBaseLocation(gi)}|${getBaseBay(bay)}`;
                trafoMap.set(mapKey, { gi, bay, merk });
            }
        });

        // 2. Ekstrak Data dari Sheet 'BAY' (Master List Bay)
        const resBay = await sheets.spreadsheets.values.get({ spreadsheetId, range: "'BAY'!A1:Z1000" });
        const rowsBay = resBay.data.values || [];
        const headersBay = rowsBay[0] || [];

        let bayGiIdx = headersBay.findIndex(h => h.toLowerCase().includes('nama gi/gis'));
        let bayNameIdx = headersBay.findIndex(h => h.toLowerCase() === 'nama bay' || h.toLowerCase() === 'master bay');
        let funcIdx = headersBay.findIndex(h => h.toLowerCase() === 'bay function');

        let totalTrafoBays = 0;
        let matchedTrafos = [];
        let missingTrafos = [];

        rowsBay.slice(1).forEach((row, idx) => {
            if (row.length === 0) return;
            const giName = (row[bayGiIdx] || "").trim();
            const bayName = (row[bayNameIdx] || "").trim();
            const func = (row[funcIdx] || "").trim().toLowerCase();

            // Saring hanya Bay yang fungsinya Trafo (termasuk IBT, Trafo Distribusi, dll)
            // Bisa dicek lewat 'func' atau 'bayName' yang mengandung kata TRF/IBT/TRAFO
            if (func.includes('trafo') || bayName.includes('TRF') || bayName.includes('IBT') || bayName.toUpperCase().includes('TRAFO')) {
                totalTrafoBays++;

                const mapKey = `${getBaseLocation(giName)}|${getBaseBay(bayName)}`;
                const trafoData = trafoMap.get(mapKey);

                if (trafoData) {
                    matchedTrafos.push(`- **${giName}** (${bayName}) -> Merk: ${trafoData.merk}`);
                } else {
                    missingTrafos.push(`- **${giName}** (${bayName}) -> Baris di Master Bay: ${idx + 2}`);

                    // Coba fuzzy match barangkali cuma typo di spasi
                    let fuzzyMatched = false;
                    for (const [key, val] of trafoMap.entries()) {
                        if (key.includes(getBaseLocation(giName)) && (key.includes(getBaseBay(bayName).replace(/TRF|IBT/g, '')) || getBaseBay(val.bay).includes(getBaseBay(bayName).replace(/TRF|IBT/g, '')))) {
                            // console.log(`   (Fuzzy Match Possible: ${val.bay})`);
                        }
                    }
                }
            }
        });

        console.log(`\n=== HASIL COMPARASI: MASTER BAY vs DETAIL TRAFO ===`);
        console.log(`Total Bay tipe Trafo/IBT di Master Bay: ${totalTrafoBays} Bay`);
        console.log(`✅ Cocok (Ada detailnya di Sheet TRAFO): ${matchedTrafos.length} Bay`);
        console.log(`❌ Tidak Cocok (Mengambang / Tidak ada detail di Sheet TRAFO): ${missingTrafos.length} Bay\n`);

        if (missingTrafos.length > 0) {
            console.log(`--- DAFTAR BAY TRAFO YANG TIDAK ADA DETAILNYA ---`);
            missingTrafos.forEach(t => console.log(t));
        }

    } catch (error) {
        console.error("Error:", error.message);
    }
}

crossCheckTrafo();
