/**
 * Test Thor worker: restart + validate config + test sync.
 * Usage: node scripts/spreadsheet-utils/test-thor-worker.js
 */

const BASE = 'http://localhost:3000';

async function test() {
    // 1. Restart (clear cache)
    console.log('=== Step 1: Restart Worker (clear cache) ===');
    const restart = await fetch(`${BASE}/api/cron/thor-sync/restart`, { method: 'POST' });
    const restartData = await restart.json();
    console.log(`Status: ${restart.status}`, restartData);

    // 2. Config (reload from sheet + validate)
    console.log('\n=== Step 2: Load Config + Validate ===');
    const config = await fetch(`${BASE}/api/cron/thor-sync/config`);
    const configData = await config.json();
    console.log(`Status: ${config.status}`);
    console.log(`IS_ACTIVE: ${configData.config?.IS_ACTIVE}`);
    console.log(`Tower Count: ${configData.towerCount}`);
    console.log(`Consecutive Errors: ${configData.consecutiveErrors}`);
    console.log(`Column Config: ULTG=${configData.config?.COL_ULTG}, GI=${configData.config?.COL_GI}, Tower=${configData.config?.COL_TOWER_NAME}, LAT=${configData.config?.COL_LAT}, LONG=${configData.config?.COL_LONG}`);
    console.log('\nValidations:');
    (configData.validations || []).forEach(v => {
        const icon = v.status === 'ok' ? '✅' : v.status === 'error' ? '❌' : '⚠️';
        console.log(`  ${icon} ${v.field}: ${v.message}`);
    });

    // 3. Sync (trigger one cycle)
    console.log('\n=== Step 3: Trigger Sync ===');
    const sync = await fetch(`${BASE}/api/cron/thor-sync`);
    const syncData = await sync.json();
    console.log(`Status: ${sync.status}`, JSON.stringify(syncData, null, 2));
}

test().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
