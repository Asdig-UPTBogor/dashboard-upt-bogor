/**
 * Properly fix Config Thor Vaisala rows 19+.
 * Clears old TOWER_COLUMNS and writes correct COL_* rows.
 * Usage: node scripts/spreadsheet-utils/fix-thor-column-config-v2.js
 */
const { google } = require('googleapis');
const path = require('path');

const CREDS = path.resolve(__dirname, '../../../Google Auth/automaticspreadsheet-de108e1d5b56.json');
const SPREADSHEET_ID = '1vpVUczVs8GB-VHbqxrHpl-EZI66HO2e2fWdU3qfLzeI';
const SHEET_NAME = 'Config Thor Vaisala';

async function main() {
    const auth = new google.auth.GoogleAuth({
        keyFile: CREDS,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    // Step 1: Read current state
    const before = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `'${SHEET_NAME}'!A:C`,
    });
    console.log('BEFORE:', before.data.values.length, 'rows');
    before.data.values.forEach((r, i) => console.log(`  [${i}] ${r[0]} = ${r[1] || ''}`));

    // Step 2: Clear rows 20-30 (in case there is leftover data)
    await sheets.spreadsheets.values.clear({
        spreadsheetId: SPREADSHEET_ID,
        range: `'${SHEET_NAME}'!A20:C30`,
    });
    console.log('\nCleared A20:C30');

    // Step 3: Write correct COL_* rows starting at row 20
    const colRows = [
        ['COL_ULTG', 'A', 'Kolom ULTG di MASTER ASSET TOWER'],
        ['COL_GI', 'B', 'Kolom Gardu Induk di MASTER ASSET TOWER'],
        ['COL_TOWER_NAME', 'F', 'Kolom Nama Tower di MASTER ASSET TOWER'],
        ['COL_LAT', 'J', 'Kolom Latitude di MASTER ASSET TOWER'],
        ['COL_LONG', 'K', 'Kolom Longitude di MASTER ASSET TOWER'],
    ];

    await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `'${SHEET_NAME}'!A20:C24`,
        valueInputOption: 'RAW',
        requestBody: { values: colRows },
    });
    console.log('Written COL_* rows at A20:C24');

    // Step 4: Verify
    const after = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `'${SHEET_NAME}'!A:C`,
    });
    console.log('\nAFTER:', after.data.values.length, 'rows');
    after.data.values.forEach((r, i) => console.log(`  [${i}] ${(r[0] || '').padEnd(25)} = ${r[1] || '(empty)'}`));
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
