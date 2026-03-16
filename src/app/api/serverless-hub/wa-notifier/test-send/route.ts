/**
 * WA Notifier Test Send — POST /api/serverless-hub/wa-notifier/test-send
 *
 * Sends a test message through the WA Notifier CR to verify
 * the full pipeline: Dashboard → CR → Cloud Tasks → MaxChat.
 *
 * Body: { chat_id?: string }
 * If chat_id not provided, uses the default maintenance group.
 */

import { NextResponse } from "next/server";
import { writeAuditLog } from "@/lib/cloud-logging-writer";
import { getSchedulerJob } from "@/lib/generic-scheduler";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEFAULT_TEST_GROUP = "120363423463367344@g.us";

export async function POST(request: Request) {
    try {
        const body = await request.json().catch(() => ({}));
        const chatId = (body as Record<string, string>).chat_id || DEFAULT_TEST_GROUP;

        const timestamp = new Date().toLocaleString("id-ID", {
            timeZone: "Asia/Jakarta",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        });

        const testMessage = `🧪 Test WA Notifier — ${timestamp} WIB\n\nPesan ini dikirim dari Serverless Hub Dashboard.\nJika pesan ini sampai, pipeline WA Notifier berjalan normal.`;

        // 1. Fetch dynamic URL from Cloud Scheduler
        const jobInfo = await getSchedulerJob("wa-notifier-health");
        if (!jobInfo.targetUri) {
            throw new Error("Could not determine service URL from Cloud Scheduler");
        }
        
        // Convert /health to /send
        const baseUrl = jobInfo.targetUri.replace(/\/health$/, "");
        const targetUrl = `${baseUrl}/send`;

        // 2. Generate OIDC Token for secure Cloud Run invocation
        const { GoogleAuth } = await import("google-auth-library");
        const auth = new GoogleAuth();
        const client = await auth.getIdTokenClient(baseUrl);
        const tokenRes = await client.getRequestHeaders();

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20_000);

        // 3. Send Request
        const response = await fetch(targetUrl, {
            method: "POST",
            headers: { 
                ...tokenRes,
                "Content-Type": "application/json" 
            },
            body: JSON.stringify({
                chat_id: chatId,
                message_text: testMessage,
                source: "serverless-hub-test",
                priority: "normal",
            }),
            signal: controller.signal,
        });

        clearTimeout(timeout);

        const data = await response.json();

        await writeAuditLog("wa-notifier", "test_send",
            `Test message sent to ${chatId.substring(0, 12)}... → ${data.queued ? "queued" : "failed"}`);

        return NextResponse.json({
            ok: data.queued || false,
            message_key: data.message_key || null,
            detail: data.queued
                ? "Message queued in Cloud Tasks — will be delivered shortly"
                : (data.error || "Failed to queue message"),
        });
    } catch (err) {
        return NextResponse.json(
            {
                ok: false,
                error: err instanceof Error ? err.message : "Test send failed",
            },
            { status: 502 },
        );
    }
}
