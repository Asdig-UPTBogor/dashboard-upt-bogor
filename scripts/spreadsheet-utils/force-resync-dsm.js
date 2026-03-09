const { listPageConfigs, savePageConfig } = require('./src/lib/data-source-registry.ts');

async function resync() {
    console.log("Memulai resinkronisasi config Data Connector ke DSM...");
    const configs = listPageConfigs();
    for (const cfg of configs) {
        savePageConfig(cfg);
        console.log(`Resync: ${cfg.page}`);
    }
    console.log("Selesai!");
}

resync().catch(console.error);
