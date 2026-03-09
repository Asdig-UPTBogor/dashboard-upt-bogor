import { google } from "googleapis";
import fs from "fs";
import path from "path";

const SPREADSHEET_ID = "1wh2ckkEaovH2MueQDXEG1u7HDenry5_D37JpdvqNWak";
const TARGET_GID = 197088185;

const CREDS_CANDIDATES = [
    process.env.GOOGLE_CREDS_PATH,
    "/home/server-01/google-auth/automaticspreadsheet-de108e1d5b56.json",
    path.join(process.cwd(), "..", "Google Auth", "automaticspreadsheet-de108e1d5b56.json"),
].filter(Boolean) as string[];
const GOOGLE_CREDS_PATH = CREDS_CANDIDATES.find((p) => fs.existsSync(p)) || CREDS_CANDIDATES[0];

async function main() {
    console.log(`Analyzing GID: ${TARGET_GID}...`);
    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: GOOGLE_CREDS_PATH,
            scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
        });
        const sheets = google.sheets({ version: "v4", auth });

        // 1. Find the Sheet Name for this GID
        const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
        const targetSheet = meta.data.sheets?.find(s => s.properties?.sheetId === TARGET_GID);

        if (!targetSheet || !targetSheet.properties?.title) {
            console.log("Could not find a sheet with that GID.");
            return;
        }

        const sheetTitle = targetSheet.properties.title;
        console.log(`Found Sheet Name: '${sheetTitle}'\n`);

        // 2. Fetch the Data
        const res = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `'${sheetTitle}'!A1:D2000` // Assuming A: ULTG, B: GI, C: Bay, D: Type
        });

        const rows = res.data.values || [];
        if (rows.length === 0) {
            console.log("Sheet is empty.");
            return;
        }

        const duplicates: string[] = [];
        const seen = new Set<string>();

        // GI -> list of bays
        const giBays: Record<string, { name: string, type: string }[]> = {};

        // Start from row 1 (skip header)
        for (let i = 1; i < rows.length; i++) {
            const gi = rows[i][1]?.trim();
            const bay = rows[i][2]?.trim();
            const type = rows[i][3]?.trim();

            if (!gi || !bay) continue;

            const uniqueKey = `${gi} || ${bay}`;
            if (seen.has(uniqueKey)) {
                duplicates.push(uniqueKey);
            } else {
                seen.add(uniqueKey);
            }

            if (!giBays[gi]) giBays[gi] = [];
            giBays[gi].push({ name: bay, type: type || "" });
        }

        // 3. Analyze Duplicates
        console.log("========================================");
        console.log("1. CEK DATA DOBEL (GARDU INDUK + BAY)");
        console.log("========================================");
        if (duplicates.length === 0) {
            console.log("✅ BERSIH! Tidak ada Gardu Induk & Bay yang duplikat/dobel.");
        } else {
            console.log(`❌ DITEMUKAN ${duplicates.length} DATA DOBEL:`);
            duplicates.slice(0, 10).forEach(d => console.log(`   - ${d}`));
            if (duplicates.length > 10) console.log(`   ...dan ${duplicates.length - 10} lainnya.`);
        }
        console.log("");

        // 4. Analyze Trafo vs Inc consistency
        console.log("========================================");
        console.log("2. CEK PASANGAN TRAFO & INC (LV)");
        console.log("========================================");

        const trafosWithoutInc: string[] = [];
        const incsWithoutTrafo: string[] = []; // Less critical but good to know
        let totalTrafos = 0;
        let totalIncs = 0;

        for (const [gi, bays] of Object.entries(giBays)) {
            // Find all trafos in this GI
            const trafos = bays.filter(b => {
                const lower = b.name.toLowerCase();
                return (lower.includes("trafo") || lower.includes("trf") || lower.includes("ibt") || lower.includes("interbus")) && !lower.includes("inc");
            });

            // Find all incs in this GI
            const incs = bays.filter(b => {
                const lower = b.name.toLowerCase();
                return lower.includes("inc");
            });

            totalTrafos += trafos.length;
            totalIncs += incs.length;

            // Simple heuristic mapping: For each Trafo 'X', is there an 'Inc' that contains 'X'?
            // e.g. "Trafo 1" -> "Inc Trafo 1"
            for (const t of trafos) {
                // Extract number/identifier from Trafo name (basic extraction)
                const match = t.name.match(/\d+/);
                const numStr = match ? match[0] : "";

                let foundPair = false;
                for (const inc of incs) {
                    if (numStr && inc.name.includes(numStr)) {
                        foundPair = true; break;
                    } else if (!numStr) {
                        // if it doesn't have a number, just check if we have any incs. This is fuzzy.
                        foundPair = true; break;
                    }
                }

                if (!foundPair) {
                    trafosWithoutInc.push(`${gi} | ${t.name}`);
                }
            }
        }

        console.log(`Total "Trafo/IBT" tercatat: ${totalTrafos}`);
        console.log(`Total "Inc" (Sisi LV) tercatat: ${totalIncs}`);

        if (trafosWithoutInc.length === 0 && totalTrafos > 0 && totalIncs >= totalTrafos) {
            console.log("\n✅ SEHAT! Secara umum jumlah Trafo dan pasangannya (Inc) terlihat seimbang.");
        } else if (trafosWithoutInc.length > 0) {
            console.log("\n❌ HATI-HATI! Ditemukan Trafo/IBT yang HILANG pasangan 'Inc'-nya:");
            trafosWithoutInc.slice(0, 15).forEach(t => console.log(`   - MINGGAT: ${t}`));
            if (trafosWithoutInc.length > 15) console.log(`   ...dan ${trafosWithoutInc.length - 15} lainnya.`);
        } else {
            console.log("\nStatus Trafo vs Inc membutuhkan pengecekan manual, angka tidak proporsional.");
        }

    } catch (err: any) {
        console.error("Error analyzing spreadsheet:", err?.message || err);
    }
}
main();
