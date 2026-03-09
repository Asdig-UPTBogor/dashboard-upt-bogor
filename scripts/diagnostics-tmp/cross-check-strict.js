const { google } = require('googleapis');

// Helper to normalize GI names for reliable text matching
// Ex: "GI 150KV BOJONG GEDE" -> "BOJONG GEDE"
// Ex: "BOGORKOTA-1" -> "BOGOR KOTA"
function normalizeGI(name) {
    if (!name) return "";
    let clean = name.toUpperCase()
        .replace(/GI\s*\d+KV/g, '')
        .replace(/GIS\s*\d+KV/g, '')
        .replace(/GITET\s*\d+KV/g, '')
        .replace(/-/g, ' ')
        .replace(/#\d+/g, '') // Remove #1, #2
        .replace(/\s+/g, '') // remove all spaces for exact string match
        .trim();
    return clean;
}

// Extract destination from Bay Name
// Ex: "PHT 150kV KEDUNGBADAK#1" -> "KEDUNGBADAK"
// Ex: "PHT KEDUNGBADAK#2" -> "KEDUNGBADAK"
function extractDestinationFromBay(bayName) {
    if (!bayName) return "";
    let dest = bayName.toUpperCase()
        .replace(/PENGHANTAR/g, '')
        .replace(/PHT/g, '')
        .replace(/150KV/gi, '')
        .replace(/70KV/gi, '')
        .replace(/500KV/gi, '')
        .replace(/#\d+/g, '')
        .replace(/-/g, '')
        .replace(/\s+/g, '')
        .trim();
    return dest;
}

async function crossCheckStrict() {
    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: '/home/server-01/Workspace/GCP Project/Dashboard-UPT-Bogor/Google Auth/automaticspreadsheet-de108e1d5b56.json',
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });

        const sheets = google.sheets({ version: 'v4', auth });
        const spreadsheetId = '1A-x4WiaSazBdtx051TdhCBqNKpPpcbMWVFVyWSFUdo4';

        // 1. Ambil data TRANSMISI
        const resTrans = await sheets.spreadsheets.values.get({ spreadsheetId, range: "'TRANSMISI'!A1:Z500" });
        const rowsTrans = resTrans.data.values || [];
        const headersTrans = rowsTrans[0] || [];

        let transDariIdx = headersTrans.findIndex(h => h.toLowerCase() === 'dari');
        let transKeIdx = headersTrans.findIndex(h => h.toLowerCase() === 'ke');
        let transJenisIdx = headersTrans.findIndex(h => h.toLowerCase().includes('jenis sutt') || h.toLowerCase().includes('sutt/sutet/sktt'));

        const validTransmissions = [];

        if (transDariIdx !== -1 && transKeIdx !== -1) {
            rowsTrans.slice(1).forEach(row => {
                if (row.length === 0) return;
                const dari = (row[transDariIdx] || "").trim();
                const ke = (row[transKeIdx] || "").trim();
                const jenis = transJenisIdx !== -1 ? (row[transJenisIdx] || "").trim().toUpperCase() : "UNKNOWN";

                if (dari && ke) {
                    validTransmissions.push({
                        rawDari: dari,
                        rawKe: ke,
                        normDari: normalizeGI(dari),
                        normKe: normalizeGI(ke),
                        jenis: jenis
                    });
                }
            });
            console.log("=== SEMUA DAFTAR TRANSMISI YANG ADA DI SHEET TRANSMISI ===");
            console.log(validTransmissions.map(t => `${t.normDari} <-> ${t.normKe} (${t.jenis})`));
        }

        // 2. Ambil data BAY
        const resBay = await sheets.spreadsheets.values.get({ spreadsheetId, range: "'BAY'!A1:Z1000" });
        const rowsBay = resBay.data.values || [];
        const headersBay = rowsBay[0] || [];

        let bayGIIdx = headersBay.findIndex(h => h.toLowerCase().includes('gardu induk') || h.toLowerCase().includes('nama gi/gis'));
        let bayNameIdx = headersBay.findIndex(h => h.toLowerCase() === 'nama bay' || h.toLowerCase() === 'master bay');
        let bayFuncIdx = headersBay.findIndex(h => h.toLowerCase() === 'bay function');

        const matchedKabel = [];
        const matchedUdara = [];
        const unmatched = [];
        let totalPenghantar = 0;

        rowsBay.slice(1).forEach(row => {
            const func = (row[bayFuncIdx] || "").trim().toLowerCase();
            const bayName = (row[bayNameIdx] || "").trim();
            const giName = (row[bayGIIdx] || "").trim();

            if (func.includes('penghantar') || func.includes('t/l bay')) {
                totalPenghantar++;
                const normAsal = normalizeGI(giName);
                const normTujuan = extractDestinationFromBay(bayName);

                // Cari di array Transmisi: (Dari==Asal && Ke==Tujuan) ATAU (Dari==Tujuan && Ke==Asal)
                const hit = validTransmissions.find(t =>
                    (t.normDari === normAsal && t.normKe === normTujuan) ||
                    (t.normKe === normAsal && t.normDari === normTujuan)
                );

                const infoStr = `GI asal: [${giName}] -> Bay: "${bayName}"`;

                if (hit) {
                    const matchInfo = `${infoStr}  >>  MATCH Jalur: ${hit.rawDari} - ${hit.rawKe} (${hit.jenis})`;
                    if (hit.jenis.includes('SKTT') || hit.jenis.includes('KABEL')) {
                        matchedKabel.push(matchInfo);
                    } else {
                        matchedUdara.push(matchInfo);
                    }
                } else {
                    unmatched.push(`${infoStr}  >>  TIDAK COCOK. (Sistem mencari jalur ${normAsal} <-> ${normTujuan} di Sheet Transmisi, tapi tidak ada)`);
                }
            }
        });

        console.log(`\n=== HASIL AUDIT RELASI (BAY vs TRANSMISI) ===`);
        console.log(`Total Bay fungsi Penghantar yang dianalisa: ${totalPenghantar}`);
        console.log(`1. COCOK dengan Transmisi SKTT (Kabel) : ${matchedKabel.length} Bay`);
        console.log(`2. COCOK dengan Transmisi SUTT (Udara) : ${matchedUdara.length} Bay`);
        console.log(`3. TIDAK COCOK (Tidak ada di Transmisi)  : ${unmatched.length} Bay`);

        if (matchedKabel.length > 0) {
            console.log(`\n--- DAFTAR YANG COCOK KABEL ---`);
            matchedKabel.forEach(m => console.log(m));
        }

        if (unmatched.length > 0) {
            console.log(`\n--- DAFTAR YANG TIDAK COCOK ---`);
            unmatched.slice(0, 15).forEach(m => console.log(m));
            if (unmatched.length > 15) console.log(`... dan ${unmatched.length - 15} data lainnya.`);
        }

    } catch (error) {
        console.error("Error:", error.message);
    }
}

crossCheckStrict();
