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
    console.log("Fetching ASSET GI-BAY to count bays...");
    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: GOOGLE_CREDS_PATH,
            scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
        });
        const sheets = google.sheets({ version: "v4", auth });

        const res = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `'ASSET GI-BAY'!A1:ZZ1000` // Fetch a wide range
        });

        const rows = res.data.values;
        if (!rows || rows.length === 0) {
            console.log("No data found.");
            return;
        }

        const headers = rows[0]; // These are the Gardu Induk names
        let totalBays = 0;
        const validBays: { gi: string, bay: string }[] = [];

        // Loop through columns (Gardu Induks)
        for (let colIdx = 0; colIdx < headers.length; colIdx++) {
            const giName = headers[colIdx]?.trim();
            if (!giName) continue; // Skip empty headers

            // Loop through rows under this header
            for (let rowIdx = 1; rowIdx < rows.length; rowIdx++) {
                const bayName = rows[rowIdx][colIdx]?.trim();
                if (bayName) {
                    totalBays++;
                    validBays.push({ gi: giName, bay: bayName });
                }
            }
        }

        console.log(`\n========================================`);
        console.log(`Total Gardu Induk (Kolom): ${headers.filter(h => h).length}`);
        console.log(`Total Bay yang ditemukan : ${totalBays}`);
        console.log(`========================================\n`);

        console.log("Contoh 5 Bay pertama jika dikonversi menjadi urutan memanjang (Tabular):");
        for (let i = 0; i < Math.min(5, validBays.length); i++) {
            console.log(`GI: ${validBays[i].gi.padEnd(25)} | Bay: ${validBays[i].bay}`);
        }

    } catch (err: any) {
        console.error("Error analyzing spreadsheet:", err?.message || err);
    }
}
main();
