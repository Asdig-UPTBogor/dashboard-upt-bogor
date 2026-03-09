const { google } = require('googleapis');

async function readSample() {
    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: '/home/server-01/Workspace/GCP Project/Dashboard-UPT-Bogor/Google Auth/automaticspreadsheet-de108e1d5b56.json',
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });
        const sheets = google.sheets({ version: 'v4', auth });
        const spreadsheetId = '1vpVUczVs8GB-VHbqxrHpl-EZI66HO2e2fWdU3qfLzeI';

        const ranges = ['Master Gardu Induk!A1:Z10', 'Master Bay!A1:Z5'];

        for (const range of ranges) {
            console.log(`\n--- Reading ${range} ---`);
            const resData = await sheets.spreadsheets.values.get({ spreadsheetId, range });
            const rows = resData.data.values;
            if (rows) {
                rows.forEach((row, idx) => {
                    console.log(`Row ${idx + 1}: ${row.join(' | ')}`);
                });
            } else {
                console.log('No data found.');
            }
        }
    } catch (e) {
        console.error("Error API:", e.message);
    }
}

readSample();
