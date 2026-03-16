/**
 * create-master-hierarchy-dataset.js
 * 
 * Creates fresh Master Hierarchy dataset per design standard:
 *   - 1 dataset: MASTER_HIERARCHY_UPT_Bogor
 *   - 7 external tables (all sheets, autodetect)
 *   - 5 views (used sheets, simple SELECT * with WHERE filter)
 *   - 5 native tables (materialized from views)
 */
const { BigQuery } = require('@google-cloud/bigquery');
const path = require('path');

const KEY_PATH = path.join(__dirname, '..', 'google-auth', 'key.json');
const PROJECT_ID = 'gcp-bridge-meshvpn';
const LOCATION = 'asia-southeast2';
const DATASET = 'MASTER_HIERARCHY_UPT_Bogor';
const SS_ID = '1vpVUczVs8GB-VHbqxrHpl-EZI66HO2e2fWdU3qfLzeI';
const SS_URL = `https://docs.google.com/spreadsheets/d/${SS_ID}`;

// All 7 sheets → external tables
const ALL_SHEETS = [
    'Master UPT',
    'Master ULTG',
    'Master Gardu Induk',
    'Master Bay',
    'Alias Bay',
    'Koordinat Gardu Induk',
    'Single Line Diagram Gardu Induk',
];

// 5 sheets that need views + native
const ACTIVE_SHEETS = [
    'Master UPT',
    'Master ULTG',
    'Master Gardu Induk',
    'Master Bay',
    'Koordinat Gardu Induk',
];

function normalize(name) {
    return name.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/_$/, '');
}

async function runSQL(bq, label, sql) {
    process.stdout.write(`  ${label} ... `);
    try {
        await bq.query({ query: sql, location: LOCATION });
        console.log('✅');
    } catch (e) {
        console.log(`❌ ${e.message.substring(0, 120)}`);
    }
}

async function main() {
    const bq = new BigQuery({ projectId: PROJECT_ID, keyFilename: KEY_PATH });

    // 1. Create dataset
    console.log(`\n📦 Creating dataset: ${DATASET}`);
    try {
        await bq.createDataset(DATASET, { location: LOCATION });
        console.log('  ✅ Dataset created');
    } catch (e) {
        if (e.message.includes('Already Exists')) console.log('  ⏭ Dataset already exists');
        else console.log(`  ❌ ${e.message}`);
    }

    // 2. Create external tables (all 7 sheets)
    console.log(`\n📋 Creating external tables (${ALL_SHEETS.length}):`);
    for (const sheet of ALL_SHEETS) {
        const tableName = `e_${normalize(sheet)}`;
        const sql = `CREATE OR REPLACE EXTERNAL TABLE \`${PROJECT_ID}.${DATASET}.${tableName}\`
OPTIONS (
  format = 'GOOGLE_SHEETS',
  uris = ['${SS_URL}'],
  sheet_range = '${sheet}',
  skip_leading_rows = 1
)`;
        await runSQL(bq, tableName, sql);
    }

    // 3. Create views (5 active sheets — master views, no JOIN needed)
    console.log(`\n🔍 Creating views (${ACTIVE_SHEETS.length}):`);
    for (const sheet of ACTIVE_SHEETS) {
        const norm = normalize(sheet);
        const viewName = `v_${norm}`;
        const extName = `e_${norm}`;

        // Master views are simple: SELECT * with basic NOT NULL filter
        let whereClause;
        if (sheet === 'Master UPT') {
            whereClause = 'WHERE Master_UPT IS NOT NULL';
        } else if (sheet === 'Master ULTG') {
            whereClause = 'WHERE Master_ULTG IS NOT NULL';
        } else if (sheet === 'Master Gardu Induk') {
            whereClause = 'WHERE Master_Gardu_Induk IS NOT NULL';
        } else if (sheet === 'Master Bay') {
            whereClause = 'WHERE Master_Gardu_Induk IS NOT NULL OR Master_Bay IS NOT NULL';
        } else if (sheet === 'Koordinat Gardu Induk') {
            whereClause = 'WHERE Master_Gardu_Induk IS NOT NULL';
        }

        const sql = `CREATE OR REPLACE VIEW \`${PROJECT_ID}.${DATASET}.${viewName}\` AS
SELECT * FROM \`${PROJECT_ID}.${DATASET}.${extName}\`
${whereClause}`;
        await runSQL(bq, viewName, sql);
    }

    // 4. Create native tables (materialized from views)
    console.log(`\n💾 Creating native tables (${ACTIVE_SHEETS.length}):`);
    for (const sheet of ACTIVE_SHEETS) {
        const norm = normalize(sheet);
        const nativeName = `n_${norm}`;
        const viewName = `v_${norm}`;
        const sql = `CREATE OR REPLACE TABLE \`${PROJECT_ID}.${DATASET}.${nativeName}\` AS
SELECT * FROM \`${PROJECT_ID}.${DATASET}.${viewName}\``;
        await runSQL(bq, nativeName, sql);
    }

    // 5. Verify
    console.log(`\n📊 Verification:`);
    const ds = bq.dataset(DATASET);
    const [tables] = await ds.getTables();
    console.log(`  Total tables: ${tables.length}`);
    for (const t of tables) {
        const [meta] = await t.getMetadata();
        const type = meta.externalDataConfiguration ? 'EXTERNAL' : meta.type;
        const rows = meta.numRows || '-';
        console.log(`  ${t.id.padEnd(40)} ${type.padEnd(10)} rows=${rows}`);
    }
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
