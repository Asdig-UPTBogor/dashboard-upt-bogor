// test-qc-writeback.js — Test QC writeback on Dashboard Gardu Induk
// Finds column positions BY HEADER NAME (not hardcoded pos)
// Batch ALL sheets in 1 spreadsheet into 1 API call
// Run: node scripts/spreadsheet-utils/test-qc-writeback.js

const { google } = require("googleapis");
const http = require("http");
const path = require("path");

var keyPath = path.join(__dirname, "../../..", "Google Auth", "automaticspreadsheet-de108e1d5b56.json");
var TARGET_SS = "1aSi-mBeRnpUvSuNQ_U4HZbLxpmqwt2Fwh8koJVslqIg"; // Dashboard Gardu Induk
var MASTER_SS = "1vpVUczVs8GB-VHbqxrHpl-EZI66HO2e2fWdU3qfLzeI"; // Master Hierarchy

var HIER_NAMES = ["Master ULTG", "Master Gardu Induk", "Master Bay"];

function fetchAPI(apiPath) {
    return new Promise(function (resolve, reject) {
        http.get("http://localhost:3000" + apiPath, { timeout: 60000 }, function (res) {
            var data = "";
            res.on("data", function (c) { data += c; });
            res.on("end", function () {
                try { resolve(JSON.parse(data)); }
                catch (e) { reject(new Error("Parse error")); }
            });
        }).on("error", reject);
    });
}

async function main() {
    // 1. Auth
    var auth = new google.auth.GoogleAuth({
        keyFile: keyPath,
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    var client = google.sheets({ version: "v4", auth });

    // 2. Get all sheet titles + numeric IDs + header rows
    console.log("1. Getting sheet metadata + headers...");
    var ssInfo = await client.spreadsheets.get({
        spreadsheetId: TARGET_SS,
        fields: "sheets.properties,sheets.data.rowData.values.formattedValue",
        includeGridData: true,
        ranges: [], // will get row 1 (header) only via data
    });

    var sheetMap = {}; // sheetName -> { id, headerRow: [col0, col1, ...] }
    ssInfo.data.sheets.forEach(function (s) {
        var title = s.properties.title;
        var id = s.properties.sheetId;
        // Extract header row (row 0)
        var headerRow = [];
        if (s.data && s.data[0] && s.data[0].rowData && s.data[0].rowData[0]) {
            var vals = s.data[0].rowData[0].values || [];
            headerRow = vals.map(function (v) { return (v && v.formattedValue) || ""; });
        }
        sheetMap[title] = { id: id, headers: headerRow };
    });

    console.log("   Sheets found:", Object.keys(sheetMap).length);

    // 3. Build valid sets from Master Hierarchy
    console.log("\n2. Fetching Master Hierarchy...");
    var giResp = await fetchAPI("/api/spreadsheet-data?spreadsheetId=" + MASTER_SS + "&sheet=Master+Gardu+Induk");
    var bayResp = await fetchAPI("/api/spreadsheet-data?spreadsheetId=" + MASTER_SS + "&sheet=Master+Bay");

    var validULTG = new Set();
    var validGI = new Set();
    var validBay = new Set();
    (giResp.sheets[0].rows || []).forEach(function (r) {
        var u = (r["Master ULTG"] || "").trim();
        var g = (r["Master Gardu Induk"] || "").trim();
        if (u) validULTG.add(u);
        if (g) validGI.add(g);
    });
    (bayResp.sheets[0].rows || []).forEach(function (r) {
        var b = (r["Master Bay"] || "").trim();
        if (b) validBay.add(b);
    });
    console.log("   Valid: " + validULTG.size + " ULTG, " + validGI.size + " GI, " + validBay.size + " Bay");

    // 4. Validate each sheet
    console.log("\n3. Validating sheets...");
    var allRequests = [];
    var totalInvalid = 0;

    for (var sheetName in sheetMap) {
        var meta = sheetMap[sheetName];

        // Find hierarchy column positions BY HEADER NAME
        var hierCols = []; // { name, colIndex }
        meta.headers.forEach(function (h, colIdx) {
            if (HIER_NAMES.indexOf(h) >= 0) {
                hierCols.push({ name: h, colIndex: colIdx });
            }
        });

        if (hierCols.length === 0) continue;

        // Fetch data via API
        var resp = await fetchAPI(
            "/api/spreadsheet-data?spreadsheetId=" + TARGET_SS + "&sheet=" + encodeURIComponent(sheetName)
        );
        if (!resp.sheets || !resp.sheets[0]) continue;
        var rows = resp.sheets[0].rows || [];
        if (rows.length === 0) continue;

        // Validate
        var sheetErrors = [];
        rows.forEach(function (row, rowIdx) {
            hierCols.forEach(function (hc) {
                var val = (row[hc.name] || "").trim();
                if (!val) return;
                var invalid = false;
                var reason = "";
                if (hc.name === "Master ULTG" && !validULTG.has(val)) {
                    invalid = true; reason = "ULTG not in Master";
                }
                if (hc.name === "Master Gardu Induk" && !validGI.has(val)) {
                    invalid = true; reason = "GI not in Master";
                }
                if (hc.name === "Master Bay" && !validBay.has(val)) {
                    invalid = true; reason = "Bay not in Master";
                }
                if (invalid) {
                    sheetErrors.push({ rowIdx: rowIdx, colIndex: hc.colIndex, colName: hc.name, reason: reason, val: val });
                }
            });
        });

        if (sheetErrors.length === 0) {
            console.log("   OK   " + sheetName + " (" + rows.length + " rows) — hierarchy cols at: " + hierCols.map(function (h) { return h.name + "=col" + h.colIndex }).join(", "));
            continue;
        }

        totalInvalid += sheetErrors.length;
        console.log("   ERR  " + sheetName + " (" + rows.length + " rows, " + sheetErrors.length + " errors) — cols: " + hierCols.map(function (h) { return h.name + "=col" + h.colIndex }).join(", "));

        // Reset hierarchy columns to white
        hierCols.forEach(function (hc) {
            allRequests.push({
                repeatCell: {
                    range: {
                        sheetId: meta.id,
                        startRowIndex: 1,
                        startColumnIndex: hc.colIndex,
                        endColumnIndex: hc.colIndex + 1,
                    },
                    cell: {
                        userEnteredFormat: { backgroundColor: { red: 1, green: 1, blue: 1 } },
                    },
                    fields: "userEnteredFormat.backgroundColor",
                },
            });
        });

        // Mark invalid cells red + note
        sheetErrors.forEach(function (e) {
            allRequests.push({
                updateCells: {
                    rows: [{
                        values: [{
                            userEnteredFormat: { backgroundColor: { red: 1, green: 0.8, blue: 0.8 } },
                            note: "QC: " + e.reason,
                        }]
                    }],
                    start: {
                        sheetId: meta.id,
                        rowIndex: e.rowIdx + 1,
                        columnIndex: e.colIndex,
                    },
                    fields: "userEnteredFormat.backgroundColor,note",
                },
            });
        });
    }

    console.log("\n4. Summary: " + totalInvalid + " invalid cells, " + allRequests.length + " format requests");
    if (allRequests.length === 0) { console.log("   Nothing to write!"); return; }

    console.log("   Sending 1 batchUpdate...");
    await client.spreadsheets.batchUpdate({
        spreadsheetId: TARGET_SS,
        requestBody: { requests: allRequests },
    });
    console.log("   DONE! Check the spreadsheet.");
}

main().catch(function (e) { console.error("Error:", e.message); process.exit(1); });
