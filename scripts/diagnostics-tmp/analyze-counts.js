const { google } = require('googleapis');

async function countTransmisiVsBay() {
    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: '/home/server-01/Workspace/GCP Project/Dashboard-UPT-Bogor/Google Auth/automaticspreadsheet-de108e1d5b56.json',
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });

        const sheets = google.sheets({ version: 'v4', auth });
        // Spreadsheet yang memuat master (BAY + TRANSMISI)
        const spreadsheetId = '1A-x4WiaSazBdtx051TdhCBqNKpPpcbMWVFVyWSFUdo4';

        // Spreadsheet yang memuat dropdown tipe bay kita (1wh2ckkEaov... tapi karena datanya asalnya sama, kita bisa hitung murni dari Master Asset ini atau yg sana)
        // Utk Type Bay (SUTT vs Kabel) kita ambil dari yg sudah diaudit di 1wh2ck...
        const newSpreadsheetId = '1wh2ckkEaovH2MueQDXEG1u7HDenry5_D37JpdvqNWak';

        // 1. Ambil Data TRANSMISI
        const resTrans = await sheets.spreadsheets.values.get({ spreadsheetId, range: "'TRANSMISI'!A1:Z500" });
        const rowsTrans = resTrans.data.values || [];
        const headersTrans = rowsTrans[0] || [];

        let transJenisIdx = headersTrans.findIndex(h => h.toLowerCase().includes('jenis sutt') || h.toLowerCase().includes('sutt/sutet/sktt'));
        let transPanjangSirkitIdx = headersTrans.findIndex(h => h.toLowerCase().includes('panjang sirkit'));

        let totalSirkitTransmisi = 0;
        let totalSirkitSKTT = 0;
        let totalSirkitSUTTSUTET = 0;

        if (transJenisIdx !== -1) {
            rowsTrans.slice(1).forEach(row => {
                if (row.length === 0) return; // skip empty

                const jenis = (row[transJenisIdx] || "").trim().toUpperCase();
                // Validasi bahwa ini baris data riil (misal ada isinya)
                if (jenis !== "") {
                    totalSirkitTransmisi++;
                    if (jenis.includes('SKTT') || jenis.includes('KABEL')) {
                        totalSirkitSKTT++;
                    } else if (jenis.includes('SUTT') || jenis.includes('SUTET') || jenis.includes('UDARA')) {
                        totalSirkitSUTTSUTET++;
                    }
                }
            });
        }

        // 2. Ambil Data BAY (dari file terbaru yang sudah ada Type Bay-nya)
        const resBay = await sheets.spreadsheets.values.get({
            spreadsheetId: newSpreadsheetId,
            range: "'Master Bay'!A2:Z1000"
        });
        const rowsBay = resBay.data.values || [];

        let totalBaySKTT = 0;
        let totalBayUdara = 0;
        let totalBayPembangkit = 0;
        let totalBayKonsumen = 0;

        rowsBay.forEach(row => {
            if (row.length === 0) return;
            // Type Bay ada di Column F (Index 5)
            const typeBay = (row[5] || "").trim();

            if (typeBay === "Penghantar - Saluran Udara") totalBayUdara++;
            else if (typeBay === "Penghantar - Kabel") totalBaySKTT++;
            else if (typeBay === "Pembangkit") totalBayPembangkit++;
            else if (typeBay === "Konsumen") totalBayKonsumen++;
        });

        const totalSemuaBayPenghantar = totalBayUdara + totalBaySKTT + totalBayPembangkit + totalBayKonsumen;

        console.log("==========================================================");
        console.log("       ANALISIS KORELASI: TOTAL TRANSMISI vs TOTAL BAY    ");
        console.log("==========================================================");

        console.log("\n[A] DATA FISIK TRANSMISI (Dari Sheet 'TRANSMISI')");
        console.log(`- Total Saluran/Sirkit SKTT (Kabel) : ${totalSirkitSKTT} sirkit`);
        console.log(`- Total Saluran/Sirkit Udara        : ${totalSirkitSUTTSUTET} sirkit`);
        console.log(`> TOTAL SELURUH SIRKIT TRANSMISI    : ${totalSirkitTransmisi} sirkit`);

        console.log("\n[B] DATA UJUNG/TERMINAL (Dari Sheet 'BAY')");
        console.log(`- Bay Penghantar - Kabel            : ${totalBaySKTT} bay`);
        console.log(`- Bay Penghantar - Saluran Udara    : ${totalBayUdara} bay`);
        // Menambahkan Pembangkit & Konsumen yg hakekatnya penghantar juga
        console.log(`- Bay Pembangkit                    : ${totalBayPembangkit} bay`);
        console.log(`- Bay Konsumen                      : ${totalBayKonsumen} bay`);
        console.log(`> TOTAL SELURUH BAY PENGHANTAR      : ${totalSemuaBayPenghantar} bay`);

        console.log("\n[C] KESIMPULAN KORELASI MATEMATIS");
        console.log("Idealnya: 1 Saluran Transmisi = Penghubung 2 Bay (Ujung A dan Ujung B).");
        console.log(`Maka, Ideal Total Bay = ${totalSirkitTransmisi} Sirkit x 2 = ${totalSirkitTransmisi * 2} Bay Penghantar.`);

        const selisih = totalSemuaBayPenghantar - (totalSirkitTransmisi * 2);

        if (selisih === 0) {
            console.log(`Status: 🟢 PERFECT MATCH (Sempurna 100%). Jumlah Bay tepat 2x lipat dari jumlah Sirkit.`);
        } else if (selisih > 0) {
            console.log(`Status: 🟡 OVERPLUS (${selisih} bay ekstra). Artinya ada Bay Penghantar yang tercatat di UPT Bogor, tetapi saluran transmisinya TIDAK TERCATAT di sheet 'TRANSMISI' (mungkin dikelola UPT tetangga).`);
        } else {
            console.log(`Status: 🔴 DEFICIT (${Math.abs(selisih)} bay kurang). Artinya ada Transmisi yang tercatat, tapi ujung Bay-nya tidak dikelola UPT Bogor.`);
        }

        // Analisa spesifik SKTT/Kabel
        console.log("\n[D] BEDAH KHUSUS KABEL (SKTT)");
        console.log(`- Total Sirkit SKTT  : ${totalSirkitSKTT} sirkit (Idealnya butuh ${totalSirkitSKTT * 2} bay)`);
        console.log(`- Bay Kabel Tersedia : ${totalBaySKTT} bay`);
        console.log(`- Kesimpulan SKTT    : Terdapat data yang tidak presisi atau penamaan "Kabel" di sheet Bay tidak terdeteksi sepenuhnya secara teks ("SKTT"/"Kabel").`);

        console.log("==========================================================");

    } catch (error) {
        console.error("Error:", error.message);
    }
}

countTransmisiVsBay();
