/**
 * get-spreadsheet-names.js
 * Fetches actual spreadsheet titles via Google Sheets API
 */
const { google } = require('googleapis');
const path = require('path');

const KEY_PATH = path.join(__dirname, '..', 'google-auth', 'key.json');
const auth = new google.auth.GoogleAuth({ keyFile: KEY_PATH, scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] });
const sheets = google.sheets({ version: 'v4', auth });

const IDS = [
    '13xm0SqMP5EYbLyYnt5jUPUx1BzhaDffkX4iippq_LuM',
    '1vpVUczVs8GB-VHbqxrHpl-EZI66HO2e2fWdU3qfLzeI',
    '1RDb1cBtjCo0rBN1goWXV4-VG75fof_K5ZiFP-L7wwW8',
    '1Ktsov6WR0CRo31T9pZGo4nEBhMW5MoJ7ectXQyqz0vk',
    '1aSi-mBeRnpUvSuNQ_U4HZbLxpmqwt2Fwh8koJVslqIg',
];

async function main() {
    for (const id of IDS) {
        const res = await sheets.spreadsheets.get({ spreadsheetId: id, fields: 'properties.title,sheets.properties.title' });
        const title = res.data.properties.title;
        const sheetNames = res.data.sheets.map(s => s.properties.title);
        console.log(`\nSpreadsheet: "${title}"`);
        console.log(`  ID: ${id}`);
        console.log(`  Dataset name: ${title.replace(/[^a-zA-Z0-9]/g, '_')}`);
        console.log(`  Sheets (${sheetNames.length}):`);
        sheetNames.forEach(s => console.log(`    - "${s}"`));
    }
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
