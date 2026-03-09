const { google } = require('googleapis');
const path = require('path');

const credentialsPath = path.join(__dirname, '../../../Google Auth/automaticspreadsheet-de108e1d5b56.json');
const auth = new google.auth.GoogleAuth({
    keyFile: credentialsPath,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

async function main() {
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = '1vpVUczVs8GB-VHbqxrHpl-EZI66HO2e2fWdU3qfLzeI';

    try {
        const meta = await sheets.spreadsheets.get({ spreadsheetId });

        for (const sheet of meta.data.sheets) {
            console.log(`\n=== Sheet: ${sheet.properties.title} ===`);
            const res = await sheets.spreadsheets.values.get({
                spreadsheetId,
                range: `'${sheet.properties.title}'!A1:Z3`, // Get first 3 rows to see headers
            });
            if (res.data.values) {
                console.table(res.data.values);
            } else {
                console.log("No data found.");
            }
        }
    } catch (e) {
        console.error(e);
    }
}

main();
