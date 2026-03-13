/**
 * API Route: /api/sld-images/[id]
 * 
 * Proxy for Google Drive images.
 * Fetches the image via Drive API and serves it directly,
 * avoiding CORS/auth issues with direct Drive URLs.
 */

import { NextResponse } from "next/server";
import { google } from "googleapis";
import { getGoogleAuth } from "@/lib/dashboard-config";

const DRIVE_SCOPES = ["https://www.googleapis.com/auth/drive.readonly"];

let driveClient: ReturnType<typeof google.drive> | null = null;

async function getDriveClient() {
    if (driveClient) return driveClient;
    const auth = getGoogleAuth(DRIVE_SCOPES);
    driveClient = google.drive({ version: "v3", auth });
    return driveClient;
}

export async function GET(
    _req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const drive = await getDriveClient();

        const res = await drive.files.get(
            { fileId: id, alt: "media" },
            { responseType: "arraybuffer" }
        );

        const buffer = Buffer.from(res.data as ArrayBuffer);

        return new NextResponse(buffer, {
            headers: {
                "Content-Type": "image/jpeg",
                "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
            },
        });
    } catch (error) {
        console.error("[sld-images/proxy] Error:", error);
        return NextResponse.json({ error: "Failed to load image" }, { status: 500 });
    }
}
