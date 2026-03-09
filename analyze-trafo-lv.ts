import { google } from "googleapis";
import fs from "fs";
import path from "path";

const SPREADSHEET_ID = "1wh2ckkEaovH2MueQDXEG1u7HDenry5_D37JpdvqNWak";

const CREDS_CANDIDATES = [
    process.env.GOOGLE_CREDS_PATH,
    "/home/server-01/google-auth/automaticspreadsheet-de108e1d5b56.json",
    path.join(process.cwd(), "..", "Google Auth", "automaticspreadsheet-de108e1d5b56.json"),
].filter(Boolean) as string[];
const GOOGLE_CREDS_PATH = CREDS_CANDIDATES.find((p) => fs.existsSync(p)) || CREDS_CANDIDATES[0];

async function main() {
    console.log("Scanning for Trafo, IBT, and Inc bays to evaluate LV/HV consistency...");
    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: GOOGLE_CREDS_PATH,
            scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
        });
        const sheets = google.sheets({ version: "v4", auth });

        const res = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `'KLASIFIKASI_BAY'!A1:F1000`
        });

        const rows = res.data.values;
        if (!rows || rows.length === 0) {
            console.log("No data found.");
            return;
        }

        const trafoBays = [];
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            const gi = row[1];
            const bay = row[2];
            const type = row[3];

            if (!bay) continue;
            const bayLower = bay.toLowerCase();

            // Catch anything related to Trafo, IBT, or Incoming (Inc)
            if (bayLower.includes("trafo") || bayLower.includes("trf") || bayLower.includes("ibt") || bayLower.includes("inc")) {
                trafoBays.push({ gi, bay, type });
            }
        }

        console.log(`Found ${trafoBays.length} bays related to Trafo/IBT/Inc.\n`);

        const groupedByGI: Record<string, any[]> = {};
        for (const item of trafoBays) {
            if (!groupedByGI[item.gi]) groupedByGI[item.gi] = [];
            groupedByGI[item.gi].push(item);
        }

        // Just print a sample of 5 GIs to evaluate the consistency
        let giCount = 0;
        for (const gi in groupedByGI) {
            giCount++;
            if (giCount > 5) break;

            console.log(`[GI] ${gi}:`);
            groupedByGI[gi].forEach(b => {
                console.log(`  -> Bay: ${b.bay.padEnd(25)} | Type: ${b.type}`);
            });
            console.log("");
        }

    } catch (err: any) {
        console.error("Error analyzing spreadsheet:", err?.message || err);
    }
}
main();
