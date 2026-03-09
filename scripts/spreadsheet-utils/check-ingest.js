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

    try {
        const res = await sheets.spreadsheets.values.get({
            spreadsheetId: ingestSpreadsheetId,
            range: "'GARDU INDUK'!A1:Z10",
        });
        console.table(res.data.values);
    } catch (e) {
        console.error(e);
    }
}
main();
