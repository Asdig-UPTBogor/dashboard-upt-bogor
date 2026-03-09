const { google } = require('googleapis');

// Fungsi pembersih teks hanya untuk tujuan pencocokan logika (menghilangkan embel-embel stasiun/kv/nomor)
function cleanText(text) {
    if (!text) return "";
    return text.toUpperCase()
        .replace(/GI\s*\d+KV/g, '')
        .replace(/GIS\s*\d+KV/g, '')
        .replace(/GITET\s*\d+KV/g, '')
        .replace(/PENGHANTAR/g, '')
        .replace(/PHT/g, '')
        .replace(/150KV/gi, '')
        .replace(/70KV/gi, '')
        .replace(/500KV/gi, '')
        .replace(/-\d+/g, '') // Hapus -1, -2
        .replace(/#\d+/g, '') // Hapus #1, #2
        .replace(/\s+/g, '') // Hapus spasi
        .trim();
}

async function checkExactPattern() {
    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: '/home/server-01/Workspace/GCP Project/Dashboard-UPT-Bogor/Google Auth/automaticspreadsheet-de108e1d5b56.json',
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });

        const sheets = google.sheets({ version: 'v4', auth });
        const spreadsheetId = '1A-x4WiaSazBdtx051TdhCBqNKpPpcbMWVFVyWSFUdo4';

        // 1. Ambil Data TRANSMISI
        const resTrans = await sheets.spreadsheets.values.get({ spreadsheetId, range: "'TRANSMISI'!A1:Z500" });
        const rowsTrans = resTrans.data.values || [];
        const headersTrans = rowsTrans[0] || [];

        let transDariIdx = headersTrans.findIndex(h => h.toLowerCase() === 'dari');
        let transKeIdx = headersTrans.findIndex(h => h.toLowerCase() === 'ke');

        // 2. Ambil Data BAY
        const resBay = await sheets.spreadsheets.values.get({ spreadsheetId, range: "'BAY'!A1:Z1000" });
        let rowsBay = resBay.data.values || [];
        const headersBay = rowsBay[0] || [];

        let bayGIIdx = headersBay.findIndex(h => h.toLowerCase().includes('gardu induk') || h.toLowerCase().includes('nama gi/gis'));
        let bayNameIdx = headersBay.findIndex(h => h.toLowerCase() === 'nama bay' || h.toLowerCase() === 'master bay');
        let bayFuncIdx = headersBay.findIndex(h => h.toLowerCase() === 'bay function');

        // Filter bay yang cuma penghantar
        const bayPenghantar = rowsBay.slice(1).filter(row => {
            if (row.length === 0) return false;
            const func = (row[bayFuncIdx] || "").trim().toLowerCase();
            return func.includes('penghantar') || func.includes('t/l bay');
        });

        console.log(`\n=================== BUKTI PATTERN "DARI/KE" vs "MASTER BAY" ===================`);
        console.log(`Mencari 2 pasang Terminal Bay untuk setiap baris Transmisi.\n`);

        let perfectMatches = 0;
        let partialMatches = 0;
        let zeroMatches = 0;

        rowsTrans.slice(1).forEach((row, idx) => {
            if (row.length === 0) return;
            const textDari = (row[transDariIdx] || "").trim();
            const textKe = (row[transKeIdx] || "").trim();

            if (!textDari || !textKe) return;

            const cleanDari = cleanText(textDari);
            const cleanKe = cleanText(textKe);

            // Kita cari Bay Ujung A (GI = Dari, Bay Name mengandung Ke)
            const matchedBayA = bayPenghantar.find(b => {
                const gi = cleanText(b[bayGIIdx] || "");
                const name = cleanText(b[bayNameIdx] || "");
                return (gi.includes(cleanDari) || cleanDari.includes(gi)) &&
                    (name.includes(cleanKe) || cleanKe.includes(name));
            });

            // Kita cari Bay Ujung B (GI = Ke, Bay Name mengandung Dari)
            const matchedBayB = bayPenghantar.find(b => {
                const gi = cleanText(b[bayGIIdx] || "");
                const name = cleanText(b[bayNameIdx] || "");
                return (gi.includes(cleanKe) || cleanKe.includes(gi)) &&
                    (name.includes(cleanDari) || cleanDari.includes(name));
            });

            let status = "";
            let isPartialOrZero = false;
            if (matchedBayA && matchedBayB) {
                perfectMatches++;
                status = "✅ PERFECT (2 Ujung Ketemu)";
            } else if (matchedBayA || matchedBayB) {
                partialMatches++;
                status = "⚠️ PARTIAL (Cuma 1 Ujung Ketemu, ujung sebelahnya milik tetangga)";
                isPartialOrZero = true;
            } else {
                zeroMatches++;
                status = "❌ GAGAL TOTAL (Tidak ada ujung yang ketemu sama sekali)";
                isPartialOrZero = true;
            }

            if (isPartialOrZero) {
                console.log(`\n--- Transmisi Jalur ${idx + 1}: [${textDari}] <--> [${textKe}] --- Status: ${status}`);

                if (matchedBayA) {
                    console.log(`   Ujung A: Ketemu ✅ di GI="${matchedBayA[bayGIIdx]}" | Master Bay="${matchedBayA[bayNameIdx]}"`);
                } else {
                    console.log(`   Ujung A: ❌ Tidak ketemu bay di Master Data GI wilayah "${textDari}" yang mengarah ke "${textKe}"`);
                }

                if (matchedBayB) {
                    console.log(`   Ujung B: Ketemu ✅ di GI="${matchedBayB[bayGIIdx]}" | Master Bay="${matchedBayB[bayNameIdx]}"`);
                } else {
                    console.log(`   Ujung B: ❌ Tidak ketemu bay di Master Data GI wilayah "${textKe}" yang mengarah ke "${textDari}"`);
                }

                if (!matchedBayA && !matchedBayB) {
                    const potA = bayPenghantar.filter(b => cleanText(b[bayGIIdx] || "").includes(cleanDari)).map(b => b[bayNameIdx]).slice(0, 3);
                    if (potA.length > 0) console.log(`      *Info: Di GI ${textDari} adanya bay ini: ${potA.join(', ')}`);
                }
            }
        });

        console.log(`\n=================== KESIMPULAN PATTERN ===================`);
        console.log(`Total Jalur Transmisi     : ${perfectMatches + partialMatches + zeroMatches}`);
        console.log(`Berhasil Lengkap 2 Ujung  : ${perfectMatches} jalur (Pola terbukti lurus)`);
        console.log(`Sebelah Ujung Tidak Cocok : ${partialMatches} jalur (Mungkin ujung satunya UPT lain/beda penamaan)`);
        console.log(`Gagal Cocok Sama Sekali   : ${zeroMatches} jalur (Pola penamaan putus)`);

    } catch (error) {
        console.error("Error:", error.message);
    }
}

checkExactPattern();
