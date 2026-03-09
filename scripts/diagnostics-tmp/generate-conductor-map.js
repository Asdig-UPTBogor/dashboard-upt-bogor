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

async function generateConductorMap() {
    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: '/home/server-01/Workspace/GCP Project/Dashboard-UPT-Bogor/Google Auth/automaticspreadsheet-de108e1d5b56.json',
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });
        const sheets = google.sheets({ version: 'v4', auth });

        // 1. Get Transmisi Data (Source of Truth for Conductors)
        const spreadsheetIdTransmisi = '1A-x4WiaSazBdtx051TdhCBqNKpPpcbMWVFVyWSFUdo4';
        const resTrans = await sheets.spreadsheets.values.get({
            spreadsheetId: spreadsheetIdTransmisi,
            range: "'TRANSMISI'!A1:Z500"
        });
        const rowsTrans = resTrans.data.values || [];
        const headersTrans = rowsTrans[0] || [];

        let transDariIdx = headersTrans.findIndex(h => h.toLowerCase() === 'dari');
        let transKeIdx = headersTrans.findIndex(h => h.toLowerCase() === 'ke');
        let transBahanIdx = headersTrans.findIndex(h => h.toLowerCase().includes('bahan'));
        let transLuasIdx = headersTrans.findIndex(h => h.toLowerCase().includes('luas penampang'));
        let transPanjangIdx = headersTrans.findIndex(h => h.toLowerCase().includes('panjang sirkit'));

        const routeMap = new Map();

        rowsTrans.slice(1).forEach(row => {
            if (row.length === 0) return;
            const dari = (row[transDariIdx] || "").trim();
            const ke = (row[transKeIdx] || "").trim();
            const bahan = transBahanIdx !== -1 ? (row[transBahanIdx] || "").trim() : "";
            const luas = transLuasIdx !== -1 ? (row[transLuasIdx] || "").trim() : "";
            const panjang = transPanjangIdx !== -1 ? (row[transPanjangIdx] || "").trim() : "";

            if (dari && ke && bahan) {
                const baseA = getBaseLocation(dari);
                const baseB = getBaseLocation(ke);
                if (baseA && baseB) {
                    const routeKey = [baseA, baseB].sort().join("<->");
                    // Simpan data konduktor lengkap
                    routeMap.set(routeKey, {
                        bahan: bahan,
                        luas: luas,
                        panjang: panjang,
                        jalur: `${dari} <-> ${ke}`
                    });
                }
            }
        });

        // 2. Get Bay Data (Target for Mapping)
        const spreadsheetIdBay = '1wh2ckkEaovH2MueQDXEG1u7HDenry5_D37JpdvqNWak';
        const resBay = await sheets.spreadsheets.values.get({
            spreadsheetId: spreadsheetIdBay,
            range: "'Master Bay'!A1:Z1000"
        });
        const rowsBay = resBay.data.values || [];

        let bayGIIdx = 2;   // Col C
        let bayNameIdx = 3; // Col D
        let funcIdx = 4;    // Col E
        let typeIdx = 5;    // Col F

        const exactMatches = [];
        const missingMatches = [];

        rowsBay.slice(1).forEach(row => {
            const func = (row[funcIdx] || "").trim().toLowerCase();
            const typeBay = (row[typeIdx] || "").trim();

            // Fokus hanya ke bay Penghantar / Saluran Udara / Kabel
            if (func.includes('penghantar') || func.includes('t/l bay') ||
                typeBay.includes('Penghantar') || typeBay.includes('Kabel') || typeBay.includes('Udara')) {

                const giName = (row[bayGIIdx] || "").trim();
                const bayName = (row[bayNameIdx] || "").trim();

                const baseGI = getBaseLocation(giName);
                const baseDest = getBaseLocation(bayName);

                if (baseGI && baseDest) {
                    const routeKey = [baseGI, baseDest].sort().join("<->");
                    const routeData = routeMap.get(routeKey);

                    if (routeData) {
                        exactMatches.push({
                            gi: giName,
                            bay: bayName,
                            type: typeBay,
                            bahan: routeData.bahan,
                            luas: routeData.luas,
                            panjang: routeData.panjang
                        });
                    } else {
                        missingMatches.push({ gi: giName, bay: bayName });
                    }
                }
            }
        });

        console.log(`\n=================== HASIL MAPPING KONDUKTOR ===================`);
        console.log(`Total Bay tipe Penghantar diproses: ${exactMatches.length + missingMatches.length}`);
        console.log(`Berhasil mendapatkan spesifikasi konduktor: ${exactMatches.length} Bay`);
        console.log(`Gagal mendapat spesifikasi konduktor (jalur nyebrang): ${missingMatches.length} Bay\n`);

        console.log("--- SAMPEL 15 BAY YANG BERHASIL DIISI KONDUKTOR DENGAN SEMPURNA ---");
        exactMatches.slice(0, 15).forEach(m => {
            console.log(`📍 GI: ${m.gi.padEnd(25)} | Bay: ${m.bay.padEnd(28)}`);
            console.log(`   └─> Type: ${m.type.padEnd(25)} | Konduktor: [ ${m.bahan} - ${m.luas} mm2 ] (P: ${m.panjang} kms)\n`);
        });

        // Simpan jumlah kabel XLPE
        let countXLPE = exactMatches.filter(m => m.bahan.toUpperCase().includes("XLPE")).length;
        console.log(`✅ INFO: Terdapat ${countXLPE} Bay dengan Konduktor tipe XLPE (Kabel Tanah / SKTT)`);

    } catch (error) {
        console.error("Error:", error.message);
    }
}

generateConductorMap();
