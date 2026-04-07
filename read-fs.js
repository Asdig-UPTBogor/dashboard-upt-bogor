const { Firestore } = require('@google-cloud/firestore');
const db = new Firestore({ projectId: 'gcp-bridge-meshvpn' });

async function main() {
  const snap = await db.collection('service_runtime_configs').get();
  snap.forEach(doc => {
    if (doc.id === 'wa_notifier') {
      const d = doc.data();
      console.log('=== wa_notifier doc ===');
      for (const [k,v] of Object.entries(d)) {
        if (typeof v === 'object' && v !== null) {
          console.log(`${k}: ${JSON.stringify(v).substring(0, 200)}`);
        } else if (typeof v === 'string' && k.includes('TOKEN')) {
          console.log(`${k}: [MASKED]`);
        } else {
          console.log(`${k}: ${v}`);
        }
      }
    }
  });
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
