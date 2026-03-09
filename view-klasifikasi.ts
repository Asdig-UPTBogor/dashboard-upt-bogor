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
    console.log("Fetching KLASIFIKASI_BAY...");
    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: GOOGLE_CREDS_PATH,
            scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
        });
        const sheets = google.sheets({ version: "v4", auth });

        const res = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `'KLASIFIKASI_BAY'!A1:F50` 
        });
        
        const rows = res.data.values;
        if (!rows || rows.length === 0) {
            console.log("No data found in KLASIFIKASI_BAY.");
            return;
        }

        console.log(`\n========================================`);
        console.log("KLASIFIKASI_BAY Data Sample:");
        console.log(`========================================\n`);

        for (let i = 0; i < Math.min(20, rows.length); i++) {
            console.log(`ROW ${i}: ${rows[i].join(" | ")}`);
        }
        
    } catch (err: any) {
        console.error("Error analyzing spreadsheet:", err?.message || err);
    }
}
main();
