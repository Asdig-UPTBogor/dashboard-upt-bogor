import { google } from "googleapis";
import path from "path";
import fs from "fs";

const SPREADSHEET_ID = "1wh2ckkEaovH2MueQDXEG1u7HDenry5_D37JpdvqNWak";

const CREDS_CANDIDATES = [
    process.env.GOOGLE_CREDS_PATH,
    "/home/server-01/google-auth/automaticspreadsheet-de108e1d5b56.json",
    path.join(process.cwd(), "..", "Google Auth", "automaticspreadsheet-de108e1d5b56.json"),
].filter(Boolean) as string[];

const GOOGLE_CREDS_PATH = CREDS_CANDIDATES.find((p) => fs.existsSync(p)) || CREDS_CANDIDATES[0];


async function main() {
    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: GOOGLE_CREDS_PATH,
            scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
        });

        const sheets = google.sheets({ version: "v4", auth });

        // Let's look deeper into ASSET GI-BAY
        const res = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `'ASSET GI-BAY'!A1:ZZ10` // First 10 rows
        });
        
        const rows = res.data.values;
        if (rows) {
            console.log("\n--- Data Sample: ASSET GI-BAY ---");
            console.log("HEADERS:", rows[0].join(" | "));
            for(let i=1; i<Math.min(rows.length, 5); i++) {
                console.log(`ROW ${i}:`, rows[i].join(" | "));
            }
        }

    } catch (err: any) {
        console.error("Error analyzing spreadsheet:", err?.message || err);
    }
}

main();
