const { google } = require('googleapis');

async function checkActualGICoordinates() {
    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: '/home/server-01/Workspace/GCP Project/Dashboard-UPT-Bogor/Google Auth/automaticspreadsheet-de108e1d5b56.json',
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });
        const sheets = google.sheets({ version: 'v4', auth });

        // Target: General Information UPT Bogor
        const spreadsheetId = '1vpVUczVs8GB-VHbqxrHpl-EZI66HO2e2fWdU3qfLzeI';
        const sheetName = 'Asset GI';

        console.log(`\nMenghubungi Google Sheets API...\nTarget Spreadsheet ID: ${spreadsheetId}\nTarget Sheet: ${sheetName}\n`);

        const res = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `'${sheetName}'!A1:Z5` // Ambil 5 baris pertama untuk lihat Header + Contoh Data
        });

        const rows = res.data.values;
        if (!rows || rows.length === 0) {
            console.log("Sheet kosong atau tidak ditemukan.");
            return;
        }

        const headers = rows[0];
        console.log("=== HEADERS AKTUAL DI GOOGLE SHEETS ===");
        headers.forEach((h, i) => {
            console.log(`Kolom ${String.fromCharCode(65 + i)}: ${h}`);
        });

        console.log("\n=== CONTOH DATA (Baris 2 & 3) AKTUAL ===");
        if (rows[1]) console.log(`Data Baris 2: ${JSON.stringify(rows[1])}`);
        if (rows[2]) console.log(`Data Baris 3: ${JSON.stringify(rows[2])}`);

        // Verifikasi Koordinat
        const latIndex = headers.findIndex(h => h.toLowerCase().includes('lat'));
        const longIndex = headers.findIndex(h => h.toLowerCase().includes('long'));

        console.log("\n=== KESIMPULAN ===");
        if (latIndex !== -1 && longIndex !== -1) {
            console.log(`✅ BENAR! Koordinat ADA secara fisik di Sheet ini.`);
            console.log(`Latitude Ditemukan di Kolom: ${String.fromCharCode(65 + latIndex)} (Header: "${headers[latIndex]}")`);
            console.log(`Longitude Ditemukan di Kolom: ${String.fromCharCode(65 + longIndex)} (Header: "${headers[longIndex]}")`);
        } else {
            console.log(`❌ SALAH! Tidak ada kolom Latitude/Longitude di sheet ini secara aktual.`);
        }

    } catch (e) {
        console.error("Error API:", e.message);
    }
}

checkActualGICoordinates();
