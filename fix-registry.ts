import { loadPageConfig, savePageConfig } from "./src/lib/data-source-registry";

const config = loadPageConfig("/maintenance/master-data");
if (config) {
    console.log("Loaded config:", config.page);
    savePageConfig(config);
    console.log("Registry synced.");
} else {
    console.log("Config not found!");
}
