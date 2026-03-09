const { google } = require('googleapis');

async function reAuditTypeBay() {
    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: '/home/server-01/Workspace/GCP Project/Dashboard-UPT-Bogor/Google Auth/automaticspreadsheet-de108e1d5b56.json',
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });

        const sheets = google.sheets({ version: 'v4', auth });
        const spreadsheetId = '1wh2ckkEaovH2MueQDXEG1u7HDenry5_D37JpdvqNWak';

        // Fetch Type Bay column (Column F)
        const resBay = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: "'Master Bay'!A2:F1000" // Fetching A to F to see what row was changed
        });

        const rowsBay = resBay.data.values || [];

        const typeCount = {};
        let totalRows = 0;

        rowsBay.forEach(row => {
            if (row.length === 0) return; // Skip completely empty trailing rows

            // F is index 5
            const type = (row[5] || "").trim();
            if (type !== "") {
                typeCount[type] = (typeCount[type] || 0) + 1;
            } else {
                typeCount["[KOSONG/BLANK]"] = (typeCount["[KOSONG/BLANK]"] || 0) + 1;
            }
            totalRows++;
        });

        console.log(`\n=== HASIL AUDIT TERBARU (Total ${totalRows} baris) ===`);
        const sortedTypes = Object.keys(typeCount).sort((a, b) => typeCount[b] - typeCount[a]);

        sortedTypes.forEach((type, index) => {
            console.log(`${index + 1}. ${type}: ${typeCount[type]} bay`);
        });

        console.log(`\nTOTAL JENIS TYPE BAY SAAT INI: ${sortedTypes.length}`);

        // Compare against the baseline 14 list we had
        const baseline14 = [
            "Penghantar - Saluran Udara", "Penghantar - Kabel", "Trafo 150/20", "Trafo 150/20 (LV)",
            "IBT 150/70", "IBT 150/70 (LV)", "IBT 500/150", "IBT 500/150 (LV)", "Busbar",
            "Diameter", "Kopel", "Kapasitor", "Section", "Cut Off"
        ];

        const newTypesDetected = sortedTypes.filter(t => !baseline14.includes(t) && t !== "[KOSONG/BLANK]");
        const missingBaselineTypes = baseline14.filter(t => !sortedTypes.includes(t));

        if (newTypesDetected.length > 0) {
            console.log(`\n⚠️ ADA TIPE BARU (Tidak ada di list 14 sebelumnya):`);
            newTypesDetected.forEach(t => console.log(`   - "${t}"`));
        }

        if (missingBaselineTypes.length > 0) {
            console.log(`\n⚠️ TIPE YANG MENGHILANG (Atau count-nya 0 sehingga tidak eksis di sheet):`);
            missingBaselineTypes.forEach(t => console.log(`   - "${t}"`));
        }

    } catch (error) {
        console.error("Error:", error.message);
    }
}

reAuditTypeBay();
