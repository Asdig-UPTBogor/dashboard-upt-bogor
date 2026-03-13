/**
 * Check actual contents of Config Thor Vaisala sheet.
 * Usage: node scripts/spreadsheet-utils/check-thor-config.js
 */
const { google } = require('googleapis');
const path = require('path');

const CREDS = path.resolve(__dirname, '../../../Google Auth/automaticspreadsheet-de108e1d5b56.json');
const SPREADSHEET_ID = '1vpVUczVs8GB-VHbqxrHpl-EZI66HO2e2fWdU3qfLzeI';

async function main() {
    const auth = new google.auth.GoogleAuth({
        keyFile: CREDS,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    const result = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: "'Config Thor Vaisala'!A:C",
    });

    const rows = result.data.values || [];
    console.log('=== Config Thor Vaisala Sheet ===');
    console.log(`Total rows: ${rows.length}\n`);
    rows.forEach((row, i) => {
        const key = (row[0] || '').padEnd(25);
        const val = row[1] || '(empty)';
        console.log(`[${String(i).padStart(2)}] ${key} = ${val}`);
    });
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
