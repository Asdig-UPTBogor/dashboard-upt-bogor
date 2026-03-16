/**
 * audit-bq-current-state.js
 * 
 * Audit semua BQ datasets dan tables di project gcp-bridge-meshvpn.
 * Usage: node utils/audit-bq-current-state.js
 */

const { BigQuery } = require('@google-cloud/bigquery');
const path = require('path');

const KEY_PATH = path.join(__dirname, '..', 'google-auth', 'key.json');
const PROJECT_ID = 'gcp-bridge-meshvpn';

async function main() {
    const bq = new BigQuery({ projectId: PROJECT_ID, keyFilename: KEY_PATH });

    const [datasets] = await bq.getDatasets();
    console.log(`\n${'='.repeat(70)}`);
    console.log(`Total Datasets: ${datasets.length}`);
    console.log('='.repeat(70));

    for (const ds of datasets) {
        const dsId = ds.id;
        const [tables] = await ds.getTables();
        
        console.log(`\n--- ${dsId} (${tables.length} tables) ---`);

        for (const table of tables) {
            const [meta] = await table.getMetadata();
            const name = table.id;
            const type = meta.type;
            const rows = meta.numRows || '-';
            const isExt = meta.externalDataConfiguration ? 'EXTERNAL' : type;
            console.log(`  ${name.padEnd(40)} ${isExt.padEnd(12)} rows=${rows}`);
        }
    }
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
