import { NextResponse } from 'next/server';
import { GoogleAuth } from 'google-auth-library';
import path from 'path';
import fs from 'fs';

// Helper to reliably get an authenticated client for Cloud Run endpoints
async function getAuthClient(targetAudience: string) {
    const isLocal = fs.existsSync(path.join(process.cwd(), 'google-auth', 'key.json'));
    const authOptions: any = {};
    if (isLocal) {
        authOptions.keyFile = path.join(process.cwd(), 'google-auth', 'key.json');
    }
    const auth = new GoogleAuth(authOptions);
    return await auth.getIdTokenClient(targetAudience);
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { dataset } = body;

        if (!dataset) {
            return NextResponse.json({ success: false, error: "Missing dataset parameter" }, { status: 400 });
        }

        const targetUrl = 'https://asia-southeast2-gcp-bridge-meshvpn.cloudfunctions.net/sheetBqSync';

        // Use GoogleAuth to securely handle Identity-Aware Proxy / Cloud Run IAM authentication
        const client = await getAuthClient(targetUrl);
        
        console.log(`[SYNC-BRIDGE] Triggering specific sync for dataset: ${dataset}`);
        const response = await client.request({
            url: targetUrl,
            method: 'POST',
            data: { dataset }, 
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 120000 // 2 minutes, as dataset creation + initial pull might take a bit
        });

        // The Cloud Function inherently returns JSON
        return NextResponse.json({ success: true, message: "On-Demand Sync completed", result: response.data });
        
    } catch (error: any) {
        console.error("[SYNC-BRIDGE] Error during CF invocation:", error.message);
        return NextResponse.json(
            {
                success: false,
                error: error.message || "Internal Server Error during direct CF Sync",
            },
            { status: 500 }
        );
    }
}
