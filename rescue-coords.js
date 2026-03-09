const fs = require('fs');
const path = require('path');

function extractGhostCoordinates() {
    try {
        const cacheFilePath = path.join(__dirname, '.cache', 'explore-1vpVUczVs8GB-VHbqxrHpl-EZI66HO2e2fWdU3qfLzeI.json');

        if (!fs.existsSync(cacheFilePath)) {
            console.log("File cache tidak ditemukan.");
            return;
        }

        const data = JSON.parse(fs.readFileSync(cacheFilePath, 'utf8'));

        // Cari sheet "Asset GI"
        let assetGISheet = null;
        if (data.sheets) {
            assetGISheet = data.sheets.find(s => s.sheetName === "Asset GI");
        } else if (data.data && data.data["Asset GI"]) {
            // Alternatif format
            assetGISheet = { data: data.data["Asset GI"] };
        }

        if (!assetGISheet && Array.isArray(data)) {
            assetGISheet = data.find(s => s.sheetName === "Asset GI");
        }

        console.log(`\n=== MENYELAMATKAN DATA KOORDINAT GI DARI CACHE LOKAL ===\n`);

        let extracted = [];
        let rowData = assetGISheet?.data || assetGISheet?.rows || [];

        // Parsing depending on format
        if (rowData.length > 0) {
            const headers = rowData[0];
            const giIdx = headers.findIndex(h => h === 'Master Gardu Induk' || h === 'Gardu Induk' || h.toLowerCase() === 'master gardu induk');
            const latIdx = headers.findIndex(h => h === 'Latitude' || h.toLowerCase() === 'latitude');
            const longIdx = headers.findIndex(h => h === 'Longitude' || h.toLowerCase() === 'longitude');
            const ultgIdx = headers.findIndex(h => h === 'Master ULTG' || h.toLowerCase() === 'master ultg');

            if (giIdx !== -1 && latIdx !== -1 && longIdx !== -1) {
                console.log(`Ditemukan Header:\nGI: Kolom ${giIdx}\nLat: Kolom ${latIdx}\nLong: Kolom ${longIdx}`);

                rows = rowData.slice(1);
                rows.forEach((row, i) => {
                    if (!row || row.length === 0) return;
                    const giName = row[giIdx];
                    const lat = row[latIdx];
                    const lng = row[longIdx];
                    const ultg = ultgIdx !== -1 ? row[ultgIdx] : '';

                    if (giName && lat && lng) {
                        extracted.push({ GI: giName, ULTG: ultg, Latitude: lat, Longitude: lng });
                    }
                });
            } else {
                console.log("Format kolom tidak cocok dengan prediksi. Headers:", headers);
            }
        }

        if (extracted.length > 0) {
            console.log(`\n✅ BERHASIL MENYELAMATKAN ${extracted.length} KOORDINAT GI:`);
            extracted.forEach((c, idx) => {
                console.log(`${idx + 1}. ${c.GI.padEnd(25)} -> Lat: ${c.Latitude}, Lng: ${c.Longitude}`);
            });

            // Simpan ke file permanen untuk di-copy user
            const outPath = path.join(__dirname, 'rescued-gi-coordinates.json');
            fs.writeFileSync(outPath, JSON.stringify(extracted, null, 2), 'utf8');
            console.log(`\n💾 Data diamankan di: ${outPath}`);
        } else {
            console.log(`❌ Gagal mengekstrak koordinat dari cache.`);
            console.log("Struktur data cache: ", JSON.stringify(data).substring(0, 500));
        }

    } catch (e) {
        console.error("Error:", e.message);
    }
}

extractGhostCoordinates();
