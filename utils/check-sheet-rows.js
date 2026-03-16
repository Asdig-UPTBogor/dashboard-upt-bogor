/**
 * check-sheet-rows.js
 * 
 * Read first 3 rows from specific sheets to check header position.
 */
const { google } = require('googleapis');
const path = require('path');

const KEY_PATH = path.join(__dirname, '..', 'google-auth', 'key.json');
const auth = new google.auth.GoogleAuth({
    keyFile: KEY_PATH,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});
const sheetsApi = google.sheets({ version: 'v4', auth });

const CHECKS = [
    { id: '1vpVUczVs8GB-VHbqxrHpl-EZI66HO2e2fWdU3qfLzeI', sheet: 'Master Gardu Induk' },
    { id: '1vpVUczVs8GB-VHbqxrHpl-EZI66HO2e2fWdU3qfLzeI', sheet: 'Master Bay' },
    { id: '1aSi-mBeRnpUvSuNQ_U4HZbLxpmqwt2Fwh8koJVslqIg', sheet: 'MTU TRAFO' },
    { id: '13xm0SqMP5EYbLyYnt5jUPUx1BzhaDffkX4iippq_LuM', sheet: '5.HEALTHY INDEX TOWER' },
];

async function main() {
    for (const c of CHECKS) {
        console.log(`\n${'─'.repeat(70)}`);
        console.log(`Sheet: "${c.sheet}"`);
        console.log(`${'─'.repeat(70)}`);

        // Read first 5 rows
        const res = await sheetsApi.spreadsheets.values.get({
            spreadsheetId: c.id,
            range: `'${c.sheet}'!A1:AZ5`,
            valueRenderOption: 'UNFORMATTED_VALUE',
        });

        const rows = res.data.values || [];
        for (let i = 0; i < Math.min(rows.length, 5); i++) {
            const cells = rows[i] || [];
            console.log(`  Row ${i + 1}: [${cells.map(c => typeof c === 'string' ? `"${c}"` : c).join(' | ')}]`);
        }
        
        // Also check sheet properties for frozen rows, etc.
        const meta = await sheetsApi.spreadsheets.get({
            spreadsheetId: c.id,
            includeGridData: false,
        });
        const sheet = meta.data.sheets?.find(s => s.properties?.title === c.sheet);
        if (sheet) {
            const props = sheet.properties?.gridProperties;
            console.log(`  Grid: ${props?.rowCount} rows × ${props?.columnCount} cols | frozenRows: ${props?.frozenRowCount || 0} | frozenCols: ${props?.frozenColumnCount || 0}`);
        }
    }
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
