/**
 * Thor Dev Scheduler — trigger sync tiap 60 detik
 * 
 * Menggantikan Cloud Scheduler di dev mode.
 * Jalankan: node scripts/spreadsheet-utils/thor-dev-scheduler.js
 * Stop: Ctrl+C
 */
const BASE = 'http://localhost:3000';
const INTERVAL = 60_000; // 60 detik

let cycle = 0;

async function triggerSync() {
    cycle++;
    const t0 = Date.now();
    try {
        const resp = await fetch(`${BASE}/api/cron/thor-sync`);
        const data = await resp.json();
        const dt = Date.now() - t0;
        const ts = new Date().toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour12: false });

        console.log(
            `[${ts}] #${cycle} ${data.status} | ` +
            `strikes=${data.totalStrikes || 0} filtered=${data.filtered || 0} ` +
            `appended=${data.appended || 0} | ${dt}ms`
        );
    } catch (e) {
        console.error(`[#${cycle}] ERROR: ${e.message}`);
    }
}

console.log('=== Thor Dev Scheduler ===');
console.log(`Trigger setiap ${INTERVAL / 1000} detik`);
console.log('Ctrl+C untuk stop\n');

// Trigger pertama langsung
triggerSync();

// Lalu tiap 60 detik
setInterval(triggerSync, INTERVAL);
