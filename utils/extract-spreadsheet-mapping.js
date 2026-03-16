/**
 * extract-spreadsheet-mapping.js
 * Extracts spreadsheet IDs from all external tables across all datasets
 */
const { BigQuery } = require('@google-cloud/bigquery');
const path = require('path');

const KEY_PATH = path.join(__dirname, '..', 'google-auth', 'key.json');
const PROJECT_ID = 'gcp-bridge-meshvpn';

async function main() {
    const bq = new BigQuery({ projectId: PROJECT_ID, keyFilename: KEY_PATH });
    const [datasets] = await bq.getDatasets();

    const spreadsheetMap = {}; // ssId → { name, sheets: [{dataset, table, sheetRange}] }

    for (const ds of datasets) {
        const [tables] = await ds.getTables();
        for (const table of tables) {
            const [meta] = await table.getMetadata();
            const ext = meta.externalDataConfiguration;
            if (ext && ext.sourceFormat === 'GOOGLE_SHEETS') {
                const uri = ext.sourceUris?.[0] || '';
                const ssId = uri.match(/\/d\/([^/]+)/)?.[1] || 'unknown';
                const range = ext.googleSheetsOptions?.range || '(full sheet)';
                
                if (!spreadsheetMap[ssId]) spreadsheetMap[ssId] = { sheets: [] };
                spreadsheetMap[ssId].sheets.push({
                    dataset: ds.id,
                    table: table.id,
                    range,
                });
            }
        }
    }

    console.log('=== SPREADSHEET → EXTERNAL TABLE MAPPING ===\n');
    for (const [ssId, info] of Object.entries(spreadsheetMap)) {
        console.log(`Spreadsheet ID: ${ssId}`);
        console.log(`  URL: https://docs.google.com/spreadsheets/d/${ssId}`);
        for (const sh of info.sheets) {
            console.log(`  [${sh.dataset}] ${sh.table} → range: "${sh.range}"`);
        }
        console.log('');
    }
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
