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
        // 1. Get sheet name for gid=707759962
        const meta = await sheets.spreadsheets.get({ spreadsheetId: ingestSpreadsheetId });
        const targetTargetSheet = meta.data.sheets.find(s => s.properties.sheetId === 707759962);

        if (!targetTargetSheet) {
            console.log("Sheet with gid 707759962 not found!");
            return;
        }
        const ingestSheetName = targetTargetSheet.properties.title;
        console.log(`Ingest Sheet Name: '${ingestSheetName}'`);

        // 2. Fetch data from source
        const res = await sheets.spreadsheets.values.get({
            spreadsheetId: ingestSpreadsheetId,
            range: `'${ingestSheetName}'!A1:Z`,
        });
        const sourceRows = res.data.values || [];
        console.log(`Found ${sourceRows.length} rows in Ingest Sheet.`);

        // Print first 10 rows to understand structure
        console.log("Head of Source Data:");
        console.table(sourceRows.slice(0, 10));

        // 3. Fetch data from Master Hierarchy
        const masterRes = await sheets.spreadsheets.values.get({
            spreadsheetId: targetSpreadsheetId,
            range: "'Master Gardu Induk'!A:E",
        });
        const masterRows = masterRes.data.values || [];

        console.log("\nHead of Master Gardu Induk:");
        console.table(masterRows.slice(0, 5));

    } catch (e) {
        console.error(e);
    }
}
main();
