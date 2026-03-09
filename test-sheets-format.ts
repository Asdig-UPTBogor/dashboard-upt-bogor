import { google } from "googleapis";
import path from "path";

async function main() {
    const auth = new google.auth.GoogleAuth({
        keyFile: path.join(process.cwd(), "config/service-account.json"),
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });
    
    // We need the spreadsheet ID. The user's page configs should have it.
    // I will read it in the next step.
    console.log("Ready to format");
}
main();
