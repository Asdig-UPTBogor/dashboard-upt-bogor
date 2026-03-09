const { google } = require('googleapis');

async function testSource() {
    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: '/home/server-01/Workspace/GCP Project/Dashboard-UPT-Bogor/Google Auth/automaticspreadsheet-de108e1d5b56.json',
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });
        const sheets = google.sheets({ version: 'v4', auth });
        
        const res = await sheets.spreadsheets.get({ spreadsheetId: '1l4bEa9xbXvJfK7Q2kUYs4AI-lJW7mTbsYPvDFWjnCs8' });
        console.log('ID Sheet Sumber:', res.data.spreadsheetId);
        console.log('Judul Spreadsheet:', res.data.properties.title);
        const sheetTitles = res.data.sheets.map(s => s.properties.title);
        console.log('Daftar Sheet di dalamnya:', sheetTitles);
        
        // Coba baca juga headernya
        const resTarget = await sheets.spreadsheets.values.get({ 
            spreadsheetId: '1l4bEa9xbXvJfK7Q2kUYs4AI-lJW7mTbsYPvDFWjnCs8', 
            range: 'GI!A7:R8' 
        });
        console.log('\nData Preview (A7:R8):');
        console.log(resTarget.data.values);

    } catch(err) {
         console.error(err.message);
    }
}
testSource();
