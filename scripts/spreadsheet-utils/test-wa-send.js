/**
 * Test kirim WA ke grup maintenance via MaxChat API
 * Ambil config dari thor-sync/config, lalu POST langsung ke MaxChat.
 */
const BASE = 'http://localhost:3000';

async function main() {
    // 1. Ambil config
    const cfgResp = await fetch(`${BASE}/api/cron/thor-sync/config`);
    const cfgData = await cfgResp.json();
    const c = cfgData.config;

    console.log('Config:');
    console.log(`  MAXCHAT_URL: ${c.MAXCHAT_URL}`);
    console.log(`  MAXCHAT_TOKEN: ${c.MAXCHAT_TOKEN ? 'ada (' + c.MAXCHAT_TOKEN.length + ' chars)' : 'KOSONG'}`);
    console.log(`  GROUP_MAINTENANCE: ${c.MAXCHAT_GROUP_MAINTENANCE || 'KOSONG'}`);
    console.log(`  GROUP_THOR: ${c.MAXCHAT_GROUP_ID_THOR || 'KOSONG'}`);
    console.log(`  MODE: ${c.MAXCHAT_MODE}`);

    // 2. Kirim test WA ke grup maintenance
    const groupId = c.MAXCHAT_GROUP_MAINTENANCE;
    if (!groupId) {
        console.error('GROUP_MAINTENANCE kosong!');
        return;
    }

    const msg = `⚡ Thor Vaisala Sync\n⏰ ${new Date().toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour12: false })} WIB\n🧪 *Test dari Dashboard Serverless*`;

    // Format Docker: {"to": groupId, "type": "text", "text": message}
    const body = { to: groupId, type: 'text', text: msg };

    console.log('\nKirim WA...');
    console.log(`  to: ${groupId}`);
    console.log(`  body: ${JSON.stringify(body).slice(0, 200)}`);

    const resp = await fetch(c.MAXCHAT_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${c.MAXCHAT_TOKEN}`,
        },
        body: JSON.stringify(body),
    });

    console.log(`\nResponse: ${resp.status} ${resp.statusText}`);
    const respBody = await resp.text();
    console.log(`Body: ${respBody.slice(0, 300)}`);
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
