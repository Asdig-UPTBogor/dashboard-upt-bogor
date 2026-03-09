const { google } = require('googleapis');

// Fungsi cerdas untuk mengambil NAMA DASAR Gardu Induk
// Menghilangkan embel-embel sirkuit seperti "-1", "-2", "#1", "#2", " 1", " 2", dst.
function getBaseLocation(text) {
    if (!text) return "";
    return text.toUpperCase()
        .replace(/GI\s*\d+KV/g, '')
        .replace(/GIS\s*\d+KV/g, '')
        .replace(/GITET\s*\d+KV/g, '')
        .replace(/-\d+/g, '') // Hapus "-1", "-2"
        .replace(/#\d+/g, '') // Hapus "#1", "#2"
        .replace(/\s\d+$/g, '') // Hapus spasi diikuti angka di akhir (contoh: "DEPOK 1")
        .replace(/PENGHANTAR/g, '')
        .replace(/PHT/g, '')
        .replace(/150KV/gi, '')
        .replace(/70KV/gi, '')
        .replace(/500KV/gi, '')
        .replace(/\s+/g, '') // Hapus semua spasi
        .trim();
}

async function analyzePattern() {
    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: '/home/server-01/Workspace/GCP Project/Dashboard-UPT-Bogor/Google Auth/automaticspreadsheet-de108e1d5b56.json',
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });

        const sheets = google.sheets({ version: 'v4', auth });
        const spreadsheetId = '1A-x4WiaSazBdtx051TdhCBqNKpPpcbMWVFVyWSFUdo4';

        // 1. Ambil Map dari TRANSMISI (Rute A <-> B murni)
        const resTrans = await sheets.spreadsheets.values.get({ spreadsheetId, range: "'TRANSMISI'!A1:Z500" });
        const rowsTrans = resTrans.data.values || [];
        const headersTrans = rowsTrans[0] || [];

        let transDariIdx = headersTrans.findIndex(h => h.toLowerCase() === 'dari');
        let transKeIdx = headersTrans.findIndex(h => h.toLowerCase() === 'ke');
        let transJenisIdx = headersTrans.findIndex(h => h.toLowerCase().includes('jenis sutt') || h.toLowerCase().includes('sutt/sutet/sktt'));

        const routeMap = new Map(); // Simpan route A-B (ALPHABETICAL order agar A-B sama dengan B-A)

        if (transDariIdx !== -1 && transKeIdx !== -1) {
            rowsTrans.slice(1).forEach(row => {
                if (row.length === 0) return;
                const dari = (row[transDariIdx] || "").trim();
                const ke = (row[transKeIdx] || "").trim();
                const jenis = transJenisIdx !== -1 ? (row[transJenisIdx] || "").trim().toUpperCase() : "UNKNOWN";

                if (dari && ke) {
                    const baseA = getBaseLocation(dari);
                    const baseB = getBaseLocation(ke);

                    if (baseA && baseB) {
                        // Kunci rute selalu diurutkan alfabet (misal "BOGORKOTA-KEDUNGBADAK")
                        const routeKey = [baseA, baseB].sort().join("<->");

                        // Cukup simpan informasinya
                        if (!routeMap.has(routeKey)) {
                            routeMap.set(routeKey, { jenis: jenis, raw: `${dari} -> ${ke}` });
                        } else {
                            // Jika ada rute ganda (kabel & udara) di rute yg sama (jarang tapi mungkin)
                            if (jenis.includes("KABEL") || jenis.includes("SKTT")) {
                                routeMap.get(routeKey).jenis = "SKTT"; // Prioritaskan deteksi SKTT
                            }
                        }
                    }
                }
            });
        }

        // 2. Cek Silang ke BAY
        const resBay = await sheets.spreadsheets.values.get({ spreadsheetId, range: "'BAY'!A1:Z1000" });
        const rowsBay = resBay.data.values || [];
        const headersBay = rowsBay[0] || [];

        let bayGIIdx = headersBay.findIndex(h => h.toLowerCase().includes('gardu induk') || h.toLowerCase().includes('nama gi/gis'));
        let bayNameIdx = headersBay.findIndex(h => h.toLowerCase() === 'nama bay' || h.toLowerCase() === 'master bay');
        let bayFuncIdx = headersBay.findIndex(h => h.toLowerCase() === 'bay function');

        let matchSKTT = [];
        let matchSUTT = [];
        let unmatched = [];

        rowsBay.slice(1).forEach(row => {
            const func = (row[bayFuncIdx] || "").trim().toLowerCase();
            const bayName = (row[bayNameIdx] || "").trim();
            const giName = (row[bayGIIdx] || "").trim();

            if (func.includes('penghantar') || func.includes('t/l bay')) {
                const baseGI = getBaseLocation(giName);
                const baseDest = getBaseLocation(bayName);

                if (baseGI && baseDest) {
                    const routeKey = [baseGI, baseDest].sort().join("<->");
                    const routeData = routeMap.get(routeKey);

                    if (routeData) {
                        const jenis = routeData.jenis;
                        const logStr = `Lokasi: ${giName} | Bay: "${bayName}" ==> Rute Terdeteksi: ${routeKey} (${jenis})`;

                        if (jenis.includes('SKTT') || jenis.includes('KABEL')) {
                            matchSKTT.push(logStr);
                        } else {
                            matchSUTT.push(logStr);
                        }
                    } else {
                        // Jika tidak ada di TRANSMISI
                        unmatched.push(`Lokasi: ${giName} | Bay: "${bayName}" ==> GAGAL MAP: Dicari rute ${routeKey} tapi tidak ada di TRANSMISI.`);
                    }
                }
            }
        });

        console.log(`\n=================== BONGKAR PATTERN RELASI ===================`);
        console.log(`Jumlah Rute Unik di TRANSMISI: ${routeMap.size}`);
        console.log(`\n--- REKAP BAY PENGHANTAR ---`);
        console.log(`Berhasil dikaitkan ke SKTT (Kabel) : ${matchSKTT.length} bay`);
        console.log(`Berhasil dikaitkan ke SUTT (Udara) : ${matchSUTT.length} bay`);
        console.log(`Gagal Match (Tidak ada rutenya)    : ${unmatched.length} bay`);

        console.log(`\n--- RINCIAN BAY KABEL (SKTT) YANG KETEMU MATCHINGNYA ---`);
        matchSKTT.forEach(m => console.log("✅ " + m));

        if (unmatched.length > 0) {
            console.log(`\n--- DAFTAR GAGAL MATCH (SAMPEL 10) ---`);
            unmatched.slice(0, 10).forEach(m => console.log("❌ " + m));
            console.log(`(Penyebab utama: Jalur ini memang BELUM DIDAFTARKAN di Sheet TRANSMISI, atau dikelola UPT lain).`);
        }

    } catch (error) {
        console.error("Error:", error.message);
    }
}

analyzePattern();
