import { google } from "googleapis";
import { GOOGLE_CREDS_PATH, GOOGLE_SCOPES } from "./dashboard-config";

const SPREADSHEET_ID = "1UiVv0mwnvbhtBZiJUczQkVUJcr22B48edfc17w3WuUQ";

let sheetsClient: ReturnType<typeof google.sheets> | null = null;

async function getClient() {
    if (sheetsClient) return sheetsClient;
    const auth = new google.auth.GoogleAuth({
        keyFile: GOOGLE_CREDS_PATH,
        scopes: [...GOOGLE_SCOPES],
    });
    sheetsClient = google.sheets({ version: "v4", auth });
    return sheetsClient;
}

export async function fetchSheet(sheetName: string) {
    const client = await getClient();
    const res = await client.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `'${sheetName}'!A:Z`,
    });
    const rows = res.data.values || [];
    if (rows.length < 2) return [];
    const headers = rows[0];
    return rows.slice(1).map((row) => {
        const obj: Record<string, string> = {};
        headers.forEach((h, i) => { obj[h] = row[i] || ""; });
        return obj;
    });
}

export async function fetchAllSheets() {
    const [ultgs, gis, bays] = await Promise.all([
        fetchSheet("Master ULTG"),
        fetchSheet("Master GI"),
        fetchSheet("Master BAY"),
    ]);
    return { ultgs, gis, bays };
}
