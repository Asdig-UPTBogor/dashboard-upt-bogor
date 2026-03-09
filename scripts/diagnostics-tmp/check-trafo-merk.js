const { google } = require('googleapis');

async function checkTrafoMerk() {
    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: '/home/server-01/Workspace/GCP Project/Dashboard-UPT-Bogor/Google Auth/automaticspreadsheet-de108e1d5b56.json',
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });

        const sheets = google.sheets({ version: 'v4', auth });
        const spreadsheetId = '1A-x4WiaSazBdtx051TdhCBqNKpPpcbMWVFVyWSFUdo4';

        console.log("Membaca data Sheet 'TRAFO'...");
        const resTrafo = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: "'TRAFO'!A1:Z500"
        });

        const rowsTrafo = resTrafo.data.values || [];
        if (rowsTrafo.length === 0) {
            console.log("Sheet TRAFO kosong.");
            return;
        }

        const headers = rowsTrafo[0] || [];

        let giIdx = 3; // Nama GI/GIS
        let trafoIdx = 4; // Nama Bay
        let merkIdx = headers.findIndex(h => h.toLowerCase().includes('merk trafo') || h.toLowerCase().replace(/\s/g, '').includes('merk'));

        console.log(`Headers ditemukan: GI [${giIdx}], Trafo [${trafoIdx}], Merk [${merkIdx}]`);

        if (merkIdx === -1) {
            console.log("Kolom 'Merk' tidak ditemukan di sheet TRAFO. Berikut semua headernya:");
            console.log(headers.join(" | "));
            return;
        }

        let totalTrafo = 0;
        let withMerk = 0;
        let blankMerkList = [];

        rowsTrafo.slice(1).forEach((row, idx) => {
            if (row.length === 0) return;
            const gi = (row[giIdx] || "-").trim();
            const trafo = (row[trafoIdx] || "-").trim();
            const merk = (row[merkIdx] || "").trim();

            if (gi && gi !== '-' && trafo && trafo !== '-') {
                totalTrafo++;
                if (merk && merk !== '-' && merk.toLowerCase() !== 'belum ada') {
                    withMerk++;
                } else {
                    blankMerkList.push(`Baris ${idx + 2}: ${gi.padEnd(25)} -> ${trafo}`);
                }
            }
        });

        console.log(`\n=== HASIL PENGECEKAN MERK TRAFO DI SHEET 'TRAFO' ===`);
        console.log(`Total data Trafo di Sheet TRAFO: ${totalTrafo} unit`);
        console.log(`✅ Trafo yang memiliki Merk tercatat: ${withMerk} unit`);
        console.log(`❌ Trafo yang Merk-nya KOSONG / BELUM ADA / STRIP(-): ${blankMerkList.length} unit`);

        if (blankMerkList.length > 0) {
            console.log(`\n--- DAFTAR TRAFO TANPA MERK DI SHEET 'TRAFO' ---`);
            blankMerkList.forEach(item => console.log(item));
        } else {
            console.log(`\n--- LUAAR BIASA! 100% Seluruh baris di Sheet TRAFO sudah memiliki Merk Trafo! ---`);
        }

    } catch (error) {
        console.error("Error:", error.message);
    }
}

checkTrafoMerk();
