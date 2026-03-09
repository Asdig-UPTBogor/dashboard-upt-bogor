const { google } = require('googleapis');

async function compareHierarchyVsGenInfo() {
    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: '/home/server-01/Workspace/GCP Project/Dashboard-UPT-Bogor/Google Auth/automaticspreadsheet-de108e1d5b56.json',
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });
        const sheets = google.sheets({ version: 'v4', auth });

        // Spreadsheet 1: Master Hierarchy (New)
        const ssHiId = '1vpVUczVs8GB-VHbqxrHpl-EZI66HO2e2fWdU3qfLzeI';
        const ssHiRange = 'Master Gardu Induk!A1:E';

        // Spreadsheet 2: General Information
        const ssGenId = '1A-x4WiaSazBdtx051TdhCBqNKpPpcbMWVFVyWSFUdo4';

        // Find correct sheet name for SSGen
        const metaGen = await sheets.spreadsheets.get({ spreadsheetId: ssGenId });
        const sheetGenName = metaGen.data.sheets.map(s => s.properties.title).find(t => t.toUpperCase().includes('GARDU INDUK') || t.toUpperCase().includes('GRADU INDUK')) || 'GARDU INDUK';
        const ssGenRange = `'${sheetGenName}'!A1:Z`;

        console.log(`Fetching Master Hierarchy [${ssHiId}], Sheet: Master Gardu Induk...`);
        const resHi = await sheets.spreadsheets.values.get({ spreadsheetId: ssHiId, range: ssHiRange });
        const dataHi = resHi.data.values || [];

        console.log(`Fetching General Information [${ssGenId}], Sheet: ${sheetGenName}...`);
        const resGen = await sheets.spreadsheets.values.get({ spreadsheetId: ssGenId, range: ssGenRange });
        const dataGen = resGen.data.values || [];

        // Parse Master Hierarchy
        const headerHi = dataHi[0] || [];
        const giIndexHi = headerHi.findIndex(h => h && h.toLowerCase().includes('master gardu induk'));

        const setHi = new Set();
        const rawHi = [];
        for (let i = 1; i < dataHi.length; i++) {
            const row = dataHi[i];
            if (!row || row.length === 0) continue;
            const gi = row[giIndexHi];
            if (gi) {
                rawHi.push(gi.trim());
                setHi.add(gi.trim().toUpperCase());
            }
        }

        // Parse General Information
        const headerGen = dataGen[0] || [];
        const giIndexGen = headerGen.findIndex(h => h && h.toLowerCase().includes('nama gi'));

        const setGen = new Set();
        const rawGen = [];
        for (let i = 1; i < dataGen.length; i++) {
            const row = dataGen[i];
            if (!row || row.length === 0) continue;
            const gi = row[giIndexGen];
            if (gi) {
                rawGen.push(gi.trim());
                setGen.add(gi.trim().toUpperCase());
            }
        }

        console.log(`\n--- Cross Checking GI Lists (Exact Match) ---`);
        let missingInGen = [];
        let missingInHi = [];
        let matches = 0;

        for (const gi of setHi) {
            if (setGen.has(gi)) {
                matches++;
            } else {
                missingInGen.push(gi);
            }
        }

        for (const gi of setGen) {
            if (!setHi.has(gi)) {
                missingInHi.push(gi);
            }
        }

        console.log(`\n=== SUMMARY ===`);
        console.log(`Total GI in Master Hierarchy  : ${setHi.size}`);
        console.log(`Total GI in General Info      : ${setGen.size}`);
        console.log(`Exact Matches                 : ${matches}`);

        console.log(`\n=== MISSING IN GENERAL INFO (Ada di Hierarchy, tapi TIDAK ADA di Gen Info) ===`);
        if (missingInGen.length > 0) {
            missingInGen.forEach(gi => console.log(`- ${gi}`));
        } else {
            console.log("None. All Hierarchy GIs map to General Info.");
        }

        console.log(`\n=== MISSING IN MASTER HIERARCHY (Ada di Gen Info, tapi TIDAK ADA di Hierarchy) ===`);
        if (missingInHi.length > 0) {
            missingInHi.forEach(gi => console.log(`- ${gi}`));
        } else {
            console.log("None. All General Info GIs map to Hierarchy.");
        }

        // Smart Mapping Check for names that might be just mismatched by spacing or "GUNUNG"/"PLTU"
        console.log(`\n=== SMART MAPPING ANALYSIS (Ignoring spaces, 'GUNUNG', 'PLTU') ===`);
        const normalize = (name) => name.replace(/GUNUNG/g, '').replace(/PLTU/g, '').replace(/\s+/g, '').toUpperCase();

        const normGen = new Set(Array.from(setGen).map(normalize));
        let smartMissingInGen = [];
        for (const gi of setHi) {
            if (!normGen.has(normalize(gi))) {
                smartMissingInGen.push(gi);
            }
        }

        if (smartMissingInGen.length < missingInGen.length) {
            console.log(`> Good news: Some missing ones are just typos. The ONLY ones TRULY missing in Gen Info are:`);
            smartMissingInGen.forEach(gi => console.log(`  - ${gi}`));
        } else {
            console.log(`> Smart mapping shows no difference in missing analysis.`);
        }

    } catch (e) {
        console.error("Error API:", e.message);
    }
}

compareHierarchyVsGenInfo();
