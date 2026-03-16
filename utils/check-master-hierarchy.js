/**
 * check-master-hierarchy.js
 * 
 * Cek isi 4 sheet Master Hierarchy dari Google Spreadsheet.
 * Usage: node utils/check-master-hierarchy.js
 */

const { google } = require('googleapis');
const path = require('path');

const KEY_PATH = path.join(__dirname, '..', 'google-auth', 'key.json');
const SSID = '1vpVUczVs8GB-VHbqxrHpl-EZI66HO2e2fWdU3qfLzeI';
const SHEETS = ['Master UPT', 'Master ULTG', 'Master Gardu Induk', 'Master Bay'];

async function main() {
    const auth = new google.auth.GoogleAuth({
        keyFile: KEY_PATH,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    const api = google.sheets({ version: 'v4', auth });

    for (const name of SHEETS) {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`📋 ${name}`);
        console.log('='.repeat(60));

        const res = await api.spreadsheets.values.get({
            spreadsheetId: SSID,
            range: name,
        });

        const rows = res.data.values || [];
        if (rows.length === 0) {
            console.log('  (empty)');
            continue;
        }

        const headers = rows[0];
        console.log(`Headers (${headers.length} cols): ${JSON.stringify(headers)}`);
        console.log(`Total data rows: ${rows.length - 1}`);
        console.log('---');

        // Print first 10 rows
        const preview = rows.slice(1, 11);
        for (const row of preview) {
            const obj = {};
            headers.forEach((h, i) => { obj[h] = row[i] || ''; });
            console.log(`  ${JSON.stringify(obj)}`);
        }

        if (rows.length > 11) {
            console.log(`  ... (${rows.length - 1} total rows)`);
        }
    }
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
