/**
 * POST /api/ss-v5/wizard/detect-sheets
 * body: { spreadsheetId }
 *
 * Returns: sheet list + headers row 1 (via Google Sheets API).
 * Sheets API butuh SA key — pakai default ADC.
 */
import { NextResponse } from "next/server";
import { google } from "googleapis";
import { GoogleAuth } from "google-auth-library";

export async function POST(req: Request) {
  try {
    const { spreadsheetId } = await req.json();
    if (!spreadsheetId) {
      return NextResponse.json({ error: "spreadsheetId required" }, { status: 400 });
    }

    const auth = new GoogleAuth({
      scopes: [
        "https://www.googleapis.com/auth/spreadsheets.readonly",
        "https://www.googleapis.com/auth/drive.metadata.readonly",
      ],
    });
    const authClient = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: authClient as any });
    const drive = google.drive({ version: "v3", auth: authClient as any });

    // Drive metadata
    const driveResp = await drive.files.get({
      fileId: spreadsheetId,
      fields: "name,owners(emailAddress),modifiedTime,webViewLink",
    });

    // Sheets list
    const ssResp = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: "sheets.properties(sheetId,title,gridProperties)",
    });

    const sheetList = ssResp.data.sheets ?? [];
    const result = await Promise.all(
      sheetList.map(async (s) => {
        const title = s.properties?.title ?? "";
        const sheetId = s.properties?.sheetId ?? 0;
        const rowCount = s.properties?.gridProperties?.rowCount ?? 0;
        // Fetch row 1 = headers
        let headers: string[] = [];
        try {
          const hResp = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${title}!A1:ZZ1`,
          });
          headers = (hResp.data.values?.[0] ?? []).map((h) => String(h).trim());
        } catch {
          headers = [];
        }
        return { sheetId, title, rowCount, headers };
      }),
    );

    return NextResponse.json({
      spreadsheetId,
      name: driveResp.data.name,
      owner: driveResp.data.owners?.[0]?.emailAddress,
      modifiedTime: driveResp.data.modifiedTime,
      webViewLink: driveResp.data.webViewLink,
      sheets: result,
    });
  } catch (e: any) {
    console.error("[wizard/detect-sheets]", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
