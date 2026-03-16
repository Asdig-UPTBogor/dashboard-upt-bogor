/**
 * qc-summary.js
 * 
 * Query semua native tables dan tampilkan QC summary per dataset.
 * Pakai @google-cloud/bigquery module, bukan bq CLI.
 */
const { BigQuery } = require('@google-cloud/bigquery');
const path = require('path');

const bq = new BigQuery({
    keyFilename: path.join(__dirname, '..', 'google-auth', 'key.json'),
    projectId: 'gcp-bridge-meshvpn',
});

const DATASETS = [
    'MASTER_HIERARCHY_UPT_Bogor',
    'Dashboard_Gardu_Induk_UPT_Bogor',
    'Master_Transmisi_UPT_Bogor',
    'Master_Asset_Relay_UPT_Bogor',
    'Master_Jadwal_Padam_UPT_Bogor',
];

async function main() {
    console.log('='.repeat(70));
    console.log('QC SUMMARY — All Native Tables');
    console.log('='.repeat(70));

    let totalOK = 0, totalIssue = 0;

    for (const ds of DATASETS) {
        console.log(`\n📦 ${ds}`);

        // Get all native tables
        const [tables] = await bq.dataset(ds).getTables();
        const nativeTables = tables.filter(t => t.id.startsWith('n_'));

        for (const table of nativeTables) {
            const name = table.id;
            const meta = table.metadata;
            const rows = parseInt(meta.numRows || '0');

            // Check if table has qc_hierarchy column
            const [schema] = await bq.dataset(ds).table(name).getMetadata();
            const fields = schema.schema?.fields?.map(f => f.name) || [];
            const hasQC = fields.includes('qc_hierarchy');

            if (hasQC) {
                // Query QC distribution (use actual count, not metadata)
                const [qcRows] = await bq.query({
                    query: `SELECT qc_hierarchy, COUNT(*) cnt FROM \`${ds}.${name}\` GROUP BY qc_hierarchy ORDER BY cnt DESC`,
                });
                const ok = qcRows.find(r => r.qc_hierarchy === 'OK')?.cnt || 0;
                const issues = qcRows.filter(r => r.qc_hierarchy !== 'OK');
                const issueCount = issues.reduce((sum, r) => sum + r.cnt, 0);
                const actualRows = ok + issueCount;
                totalOK += ok;
                totalIssue += issueCount;

                const issueStr = issues.length > 0
                    ? issues.map(r => `${r.qc_hierarchy}=${r.cnt}`).join(', ')
                    : '';
                
                const pct = actualRows > 0 ? Math.round(ok / actualRows * 100) : 0;
                console.log(`  ${name.padEnd(35)} ${String(actualRows).padStart(6)} rows | ${pct}% OK ${issueStr ? '| ⚠️  ' + issueStr : '| ✅'}`);
            } else {
                // For master tables, count directly
                const [countRows] = await bq.query({ query: `SELECT COUNT(*) cnt FROM \`${ds}.${name}\`` });
                const cnt = countRows[0]?.cnt || 0;
                console.log(`  ${name.padEnd(35)} ${String(cnt).padStart(6)} rows | master (no QC)`);
            }
        }
    }

    console.log('\n' + '='.repeat(70));
    console.log(`TOTAL: ${totalOK + totalIssue} rows | ${totalOK} OK (${Math.round(totalOK / (totalOK + totalIssue) * 100)}%) | ${totalIssue} issues`);
    console.log('='.repeat(70));
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
