/**
 * Dump Firestore: dashboard_pages + data_sources
 * Uses same auth pattern as existing utils/dump-firestore-registry.js
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
    if ('doubleValue' in val) return val.doubleValue;
    if ('booleanValue' in val) return val.booleanValue;
    if ('nullValue' in val) return null;
    if ('arrayValue' in val) return (val.arrayValue.values || []).map(decode);
    if ('mapValue' in val) {
        const obj = {};
        for (const [k, v] of Object.entries(val.mapValue.fields || {})) obj[k] = decode(v);
        return obj;
    }
    return null;
}

function decodeDoc(doc) {
    const id = doc.name.split('/').pop();
    const fields = {};
    for (const [k, v] of Object.entries(doc.fields || {})) fields[k] = decode(v);
    return { _id: id, ...fields };
}

async function fetchCollection(collection, token) {
    const res = await fetch(`${BASE_URL}/${collection}?pageSize=200`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Failed ${collection}: ${res.status}`);
    const data = await res.json();
    return (data.documents || []).map(decodeDoc);
}

async function main() {
    const client = await auth.getClient();
    const { token } = await client.getAccessToken();

    // ══════════════ DASHBOARD_PAGES ══════════════
    console.log('╔══════════════════════════════════════════════════════╗');
    console.log('║  COLLECTION: dashboard_pages                        ║');
    console.log('╚══════════════════════════════════════════════════════╝\n');
    
    const pages = await fetchCollection('dashboard_pages', token);
    console.log(`Total documents: ${pages.length}\n`);
    
    for (const p of pages) {
        console.log(`┌─── ${p._id} ───`);
        console.log(`│ page: ${p.page || '(none)'}`);
        
        const ds = Array.isArray(p.dataSources) ? p.dataSources : [];
        console.log(`│ dataSources: ${ds.length} entries`);
        for (const d of ds) {
            console.log(`│   ┌── sheetName: "${d.sheetName || '?'}"`);
            console.log(`│   │   dataset:       ${d.dataset || '❌ MISSING'}`);
            console.log(`│   │   tableName:     ${d.tableName || '❌ MISSING'}`);
            console.log(`│   │   spreadsheetId: ${d.spreadsheetId ? d.spreadsheetId.substring(0, 20) + '...' : '(none)'}`);
            const cols = Array.isArray(d.columnsUsed) ? d.columnsUsed : [];
            const names = cols.map(c => typeof c === 'string' ? c : c?.name || '').filter(Boolean);
            console.log(`│   │   columnsUsed:   [${names.length} cols]`);
            if (d.hierarchyMapping) console.log(`│   │   hierarchyMapping: ${JSON.stringify(d.hierarchyMapping)}`);
            if (d.hierarchyPresent) console.log(`│   │   hierarchyPresent: ${JSON.stringify(d.hierarchyPresent)}`);
            console.log(`│   └──`);
        }
        
        // Show other top-level keys
        const skip = new Set(['_id','page','dataSources','_firestore','updatedAt','title']);
        const other = Object.keys(p).filter(k => !skip.has(k));
        if (other.length > 0) console.log(`│ otherKeys: ${other.join(', ')}`);
        console.log(`└───\n`);
    }

    // ══════════════ DATA_SOURCES ══════════════
    console.log('\n╔══════════════════════════════════════════════════════╗');
    console.log('║  COLLECTION: data_sources                            ║');
    console.log('╚══════════════════════════════════════════════════════╝\n');
    
    const sources = await fetchCollection('data_sources', token);
    console.log(`Total documents: ${sources.length}\n`);
    
    for (const s of sources) {
        console.log(`┌─── ${s._id} ───`);
        if (s._id === '_settings') {
            console.log(`│ globalEnabled:       ${s.globalEnabled}`);
            console.log(`│ syncIntervalMinutes: ${s.syncIntervalMinutes}`);
            console.log(`│ lastFullSync:        ${s.lastFullSync}`);
            console.log(`│ lastSyncStatus:      ${s.lastSyncStatus}`);
            console.log(`│ lastSyncDurationMs:  ${s.lastSyncDurationMs}`);
            const cfKeys = Object.keys(s).filter(k => k.startsWith('cf'));
            for (const k of cfKeys) console.log(`│ ${k}: ${s[k]}`);
        } else {
            console.log(`│ spreadsheetName: ${s.spreadsheetName}`);
            console.log(`│ dataset:         ${s.dataset}`);
            console.log(`│ syncEnabled:     ${s.syncEnabled}`);
            console.log(`│ syncMode:        ${s.syncMode}`);
            if (s.sheets && typeof s.sheets === 'object') {
                const names = Object.keys(s.sheets);
                console.log(`│ sheets: (${names.length} entries)`);
                for (const sn of names) {
                    const sh = s.sheets[sn];
                    console.log(`│   ├── "${sn}"`);
                    console.log(`│   │   tableName: ${sh.tableName || '?'}  rows: ${sh.rowCount || 0}  cols: ${sh.columnCount || 0}  size: ${((sh.sizeBytes||0)/1048576).toFixed(2)}MB  syncMs: ${sh.syncMs || 0}`);
                }
            }
        }
        console.log(`└───\n`);
    }

    // ══════════════ MIGRATION READINESS ══════════════
    console.log('\n╔══════════════════════════════════════════════════════╗');
    console.log('║  MIGRATION READINESS                                 ║');
    console.log('╚══════════════════════════════════════════════════════╝\n');
    
    // Build lookup from data_sources
    const lookup = {};
    for (const s of sources) {
        if (s._id === '_settings') continue;
        if (s.sheets) {
            for (const [sn, sh] of Object.entries(s.sheets)) {
                lookup[sn] = { dataset: s.dataset, tableName: sh.tableName, doc: s._id };
            }
        }
    }
    
    let ready = 0, needs = 0;
    for (const p of pages) {
        const ds = Array.isArray(p.dataSources) ? p.dataSources : [];
        const allOk = ds.every(d => d.dataset && d.tableName);
        const status = allOk ? '✅' : '⚠️';
        if (allOk) ready++; else needs++;
        console.log(`${status} ${p._id} (${p.page})`);
        for (const d of ds) {
            const hasDs = d.dataset ? '✅' : '❌';
            const hasTn = d.tableName ? '✅' : '❌';
            const l = lookup[d.sheetName];
            const resolveHint = (!d.dataset || !d.tableName) && l
                ? ` → resolve: ${l.dataset}.${l.tableName}`
                : (!d.dataset || !d.tableName) ? ' → ⚠️ NOT IN data_sources' : '';
            console.log(`   ${hasDs}ds ${hasTn}tn  "${d.sheetName}"${resolveHint}`);
        }
    }
    console.log(`\n✅ Ready: ${ready}  |  ⚠️ Needs migration: ${needs}  |  📦 data_sources mappings: ${Object.keys(lookup).length}`);
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
