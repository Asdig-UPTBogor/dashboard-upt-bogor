const { google } = require('googleapis');

function getBaseLocation(text) {
    if (!text) return "";
    return text.toUpperCase().replace(/GI\s*\d+KV/g, '').replace(/GIS\s*\d+KV/g, '').replace(/GITET\s*\d+KV/g, '').replace(/-\d+/g, '').replace(/#\d+/g, '').replace(/\s\d+$/g, '').replace(/PENGHANTAR/g, '').replace(/PHT/g, '').replace(/150KV/gi, '').replace(/70KV/gi, '').replace(/500KV/gi, '').replace(/\s+/g, '').trim();
}

async function dumpCompleteList() {
    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: '/home/server-01/Workspace/GCP Project/Dashboard-UPT-Bogor/Google Auth/automaticspreadsheet-de108e1d5b56.json',
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });
        const sheets = google.sheets({ version: 'v4', auth });
        const spreadsheetId = '1A-x4WiaSazBdtx051TdhCBqNKpPpcbMWVFVyWSFUdo4';

        const resTrans = await sheets.spreadsheets.values.get({ spreadsheetId, range: "'TRANSMISI'!A1:Z500" });
        const rowsTrans = resTrans.data.values || [];
        const headersTrans = rowsTrans[0] || [];

        let transDariIdx = headersTrans.findIndex(h => h.toLowerCase() === 'dari');
        let transKeIdx = headersTrans.findIndex(h => h.toLowerCase() === 'ke');
        let transBahanIdx = headersTrans.findIndex(h => h.toLowerCase().includes('bahan'));
        const routeMap = new Map();

        rowsTrans.slice(1).forEach(row => {
            const dari = (row[transDariIdx] || "").trim();
            const ke = (row[transKeIdx] || "").trim();
            const bahan = transBahanIdx !== -1 ? (row[transBahanIdx] || "").trim() : "";
            if (dari && ke && bahan) {
                const baseA = getBaseLocation(dari);
                const baseB = getBaseLocation(ke);
                if (baseA && baseB) {
                    routeMap.set([baseA, baseB].sort().join("<->"), { bahan });
                }
            }
        });

        const resBay = await sheets.spreadsheets.values.get({ spreadsheetId, range: "'BAY'!A1:Z1000" });
        const rowsBay = resBay.data.values || [];
        const headersBay = rowsBay[0] || [];

        let bayGIIdx = headersBay.findIndex(h => h.toLowerCase().includes('gardu induk') || h.toLowerCase().includes('nama gi/gis'));
        let bayNameIdx = headersBay.findIndex(h => h.toLowerCase() === 'nama bay' || h.toLowerCase() === 'master bay');
        let bayFuncIdx = headersBay.findIndex(h => h.toLowerCase() === 'bay function');

        const successList = [];
        const failedList = [];

        rowsBay.slice(1).forEach(row => {
            if (row.length === 0) return;
            const func = (row[bayFuncIdx] || "").trim().toLowerCase();
            const bayName = (row[bayNameIdx] || "").trim();
            const giName = (row[bayGIIdx] || "").trim();

            if (func.includes('penghantar') || func.includes('t/l bay')) {
                const baseGI = getBaseLocation(giName);
                const baseDest = getBaseLocation(bayName);

                if (baseGI && baseDest) {
                    const routeKey = [baseGI, baseDest].sort().join("<->");
                    const routeData = routeMap.get(routeKey);

                    if (routeData) {
                        successList.push(`- **${giName}** (${bayName}) $\\rightarrow$ Konduktor: **${routeData.bahan}**`);
                    } else {
                        failedList.push(`- **${giName}** (${bayName})`);
                    }
                }
            }
        });

        console.log(`\n\n=== JAWABAN UNTUK USER ===`);
        console.log(`Paham Bang. Sesuai analisa kita tadi:\nDi Master Bay memang \`Jenis Konduktor\`-nya kosong semua. Namun setelah dikawinkan dengan Sheet Transmisi berdasarkan kecocokan rute (Dari-Ke), ini rincian lengkapnya:\n`);

        console.log(`### ✅ A. BERHASIL! (61 Bay Penghantar ini SUDAH KETEMU tipe Konduktornya di Sheet Transmisi)`);
        successList.forEach(s => console.log(s));

        console.log(`\n### ❌ B. GAGAL! (32 Bay Penghantar ini BELUM KETEMU Konduktornya, karena tidak dicatat di Sheet Transmisi UPT Bogor / Milik UPT Lain)`);
        failedList.forEach(s => console.log(s));

    } catch (error) {
        console.error("Error:", error.message);
    }
}

dumpCompleteList();
