/**
 * dump-bq-view-sources.js
 * Extracts SQL definitions from all views in dashboard_views 
 * to find which external tables/spreadsheets they reference
 */
const { BigQuery } = require('@google-cloud/bigquery');
const path = require('path');

const KEY_PATH = path.join(__dirname, '..', 'google-auth', 'key.json');
const PROJECT_ID = 'gcp-bridge-meshvpn';

async function main() {
    const bq = new BigQuery({ projectId: PROJECT_ID, keyFilename: KEY_PATH });
    
    // Get all views from dashboard_views and their SQL
    const [rows] = await bq.query({
        query: `
            SELECT table_name, view_definition
            FROM \`gcp-bridge-meshvpn.dashboard_views.INFORMATION_SCHEMA.VIEWS\`
            ORDER BY table_name
        `,
        location: 'asia-southeast2',
    });
    
    console.log(`Found ${rows.length} views\n`);
    
    // Extract source references from each view
    for (const row of rows) {
        console.log(`--- ${row.table_name} ---`);
        // Find FROM clauses to see what tables/externals they reference
        const sql = row.view_definition;
        const fromRefs = sql.match(/FROM\s+`[^`]+`/gi) || [];
        const joinRefs = sql.match(/JOIN\s+`[^`]+`/gi) || [];
        console.log(`  Sources: ${[...fromRefs, ...joinRefs].join(', ')}`);
        console.log(`  SQL (first 200): ${sql.substring(0, 200)}`);
        console.log('');
    }
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
