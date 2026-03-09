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
    console.log("Fetching ASSET GI-BAY to count Trafos specifically...");
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

        const headers = rows[0]; 
        let totalTrafos = 0;
        const validTrafos: { gi: string, bay: string }[] = [];

        // Loop through columns (Gardu Induks)
        for (let colIdx = 0; colIdx < headers.length; colIdx++) {
            const giName = headers[colIdx]?.trim();
            if (!giName) continue; 

            // Loop through rows under this header
            for (let rowIdx = 1; rowIdx < rows.length; rowIdx++) {
                const bayName = rows[rowIdx][colIdx]?.trim();
                if (bayName) {
                    const bayLower = bayName.toLowerCase();
                    // Must contain "trafo" or "trf" but NOT "inc"
                    if ((bayLower.includes("trafo") || bayLower.includes("trf")) && !bayLower.includes("inc")) {
                        totalTrafos++;
                        validTrafos.push({ gi: giName, bay: bayName });
                    }
                }
            }
        }

        console.log(`\n========================================`);
        console.log(`Total Murni "Trafo" (Bukan Inc Trafo) : ${totalTrafos}`);
        console.log(`========================================\n`);

        console.log("Contoh 10 Trafo Murni yang Ditemukan:");
        for (let i = 0; i < Math.min(10, validTrafos.length); i++) {
            console.log(`GI: ${validTrafos[i].gi.padEnd(25)} | Bay: ${validTrafos[i].bay}`);
        }
        
    } catch (err: any) {
        console.error("Error analyzing spreadsheet:", err?.message || err);
    }
}
main();
