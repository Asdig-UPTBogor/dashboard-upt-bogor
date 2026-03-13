/**
 * Check MASTER ASSET TOWER sheet header + first 3 rows to debug why 0 towers loaded.
 * Usage: node scripts/spreadsheet-utils/check-tower-sheet.js
 */
const { google } = require('googleapis');
const path = require('path');

const CREDS = path.resolve(__dirname, '../../../Google Auth/automaticspreadsheet-de108e1d5b56.json');
const SPREADSHEET_ID = '13xm0SqMP5EYbLyYnt5jUPUx1BzhaDffkX4iippq_LuM';
const SHEET = 'MASTER ASSET TOWER';

async function main() {
    const auth = new google.auth.GoogleAuth({
        keyFile: CREDS,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    // Get first 5 rows, columns A through Z
    const result = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `'${SHEET}'!A1:Z5`,
    });

    const rows = result.data.values || [];
    console.log(`=== ${SHEET} — First ${rows.length} rows ===\n`);

    if (rows.length === 0) {
        console.log('EMPTY SHEET!');
        return;
    }

    // Print header
    const header = rows[0];
    console.log('HEADER:');
    header.forEach((h, i) => {
        const col = String.fromCharCode(65 + i);
        console.log(`  ${col} = "${h}"`);
    });

    // Print data rows
    for (let r = 1; r < rows.length; r++) {
        console.log(`\nROW ${r}:`);
        const row = rows[r];
        header.forEach((h, i) => {
            const col = String.fromCharCode(65 + i);
            const val = row[i] || '(empty)';
            console.log(`  ${col}(${h}) = ${val}`);
        });
    }

    // Also check total row count
    const countResult = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `'${SHEET}'!A:A`,
    });
    console.log(`\nTotal rows in column A: ${(countResult.data.values || []).length}`);

    // Check columns W and X specifically
    const wxResult = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `'${SHEET}'!W1:X5`,
    });
    const wxRows = wxResult.data.values || [];
    console.log(`\n=== Columns W-X (first 5 rows) ===`);
    wxRows.forEach((row, i) => {
        console.log(`  [${i}] W="${row[0] || '(empty)'}"  X="${row[1] || '(empty)'}"`);
    });
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
