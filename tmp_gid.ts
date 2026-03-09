import { getSheetsClient } from "./src/lib/sheets-api";

async function main() {
    console.log("Fetching spreadsheet metadata...");
    const client = await getSheetsClient();
    const res = await client.spreadsheets.get({
        spreadsheetId: "1vpVUczVs8GB-VHbqxrHpl-EZI66HO2e2fWdU3qfLzeI"
    });
    const targetGid = 788480205;
    for (const sheet of res.data.sheets || []) {
        console.log(`Sheet: "${sheet.properties?.title}", GID: ${sheet.properties?.sheetId}`);
        if (sheet.properties?.sheetId === targetGid) {
            console.log(`\n>>> MATCH FOUND: gid=${targetGid} is sheet "${sheet.properties?.title}" <<<`);
        }
    }
}
main().catch(console.error);
