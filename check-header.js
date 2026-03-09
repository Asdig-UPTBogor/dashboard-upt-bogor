const { google } = require('googleapis');
async function run() {
    console.log("Starting check...");
    const auth = new google.auth.GoogleAuth({
        keyFile: '/home/server-01/Workspace/GCP Project/Dashboard-UPT-Bogor/Google Auth/automaticspreadsheet-de108e1d5b56.json',
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    const sheets = google.sheets({ version: 'v4', auth });
    
    // SS 2: General Information
    const ssGenId = '1A-x4WiaSazBdtx051TdhCBqNKpPpcbMWVFVyWSFUdo4';
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: ssGenId, range: `'GARDU INDUK'!A1:Z1` });
    console.log("Headers in General Information:");
    console.log(res.data.values[0]);
    process.exit(0);
}
run();
