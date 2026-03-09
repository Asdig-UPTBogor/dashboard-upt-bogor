// reset-qc-marks.js — Clear ALL QC red marks from Dashboard Gardu Induk
// No dev server needed — uses Google Sheets API directly
// Run: node scripts/spreadsheet-utils/reset-qc-marks.js

const { google } = require("googleapis");
const path = require("path");

var keyPath = path.join(__dirname, "../../..", "Google Auth", "automaticspreadsheet-de108e1d5b56.json");
var TARGET_SS = "1aSi-mBeRnpUvSuNQ_U4HZbLxpmqwt2Fwh8koJVslqIg"; // Dashboard Gardu Induk

var HIER_NAMES = ["Master ULTG", "Master Gardu Induk", "Master Bay"];

async function main() {
    var auth = new google.auth.GoogleAuth({
        keyFile: keyPath,
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    var client = google.sheets({ version: "v4", auth });

    // 1. Get sheet metadata + header rows
    console.log("1. Getting sheet metadata + headers...");
    var ssInfo = await client.spreadsheets.get({
        spreadsheetId: TARGET_SS,
        fields: "sheets.properties,sheets.data.rowData.values.formattedValue",
        includeGridData: true,
    });

    var requests = [];
    var sheetsCleared = 0;

    for (var s of ssInfo.data.sheets) {
        var title = s.properties.title;
        var sheetId = s.properties.sheetId;

        // Get actual header row
        var headers = [];
        if (s.data && s.data[0] && s.data[0].rowData && s.data[0].rowData[0]) {
            headers = (s.data[0].rowData[0].values || []).map(function (v) {
                return (v && v.formattedValue) || "";
            });
        }

        // Find hierarchy column positions
        var hierCols = [];
        headers.forEach(function (h, idx) {
            if (HIER_NAMES.indexOf(h) >= 0) {
                hierCols.push({ name: h, colIndex: idx });
            }
        });

        if (hierCols.length === 0) continue;

        sheetsCleared++;
        console.log("   RESET " + title + " — clearing cols: " + hierCols.map(function (c) { return c.name + "=col" + c.colIndex }).join(", "));

        // Clear background + notes on all hierarchy columns (rows 2+)
        hierCols.forEach(function (hc) {
            requests.push({
                repeatCell: {
                    range: {
                        sheetId: sheetId,
                        startRowIndex: 1,
                        startColumnIndex: hc.colIndex,
                        endColumnIndex: hc.colIndex + 1,
                    },
                    cell: {
                        userEnteredFormat: {},
                        note: "",
                    },
                    fields: "userEnteredFormat.backgroundColor,note",
                },
            });
        });
    }

    if (requests.length === 0) {
        console.log("   Nothing to reset.");
        return;
    }

    console.log("\n2. Sending " + requests.length + " reset requests for " + sheetsCleared + " sheets...");
    await client.spreadsheets.batchUpdate({
        spreadsheetId: TARGET_SS,
        requestBody: { requests: requests },
    });
    console.log("   DONE! All QC marks cleared.");
}

main().catch(function (e) { console.error("Error:", e.message); process.exit(1); });
