import { google } from "googleapis";
import fs from "fs";
import path from "path";

const SPREADSHEET_ID = "1wh2ckkEaovH2MueQDXEG1u7HDenry5_D37JpdvqNWak";
const CREDS_PATH = [
    process.env.GOOGLE_CREDS_PATH,
    "/home/server-01/google-auth/automaticspreadsheet-de108e1d5b56.json",
    path.join(process.cwd(), "..", "Google Auth", "automaticspreadsheet-de108e1d5b56.json"),
].find((p) => p && fs.existsSync(p));

async function main() {
    try {
        const auth = new google.auth.GoogleAuth({ keyFile: CREDS_PATH, scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"] });
        const sheets = google.sheets({ version: "v4", auth });
        let r1 = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: "'Master Gardu Induk'!A1:F1" });
        console.log("Master Gardu Induk headers:", r1.data.values?.[0]);
        let r2 = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: "'Master Bay'!A1:H1" });
        console.log("Master Bay headers:", r2.data.values?.[0]);
        let r3 = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: "'Klasifikasi Bay'!A1:F1" });
        console.log("Klasifikasi Bay headers:", r3.data.values?.[0]);
    } catch (e: any) { console.error(e.message || e); }
}
main();
