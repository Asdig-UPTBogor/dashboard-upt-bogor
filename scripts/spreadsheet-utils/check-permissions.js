const { google } = require('googleapis');
const path = require('path');

const credentialsPath = path.join(__dirname, '../../../Google Auth/automaticspreadsheet-de108e1d5b56.json');
const spreadsheetId = '1vpVUczVs8GB-VHbqxrHpl-EZI66HO2e2fWdU3qfLzeI';
const sheetTitle = 'Master Gardu Induk';

async function checkPermissions() {
    console.log("Checking protections on", sheetTitle, "...");
    const auth = new google.auth.GoogleAuth({
        keyFile: credentialsPath,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    try {
        const meta = await sheets.spreadsheets.get({
            spreadsheetId,
            fields: 'sheets(properties(sheetId,title),protectedRanges)',
        });

        const sheet = meta.data.sheets.find(s => s.properties.title === sheetTitle);
        if (!sheet) throw new Error(`Sheet ${sheetTitle} not found`);

        console.log("Protected Ranges:", JSON.stringify(sheet.protectedRanges, null, 2));

    } catch (err) {
        console.error("Error:", err.message);
    }
}

checkPermissions();
