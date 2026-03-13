/**
 * Standalone test WA — baca config dari Google Sheets langsung,
 * test kirim ke grup maintenance via 3 endpoint:
 * 1. /api/messages (direct)
 * 2. /api/messages?skipBusy=true 
 * 3. /api/queue (queue)
 */
const { google } = require('googleapis');
const path = require('path');

const CONFIG_SPREADSHEET_ID = '1vpVUczVs8GB-VHbqxrHpl-EZI66HO2e2fWdU3qfLzeI';
const CONFIG_SHEET = 'Config Thor Vaisala';
const CREDS = '/home/server-01/Workspace/Automatic Spreadsheet N8N/Google Auth/automaticspreadsheet-de108e1d5b56.json';

async function getConfig() {
    const auth = new google.auth.GoogleAuth({
        keyFile: CREDS,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });
    const result = await sheets.spreadsheets.values.get({
        spreadsheetId: CONFIG_SPREADSHEET_ID,
        range: `'${CONFIG_SHEET}'!A:B`,
    });
    const map = {};
    for (const row of result.data.values || []) {
        if (row[0]) map[row[0]] = row[1] || '';
    }
    return map;
}

async function testSend(label, url, token, groupId, msg) {
    console.log(`\n--- ${label} ---`);
    console.log(`URL: ${url}`);
    const body = { to: groupId, type: 'text', text: msg };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
        const resp = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify(body),
            signal: controller.signal,
        });
        clearTimeout(timeout);
        const respBody = await resp.text();
        console.log(`Status: ${resp.status} ${resp.statusText}`);
        console.log(`Body: ${respBody.slice(0, 300)}`);
        return resp.status;
    } catch (e) {
        clearTimeout(timeout);
        console.log(`ERROR: ${e.message}`);
        return 0;
    }
}

async function main() {
    console.log('=== Standalone WA Test ===\n');

    // 1. Baca config dari sheet
    console.log('Loading config from Google Sheets...');
    const cfg = await getConfig();

    const url = cfg.MAXCHAT_URL;
    const token = cfg.MAXCHAT_TOKEN;
    const groupMaint = cfg.MAXCHAT_GROUP_MAINTENANCE;
    const groupProd = cfg.MAXCHAT_GROUP_ID_THOR;

    console.log(`MAXCHAT_URL: ${url}`);
    console.log(`TOKEN: ${token ? token.slice(0, 4) + '...' + token.slice(-4) : 'KOSONG'}`);
    console.log(`GROUP_MAINTENANCE: ${groupMaint}`);
    console.log(`GROUP_PRODUCTION: ${groupProd}`);

    if (!url || !token || !groupMaint) {
        console.error('\nConfig tidak lengkap!');
        return;
    }

    // 2. Cek ping dulu
    console.log('\n--- Ping ---');
    try {
        const controller = new AbortController();
        setTimeout(() => controller.abort(), 5000);
        const ping = await fetch(url.replace('/api/messages', '/api/ping'), {
            headers: { 'Authorization': `Bearer ${token}` },
            signal: controller.signal,
        });
        const pingBody = await ping.text();
        console.log(`Ping: ${ping.status} — ${pingBody}`);
    } catch (e) {
        console.log(`Ping ERROR: ${e.message}`);
    }

    // 3. Cek busy status
    console.log('\n--- Busy check ---');
    try {
        const controller = new AbortController();
        setTimeout(() => controller.abort(), 5000);
        const busy = await fetch(url.replace('/api/messages', '/api/system/busy'), {
            headers: { 'Authorization': `Bearer ${token}` },
            signal: controller.signal,
        });
        const busyBody = await busy.text();
        console.log(`Busy: ${busy.status} — ${busyBody}`);
    } catch (e) {
        console.log(`Busy ERROR: ${e.message}`);
    }

    const ts = new Date().toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour12: false });
    const msg = `🧪 Test Standalone\n⏰ ${ts} WIB\nDari script tanpa Next.js`;

    // 4. Test semua endpoint
    await testSend('Direct /api/messages', url, token, groupMaint, msg);
    await testSend('Direct ?skipBusy=true', url + '?skipBusy=true', token, groupMaint, msg);
    await testSend('Queue /api/queue', url.replace('/api/messages', '/api/queue'), token, groupMaint, msg);

    console.log('\n=== Done ===');
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
