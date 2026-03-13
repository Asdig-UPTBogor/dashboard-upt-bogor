/**
 * Fix Config Thor Vaisala sheet:
 * 1. Replace TOWER_COLUMNS (one combined string) with individual COL_* rows
 * 2. Update column letters to match actual MASTER ASSET TOWER layout:
 *    - A = MASTER ULTG, B = MASTER GARDU INDUK, F = NAMA TOWER, J = LAT, K = LONG
 *
 * Usage: node scripts/spreadsheet-utils/fix-thor-column-config.js
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

    // Replace row 20 (TOWER_COLUMNS) with 5 individual COL_* rows
    const newRows = [
        ['COL_ULTG', 'A', 'Kolom ULTG di MASTER ASSET TOWER'],
        ['COL_GI', 'B', 'Kolom Gardu Induk di MASTER ASSET TOWER'],
        ['COL_TOWER_NAME', 'F', 'Kolom Nama Tower di MASTER ASSET TOWER'],
        ['COL_LAT', 'J', 'Kolom Latitude di MASTER ASSET TOWER'],
        ['COL_LONG', 'K', 'Kolom Longitude di MASTER ASSET TOWER'],
    ];

    // Row 20 = A20 (0-indexed row 19 = TOWER_COLUMNS)
    // Replace it with 5 rows starting at A20
    const range = `'${SHEET_NAME}'!A20:C24`;

    await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range,
        valueInputOption: 'RAW',
        requestBody: { values: newRows },
    });

    console.log(`✅ Replaced TOWER_COLUMNS with 5 individual COL_* rows at A20:C24`);
    console.log('   COL_ULTG = A');
    console.log('   COL_GI = B');
    console.log('   COL_TOWER_NAME = F');
    console.log('   COL_LAT = J');
    console.log('   COL_LONG = K');

    // Verify
    const verify = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `'${SHEET_NAME}'!A1:C25`,
    });

    console.log(`\n=== Verified (${verify.data.values.length} rows) ===`);
    verify.data.values.forEach((row, i) => {
        const tag = i === 0 ? '[H]' : `[${String(i).padStart(2)}]`;
        console.log(`${tag} ${(row[0] || '').padEnd(25)} = ${row[1] || '(empty)'}`);
    });
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
