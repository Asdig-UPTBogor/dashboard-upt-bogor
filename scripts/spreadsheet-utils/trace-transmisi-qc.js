// trace-transmisi-qc.js — Compare Transmisi data vs Master Hierarchy
// Run: node scripts/spreadsheet-utils/trace-transmisi-qc.js

const http = require("http");

function fetchAPI(apiPath) {
    return new Promise((resolve, reject) => {
        const url = "http://localhost:3000" + apiPath;
        http.get(url, { timeout: 15000 }, function (res) {
            var data = "";
            res.on("data", function (c) { data += c; });
            res.on("end", function () {
                try { resolve(JSON.parse(data)); }
                catch (e) { reject(new Error("Parse: " + data.slice(0, 200))); }
            });
        }).on("error", reject);
    });
}

async function main() {
    // 1. Get Master Hierarchy (small sheet, 25 rows)
    console.log("Fetching Master Gardu Induk...");
    var masterResp = await fetchAPI(
        "/api/spreadsheet-data?spreadsheetId=1vpVUczVs8GB-VHbqxrHpl-EZI66HO2e2fWdU3qfLzeI&sheet=Master+Gardu+Induk"
    );
    var masterSheet = masterResp.sheets && masterResp.sheets[0];
    var masterRows = (masterSheet && masterSheet.rows) || [];
    var validGI = new Set(masterRows.map(function (r) { return (r["Master Gardu Induk"] || "").trim(); }).filter(Boolean));
    var validULTG = new Set(masterRows.map(function (r) { return (r["Master ULTG"] || "").trim(); }).filter(Boolean));

    console.log("\n=== MASTER HIERARCHY ===");
    console.log("Valid ULTG:", Array.from(validULTG).join(", "));
    console.log("Valid GI:", Array.from(validGI).join(", "));

    // 2. Get Transmisi 3.PROTEKSI
    console.log("\nFetching 3.PROTEKSI PETIR TAMBAHAN...");
    var transResp = await fetchAPI(
        "/api/spreadsheet-data?spreadsheetId=13xm0SqMP5EYbLyYnt5jUPUx1BzhaDffkX4iippq_LuM&sheet=3.PROTEKSI+PETIR+TAMBAHAN"
    );
    var transSheet = transResp.sheets && transResp.sheets[0];
    var transRows = (transSheet && transSheet.rows) || [];

    console.log("\n=== TRANSMISI: 3.PROTEKSI PETIR TAMBAHAN ===");
    console.log("Total rows:", transRows.length);
    var masterHeaders = (transSheet && transSheet.headers || []).filter(function (h) { return h.includes("Master"); });
    console.log("Headers with 'Master':", masterHeaders.join(", "));

    // First 5 rows
    console.log("\nFirst 5 rows:");
    transRows.slice(0, 5).forEach(function (r, i) {
        var ultg = r["Master ULTG"] || "(empty)";
        var gi = r["Master Gardu Induk"] || "(empty)";
        console.log("  Row " + i + ': ULTG="' + ultg + '"  GI="' + gi + '"');
    });

    // Unique values
    var transGI = new Set(transRows.map(function (r) { return (r["Master Gardu Induk"] || "").trim(); }).filter(Boolean));
    var transULTG = new Set(transRows.map(function (r) { return (r["Master ULTG"] || "").trim(); }).filter(Boolean));
    console.log("\nUnique ULTG in Transmisi:", Array.from(transULTG).join(", "));
    console.log("Unique GI in Transmisi (first 15):");
    Array.from(transGI).slice(0, 15).forEach(function (g) {
        var match = validGI.has(g) ? "OK" : "FAIL";
        console.log("  [" + match + '] "' + g + '"');
    });

    // Overlap summary
    var giMatch = Array.from(transGI).filter(function (g) { return validGI.has(g); });
    var ultgMatch = Array.from(transULTG).filter(function (u) { return validULTG.has(u); });
    console.log("\n=== OVERLAP ===");
    console.log("ULTG: " + ultgMatch.length + "/" + transULTG.size + " match");
    console.log("GI: " + giMatch.length + "/" + transGI.size + " match");
}

main().catch(function (e) { console.error("Error:", e.message); process.exit(1); });
