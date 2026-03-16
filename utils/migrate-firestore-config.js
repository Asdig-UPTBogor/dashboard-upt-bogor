/**
 * migrate-firestore-config.js
 * 
 * Updates Firestore dashboard_pages dataSources with:
 * - dataset: BQ dataset name
 * - tableName: native table name (n_...)
 * - hierarchyLevel: BAY / GI / master
 * 
 * Uses existing SA credentials.
 */
const { Firestore } = require('@google-cloud/firestore');
const path = require('path');

const db = new Firestore({
    projectId: 'gcp-bridge-meshvpn',
    keyFilename: path.join(__dirname, '..', 'google-auth', 'key.json'),
});

// Master mapping: sheetName → { dataset, tableName, hierarchyLevel }
const SHEET_CONFIG = {
    // Master Hierarchy
    'Master Gardu Induk':        { dataset: 'MASTER_HIERARCHY_UPT_Bogor', tableName: 'n_Master_Gardu_Induk', hierarchyLevel: 'master' },
    'Master Bay':                { dataset: 'MASTER_HIERARCHY_UPT_Bogor', tableName: 'n_Master_Bay', hierarchyLevel: 'master' },
    'Koordinat Gardu Induk':     { dataset: 'MASTER_HIERARCHY_UPT_Bogor', tableName: 'n_Koordinat_Gardu_Induk', hierarchyLevel: 'master' },
    'Koordinat GI':              { dataset: 'MASTER_HIERARCHY_UPT_Bogor', tableName: 'n_Koordinat_Gardu_Induk', hierarchyLevel: 'master' }, // alias

    // Dashboard Gardu Induk
    'MTU TRAFO':                 { dataset: 'Dashboard_Gardu_Induk_UPT_Bogor', tableName: 'n_MTU_TRAFO', hierarchyLevel: 'BAY' },
    'MTU PMT':                   { dataset: 'Dashboard_Gardu_Induk_UPT_Bogor', tableName: 'n_MTU_PMT', hierarchyLevel: 'BAY' },
    'MTU PMS':                   { dataset: 'Dashboard_Gardu_Induk_UPT_Bogor', tableName: 'n_MTU_PMS', hierarchyLevel: 'BAY' },
    'MTU CT':                    { dataset: 'Dashboard_Gardu_Induk_UPT_Bogor', tableName: 'n_MTU_CT', hierarchyLevel: 'BAY' },
    'MTU CVT':                   { dataset: 'Dashboard_Gardu_Induk_UPT_Bogor', tableName: 'n_MTU_CVT', hierarchyLevel: 'BAY' },
    'MTU LA':                    { dataset: 'Dashboard_Gardu_Induk_UPT_Bogor', tableName: 'n_MTU_LA', hierarchyLevel: 'BAY' },
    'MTU KABEL POWER':           { dataset: 'Dashboard_Gardu_Induk_UPT_Bogor', tableName: 'n_MTU_KABEL_POWER', hierarchyLevel: 'BAY' },
    'SEALING END':               { dataset: 'Dashboard_Gardu_Induk_UPT_Bogor', tableName: 'n_SEALING_END', hierarchyLevel: 'BAY' },
    'PROGRAM STRATEGIS TRAFO':   { dataset: 'Dashboard_Gardu_Induk_UPT_Bogor', tableName: 'n_PROGRAM_STRATEGIS_TRAFO', hierarchyLevel: 'GI' },
    'PROGRAM KERJA HARGI':       { dataset: 'Dashboard_Gardu_Induk_UPT_Bogor', tableName: 'n_PROGRAM_KERJA_HARGI', hierarchyLevel: 'GI' },

    // Master Transmisi
    'MASTER ASSET TOWER':        { dataset: 'Master_Transmisi_UPT_Bogor', tableName: 'n_MASTER_ASSET_TOWER', hierarchyLevel: 'GI' },
    '0.RESUME JARINGAN':         { dataset: 'Master_Transmisi_UPT_Bogor', tableName: 'n_0_RESUME_JARINGAN', hierarchyLevel: 'GI' },
    '1.DATA PETIR':              { dataset: 'Master_Transmisi_UPT_Bogor', tableName: 'n_1_DATA_PETIR', hierarchyLevel: 'GI' },
    'DATA PETIR':                { dataset: 'Master_Transmisi_UPT_Bogor', tableName: 'n_1_DATA_PETIR', hierarchyLevel: 'GI' }, // alias
    '3.PROTEKSI PETIR TAMBAHAN': { dataset: 'Master_Transmisi_UPT_Bogor', tableName: 'n_3_PROTEKSI_PETIR_TAMBAHAN', hierarchyLevel: 'GI' },
    '5.HEALTHY INDEX TOWER':     { dataset: 'Master_Transmisi_UPT_Bogor', tableName: 'n_5_HEALTHY_INDEX_TOWER', hierarchyLevel: 'GI' },
    '6.ASSESMENT TOWER DAN VENOM': { dataset: 'Master_Transmisi_UPT_Bogor', tableName: 'n_6_ASSESMENT_TOWER_DAN_VENOM', hierarchyLevel: 'GI' },
    '12.KONDISI ROW':            { dataset: 'Master_Transmisi_UPT_Bogor', tableName: 'n_12_KONDISI_ROW', hierarchyLevel: 'GI' },
    '14.LM JARINGAN 2026':       { dataset: 'Master_Transmisi_UPT_Bogor', tableName: 'n_14_LM_JARINGAN_2026', hierarchyLevel: 'GI' },
    '17.SLD TOWER':              { dataset: 'Master_Transmisi_UPT_Bogor', tableName: 'n_17_SLD_TOWER', hierarchyLevel: 'GI' },

    // Asset Relay
    'Asset Relay UPT Bogor':     { dataset: 'Master_Asset_Relay_UPT_Bogor', tableName: 'n_Asset_Relay_UPT_Bogor', hierarchyLevel: 'GI' },

    // Jadwal Padam
    'Jadwal Padam':              { dataset: 'Master_Jadwal_Padam_UPT_Bogor', tableName: 'n_Jadwal_Padam', hierarchyLevel: 'GI' },
};

async function main() {
    console.log('='.repeat(60));
    console.log('FIRESTORE CONFIG MIGRATION');
    console.log('='.repeat(60));

    // 1. Update dashboard_pages — add dataset/tableName/hierarchyLevel
    const pagesRef = db.collection('dashboard_pages');
    const pages = await pagesRef.get();

    for (const doc of pages.docs) {
        const data = doc.data();
        const pageId = doc.id;
        const dataSources = data.dataSources || [];
        let updated = false;

        console.log(`\n📄 ${pageId} (${data.page || '?'})`);

        const newDataSources = dataSources.map((ds) => {
            const config = SHEET_CONFIG[ds.sheetName];
            if (config) {
                console.log(`  ✅ ${ds.sheetName} → ${config.dataset}.${config.tableName} (${config.hierarchyLevel})`);
                updated = true;
                return {
                    ...ds,
                    dataset: config.dataset,
                    tableName: config.tableName,
                    hierarchyLevel: config.hierarchyLevel,
                };
            } else {
                console.log(`  ⚠️  ${ds.sheetName} → NO MAPPING FOUND`);
                return ds;
            }
        });

        if (updated) {
            await pagesRef.doc(pageId).update({ dataSources: newDataSources });
            console.log(`  💾 Saved!`);
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ FIRESTORE MIGRATION COMPLETE!');
    console.log('='.repeat(60));
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
