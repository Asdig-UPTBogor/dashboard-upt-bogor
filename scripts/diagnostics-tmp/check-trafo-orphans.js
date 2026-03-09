const { google } = require('googleapis');

// Fungsi pembersih untuk mencocokkan inti nama Trafo
function getPureTrafoName(text) {
    if (!text) return "";
    let clean = text.toUpperCase()
        .replace(/\s+/g, '') // Hapus spasi
        .replace(/150\/20KV/g, '')
        .replace(/150\/70KV/g, '')
        .replace(/70\/20KV/g, '')
        .replace(/500\/150KV/g, '')
        .replace(/150\/33KV/g, '')
        .replace(/\(INC\)/g, '')
        .replace(/\(LV\)/g, '')
        .replace(/KV/g, '')
        .replace(/TRAFO/g, 'TRF')
        .replace(/TRANSFORMATOR/g, 'TRF')
        .replace(/-/g, '')
        .trim();

    if (clean.includes('TRF') && !clean.includes('#')) {
        clean = clean.replace(/TRF(\d+)/, 'TRF#$1');
    }
    if (clean.includes('IBT') && !clean.includes('#')) {
        clean = clean.replace(/IBT(\d+)/, 'IBT#$1');
    }

    return clean;
}

function getBaseLocation(text) {
    if (!text) return "";
    return text.toUpperCase()
        .replace(/GI\s*\d+KV/g, '')
        .replace(/GIS\s*\d+KV/g, '')
        .replace(/GITET\s*\d+KV/g, '')
        .replace(/GI\s*\d+/g, '')
        .replace(/\s+/g, '')
        .trim();
}

async function findOrphans() {
    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: '/home/server-01/Workspace/GCP Project/Dashboard-UPT-Bogor/Google Auth/automaticspreadsheet-de108e1d5b56.json',
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });
        const sheets = google.sheets({ version: 'v4', auth });
        const spreadsheetId = '1A-x4WiaSazBdtx051TdhCBqNKpPpcbMWVFVyWSFUdo4';

        // 1. Ambil Data Sheet TRAFO (Fisik)
        const resTrafo = await sheets.spreadsheets.values.get({ spreadsheetId, range: "'TRAFO'!A1:Z500" });
        const rowsTrafo = resTrafo.data.values || [];

        const physicalTrafos = []; // List of all physical records

        let trafoGiIdx = 3;
        let trafoBayIdx = 4;

        rowsTrafo.slice(1).forEach((row, rowIndex) => {
            if (row.length === 0) return;
            const gi = (row[trafoGiIdx] || "").trim();
            const bay = (row[trafoBayIdx] || "").trim();

            if (gi && bay) {
                const pureGI = getBaseLocation(gi);
                const pureBay = getPureTrafoName(bay);
                physicalTrafos.push({
                    rowIndex: rowIndex + 2,
                    rawGI: gi,
                    rawBay: bay,
                    pureGI,
                    pureBay,
                    matchedWithBays: [] // To track which bays point to this physical trafo
                });
            }
        });

        // 2. Ambil Data Sheet BAY (Slot)
        const resBay = await sheets.spreadsheets.values.get({ spreadsheetId, range: "'BAY'!A1:Z1000" });
        const rowsBay = resBay.data.values || [];
        const headersBay = rowsBay[0] || [];

        let bayGiIdx = headersBay.findIndex(h => h.toLowerCase().includes('nama gi/gis'));
        let bayNameIdx = headersBay.findIndex(h => h.toLowerCase() === 'nama bay');
        let funcIdx = headersBay.findIndex(h => h.toLowerCase() === 'bay function');

        const trafoBays = [];

        rowsBay.slice(1).forEach((row, rowIndex) => {
            if (row.length === 0) return;
            const giName = (row[bayGiIdx] || "").trim();
            const bayName = (row[bayNameIdx] || "").trim();
            const func = (row[funcIdx] || "").trim().toLowerCase();

            if (func.includes('trafo') || bayName.includes('TRF') || bayName.includes('IBT') || bayName.toUpperCase().includes('TRAFO')) {
                const pureGI = getBaseLocation(giName);
                const pureBay = getPureTrafoName(bayName);
                trafoBays.push({
                    rowIndex: rowIndex + 2,
                    rawGI: giName,
                    rawBay: bayName,
                    pureGI,
                    pureBay,
                    hasPhysicalMatch: false
                });
            }
        });

        // 3. CROSS-MATCHING (Mencocokkan Slot Bay dengan Fisik Trafo)
        trafoBays.forEach(bay => {
            // Cari fisik trafo yang sesuai
            let match = physicalTrafos.find(phy => phy.pureGI === bay.pureGI && phy.pureBay === bay.pureBay);

            // Coba fuzzy match misal TRF#1 ada di "Trafo 1"
            if (!match) {
                match = physicalTrafos.find(phy =>
                    phy.pureGI === bay.pureGI &&
                    (phy.pureBay.replace(/#/g, '') === bay.pureBay.replace(/#/g, '') ||
                        phy.rawBay.replace(/\s+/g, '').toUpperCase().includes(bay.pureBay.replace(/TRF|IBT|#/g, '')))
                );
            }

            if (match) {
                bay.hasPhysicalMatch = true;
                match.matchedWithBays.push(bay.rawBay);
            }
        });

        const orphanBays = trafoBays.filter(b => !b.hasPhysicalMatch);
        const orphanPhysicalTrafos = physicalTrafos.filter(p => p.matchedWithBays.length === 0);

        console.log(`\n=== AUDIT INKONSISTENSI DATA TRAFO (ORPHAN DATA CHECK) ===\n`);

        console.log(`🔍 STATISTIK TOTAL:`);
        console.log(`- Jumlah Slot Bay Trafo (Sheet BAY)  : ${trafoBays.length}`);
        console.log(`- Jumlah Fisik Trafo (Sheet TRAFO)   : ${physicalTrafos.length}`);

        console.log(`\n------------------------------------------------------------`);
        console.log(`❌ 1. ORPHAN BAYS (Bay Tercatat, Fisik Trafo TIDAK DITEMUKAN di form)`);
        console.log(`   Ada ${orphanBays.length} Bay yang butuh data fisik trafonya:`);

        if (orphanBays.length > 0) {
            orphanBays.forEach(b => {
                console.log(`   - GI: ${b.rawGI.padEnd(25)} | Bay: ${b.rawBay} (Baris ${b.rowIndex})`);
            });
            // Debugging to see what is available in TRAFO for that GI
            console.log(`\n   --- DEBUG: Aset apa saja yang sebenarnya terekam di CI BINONG dsb ---`);
            const sampleGIs = [...new Set(orphanBays.map(b => b.pureGI))];
            sampleGIs.forEach(gi => {
                const available = physicalTrafos.filter(p => p.pureGI === gi);
                console.log(`   * Aset Fisik di ${gi} (Sheet TRAFO): ${available.map(a => a.rawBay).join(', ')}`);
            });
        } else {
            console.log(`   (Aman, tidak ada Orphan Bay)`);
        }

        console.log(`\n------------------------------------------------------------`);
        console.log(`❌ 2. UNLINKED PHYSICAL TRAFOS (Fisik Ada, tapi tidak ada satupun Bay yang nyantol)`);
        console.log(`   Ada ${orphanPhysicalTrafos.length} Trafo yang butuh Bay Penghubung:`);
        if (orphanPhysicalTrafos.length > 0) {
            orphanPhysicalTrafos.forEach(p => {
                console.log(`   - GI: ${p.rawGI.padEnd(25)} | Fisik: ${p.rawBay} (Baris ${p.rowIndex})`);
            });
        } else {
            console.log(`   (Aman, semua fisik trafo sudah punya perwakilan di Bay)`);
        }

        console.log(`\n------------------------------------------------------------`);
        console.log(`✅ 3. MATCHED (Sinkron, 1 Fisik Trafo bisa menaungi 1 atau lebih Bay/Sisi LV)`);
        const matchedPhys = physicalTrafos.filter(p => p.matchedWithBays.length > 0);
        console.log(`   Sebanyak ${matchedPhys.length} aset fisik menaungi ${trafoBays.length - orphanBays.length} Bay.`);

    } catch (error) {
        console.error("Error:", error.message);
    }
}

findOrphans();
