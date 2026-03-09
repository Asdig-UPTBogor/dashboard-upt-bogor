const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

const auth = new google.auth.GoogleAuth({
    keyFile: path.join(__dirname, 'Google Auth/automaticspreadsheet-de108e1d5b56.json'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const SPREADSHEET_ID = '1vpVUczVs8GB-VHbqxrHpl-EZI66HO2e2fWdU3qfLzeI'; // Master Hierarchy

async function migrateCoordinates() {
    const sheets = google.sheets({ version: 'v4', auth });

    console.log("1. Mengambil data sumber dari 'Koordinat Gardu Induk'...");
    const sourceRes = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: "'Koordinat Gardu Induk'!A:C"
    });

    const sourceRows = sourceRes.data.values || [];
    // Buat dict { namaGI: { lat, lon } }
    const sourceMap = new Map();
    // Skip header
    for (let i = 1; i < sourceRows.length; i++) {
        const row = sourceRows[i];
        if (!row[0]) continue;

        let rawName = row[0].replace(/^(GI[SET]*\\s+\\d+KV\\s+)/i, "").trim().toUpperCase();
        // Custom remap sama seperti verifikasi sebelumnya
        if (rawName === "PLTP SALAK (BR)") rawName = "SALAK BARU";
        if (rawName === "INDO LISAN/T OLAI") rawName = "INDOLISAN";

        sourceMap.set(rawName, {
            lat: row[1] || "",
            lon: row[2] || ""
        });
    }
    console.log(`Berhasil memetakan ${sourceMap.size} koordinat dari sumber.`);

    console.log("\\n2. Mengambil data target dari 'Asset GI'...");
    const targetRes = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: "'Asset GI'!A:Z"
    });

    const targetRows = targetRes.data.values || [];
    const headers = targetRows[0];

    const latColIdx = headers.findIndex(h => h && h.trim().toLowerCase() === "latitude");
    const lonColIdx = headers.findIndex(h => h && h.trim().toLowerCase() === "longitude");
    const nameColIdx = headers.findIndex(h => h && h.trim().toLowerCase() === "master gardu induk");

    if (latColIdx === -1 || lonColIdx === -1 || nameColIdx === -1) {
        console.error("Gagal menemukan kolom Latitude, Longitude, atau Master Gardu Induk di Asset GI!");
        return;
    }

    console.log(`Kolom target -> Name: ${nameColIdx}, Lat: ${latColIdx}, Lon: ${lonColIdx}`);

    let updatedCount = 0;
    const updates = [];

    for (let i = 1; i < targetRows.length; i++) {
        const row = targetRows[i];
        if (!row[nameColIdx]) continue;

        const rawName = row[nameColIdx].replace(/^(GI[SET]*\\s+\\d+KV\\s+)/i, "").trim().toUpperCase();
        const coords = sourceMap.get(rawName);

        if (coords) {
            // Kita siapkan update per-cell
            const rowNumber = i + 1;

            // Konversi index kolom ke huruf (0 -> A, 1 -> B, ...)
            const getColLetter = (idx) => String.fromCharCode(65 + idx);
            const latRange = `'Asset GI'!${getColLetter(latColIdx)}${rowNumber}`;
            const lonRange = `'Asset GI'!${getColLetter(lonColIdx)}${rowNumber}`;

            updates.push({
                range: latRange,
                values: [[coords.lat]]
            });
            updates.push({
                range: lonRange,
                values: [[coords.lon]]
            });

            // Update the local row array for logging
            row[latColIdx] = coords.lat;
            row[lonColIdx] = coords.lon;
            updatedCount++;
        } else {
            console.log(`  [SKIP] Koordinat tidak ditemukan untuk: ${row[nameColIdx]}`);
        }
    }

    console.log(`\\n3. Menyuntikkan ${updatedCount} baris koodinat ke 'Asset GI'...`);

    if (updates.length > 0) {
        // Melakukan batch update
        await sheets.spreadsheets.values.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            requestBody: {
                valueInputOption: "USER_ENTERED",
                data: updates
            }
        });
        console.log("✅ INJEKSI KOORDINAT BERHASIL!");
    } else {
        console.log("⚠️ Tidak ada data yang perlu di-update.");
    }
}

migrateCoordinates().catch(console.error);
