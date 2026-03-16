/**
 * dump-firestore-registry-rest.js
 * Reads Firestore registry using REST API (same auth as dashboard)
 */
const { GoogleAuth } = require('google-auth-library');
const path = require('path');

const KEY_PATH = path.join(__dirname, '..', 'google-auth', 'key.json');
const PROJECT_ID = 'gcp-bridge-meshvpn';
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

const auth = new GoogleAuth({
    keyFile: KEY_PATH,
    scopes: ['https://www.googleapis.com/auth/datastore'],
});

function decode(val) {
    if (!val) return null;
    if ('stringValue' in val) return val.stringValue;
    if ('integerValue' in val) return Number(val.integerValue);
    if ('booleanValue' in val) return val.booleanValue;
    if ('arrayValue' in val) return (val.arrayValue.values || []).map(decode);
    if ('mapValue' in val) {
        const obj = {};
        for (const [k, v] of Object.entries(val.mapValue.fields || {})) obj[k] = decode(v);
        return obj;
    }
    return null;
}

async function main() {
    const client = await auth.getClient();
    const token = await client.getAccessToken();

    // 1. Get registry_root
    console.log('=== registry_root ===');
    let res = await fetch(`${BASE_URL}/dashboard_meta/registry_root`, {
        headers: { Authorization: `Bearer ${token.token}` },
    });
    const regDoc = await res.json();
    const reg = {};
    for (const [k, v] of Object.entries(regDoc.fields || {})) reg[k] = decode(v);
    
    const spreadsheets = reg.spreadsheets || [];
    for (const ss of spreadsheets) {
        console.log(`\nSpreadsheet: "${ss.label}"`);
        console.log(`  ID: ${ss.spreadsheetId}`);
        const sheets = ss.sheets || [];
        for (const sh of sheets) {
            console.log(`  Sheet: "${sh.sheetName}" → usedBy: ${JSON.stringify(sh.usedBy || [])}`);
        }
    }

    // 2. Get all page configs for spreadsheetId
    console.log('\n\n=== dashboard_pages (spreadsheetId per dataSource) ===');
    res = await fetch(`${BASE_URL}/dashboard_pages`, {
        headers: { Authorization: `Bearer ${token.token}` },
    });
    const pagesDoc = await res.json();
    
    for (const doc of (pagesDoc.documents || [])) {
        const docId = doc.name.split('/').pop();
        const data = {};
        for (const [k, v] of Object.entries(doc.fields || {})) data[k] = decode(v);
        
        const sources = data.dataSources || [];
        const hasSSId = sources.some(s => s.spreadsheetId);
        if (hasSSId) {
            console.log(`\n📄 ${docId} (page: ${data.page})`);
            for (const ds of sources) {
                if (ds.spreadsheetId) {
                    console.log(`  Sheet: "${ds.sheetName}" → ssId: ${ds.spreadsheetId}`);
                }
            }
        }
    }
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
