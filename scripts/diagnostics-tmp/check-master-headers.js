const { google } = require('googleapis');

async function getHeaders() {
    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: '/home/server-01/Workspace/GCP Project/Dashboard-UPT-Bogor/Google Auth/automaticspreadsheet-de108e1d5b56.json',
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });

        const sheets = google.sheets({ version: 'v4', auth });
        const spreadsheetId = '1wh2ckkEaovH2MueQDXEG1u7HDenry5_D37JpdvqNWak'; // New Master Bay

        const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: "'Master Bay'!A1:Z1" });
        const headers = res.data.values[0] || [];

        console.log("Headers in New Master Bay: ");
        headers.forEach((h, i) => console.log(`${i}: ${h}`));

    } catch (error) {
        console.error("Error:", error.message);
    }
}
getHeaders();
