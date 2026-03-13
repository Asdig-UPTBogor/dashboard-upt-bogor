/**
 * Debug filterStrikes — cek berapa yang kena filter UPT, BBOX, dan timestamp
 * 
 * Panggil Vaisala API langsung, lalu hitung per-filter kenapa filtered=0
 */
const BASE = 'http://localhost:3000';

async function debug() {
    // 1. Ambil config
    const cfg = await (await fetch(`${BASE}/api/cron/thor-sync/config`)).json();
    const config = cfg.config;
    console.log('Config:');
    console.log(`  UPT_FILTER: "${config.UPT_FILTER}"`);
    console.log(`  BBOX: lon ${config.BBOX_MIN_LON}..${config.BBOX_MAX_LON}, lat ${config.BBOX_MIN_LAT}..${config.BBOX_MAX_LAT}`);
    console.log(`  LAST_FETCH_TS: "${config.LAST_FETCH_TS}"`);

    // 2. Fetch Vaisala langsung
    console.log('\nFetching Vaisala API...');
    const resp = await fetch(config.VAISALA_URL, {
        headers: {
            'Accept': 'application/json',
            'User-Agent': 'Debug/1.0',
            'Cookie': config.VAISALA_COOKIE,
        },
    });
    const data = await resp.json();
    const strikes = data.map_data || [];
    console.log(`Total strikes from API: ${strikes.length}`);
    console.log(`now_timestamp: "${data.now_timestamp}"`);

    if (strikes.length === 0) {
        console.log('Tidak ada data dari API.');
        return;
    }

    // 3. Sample strike pertama
    const s = strikes[0];
    console.log('\nContoh strike pertama:');
    console.log(`  upt: "${s.upt}"`);
    console.log(`  event_time_wib: "${s.event_time_wib}"`);
    console.log(`  strike_lat: ${s.strike_lat}`);
    console.log(`  strike_lon: ${s.strike_lon}`);
    console.log(`  tower_name: "${s.tower_name}"`);

    // 4. Hitung per filter
    let passUpt = 0, failUpt = 0;
    let passBbox = 0, failBbox = 0;
    let passTs = 0, failTs = 0;
    const lastTs = config.LAST_FETCH_TS || '';
    const uptValues = new Set();

    for (const strike of strikes) {
        uptValues.add(strike.upt);

        // UPT filter
        if (strike.upt !== config.UPT_FILTER) {
            failUpt++;
            continue;
        }
        passUpt++;

        // BBOX filter
        if (
            strike.strike_lon < config.BBOX_MIN_LON ||
            strike.strike_lon > config.BBOX_MAX_LON ||
            strike.strike_lat < config.BBOX_MIN_LAT ||
            strike.strike_lat > config.BBOX_MAX_LAT
        ) {
            failBbox++;
            continue;
        }
        passBbox++;

        // Timestamp dedup
        if (lastTs && strike.event_time_wib <= lastTs) {
            failTs++;
            continue;
        }
        passTs++;
    }

    console.log(`\n=== Filter Breakdown ===`);
    console.log(`UPT values in data: ${[...uptValues].join(', ')}`);
    console.log(`UPT filter "${config.UPT_FILTER}": ${passUpt} pass, ${failUpt} fail`);
    console.log(`BBOX filter: ${passBbox} pass, ${failBbox} fail`);
    console.log(`Timestamp dedup (lastTs="${lastTs}"): ${passTs} pass, ${failTs} fail`);
    console.log(`\nFinal result: ${passTs} strikes would be processed`);
}

debug().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
