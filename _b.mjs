import { Firestore } from '@google-cloud/firestore';
import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';
const fs = new Firestore({ projectId: 'gcp-bridge-meshvpn' });
const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] });
const sheets = google.sheets({ version: 'v4', auth: await auth.getClient() });

const dsSnap = await fs.collection('data_sources').get();
let fixed = 0;
for (const doc of dsSnap.docs) {
  if (doc.id === '_settings') continue;
  const d = doc.data();
  const ssid = d.spreadsheetId;
  if (!ssid) continue;
  const sheetCfgs = d.sheets || {};
  const need = Object.entries(sheetCfgs).filter(([, c]) => !c.sheetId || c.sheetId === 0);
  if (need.length === 0) continue;
  const meta = await sheets.spreadsheets.get({ spreadsheetId: ssid, fields: 'sheets.properties(sheetId,title)' });
  const map = new Map((meta.data.sheets || []).map(s => [s.properties.title, s.properties.sheetId]));
  const newSheets = { ...sheetCfgs };
  for (const [name] of need) {
    const sid = map.get(name);
    if (sid != null) {
      newSheets[name] = { ...newSheets[name], sheetId: sid };
      console.log(`  ${doc.id} / ${name} → sheetId=${sid}`);
      fixed++;
    }
  }
  await fs.collection('data_sources').doc(doc.id).update({ sheets: newSheets });
}
console.log(`\n✓ Fixed ${fixed} sheets`);
