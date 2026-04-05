/**
 * GET/POST /api/console/services/[id]/actions/[action]
 * 
 * Service-specific action handler.
 * Routes to the correct action handler based on [id] and [action].
 * 
 * Known actions:
 *   - notifier/health    → GET → proxy health check
 *   - notifier/test-send → POST → send test WA message
 *   - spreadsheet-sync/sync-now → POST → blocking sync trigger
 */

import { NextRequest, NextResponse } from 'next/server';
import { CloudSchedulerClient } from '@google-cloud/scheduler';
import { google } from 'googleapis';
import { authenticatedFetch } from '../../../../_lib/auth';
import { PROJECT_ID } from '../../../../_lib/firestore';
import { getGoogleAuth } from '@/lib/dashboard-config';

const schedulerClient = new CloudSchedulerClient();
const LOCATION = process.env.SCHEDULER_REGION || 'asia-southeast2';
const SHEETS_SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'] as const;

// ── Notifier Actions ──

async function getNotifierBaseUrl(): Promise<string> {
  const [job] = await schedulerClient.getJob({
    name: `projects/${PROJECT_ID}/locations/${LOCATION}/jobs/wa-notifier-health`,
  });
  const targetUri = job.httpTarget?.uri;
  if (!targetUri) throw new Error('Could not resolve notifier URL from scheduler');
  return targetUri.replace(/\/health$/, '');
}

async function handleNotifierHealth() {
  const baseUrl = await getNotifierBaseUrl();
  const response = await authenticatedFetch(`${baseUrl}/health`, {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
  });
  if (!response.ok) {
    return NextResponse.json({ ok: false, error: `CR responded with ${response.status}` }, { status: 502 });
  }
  const data = await response.json();
  return NextResponse.json(data);
}

async function handleNotifierTestSend(body: Record<string, unknown>) {
  const chatId = (body?.chat_id as string) || '120363423463367344@g.us';
  const timestamp = new Date().toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const testMessage = `🧪 Test WA Notifier — ${timestamp} WIB\n\nPesan ini dikirim dari Dashboard.\nJika pesan ini sampai, pipeline WA Notifier berjalan normal.`;

  const baseUrl = await getNotifierBaseUrl();
  const response = await authenticatedFetch(`${baseUrl}/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, message_text: testMessage, source: 'dashboard-test', priority: 'normal' }),
  }, 20000);

  const data = await response.json() as { queued?: boolean; message_key?: string; error?: string };
  console.log(`[console] notifier test-send → ${data.queued ? 'queued' : 'failed'}`);

  return NextResponse.json({
    ok: data.queued || false,
    message_key: data.message_key || null,
    detail: data.queued ? 'Message queued — will be delivered shortly' : (data.error || 'Failed'),
  });
}

// ── Sync Actions ──

async function handleSyncNow() {
  const [job] = await schedulerClient.getJob({
    name: `projects/${PROJECT_ID}/locations/${LOCATION}/jobs/sheet-bq-sync-trigger`,
  });
  const targetUrl = job.httpTarget?.uri;
  if (!targetUrl) throw new Error('Could not resolve sync CF URL');

  console.log(`[console] spreadsheet-sync manual sync triggered`);

  const response = await authenticatedFetch(targetUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, 120000);

  console.log(`[console] spreadsheet-sync manual sync → HTTP ${response.status}`);

  return NextResponse.json({
    ok: response.ok,
    status: response.status,
    duration: 'complete',
  });
}

// ── Thor Vaisala Actions ──

async function handleThorTestConnection(body: Record<string, unknown>) {
  try {
    const url = body.url as string;
    const cookie = body.cookie as string;
    if (!url || !cookie) {
      return NextResponse.json({ ok: false, detail: 'URL and Cookie are required' });
    }
    const res = await fetch(url, {
      headers: { Cookie: cookie, 'User-Agent': 'Mozilla/5.0' },
    });
    if (!res.ok) {
      return NextResponse.json({ ok: false, detail: `Trion API returned HTTP ${res.status}` });
    }
    return NextResponse.json({ ok: true, detail: 'Connection successful' });
  } catch (e: any) {
    return NextResponse.json({ ok: false, detail: e.message || 'Fetch failed' });
  }
}

// ── Spreadsheet Actions (shared: Config tab + Enrichment tab) ──

function getSheetsClient() {
  const auth = getGoogleAuth([...SHEETS_SCOPES]);
  return google.sheets({ version: 'v4', auth });
}

/**
 * Load all sheet names from a spreadsheet.
 * Used by Config tab (tower sheet) and Enrichment tab (source sheet).
 */
async function handleLoadSheets(body: Record<string, unknown>) {
  const spreadsheetId = body.spreadsheetId as string;
  if (!spreadsheetId) {
    return NextResponse.json({ error: 'spreadsheetId is required' }, { status: 400 });
  }

  try {
    const client = getSheetsClient();
    const meta = await client.spreadsheets.get({
      spreadsheetId,
      fields: 'sheets.properties.title',
    });

    const sheets = (meta.data.sheets || []).map(
      (s) => s.properties?.title || 'Untitled'
    );

    return NextResponse.json({ sheets });
  } catch (err: any) {
    const msg = err.message || 'Failed to load sheets';
    console.error(`[actions] load-sheets error: ${msg}`);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

/**
 * Load header row + row count from a specific sheet.
 * Used by Config tab (tower column mapping) and Enrichment tab (column mapping).
 */
async function handleLoadHeaders(body: Record<string, unknown>) {
  const spreadsheetId = body.spreadsheetId as string;
  const sheetName = body.sheetName as string;
  if (!spreadsheetId || !sheetName) {
    return NextResponse.json({ error: 'spreadsheetId and sheetName are required' }, { status: 400 });
  }

  try {
    const client = getSheetsClient();

    // Read header row (row 1)
    const headerRes = await client.spreadsheets.values.get({
      spreadsheetId,
      range: `'${sheetName}'!1:1`,
    });
    const headers = (headerRes.data.values?.[0] || []).map((h: unknown) =>
      String(h || '').trim()
    ).filter(Boolean);

    // Read column A to count data rows
    const countRes = await client.spreadsheets.values.get({
      spreadsheetId,
      range: `'${sheetName}'!A:A`,
    });
    const rowCount = Math.max(0, (countRes.data.values?.length || 1) - 1);

    return NextResponse.json({ headers, rowCount });
  } catch (err: any) {
    const msg = err.message || 'Failed to load headers';
    console.error(`[actions] load-headers error: ${msg}`);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

// ── Route Handler ──

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; action: string }> }
) {
  try {
    const { id, action } = await params;

    if (id === 'notifier' && action === 'health') {
      return await handleNotifierHealth();
    }

    return NextResponse.json({ error: `Unknown GET action: ${id}/${action}` }, { status: 404 });
  } catch (error) {
    const err = error as Error;
    return NextResponse.json({ error: err.message }, { status: 502 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; action: string }> }
) {
  try {
    const { id, action } = await params;
    const body = request.headers.get('content-type')?.includes('json')
      ? await request.json() : {};

    if (id === 'notifier' && action === 'test-send') {
      return await handleNotifierTestSend(body);
    }

    if (id === 'spreadsheet-sync' && action === 'sync-now') {
      return await handleSyncNow();
    }

    if ((id === 'thor-vaisala' || id === 'thor-gen3') && action === 'test-connection') {
      return await handleThorTestConnection(body);
    }

    // Shared spreadsheet actions (any service can use)
    if (action === 'load-sheets') {
      return await handleLoadSheets(body);
    }
    if (action === 'load-headers') {
      return await handleLoadHeaders(body);
    }

    return NextResponse.json({ error: `Unknown POST action: ${id}/${action}` }, { status: 404 });
  } catch (error) {
    const err = error as Error;
    return NextResponse.json({ error: err.message }, { status: 502 });
  }
}
