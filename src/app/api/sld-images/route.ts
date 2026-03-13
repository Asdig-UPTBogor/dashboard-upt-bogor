/**
 * API Route: /api/sld-images
 * 
 * Lists SLD image files from a Google Drive folder.
 * Uses the same service account as spreadsheet fetching.
 * Returns file IDs, names, and embeddable URLs.
 */

import { NextResponse } from "next/server";
import { google } from "googleapis";
import { getGoogleAuth } from "@/lib/dashboard-config";

const DRIVE_FOLDER_ID = "13-xGXMgVGHvrVQrk8-hvs1848yjD5i26";
const DRIVE_SCOPES = ["https://www.googleapis.com/auth/drive.readonly"];

let driveClient: ReturnType<typeof google.drive> | null = null;

async function getDriveClient() {
    if (driveClient) return driveClient;
    const auth = getGoogleAuth(DRIVE_SCOPES);
    driveClient = google.drive({ version: "v3", auth });
    return driveClient;
}

export interface SLDFile {
    id: string;
    name: string;
    mimeType: string;
    thumbnailUrl: string;
    viewUrl: string;
}

export async function GET() {
    try {
        const drive = await getDriveClient();
        const res = await drive.files.list({
            q: `'${DRIVE_FOLDER_ID}' in parents and trashed = false`,
            fields: "files(id, name, mimeType, thumbnailLink, webContentLink, webViewLink)",
            orderBy: "name",
            pageSize: 100,
        });

        const files: SLDFile[] = (res.data.files || []).map(f => ({
            id: f.id!,
            name: f.name!.replace(/\.\w+$/, ""), // remove extension
            mimeType: f.mimeType || "image/jpeg",
            thumbnailUrl: `/api/sld-images/${f.id}`,
            viewUrl: `https://drive.google.com/file/d/${f.id}/preview`,
        }));

        return NextResponse.json({ files, count: files.length });
    } catch (error) {
        console.error("[sld-images] Error listing Drive files:", error);
        return NextResponse.json(
            { error: "Failed to list SLD images", files: [], count: 0 },
            { status: 500 }
        );
    }
}
