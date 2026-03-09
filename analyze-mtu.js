const http = require("http");
console.log("Refreshing data...");
http.get("http://localhost:3000/api/page-data?page=/overview&refresh=true", (res) => {
    const chunks = [];
    res.on("data", (c) => chunks.push(c));
    res.on("end", () => {
        const d = JSON.parse(Buffer.concat(chunks).toString());
        if (d.error) { console.log("ERROR:", d.error); return; }
        const gs = (n) => d.sheets?.find((s) => s.sheetName === n)?.rows || [];
        const gi = gs("Master Gardu Induk");
        const bay = gs("Master Bay");

        // Build composite GI+Bay keys
        const bayKeys = new Set();
        bay.forEach(r => {
            const g = (r["Master Gardu Induk"] || "").trim().toLowerCase();
            const b = (r["Master Bay"] || "").trim().toLowerCase();
            if (g && b) bayKeys.add(g + "||" + b);
        });
        const GS = new Set(gi.map(r => (r["Master Gardu Induk"] || "").trim().toLowerCase()).filter(Boolean));

        console.log("GI:" + GS.size + " Bay:" + bayKeys.size);

        const types = [
            ["TRAFO", "MTU TRAFO"], ["PMT", "MTU PMT"], ["PMS", "MTU PMS"],
            ["CT", "MTU CT"], ["CVT", "MTU CVT"], ["LA", "MTU LA"],
            ["KABEL POWER", "MTU KABEL POWER"], ["SEALING END", "SEALING END"],
        ];
        let gt = 0, orphans = [];
        for (const [key, sheet] of types) {
            const rows = gs(sheet);
            gt += rows.length;
            for (const r of rows) {
                const g = (r["Master Gardu Induk"] || "").trim();
                const b = (r["Master Bay"] || "").trim();
                if (!g || !GS.has(g.toLowerCase())) { orphans.push({ type: key, gi: g, bay: b, reason: "GI not found" }); continue; }
                if (b && !bayKeys.has(g.toLowerCase() + "||" + b.toLowerCase())) { orphans.push({ type: key, gi: g, bay: b, reason: "Bay not in GI" }); }
            }
        }
        console.log("Total MTU: " + gt);
        console.log("Orphans: " + orphans.length);
        orphans.forEach(o => console.log("  " + o.type + ": " + o.gi + " → " + o.bay + " (" + o.reason + ")"));
        if (orphans.length === 0) console.log("✅ ALL CLEAN!");
    });
}).on("error", e => console.error("Error:", e.message));
