const { BigQuery } = require('@google-cloud/bigquery');
const path = require('path');

const KEY_PATH = path.join(__dirname, '..', 'google-auth', 'key.json');
const PROJECT_ID = 'gcp-bridge-meshvpn';

const TO_DELETE = [
  'Dashboard_Gardu_Induk_UPT_Bogor',
  'MASTER_HIERARCHY_UPT_Bogor',
  'Master_Asset_Relay_UPT_Bogor',
  'Master_Jadwal_Padam_UPT_Bogor',
  'Master_Transmisi_UPT_Bogor',
];

const TO_KEEP = [
  'dashboard_views',
  'dashboard_native',
  'dashboard_upt_bogor',
];

async function main() {
  const bq = new BigQuery({ projectId: PROJECT_ID, keyFilename: KEY_PATH });

  console.log('KEEPING (used by CR):');
  TO_KEEP.forEach(d => console.log(`  ${d}`));

  console.log('\nDELETING:');
  for (const dsId of TO_DELETE) {
    try {
      await bq.dataset(dsId).delete({ force: true });
      console.log(`  ${dsId} — DELETED`);
    } catch (e) {
      console.log(`  ${dsId} — ERROR: ${e.message}`);
    }
  }

  console.log('\nRemaining datasets:');
  const [datasets] = await bq.getDatasets();
  datasets.forEach(d => console.log(`  ${d.id}`));
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
