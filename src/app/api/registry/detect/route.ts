import { NextResponse } from "next/server";
import { google } from "googleapis";
import { GOOGLE_CREDS_PATH, GOOGLE_SCOPES } from "@/lib/dashboard-config";

/**
 * GET /api/registry/detect?spreadsheetId=xxx
 *
 * Auto-detect spreadsheet info:
 * - Title
 * - List of sheet tabs with row/col counts
 * - Headers (first row) for each sheet
 */
export async function GET(req: Request) {
    const url = new URL(req.url);
    const spreadsheetId = url.searchParams.get("spreadsheetId");

    if (!spreadsheetId) {
        return NextResponse.json(
            { success: false, error: "Missing query parameter: spreadsheetId" },
            { status: 400 },
        );
    }

    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: GOOGLE_CREDS_PATH,
            scopes: [...GOOGLE_SCOPES],
        });
        const sheetsApi = google.sheets({ version: "v4", auth });

        // Step 1: Get spreadsheet metadata
        const meta = await sheetsApi.spreadsheets.get({
            spreadsheetId,
            fields: "properties.title,sheets.properties(title,gridProperties)",
        });

        const title = meta.data.properties?.title || "Untitled";
        const sheetsRaw = meta.data.sheets || [];

        // Step 2: Get headers for each sheet
        const sheets = await Promise.all(
            sheetsRaw.map(async (s) => {
                const sheetName = s.properties?.title || "Unknown";
                const rowCount = s.properties?.gridProperties?.rowCount || 0;
                const colCount = s.properties?.gridProperties?.columnCount || 0;

                let headers: string[] = [];
                try {
                    const hRes = await sheetsApi.spreadsheets.values.get({
                        spreadsheetId,
                        range: `'${sheetName}'!1:1`,
                    });
                    const row = hRes.data.values?.[0] || [];
                    headers = row.map((h: string) => h?.toString().trim()).filter(Boolean);
                } catch {
                    // Sheet might be empty or inaccessible
                }

                return {
                    sheetName,
                    rowCount,
                    colCount,
                    headers,
                };
            }),
        );

        return NextResponse.json({
            success: true,
            data: {
                spreadsheetId,
                title,
                sheets,
            },
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        const isNotFound = message.includes("not found") || message.includes("404");
        const isPermission = message.includes("permission") || message.includes("403");

        return NextResponse.json(
            {
                success: false,
                error: isNotFound
                    ? "Spreadsheet tidak ditemukan. Periksa ID dan pastikan sudah di-share."
                    : isPermission
                        ? "Tidak punya akses. Pastikan spreadsheet di-share ke service account."
                        : message,
            },
            { status: isNotFound ? 404 : isPermission ? 403 : 500 },
        );
    }
}
