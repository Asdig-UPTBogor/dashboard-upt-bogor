const fs = require('fs');
const path = require('path');

function analyzeSpreadsheets() {
    try {
        const configPath = path.join(__dirname, 'src', 'lib', 'spreadsheet-config.json');
        const rawConfig = fs.readFileSync(configPath, 'utf8');
        const config = JSON.parse(rawConfig);

        const spreadsheets = config.spreadsheets || [];
        const totalSpreadsheets = spreadsheets.length;

        let totalSheets = 0;
        let totalColumns = 0;
        const sheetDetails = [];

        console.log(`\n=== REKAP PENGGUNAAN SPREADSHEET DI DASHBOARD ===\n`);
        console.log(`📊 Total Akun/File Spreadsheet Utama: ${totalSpreadsheets} File\n`);

        spreadsheets.forEach((ss, idx) => {
            console.log(`[${idx + 1}] SPREADSHEET: "${ss.title}"`);
            console.log(`    ID: ${ss.spreadsheetId}`);

            const sheets = ss.sheets || [];
            totalSheets += sheets.length;
            console.log(`    Total Sheet (Tab) di dalam file ini: ${sheets.length} Sheet`);

            sheets.forEach((sheet, sIdx) => {
                const cols = sheet.columnsUsed || sheet.expectedColumns || [];
                totalColumns += cols.length;
                console.log(`      ${sIdx + 1}. Tab: "${sheet.sheetName}" -> (${cols.length} Kolom Digunakan)`);
                sheetDetails.push({
                    spreadsheet: ss.title,
                    sheet: sheet.sheetName,
                    columns: cols
                });
            });
            console.log("");
        });

        console.log(`--------------------------------------------------`);
        console.log(`📈 RINGKASAN KESELURUHAN:`);
        console.log(`- Jumlah Spreadsheet  : ${totalSpreadsheets}`);
        console.log(`- Jumlah Tab (Sheet)  : ${totalSheets}`);
        console.log(`- Jumlah Total Kolom  : ${totalColumns} Kolom (Yang dikonfigurasi & di-fetch)`);
        console.log(`--------------------------------------------------`);

        // Print detailed columns for each sheet to give a full report
        console.log(`\n\n=== DETAIL KOLOM PER SHEET ===`);
        sheetDetails.forEach(detail => {
            console.log(`\n📌 [${detail.spreadsheet}] -> Tab: ${detail.sheet}`);
            console.log(`    🛠 Kolom (${detail.columns.length}):`);
            detail.columns.forEach(col => {
                // Determine name vs header property
                const name = col.name || col.header || "Unknown";
                const pos = col.pos ? `(Kolom ${col.pos})` : "";
                const isKey = col.isPrimaryKey ? "(PRIMARY KEY)" : "";
                console.log(`      - ${name} ${pos} ${isKey}`);
            });
        });

    } catch (e) {
        console.error("Error analyzing config:", e.message);
    }
}

analyzeSpreadsheets();
