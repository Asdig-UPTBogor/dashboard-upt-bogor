/**
 * Test Thor logs after config fix.
 * Usage: node scripts/spreadsheet-utils/test-thor-logs.js
 */
const BASE = 'http://localhost:3000';

async function test() {
    // 1. Restart to clear cache + buffer
    console.log('=== 1. Restart ===');
    await (await fetch(`${BASE}/api/cron/thor-sync/restart`, { method: 'POST' })).json();

    // 2. Check initial logs (should have "Cache cleared" entry)
    console.log('\n=== 2. Logs after restart ===');
    let logs = await (await fetch(`${BASE}/api/cron/thor-sync/logs`)).json();
    console.log(`Entries: ${logs.entries.length}`);
    logs.entries.forEach(e => console.log(`  [${e.level}] ${e.message}`));

    // 3. Load config (triggers cache miss → thorLog calls)
    console.log('\n=== 3. Load config ===');
    const config = await (await fetch(`${BASE}/api/cron/thor-sync/config`)).json();
    console.log(`Status: ${config.status}, Towers: ${config.towerCount}`);

    // 4. Check logs again (should have config load entries)
    console.log('\n=== 4. Logs after config load ===');
    logs = await (await fetch(`${BASE}/api/cron/thor-sync/logs`)).json();
    console.log(`Entries: ${logs.entries.length}`);
    logs.entries.forEach(e => console.log(`  [${e.level}] ${e.message}`));

    // 5. Trigger sync
    console.log('\n=== 5. Trigger sync ===');
    const sync = await (await fetch(`${BASE}/api/cron/thor-sync`)).json();
    console.log(`Status: ${sync.status}, Towers: ${sync.towerCount}, Duration: ${sync.durationMs}ms`);

    // 6. Final logs (should have sync entries too)
    console.log('\n=== 6. Final logs ===');
    logs = await (await fetch(`${BASE}/api/cron/thor-sync/logs`)).json();
    console.log(`Entries: ${logs.entries.length}`);
    logs.entries.forEach(e => console.log(`  [${e.level}] ${e.message}`));
}

test().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
