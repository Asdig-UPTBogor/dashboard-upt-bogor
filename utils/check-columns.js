const { Firestore } = require('@google-cloud/firestore');
const db = new Firestore({ projectId: 'gcp-bridge-meshvpn', keyFilename: 'google-auth/key.json' });

(async () => {
  // Check a few pages for columnsUsed
  const pages = ['overview', 'gardu-induk--hi-trafo', 'transmisi--asset'];
  for (const id of pages) {
    const doc = await db.collection('dashboard_pages').doc(id).get();
    const data = doc.data();
    console.log(`\n=== ${id} ===`);
    for (const ds of (data.dataSources || [])) {
      console.log(`\n  ${ds.sheetName}:`);
      console.log(`    dataset: ${ds.dataset}`);
      console.log(`    tableName: ${ds.tableName}`);
      console.log(`    hierarchyLevel: ${ds.hierarchyLevel}`);
      if (ds.columnsUsed && ds.columnsUsed.length > 0) {
        console.log(`    columnsUsed: ✅ ${ds.columnsUsed.length} cols`);
        ds.columnsUsed.forEach(c => console.log(`      - ${typeof c === 'object' ? JSON.stringify(c) : c}`));
      } else {
        console.log(`    columnsUsed: ❌ NOT SET`);
      }
      if (ds.hierarchyMapping) {
        console.log(`    hierarchyMapping: ${JSON.stringify(ds.hierarchyMapping)}`);
      }
    }
  }
  process.exit(0);
})();
