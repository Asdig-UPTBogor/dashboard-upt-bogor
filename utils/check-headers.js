const { google } = require('googleapis');
const path = require('path');
const auth = new google.auth.GoogleAuth({ keyFile: path.join(__dirname, '..', 'google-auth', 'key.json'), scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] });
const sheets = google.sheets({ version: 'v4', auth });

function normalizeCol(name) {
    let n = name.replace(/[^a-zA-Z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
    if (['NO'].includes(n.toUpperCase())) n = n + '_';
    return n;
}

(async () => {
    // Jadwal Padam
    let res = await sheets.spreadsheets.values.get({ spreadsheetId: '1Ktsov6WR0CRo31T9pZGo4nEBhMW5MoJ7ectXQyqz0vk', range: "'Jadwal Padam'!1:1" });
    let headers = (res.data.values?.[0] || []).filter(h => h && h.trim()).map(h => normalizeCol(h));
    console.log('JADWAL PADAM:');
    console.log(headers.map(h => `${h} STRING`).join(', '));
    
    // Healthy Index Tower
    res = await sheets.spreadsheets.values.get({ spreadsheetId: '13xm0SqMP5EYbLyYnt5jUPUx1BzhaDffkX4iippq_LuM', range: "'5.HEALTHY INDEX TOWER'!1:1" });
    headers = (res.data.values?.[0] || []).filter(h => h && h.trim()).map(h => normalizeCol(h));
    console.log('\nHEALTHY INDEX TOWER:');
    console.log(headers.map(h => `${h} STRING`).join(', '));
})();
