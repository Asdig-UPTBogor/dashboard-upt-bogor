#!/usr/bin/env node
/**
 * Verify spreadsheet-config.json against live Google Sheets API
 * Compares: sheet names, column headers (name + position)
 */
const { google } = require("googleapis");
const fs = require("fs");
const path = require("path");

const CREDS = "/home/server-01/Workspace/GCP Project/Dashboard-UPT-Bogor/Google Auth/automaticspreadsheet-de108e1d5b56.json";
const CONFIG = path.join(__dirname, "src/lib/spreadsheet-config.json");

async function main() {
    const auth = new google.auth.GoogleAuth({
        keyFile: CREDS,
        scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });
    const sheets = google.sheets({ version: "v4", auth });
    const config = JSON.parse(fs.readFileSync(CONFIG, "utf-8"));

    let totalIssues = 0;

    for (const ss of config.spreadsheets) {
        console.log(`\n${"=".repeat(70)}`);
        console.log(`📊 Spreadsheet: ${ss.title}`);
        console.log(`   ID: ${ss.spreadsheetId}`);

        // 1. Get spreadsheet metadata (all sheet names)
        let meta;
        try {
            meta = await sheets.spreadsheets.get({
                spreadsheetId: ss.spreadsheetId,
                fields: "sheets.properties.title",
            });
        } catch (e) {
            console.log(`   ❌ ERROR: Cannot access spreadsheet: ${e.message}`);
            totalIssues++;
            continue;
        }

        const liveSheetNames = meta.data.sheets.map(s => s.properties.title);
        console.log(`   Live sheets: [${liveSheetNames.join(", ")}]`);

        for (const cfgSheet of ss.sheets) {
            console.log(`\n   ── Sheet: "${cfgSheet.sheetName}" ──`);

            // 2. Check sheet exists
            if (!liveSheetNames.includes(cfgSheet.sheetName)) {
                console.log(`   ❌ SHEET MISSING! "${cfgSheet.sheetName}" not found in spreadsheet`);
                const similar = liveSheetNames.filter(n =>
                    n.toLowerCase().includes(cfgSheet.sheetName.toLowerCase().slice(0, 5))
                );
                if (similar.length) console.log(`      Possible match: ${similar.join(", ")}`);
                totalIssues++;
                continue;
            }
            console.log(`   ✅ Sheet exists`);

            // 3. Get first row (headers)
            let headerRow;
            try {
                const resp = await sheets.spreadsheets.values.get({
                    spreadsheetId: ss.spreadsheetId,
                    range: `'${cfgSheet.sheetName}'!1:1`,
                });
                headerRow = (resp.data.values && resp.data.values[0]) || [];
            } catch (e) {
                console.log(`   ❌ ERROR reading headers: ${e.message}`);
                totalIssues++;
                continue;
            }

            // 4. Compare each configured column
            const colLetters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
            for (let i = 0; i < 26; i++) colLetters.push("A" + colLetters[i]);

            let colOk = 0;
            let colMissing = 0;
            let colWrongPos = 0;

            for (const col of (cfgSheet.columnsUsed || [])) {
                const name = typeof col === "string" ? col : col.name;
                const pos = typeof col === "string" ? null : col.pos;

                // Find in headers (case-insensitive, trimmed)
                const headerIndex = headerRow.findIndex(
                    h => h && h.trim().toLowerCase() === name.trim().toLowerCase()
                );

                if (headerIndex === -1) {
                    console.log(`      ❌ Column "${name}" (pos ${pos}) → NOT FOUND in live headers`);
                    colMissing++;
                    totalIssues++;
                } else {
                    const actualPos = colLetters[headerIndex];
                    if (pos && actualPos !== pos) {
                        console.log(`      ⚠️  Column "${name}" → pos mismatch: config=${pos}, actual=${actualPos}`);
                        colWrongPos++;
                        totalIssues++;
                    } else {
                        colOk++;
                    }
                }
            }
            console.log(`      Summary: ✅ ${colOk} ok, ❌ ${colMissing} missing, ⚠️ ${colWrongPos} wrong pos`);
        }
    }

    console.log(`\n${"=".repeat(70)}`);
    console.log(`🏁 Total issues found: ${totalIssues}`);
    if (totalIssues === 0) console.log("✅ ALL GOOD — config matches live Google Sheets!");
}

main().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
