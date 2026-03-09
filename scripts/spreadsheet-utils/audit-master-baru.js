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
        const sheet = meta.data.sheets.find(s => s.properties.sheetId === 678848539);

        if (!sheet) {
            console.log("Sheet with gid 678848539 not found.");
            return;
        }

        console.log(`Sheet Name: ${sheet.properties.title}`);

        const res = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `'${sheet.properties.title}'!A1:Z10`,
        });

        console.log("Data (Rows 1-10):");
        console.table(res.data.values);
    } catch (e) {
        console.error(e);
    }
}

main();
