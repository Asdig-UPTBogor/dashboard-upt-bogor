/**
 * Populate "Config Thor Vaisala" sheet with default configuration.
 * 
 * Spreadsheet: Master Hierarchy
 * Sheet: Config Thor Vaisala (gid=161580239)
 * 
 * Usage: node scripts/spreadsheet-utils/populate-thor-config.js
 * One-time script — safe to delete after use.
 */

const { google } = require("googleapis");
const path = require("path");

const CREDS_PATH = path.resolve(__dirname, "../../../Google Auth/automaticspreadsheet-de108e1d5b56.json");
const SPREADSHEET_ID = "1vpVUczVs8GB-VHbqxrHpl-EZI66HO2e2fWdU3qfLzeI";
const SHEET_NAME = "Config Thor Vaisala";
const SHEET_GID = 161580239;

const CONFIG_ROWS = [
    ["KEY", "VALUE", "KETERANGAN"],
    ["IS_ACTIVE", "TRUE", "Sakelar hidup/mati worker"],
    ["LAST_FETCH_TS", "", "Timestamp terakhir fetch (auto-update tiap polling)"],
    ["VAISALA_URL", "https://trion.ddns.net/lcc-dashboard/api/data", "Endpoint API Vaisala"],
    ["VAISALA_COOKIE", "", "Cookie autentikasi Vaisala (isi manual: connect.sid=xxx)"],
    ["UPT_FILTER", "UPT BOGOR", "Filter data per UPT"],
    ["BBOX_MIN_LON", "106.43325", "Batas barat wilayah pemantauan"],
    ["BBOX_MAX_LON", "107.3623167", "Batas timur wilayah pemantauan"],
    ["BBOX_MIN_LAT", "-7.02163", "Batas selatan wilayah pemantauan"],
    ["BBOX_MAX_LAT", "-6.360084", "Batas utara wilayah pemantauan"],
    ["MAXCHAT_URL", "https://core.maxchat.id/pln-bogor/api/messages", "Endpoint API MaxChat"],
    ["MAXCHAT_TOKEN", "Z27w2KsJmY2FLBKO", "Token autentikasi WhatsApp"],
    ["MAXCHAT_GROUP_ID", "120363405842300229@g.us", "ID Grup WA produksi (Thor)"],
    ["MAXCHAT_GROUP_TESTING", "120363423463367344@g.us", "ID Grup WA testing"],
    ["MAXCHAT_MODE", "production", "Mode routing: production atau maintenance"],
];

async function main() {
    console.log("🔧 Populating Config Thor Vaisala...");
    console.log(`   Spreadsheet: ${SPREADSHEET_ID}`);
    console.log(`   Sheet: ${SHEET_NAME} (gid=${SHEET_GID})`);
    console.log(`   Rows: ${CONFIG_ROWS.length} (1 header + ${CONFIG_ROWS.length - 1} config)\n`);

    const auth = new google.auth.GoogleAuth({
        keyFile: CREDS_PATH,
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    const sheets = google.sheets({ version: "v4", auth });

    // Step 1: Write values
    const range = `'${SHEET_NAME}'!A1:C${CONFIG_ROWS.length}`;
    const result = await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range,
        valueInputOption: "RAW",
        requestBody: { values: CONFIG_ROWS },
    });
    console.log(`✅ Written ${result.data.updatedCells} cells to ${result.data.updatedRange}`);

    // Step 2: Format header + freeze + auto-resize
    await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
            requests: [
                // Bold header with light blue background
                {
                    repeatCell: {
                        range: { sheetId: SHEET_GID, startRowIndex: 0, endRowIndex: 1 },
                        cell: {
                            userEnteredFormat: {
                                textFormat: { bold: true },
                                backgroundColor: { red: 0.85, green: 0.92, blue: 1.0 },
                            },
                        },
                        fields: "userEnteredFormat(textFormat.bold,backgroundColor)",
                    },
                },
                // Freeze header row
                {
                    updateSheetProperties: {
                        properties: {
                            sheetId: SHEET_GID,
                            gridProperties: { frozenRowCount: 1 },
                        },
                        fields: "gridProperties.frozenRowCount",
                    },
                },
                // Auto-resize all columns
                {
                    autoResizeDimensions: {
                        dimensions: {
                            sheetId: SHEET_GID,
                            dimension: "COLUMNS",
                            startIndex: 0,
                            endIndex: 3,
                        },
                    },
                },
            ],
        },
    });
    console.log("✅ Formatted: bold header, frozen row, auto-resize columns");

    // Step 3: Verify by reading back
    const verify = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `'${SHEET_NAME}'!A1:C${CONFIG_ROWS.length}`,
    });
    console.log(`\n📋 Verification (${verify.data.values.length} rows):`);
    verify.data.values.forEach((row, i) => {
        const prefix = i === 0 ? "  [H]" : `  [${i}]`;
        console.log(`${prefix} ${row[0]} = ${row[1] || "(empty)"}`);
    });

    console.log("\n🎉 Done! Config Thor Vaisala sheet populated.");
    console.log("   ⚠️  Remember to fill VAISALA_COOKIE manually!");
}

main().catch((e) => {
    console.error("❌ ERROR:", e.message);
    process.exit(1);
});
