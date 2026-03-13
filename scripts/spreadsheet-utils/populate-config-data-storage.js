/**
 * Populate additional Data Storage config rows into Config Thor Vaisala sheet.
 * Adds rows 15-19: DATA_SPREADSHEET_ID, DATA_SPREADSHEET_NAME,
 * DATA_SHEET_OUTPUT, TOWER_SHEET_SOURCE, TOWER_COLUMNS
 *
 * Run: node scripts/spreadsheet-utils/populate-config-data-storage.js
 */

const { google } = require('googleapis');
const path = require('path');

const SPREADSHEET_ID = '1vpVUczVs8GB-VHbqxrHpl-EZI66HO2e2fWdU3qfLzeI';
const SHEET_NAME = 'Config Thor Vaisala';

const NEW_ROWS = [
    ['DATA_SPREADSHEET_ID', '13xm0SqMP5EYbLyYnt5jUPUx1BzhaDffkX4iippq_LuM', 'Spreadsheet ID data petir & tower'],
    ['DATA_SPREADSHEET_NAME', 'Master Transmisi - UPT Bogor', 'Nama spreadsheet data'],
    ['DATA_SHEET_OUTPUT', '1.DATA PETIR', 'Sheet untuk append data petir baru'],
    ['TOWER_SHEET_SOURCE', 'Master Transmisi', 'Sheet sumber data tower (read-only)'],
    ['TOWER_COLUMNS', 'A=ULTG, B=Gardu Induk, G=Nama Tower, W=LAT, X=LONG', 'Kolom tower yang dipakai worker'],
];

async function main() {
    const auth = new google.auth.GoogleAuth({
        keyFile: path.resolve(__dirname, '../../../Google Auth/automaticspreadsheet-de108e1d5b56.json'),
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    console.log('📋 Adding Data Storage config rows to Config Thor Vaisala...');
    console.log(`   Spreadsheet: ${SPREADSHEET_ID}`);
    console.log(`   Sheet: ${SHEET_NAME}`);
    console.log(`   New rows: ${NEW_ROWS.length}`);

    // Append after existing 14 config rows + 1 header = row 16 onward
    const range = `'${SHEET_NAME}'!A16:C20`;

    await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range,
        valueInputOption: 'RAW',
        requestBody: { values: NEW_ROWS },
    });

    console.log(`\n✅ Written ${NEW_ROWS.length} rows to '${SHEET_NAME}'!A16:C20`);

    // Verify
    const verify = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `'${SHEET_NAME}'!A1:C25`,
    });

    console.log(`\n📋 Full config (${verify.data.values.length} rows):`);
    verify.data.values.forEach((row, i) => {
        const tag = i === 0 ? '[H]' : `[${i}]`;
        console.log(`  ${tag} ${row[0]} = ${row[1] || '(empty)'}`);
    });

    console.log('\n🎉 Done! Data Storage config added.');
}

main().catch((e) => console.error('ERROR:', e.message));
