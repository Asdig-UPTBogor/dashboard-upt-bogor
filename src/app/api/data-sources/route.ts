/**
 * /api/data-sources — Lists available BQ tables and page configurations.
 *
 * Reads from Firestore page configs (DC Canvas).
 * Also supports ?raw=1 (registry) and ?explore=SPREADSHEET_ID (sheet headers)
 * for the Data Connector page.
 */

import { NextResponse } from "next/server";
import { getAllPages } from "@/lib/sidebar-config";
import {
    loadRegistryRootFromFirestore,
    syncRegistryRootFromPageConfigs,
    saveDataSourceToFirestore
} from "@/lib/firestore-dashboard-config";
import { getGoogleAuth } from "@/lib/dashboard-config";
import { google } from "googleapis";

export async function GET(request: Request) {
    try {
        const url = new URL(request.url);

        // Return all sidebar pages
        if (url.searchParams.get("pages") === "1") {
            return NextResponse.json({ success: true, pages: getAllPages() });
        }

        // Return registry (for DC sheet picker) — reads from data_sources
        if (url.searchParams.get("raw") === "1") {
            try {
                const dsAuth = getGoogleAuth(["https://www.googleapis.com/auth/datastore"]);
                const dsClient = await dsAuth.getClient();
                const dsToken = (await dsClient.getAccessToken()).token;
                const projectId = process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || "gcp-bridge-meshvpn";
                const fsBase = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;

                const fsRes = await fetch(`${fsBase}/data_sources?pageSize=20`, {
                    headers: { Authorization: `Bearer ${dsToken}` },
                });
                const fsData = await fsRes.json();
                const docs = fsData.documents || [];

                // Convert data_sources docs into RegistryEntry[] format
                const spreadsheets = docs
                    .filter((doc: any) => {
                        const id = doc.name?.split("/").pop();
                        return id !== "_settings"; // skip settings doc
                    })
                    .map((doc: any) => {
                        const fields = doc.fields || {};
                        const ssId = fields.spreadsheetId?.stringValue || "";
                        const title = fields.name?.stringValue || fields.spreadsheetName?.stringValue || doc.name?.split("/").pop() || "";
                        const sheetsMap = fields.sheets?.mapValue?.fields || {};

                        const sheets = Object.entries(sheetsMap).map(([sheetName, sheetVal]: [string, any]) => {
                            const sf = sheetVal?.mapValue?.fields || {};
                            return {
                                sheetName,
                                label: sheetName,
                                route: "",
                                usedBy: [],
                                columnsUsed: [],
                            };
                        });

                        return {
                            id: ssId,
                            spreadsheetId: ssId,
                            title,
                            sheets,
                        };
                    });

                return NextResponse.json({ success: true, data: spreadsheets, source: "data_sources" });
            } catch (err) {
                console.error("[data-sources] Failed to read data_sources for registry:", err);
                // Fallback to legacy dashboard_meta
                await syncRegistryRootFromPageConfigs();
                const registryRoot = await loadRegistryRootFromFirestore();
                return NextResponse.json({
                    success: true,
                    data: registryRoot?.spreadsheets || [],
                    source: "dashboard_meta_fallback",
                });
            }
        }

        // Explore a spreadsheet's sheets & headers (for DC sheet picker)
        // Reads from Firestore data_sources (populated by CF every 15 min)
        // Falls back to Sheets API only for spreadsheets not yet in data_sources
        const exploreId = url.searchParams.get("explore");
        if (exploreId) {
            // Try Firestore data_sources first (fast, no Sheets API call)
            try {
                const dsAuth = getGoogleAuth(["https://www.googleapis.com/auth/datastore"]);
                const dsClient = await dsAuth.getClient();
                const dsToken = (await dsClient.getAccessToken()).token;
                const projectId = process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || "gcp-bridge-meshvpn";
                const fsBase = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;

                // List all data_sources docs to find the one with matching spreadsheetId
                const fsRes = await fetch(`${fsBase}/data_sources?pageSize=20`, {
                    headers: { Authorization: `Bearer ${dsToken}` },
                });
                const fsData = await fsRes.json();
                const docs = fsData.documents || [];

                // Find the doc that matches the requested spreadsheetId
                const matchDoc = docs.find((doc: { fields?: Record<string, { stringValue?: string }> }) => {
                    const ssId = doc.fields?.spreadsheetId?.stringValue;
                    return ssId === exploreId;
                });

                if (matchDoc?.fields?.sheets?.mapValue?.fields) {
                    const sheetsMap = matchDoc.fields.sheets.mapValue.fields;
                    const result = Object.entries(sheetsMap).map(([sheetName, sheetVal]: [string, any]) => {
                        const sheetFields = sheetVal?.mapValue?.fields || {};
                        // Columns are stored as an array of strings
                        const columns = (sheetFields.columns?.arrayValue?.values || [])
                            .map((v: { stringValue?: string }) => v.stringValue)
                            .filter(Boolean);
                        return { name: sheetName, headers: columns };
                    });

                    const title = matchDoc.fields?.name?.stringValue || "Untitled Spreadsheet";
                    return NextResponse.json({ success: true, title, sheets: result, source: "firestore" });
                }
            } catch (fsErr) {
                console.warn("[data-sources] Firestore data_sources lookup failed, falling back to Sheets API:", fsErr);
            }

            // Fallback: Sheets API (for spreadsheets not yet synced by CF)
            const keyFile = JSON.parse(
                (await import("fs")).readFileSync(
                    process.env.GOOGLE_APPLICATION_CREDENTIALS || "google-auth/key.json",
                    "utf-8"
                )
            );
            const auth = new google.auth.GoogleAuth({
                credentials: keyFile,
                scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
            });
            const sheets = google.sheets({ version: "v4", auth });
            const meta = await sheets.spreadsheets.get({
                spreadsheetId: exploreId,
                includeGridData: false,
            });

            const result = await Promise.all(
                (meta.data.sheets || []).map(async (s) => {
                    const title = s.properties?.title || "";
                    try {
                        const headerRes = await sheets.spreadsheets.values.get({
                            spreadsheetId: exploreId,
                            range: `'${title}'!1:1`,
                        });
                        const headers = (headerRes.data.values?.[0] || []).filter(Boolean);
                        return { name: title, headers };
                    } catch {
                        return { name: title, headers: [] };
                    }
                })
            );

            const docTitle = meta.data.properties?.title || "Untitled Spreadsheet";
            return NextResponse.json({ success: true, title: docTitle, sheets: result, source: "sheets-api" });
        }

        // Default: return list of all dashboard pages
        const allPages = getAllPages();

        return NextResponse.json({
            success: true,
            totalPages: allPages.length,
            pages: allPages.map(p => ({ path: p.path, label: p.label })),
        });
    } catch (error) {
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Internal Server Error",
            },
            { status: 500 }
        );
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { spreadsheetId, name, sheets } = body;
        
        if (!spreadsheetId) {
            return NextResponse.json({ success: false, error: "Missing spreadsheetId" }, { status: 400 });
        }

        const dataset = (name || "Untitled").replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');

        const sheetsMap: Record<string, any> = {};
        if (Array.isArray(sheets)) {
            sheets.forEach((s: any) => {
                sheetsMap[s.sheetName] = { 
                    sheetName: s.sheetName,
                    columns: s.headers || [],
                    rowCount: 0,
                    columnCount: s.headers?.length || 0,
                    sizeBytes: 0,
                    syncMs: 0,
                    tableName: ""
                };
            });
        }

        const data = {
            spreadsheetId,
            name: name || "Untitled",
            dataset: dataset,
            syncEnabled: true,
            syncMode: "full",
            sheetCount: Object.keys(sheetsMap).length,
            sheets: sheetsMap,
            timestamp: new Date().toISOString()
        };

        await saveDataSourceToFirestore(dataset, data);
        
        return NextResponse.json({ success: true, message: "DataSource saved successfully", dataset: dataset });
    } catch (error) {
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Internal Server Error",
            },
            { status: 500 }
        );
    }
}
