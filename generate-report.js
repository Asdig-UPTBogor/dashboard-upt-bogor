const fs = require('fs');
const path = require('path');

function generateReport() {
    const configPath = path.join(__dirname, 'src', 'lib', 'spreadsheet-config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    let totalSpreadsheets = config.spreadsheets.length;
    let totalSheets = 0;
    let totalColumns = 0;

    let report = `=== REKAP PENGGUNAAN SPREADSHEET (DASHBOARD UPT BOGOR) ===\n\n`;
    report += `Total Spreadsheet Utama : ${totalSpreadsheets} File\n`;

    config.spreadsheets.forEach(ss => {
        report += `\n📁 SPREADSHEET: "${ss.title}"\n`;
        const sheets = ss.sheets || [];
        totalSheets += sheets.length;

        sheets.forEach((sheet, idx) => {
            const cols = sheet.columnsUsed || sheet.expectedColumns || [];
            totalColumns += cols.length;
            report += `   📄 Tab ${idx + 1}: "${sheet.sheetName}" (${cols.length} Kolom Aktif)\n`;

            if (cols.length > 0) {
                const colNames = cols.map(c => {
                    let name = c.name || c.header || "N/A";
                    if (c.pos) name += ` [${c.pos}]`;
                    return name;
                });
                report += `      -> Kolom: ${colNames.join(', ')}\n`;
            }
        });
    });

    report += `\n============================================================\n`;
    report += `📈 STATISTIK KESELURUHAN:\n`;
    report += `- Total File Spreadsheet   : ${totalSpreadsheets}\n`;
    report += `- Total Tab (Sheet) Aktif  : ${totalSheets}\n`;
    report += `- Total Kolom Dikonfigurasi: ${totalColumns}\n`;
    report += `============================================================\n`;

    fs.writeFileSync(path.join(__dirname, 'scripts', 'diagnostics-tmp', 'config-report.txt'), report);
    console.log(report);
}

generateReport();
