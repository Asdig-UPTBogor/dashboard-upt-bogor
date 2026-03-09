const { google } = require('googleapis');

// Fungsi pembersih tingkat tinggi khusus untuk Trafo
function getPureTrafoName(text) {
    if (!text) return "";
    let clean = text.toUpperCase()
        .replace(/\s+/g, '') // Hapus semua spasi
        .replace(/150\/20KV/g, '') // Hapus spek tegangan
        .replace(/150\/70KV/g, '')
        .replace(/70\/20KV/g, '')
        .replace(/500\/150KV/g, '')
        .replace(/\(INC\)/g, '') // Hapus status INC
        .replace(/\(LV\)/g, '') // Hapus status LV
        .replace(/KV/g, '') // Hapus satuan KV
        .replace(/TRAFO/g, 'TRF') // Normalisasi TRAFO jadi TRF
        .replace(/TRANSFORMATOR/g, 'TRF')
        .replace(/-/g, '') // Hapus strip
        .trim();

    // Contoh: "TRF#3150/20KV(INC)" -> "TRF#3"
    // "TRAFO1" -> "TRF1" -> "TRF#1" (kalau bisa dibikin seragam)
    if (clean.includes('TRF') && !clean.includes('#')) {
        clean = clean.replace(/TRF(\d+)/, 'TRF#$1');
    }
    if (clean.includes('IBT') && !clean.includes('#')) {
        clean = clean.replace(/IBT(\d+)/, 'IBT#$1');
    }

    return clean;
}

function getBaseLocation(text) {
    if (!text) return "";
    return text.toUpperCase()
        .replace(/GI\s*\d+KV/g, '')
        .replace(/GIS\s*\d+KV/g, '')
        .replace(/GITET\s*\d+KV/g, '')
        .replace(/\s+/g, '')
        .trim();
}

async function deepCrossCheckTrafo() {
    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: '/home/server-01/Workspace/GCP Project/Dashboard-UPT-Bogor/Google Auth/automaticspreadsheet-de108e1d5b56.json',
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });
        const sheets = google.sheets({ version: 'v4', auth });
        const spreadsheetId = '1A-x4WiaSazBdtx051TdhCBqNKpPpcbMWVFVyWSFUdo4';

        // 1. Ekstrak TRAFO
        const resTrafo = await sheets.spreadsheets.values.get({ spreadsheetId, range: "'TRAFO'!A1:Z500" });
        const rowsTrafo = resTrafo.data.values || [];

        let trafoGiIdx = 3;
        let trafoBayIdx = 4;

        // Set untuk menyimpan daftar Bay Trafo yang VALID ada asetnya
        const validTrafoSet = new Set();
        const rawTrafos = [];

        rowsTrafo.slice(1).forEach(row => {
            if (row.length === 0) return;
            const gi = (row[trafoGiIdx] || "").trim();
            const bay = (row[trafoBayIdx] || "").trim();

            if (gi && bay) {
                const pureGI = getBaseLocation(gi);
                const pureBay = getPureTrafoName(bay);
                validTrafoSet.add(`${pureGI}|${pureBay}`);
                rawTrafos.push({ rawGI: gi, rawBay: bay, pure: `${pureGI}|${pureBay}` });
            }
        });

        // 2. Ekstrak BAY
        const resBay = await sheets.spreadsheets.values.get({ spreadsheetId, range: "'BAY'!A1:Z1000" });
        const rowsBay = resBay.data.values || [];
        const headersBay = rowsBay[0] || [];

        let bayGiIdx = headersBay.findIndex(h => h.toLowerCase().includes('nama gi/gis'));
        let bayNameIdx = headersBay.findIndex(h => h.toLowerCase() === 'nama bay' || h.toLowerCase() === 'master bay');
        let funcIdx = headersBay.findIndex(h => h.toLowerCase() === 'bay function');

        let matchedTrafos = [];
        let missingTrafos = [];

        rowsBay.slice(1).forEach((row, idx) => {
            if (row.length === 0) return;
            const giName = (row[bayGiIdx] || "").trim();
            const bayName = (row[bayNameIdx] || "").trim();
            const func = (row[funcIdx] || "").trim().toLowerCase();

            if (func.includes('trafo') || bayName.includes('TRF') || bayName.includes('IBT') || bayName.toUpperCase().includes('TRAFO')) {
                const pureGI = getBaseLocation(giName);
                const pureBay = getPureTrafoName(bayName);
                const searchKey = `${pureGI}|${pureBay}`;

                if (validTrafoSet.has(searchKey)) {
                    matchedTrafos.push(`✅ [MATCH] ${giName} -> ${bayName}`);
                } else {
                    // Fallback fuzzy: jika pure bay-nya terkandung di dalam salah satu raw bay sheet TRAFO di GI yg sama
                    let fuzzyMatched = false;
                    for (let item of rawTrafos) {
                        if (item.pure.startsWith(pureGI)) {
                            // Cek jika purebay "TRF#3" ada di dalam rawBay "Trafo 3 150kV" dsb.
                            if (pureBay.replace(/#/g, '') === getPureTrafoName(item.rawBay).replace(/#/g, '')) {
                                matchedTrafos.push(`⚠️ [FUZZY MATCH] ${giName} -> Master: "${bayName}" disamakan dgn Sheet Trafo: "${item.rawBay}"`);
                                fuzzyMatched = true;
                                break;
                            }
                        }
                    }

                    if (!fuzzyMatched) {
                        missingTrafos.push(`❌ [MISSING] GI: ${giName} | Bay Name: ${bayName} | Clean Name: ${pureBay}`);
                    }
                }
            }
        });

        console.log(`\n=== HASIL RE-EVALUASI MENDALAM: MASTER BAY vs DETAIL TRAFO ===`);
        console.log(`Total Bay tipe Trafo/IBT di Master Bay : ${matchedTrafos.length + missingTrafos.length}`);
        console.log(`✅ Berhasil dicocokkan (Termasuk beda spasi/typo) : ${matchedTrafos.length} Bay`);
        console.log(`❌ Gagal dicocokkan (Tidak ada di Sheet TRAFO)   : ${missingTrafos.length} Bay\n`);

        if (missingTrafos.length > 0) {
            console.log(`--- DETAIL ${missingTrafos.length} BAY TRAFO "HANTU" (ADA DI MASTER BAY, TIDAK ADA DI SHEET TRAFO) ---`);
            missingTrafos.forEach(t => console.log(t));
        }

    } catch (error) {
        console.error("Error:", error.message);
    }
}

deepCrossCheckTrafo();
