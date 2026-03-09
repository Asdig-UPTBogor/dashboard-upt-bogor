const { google } = require('googleapis');

async function countLVMatches() {
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
            range: "'Master Bay'!F2:F1000"
        });

        const rowsBay = resBay.data.values || [];

        let trafoCount = 0;
        let trafoLVCount = 0;
        let ibt70Count = 0;
        let ibt70LVCount = 0;
        let ibt500Count = 0;
        let ibt500LVCount = 0;

        rowsBay.forEach(row => {
            const type = (row[0] || "").trim();
            if (type === "Trafo 150/20") trafoCount++;
            else if (type === "Trafo 150/20 (LV)") trafoLVCount++;
            else if (type === "IBT 150/70") ibt70Count++;
            else if (type === "IBT 150/70 (LV)") ibt70LVCount++;
            else if (type === "IBT 500/150") ibt500Count++;
            else if (type === "IBT 500/150 (LV)") ibt500LVCount++;
        });

        console.log("=== HASIL PERBANDINGAN JUMLAH TRAFO & LV ===");
        console.log(`1. Trafo 150/20        : ${trafoCount} bay`);
        console.log(`   Trafo 150/20 (LV)   : ${trafoLVCount} bay`);
        if (trafoCount === trafoLVCount) console.log("   -> ✅ MATCH (SAMA JUMLAH)");
        else console.log("   -> ❌ TIDAK SAMA");

        console.log(`\n2. IBT 150/70          : ${ibt70Count} bay`);
        console.log(`   IBT 150/70 (LV)     : ${ibt70LVCount} bay`);
        if (ibt70Count === ibt70LVCount) console.log("   -> ✅ MATCH (SAMA JUMLAH)");
        else console.log("   -> ❌ TIDAK SAMA");

        console.log(`\n3. IBT 500/150         : ${ibt500Count} bay`);
        console.log(`   IBT 500/150 (LV)    : ${ibt500LVCount} bay`);
        if (ibt500Count === ibt500LVCount) console.log("   -> ✅ MATCH (SAMA JUMLAH)");
        else console.log("   -> ❌ TIDAK SAMA");

    } catch (error) {
        console.error("Error:", error.message);
    }
}

countLVMatches();
