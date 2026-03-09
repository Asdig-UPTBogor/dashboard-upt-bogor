const { google } = require('googleapis');
const path = require('path');

const credentialsPath = path.join(__dirname, '../../../Google Auth/automaticspreadsheet-de108e1d5b56.json');
const auth = new google.auth.GoogleAuth({
    keyFile: credentialsPath,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

async function main() {
    const sheets = google.sheets({ version: 'v4', auth });
    const ingestSpreadsheetId = '1UiVv0mwnvbhtBZiJUczQkVUJcr22B48edfc17w3WuUQ';
    const targetSpreadsheetId = '1vpVUczVs8GB-VHbqxrHpl-EZI66HO2e2fWdU3qfLzeI';

    try {
        const res = await sheets.spreadsheets.values.get({
            spreadsheetId: ingestSpreadsheetId,
            range: "'Master GI'!A1:H",
        });
        const sourceRows = res.data.values || [];
        console.table(sourceRows);

        const masterRes = await sheets.spreadsheets.values.get({
            spreadsheetId: targetSpreadsheetId,
            range: "'Master Gardu Induk'!A:E",
        });
        const masterRows = masterRes.data.values || [];
        console.table(masterRows);

    } catch (e) {
        console.error(e);
    }
}
main();
