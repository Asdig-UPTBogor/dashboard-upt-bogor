/**
 * Unified Cron Dispatcher
 * 
 * Single Cloud Scheduler job dispatches to all workers based on time.
 * Schedule: every 1 minute (cron: star-slash-1 star star star star)
 * 
 * Ref: cloud_run_unified_architecture.md
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 60 second timeout for all workers combined

export async function GET(request: Request) {
    const startTime = Date.now();

    // ── Security: verify cron secret ──
    const cronSecret = request.headers.get('x-cron-secret') ||
        new URL(request.url).searchParams.get('secret');
    const expectedSecret = process.env.CRON_SECRET || '';

    if (expectedSecret && cronSecret !== expectedSecret) {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const now = new Date();
    const minute = now.getMinutes();
    const hour = now.getHours();
    const results: Record<string, unknown> = {};

    // ── Worker 1: Thor Sync — EVERY call (1 minute) ──
    try {
        const baseUrl = new URL(request.url).origin;
        const thorUrl = `${baseUrl}/api/cron/thor-sync${cronSecret ? `?secret=${cronSecret}` : ''}`;
        const thorRes = await fetch(thorUrl, {
            headers: cronSecret ? { 'x-cron-secret': cronSecret } : {},
        });
        results.thor = await thorRes.json();
    } catch (error) {
        results.thor = { status: 'error', detail: (error as Error).message };
    }

    // ── Worker 2: Sheet Sync — every 5 minutes ──
    // TODO: Implement when sheet-sync is ready
    if (minute % 5 === 0) {
        results.sheetSync = { status: 'skipped', reason: 'not_implemented_yet' };
    }

    // ── Worker 3: Weather GI — every 6 hours ──
    // TODO: Implement when weather-sync is ready
    if (hour % 6 === 0 && minute === 0) {
        results.weatherGI = { status: 'skipped', reason: 'not_implemented_yet' };
    }

    // ── Worker 4: WA Daily Report — every day at 07:00 ──
    // TODO: Implement when wa-report is ready
    if (hour === 7 && minute === 0) {
        results.waReport = { status: 'skipped', reason: 'not_implemented_yet' };
    }

    return NextResponse.json({
        ok: true,
        timestamp: now.toISOString(),
        results,
        durationMs: Date.now() - startTime,
    });
}
