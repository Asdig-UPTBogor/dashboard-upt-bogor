const { google } = require('googleapis');

async function checkSheet() {
    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: '/home/server-01/Workspace/GCP Project/Dashboard-UPT-Bogor/Google Auth/automaticspreadsheet-de108e1d5b56.json',
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });
        const sheets = google.sheets({ version: 'v4', auth });
        const spreadsheetId = '1A-x4WiaSazBdtx051TdhCBqNKpPpcbMWVFVyWSFUdo4';

        const res = await sheets.spreadsheets.get({ spreadsheetId });
        console.log(`Spreadsheet Title: ${res.data.properties.title}`);

        for (const sheet of res.data.sheets) {
            const title = sheet.properties.title;
            const resData = await sheets.spreadsheets.values.get({ spreadsheetId, range: `'${title}'!A1:Z1` });
            const headers = resData.data.values ? resData.data.values[0] : [];
            console.log(`\nSheet: ${title}`);
            console.log(`Headers: ${headers.join(', ')}`);
        }
    } catch (e) {
        console.error(e.message);
    }
}
checkSheet();
