const { google } = require("googleapis");

const keyPath = "../Google Auth/automaticspreadsheet-de108e1d5b56.json";

async function run() {
    const auth = new google.auth.GoogleAuth({
        keyFile: keyPath,
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    const client = google.sheets({ version: "v4", auth });
    try {
        // 1. Get Headers from Asset Bay
        const res = await client.spreadsheets.values.get({
            spreadsheetId: "1vpVUczVs8GB-VHbqxrHpl-EZI66HO2e2fWdU3qfLzeI",
            range: "'Asset Bay'!A1:Z1"
        });

        if (!res.data.values || res.data.values.length === 0) {
            console.error("Asset Bay headers not found.");
            return;
        }

        const headers = res.data.values[0];
        console.log("Found Asset Bay Headers:", headers);

        // 2. Write Headers to Daftar Gardu Induk
        console.log("Writing headers to 'Daftar Gradu Induk'...");
        const writeRes = await client.spreadsheets.values.update({
            spreadsheetId: "1vpVUczVs8GB-VHbqxrHpl-EZI66HO2e2fWdU3qfLzeI",
            range: "'Daftar Gradu Induk'!A1:Z1",
            valueInputOption: "USER_ENTERED",
            requestBody: {
                values: [headers]
            }
        });

        console.log("Success! Updated cells:", writeRes.data.updatedCells);

    } catch (e) {
        console.error("Error:", e.message);
    }
}
run();
