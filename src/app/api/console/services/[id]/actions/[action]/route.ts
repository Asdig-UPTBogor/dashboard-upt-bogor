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

import { PubSub as EventarcTransport } from '@google-cloud/pubsub';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { BigQuery } from '@google-cloud/bigquery';
import { NextRequest, NextResponse } from 'next/server';
import { CloudSchedulerClient } from '@google-cloud/scheduler';
import { google } from 'googleapis';
import { authenticatedFetch } from '@/app/api/console/_lib/auth';
import { PROJECT_ID, db, readConfig, updateConfig, getServiceDef } from '@/app/api/console/_lib/firestore';
import { getGoogleAuth } from '@/lib/dashboard-config';
import { FieldValue } from '@google-cloud/firestore';

const schedulerClient = new CloudSchedulerClient();
const eventarc = new EventarcTransport({ projectId: PROJECT_ID });
const secretManager = new SecretManagerServiceClient({ projectId: PROJECT_ID });
const LOCATION = process.env.SCHEDULER_REGION || 'asia-southeast2';
const NOTIFIER_TOPIC = 'notifier-send'; // Transport for Eventarc v3.0
const SHEETS_SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'] as const;

// Cache for secrets (cold start optimization)
const secretCache = new Map<string, string>();

/**
 * triggerEventarcNotifier
 * - Abstraction layer for sending events to Notifier v3.0
 * - Handles the base64 wrapping required by the Eventarc contract
 */
async function triggerEventarcNotifier(payload: any) {
  const dataBuffer = Buffer.from(JSON.stringify(payload));
  // Eventarc v3.0 uses high-availability event transport
  const messageId = await eventarc.topic(NOTIFIER_TOPIC).publishMessage({ data: dataBuffer });
  return messageId;
}

/**
 * getSecret
 * - Fetches secret from Google Secret Manager
 * - Minimal memory caching for cold start performance
 */
async function getSecret(secretName: string): Promise<string> {
  const service = 'notifier';
  const tag = `[actions][${service}][secrets]`;

  if (secretCache.has(secretName)) return secretCache.get(secretName)!;

  const name = `projects/${PROJECT_ID}/secrets/${secretName}/versions/latest`;
  try {
    console.log(tag, `[R1] Fetching secret: ${secretName}`);
    const [version] = await secretManager.accessSecretVersion({ name });
    const payload = version.payload?.data?.toString();
    
    if (!payload) {
      throw new Error(`Secret ${secretName} has empty payload`);
    }

    secretCache.set(secretName, payload);
    console.log(tag, `[R2] Secret ${secretName} loaded successfully (Length: ${payload.length})`);
    return payload;
  } catch (err: any) {
    console.error(tag, `[ERR] Failed to access secret ${secretName}:`, err.message);
    // Standardizing error for UI/User — case-insensitive karena gRPC error codes bisa uppercase/lowercase
    const errMsg = (err.message || '').toLowerCase();
    if (errMsg.includes('not_found') || errMsg.includes('not found')) {
      throw new Error(`Secret '${secretName}' tidak ditemukan di GCP Secret Manager.`);
    }
    if (errMsg.includes('permission_denied') || errMsg.includes('permission denied')) {
      throw new Error(`Service Account tidak memiliki izin akses ke secret '${secretName}'.`);
    }
    throw new Error(`Secret Manager error: ${err.message}`);
  }
}

/**
 * handleNotifierTestSend
 * - Triggers a test event via Eventarc
 * - Standard v3: No HTTP calls to CF, strictly event-driven.
 */
async function handleNotifierTestSend(body: Record<string, unknown>) {
  try {
    const { config } = await readConfig('notifier');
    const groups = (config.groups as Record<string, any>) || {};
    
    // Safety: Test send ONLY to maintenance group
    if (!groups.maintenance?.wa_chat_id) {
       throw new Error('Maintenance group (wa_chat_id) must be configured first in Firestore');
    }

    const timestamp = new Date().toLocaleString('id-ID', {
      timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', second: '2-digit',
    });

    // F02 fix: Gunakan pesan dari user jika ada, fallback ke default
    const userText = typeof body.text === 'string' && body.text.trim() ? body.text.trim() : null;
    const defaultText = `🧪 Test Notifier — ${timestamp} WIB\n\nPesan ini dikirim dari Dashboard via Eventarc Transport.\nArsitektur: Notifier v3.0 (Strict Event-Driven).`;
    
    const payload = {
      group: 'maintenance',
      type: 'text',
      text: userText || defaultText,
      source: 'dashboard-test',
      priority: 'normal'
    };

    const eventId = await triggerEventarcNotifier(payload);

    console.log(`[console] eventarc notifier test-send → trigger success: ${eventId}`);

    return NextResponse.json({
      ok: true,
      event_id: eventId,
      detail: 'Event triggered via Eventarc — check Maintenance group for delivery status'
    });
  } catch (err: any) {
    console.error(`[console] eventarc test-send error: ${err.message}`);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

/**
 * handleNotifierVerifyGroup
 * - Proxies call to MaxChat API to sync group name and member count
 * - Flow Standard: [V0-V5] Validation, [R0-R6] Runtime
 */
async function handleNotifierVerifyGroup(body: Record<string, unknown>) {
  const service = 'notifier';
  const tag = (step: string) => `[actions][${service}][verify-group]${step}`;

  try {
    // ── [V0] Schema Validation ──
    const { groupName, wa_chat_id } = body as { groupName: string, wa_chat_id: string };
    if (!groupName || !wa_chat_id) {
      throw new Error('Property groupName dan wa_chat_id wajib ada dalam payload.');
    }

    // ── [V1] Config Resolution ──
    console.log(tag('[V1]'), `Resolving config for ${groupName}`);
    const { config } = await readConfig(service);
    if (!config) throw new Error('Konfigurasi notifier tidak ditemukan di Firestore.');

    const activeId = (config.ACTIVE_PROVIDER as string) || 'maxchat';
    const providerCfg = (config.providers as Record<string, any>)?.[activeId];
    
    if (!providerCfg?.token_secret || !providerCfg?.base_url) {
      console.warn(tag('[V1]'), `Provider config ${activeId} incomplete`);
      throw new Error(`Konfigurasi provider '${activeId}' belum lengkap (Cek base_url/token_secret).`);
    }

    // ── [R1] Secret Handshake (SA Access) ──
    const token = await getSecret(providerCfg.token_secret);
    
    // ── [R2] External Provider API Call ──
    const apiEndpoint = `${providerCfg.base_url.replace(/\/$/, '')}/groups/${wa_chat_id}`;
    console.log(tag('[R2]'), `Syncing via ${activeId} to: ${apiEndpoint}`);
    
    const response = await fetch(apiEndpoint, {
      method: 'GET',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      const errorBody = await response.text();
      const status = response.status;
      
      console.error(tag('[R2]'), `API error ${status}: ${errorBody}`);

      if (status === 401) {
        throw new Error(`[401] Token Provider (${activeId}) kadaluwarsa. Silakan perbarui Secret Manager.`);
      }
      if (status === 404) {
        throw new Error(`[404] Grup WhatsApp dengan ID ${wa_chat_id} tidak ditemukan.`);
      }
      throw new Error(`Gagal menghubungi provider API (HTTP ${status}).`);
    }

    const data = await response.json();
    const result = data.data || data; // Handle different wrapper formats
    
    const providerName = result.name || result.subject || result.groupName;
    const providerCount = result.totalMember || result.member_count || result.count || 0;

    if (!providerName) {
      console.warn(tag('[R2]'), 'API response valid but missing name/subject', result);
      throw new Error('API provider tidak mengembalikan nama grup yang valid.');
    }

    // ── [R3] SSOT Reconciliation ──
    const groups = (config.groups as Record<string, any>) || {};
    const existingGroup = groups[groupName] || {};

    // F04 fix: Timestamp WIB sesuai convention (bukan UTC)
    const nowWib = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Jakarta' }).replace(' ', 'T') + '+07:00';
    
    console.log(tag('[R3]'), `Reconciled ${groupName} -> WA Name: "${providerName}", Members: ${providerCount}`);

    // ── [R4] Atomic Commit ──
    // F13 fix: Gunakan dot-notation update agar HANYA group ini yang diupdate.
    // Sebelumnya pakai updateConfig() dengan nested object → Firestore set({merge:true})
    // akan REPLACE seluruh map `groups`, menghapus sibling groups.
    // Sekarang: direct Firestore update dengan dot-notation per-field.
    const def = await getServiceDef(service);
    if (!def?.configCollection || !def?.configDocument) {
      throw new Error('Service definition notifier tidak ditemukan.');
    }

    const dotUpdate: Record<string, unknown> = {
      [`groups.${groupName}.wa_group_name`]: providerName,
      [`groups.${groupName}.wa_member_count`]: providerCount,
      [`groups.${groupName}.wa_chat_id`]: wa_chat_id,
      [`groups.${groupName}.verified_at`]: nowWib,
      // F14 fix: Tambah added_at/added_by fallback untuk group baru
      // Hanya set jika belum ada (group pertama kali di-verify)
      ...(!existingGroup.added_at ? { [`groups.${groupName}.added_at`]: nowWib } : {}),
      ...(!existingGroup.added_by ? { [`groups.${groupName}.added_by`]: 'dashboard-verify' } : {}),
    };

    // Preserve existing fields yang tidak di-update (tg_chat_id, tg_group_name, dll)
    // Dot-notation update TIDAK menghapus field lain di dalam groups.${groupName}
    await db.collection(def.configCollection).doc(def.configDocument).update(dotUpdate);
    console.log(tag('[R4]'), `Sync success for group: ${groupName}`);

    return NextResponse.json({ 
      ok: true, 
      message: 'Sinkronisasi metadata grup berhasil.',
      reconciled: {
        wa_name: providerName,
        members: providerCount,
      }
    });

  } catch (err: any) {
    console.error(tag('[ERR]'), err.message);
    const statusCode = err.message.includes('[401]') ? 401 : err.message.includes('[404]') ? 404 : 500;
    return NextResponse.json({ ok: false, error: err.message }, { status: statusCode });
  }
}

// ── Group CRUD ──
// Groups di-manage HANYA dari CC Notifier.
// CF Notifier baca groups dari Firestore saat runtime — tidak hardcode.

/**
 * resolveWaChatId
 * - Resolve input ke format wa_chat_id (@g.us)
 * - Mendukung: raw ID, invite link (https://chat.whatsapp.com/...)
 * - Invite link di-resolve via MaxChat POST /api/groups/join
 */
async function resolveWaChatId(input: string, providerCfg: any): Promise<{ chatId: string; resolvedFrom: 'raw' | 'invite' }> {
  const trimmed = input.trim();

  // Case 1: Sudah format @g.us → langsung return
  if (trimmed.endsWith('@g.us')) {
    return { chatId: trimmed, resolvedFrom: 'raw' };
  }

  // Case 2: Invite link → extract code → resolve via MaxChat
  const inviteMatch = trimmed.match(/chat\.whatsapp\.com\/([A-Za-z0-9]+)/);
  if (inviteMatch) {
    const inviteCode = inviteMatch[1];
    console.log(`[resolve] Invite code extracted: ${inviteCode}`);

    // Ambil token dari Secret Manager
    const token = await getSecret(providerCfg.token_secret);
    const baseUrl = providerCfg.base_url.replace(/\/$/, '');

    const res = await fetch(`${baseUrl}/groups/join`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code: inviteCode }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Gagal resolve invite link (HTTP ${res.status}): ${errBody}`);
    }

    const data = await res.json();
    const rawId = data.chatId || data.id;
    if (!rawId) {
      throw new Error('MaxChat /groups/join tidak mengembalikan chatId.');
    }

    // MaxChat return tanpa @g.us, tambahkan
    const chatId = rawId.endsWith('@g.us') ? rawId : `${rawId}@g.us`;
    console.log(`[resolve] Invite resolved: ${inviteCode} → ${chatId}`);
    return { chatId, resolvedFrom: 'invite' };
  }

  // Case 3: Format tidak dikenali
  throw new Error(
    'Format tidak dikenali. Masukkan WA Chat ID (xxx@g.us) atau paste invite link (https://chat.whatsapp.com/...).'
  );
}

/**
 * handleNotifierResolveInvite
 * - Resolve invite link ke chat ID tanpa save ke Firestore
 * - Dipakai FE untuk preview sebelum Add Group
 */
async function handleNotifierResolveInvite(body: Record<string, unknown>) {
  const service = 'notifier';
  const tag = (step: string) => `[actions][${service}][resolve-invite]${step}`;

  try {
    const { input } = body as { input: string };
    if (!input) throw new Error('Input wajib diisi.');

    // [V1] Ambil provider config
    const { config } = await readConfig(service);
    const activeId = (config.ACTIVE_PROVIDER as string) || 'maxchat';
    const providerCfg = (config.providers as Record<string, any>)?.[activeId];
    if (!providerCfg?.token_secret || !providerCfg?.base_url) {
      throw new Error(`Konfigurasi provider '${activeId}' belum lengkap.`);
    }

    // [R1] Resolve
    const { chatId, resolvedFrom } = await resolveWaChatId(input, providerCfg);

    // [R2] Fetch group info untuk preview
    const token = await getSecret(providerCfg.token_secret);
    const baseUrl = providerCfg.base_url.replace(/\/$/, '');
    let groupName = null;
    let memberCount = null;

    try {
      const infoRes = await fetch(`${baseUrl}/groups/${chatId}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
      });
      if (infoRes.ok) {
        const infoData = await infoRes.json();
        const result = infoData.data || infoData;
        groupName = result.subject || result.name || null;
        memberCount = result.totalMember || result.member_count || null;
      }
    } catch {
      console.warn(tag('[R2]'), 'Failed to fetch group info (non-fatal)');
    }

    console.log(tag('[R2]'), `Resolved: ${input} → ${chatId} (${resolvedFrom})`);

    return NextResponse.json({
      ok: true,
      chatId,
      resolvedFrom,
      groupName,
      memberCount,
    });
  } catch (err: any) {
    console.error(tag('[ERR]'), err.message);
    return NextResponse.json({ ok: false, error: err.message }, { status: 400 });
  }
}

/**
 * handleNotifierAddGroup
 * - Admin tambah group baru via CC Notifier
 * - Input: groupName (key) + wa_chat_id (raw ID atau invite link)
 * - Invite link otomatis di-resolve via MaxChat POST /groups/join
 * - Dot-notation write → tidak ganggu sibling groups
 */
async function handleNotifierAddGroup(body: Record<string, unknown>) {
  const service = 'notifier';
  const tag = (step: string) => `[actions][${service}][add-group]${step}`;

  try {
    const { groupName, wa_chat_id } = body as { groupName: string; wa_chat_id: string };

    // [V0] Validasi input
    if (!groupName || typeof groupName !== 'string') {
      throw new Error('groupName wajib diisi (string).');
    }
    if (!wa_chat_id || typeof wa_chat_id !== 'string') {
      throw new Error('wa_chat_id wajib diisi (string).');
    }

    // Key harus snake_case (lowercase + underscore)
    const keyPattern = /^[a-z][a-z0-9_]*$/;
    if (!keyPattern.test(groupName)) {
      throw new Error('groupName harus snake_case (huruf kecil, angka, underscore). Contoh: thor_alert, maintenance');
    }

    // [V1] Resolve wa_chat_id (support invite link)
    const { config } = await readConfig(service);
    const activeId = (config.ACTIVE_PROVIDER as string) || 'maxchat';
    const providerCfg = (config.providers as Record<string, any>)?.[activeId];
    if (!providerCfg?.token_secret || !providerCfg?.base_url) {
      throw new Error(`Konfigurasi provider '${activeId}' belum lengkap.`);
    }

    const { chatId: resolvedChatId, resolvedFrom } = await resolveWaChatId(wa_chat_id, providerCfg);
    console.log(tag('[V1]'), `Resolved: ${wa_chat_id} → ${resolvedChatId} (${resolvedFrom})`);

    // [V2] Cek apakah group sudah ada
    const groups = (config.groups as Record<string, any>) || {};
    if (groups[groupName]) {
      throw new Error(`Group "${groupName}" sudah ada. Gunakan Edit untuk mengubah.`);
    }

    // [R1] Tulis ke Firestore dengan dot-notation
    const nowWib = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Jakarta' }).replace(' ', 'T') + '+07:00';
    const def = await getServiceDef(service);
    if (!def?.configCollection || !def?.configDocument) {
      throw new Error('Service definition notifier tidak ditemukan.');
    }

    const dotUpdate: Record<string, unknown> = {
      [`groups.${groupName}.wa_chat_id`]: resolvedChatId,
      [`groups.${groupName}.wa_group_name`]: null,  // Akan diisi saat Verify
      [`groups.${groupName}.wa_member_count`]: null,
      [`groups.${groupName}.tg_chat_id`]: null,
      [`groups.${groupName}.tg_group_name`]: null,
      [`groups.${groupName}.tg_member_count`]: null,
      [`groups.${groupName}.added_at`]: nowWib,
      [`groups.${groupName}.added_by`]: 'dashboard-admin',
      [`groups.${groupName}.verified_at`]: null,
    };

    await db.collection(def.configCollection).doc(def.configDocument).update(dotUpdate);
    console.log(tag('[R1]'), `Group added: ${groupName} → ${resolvedChatId}`);

    const fromNote = resolvedFrom === 'invite' ? ` (resolved dari invite link)` : '';
    return NextResponse.json({
      ok: true,
      message: `Group "${groupName}" → ${resolvedChatId}${fromNote} berhasil ditambahkan. Klik Verify untuk sync metadata.`,
      resolvedChatId,
    });
  } catch (err: any) {
    console.error(tag('[ERR]'), err.message);
    return NextResponse.json({ ok: false, error: err.message }, { status: 400 });
  }
}

/**
 * handleNotifierEditGroup
 * - Admin edit wa_chat_id group existing
 * - Reset verified_at karena chat ID berubah (perlu verify ulang)
 */
async function handleNotifierEditGroup(body: Record<string, unknown>) {
  const service = 'notifier';
  const tag = (step: string) => `[actions][${service}][edit-group]${step}`;

  try {
    const { groupName, wa_chat_id } = body as { groupName: string; wa_chat_id: string };

    if (!groupName || !wa_chat_id) {
      throw new Error('groupName dan wa_chat_id wajib diisi.');
    }
    if (!wa_chat_id.endsWith('@g.us')) {
      throw new Error('wa_chat_id harus format WhatsApp group ID (diakhiri @g.us).');
    }

    // Cek group ada
    const { config } = await readConfig(service);
    const groups = (config.groups as Record<string, any>) || {};
    if (!groups[groupName]) {
      throw new Error(`Group "${groupName}" tidak ditemukan.`);
    }

    const def = await getServiceDef(service);
    if (!def?.configCollection || !def?.configDocument) {
      throw new Error('Service definition notifier tidak ditemukan.');
    }

    // Update chat ID + reset verify (karena ID berubah)
    const dotUpdate: Record<string, unknown> = {
      [`groups.${groupName}.wa_chat_id`]: wa_chat_id,
      [`groups.${groupName}.wa_group_name`]: null,   // Reset — perlu verify ulang
      [`groups.${groupName}.wa_member_count`]: null,
      [`groups.${groupName}.verified_at`]: null,
    };

    await db.collection(def.configCollection).doc(def.configDocument).update(dotUpdate);
    console.log(tag('[R1]'), `Group edited: ${groupName} → ${wa_chat_id}`);

    return NextResponse.json({
      ok: true,
      message: `Chat ID group "${groupName}" berhasil diubah. Klik Verify untuk sync metadata baru.`,
    });
  } catch (err: any) {
    console.error(tag('[ERR]'), err.message);
    return NextResponse.json({ ok: false, error: err.message }, { status: 400 });
  }
}

/**
 * handleNotifierDeleteGroup
 * - Admin hapus group dari Firestore
 * - PERINGATAN: Producer yang masih kirim ke key ini akan error (logged di BQ)
 */
async function handleNotifierDeleteGroup(body: Record<string, unknown>) {
  const service = 'notifier';
  const tag = (step: string) => `[actions][${service}][delete-group]${step}`;

  try {
    const { groupName } = body as { groupName: string };
    if (!groupName) {
      throw new Error('groupName wajib diisi.');
    }

    // Cek group ada
    const { config } = await readConfig(service);
    const groups = (config.groups as Record<string, any>) || {};
    if (!groups[groupName]) {
      throw new Error(`Group "${groupName}" tidak ditemukan.`);
    }

    const def = await getServiceDef(service);
    if (!def?.configCollection || !def?.configDocument) {
      throw new Error('Service definition notifier tidak ditemukan.');
    }

    // Hapus seluruh group map entry menggunakan FieldValue.delete()
    await db.collection(def.configCollection).doc(def.configDocument).update({
      [`groups.${groupName}`]: FieldValue.delete(),
    });
    console.log(tag('[R1]'), `Group deleted: ${groupName}`);

    return NextResponse.json({
      ok: true,
      message: `Group "${groupName}" berhasil dihapus. Producer yang masih kirim ke key ini akan error.`,
    });
  } catch (err: any) {
    console.error(tag('[ERR]'), err.message);
    return NextResponse.json({ ok: false, error: err.message }, { status: 400 });
  }
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

// ── Notifier: BQ Delivery Logs ──

/**
 * GET /api/console/services/notifier/actions/delivery-logs?limit=50&offset=0&status=failed
 * 
 * Query BigQuery delivery_log — kronologis, terbaru di atas.
 * Filter opsional: status (delivered/failed/skipped/dropped)
 */
const bq = new BigQuery({ projectId: PROJECT_ID });

async function handleNotifierDeliveryLogs(request: NextRequest) {
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const statusFilter = url.searchParams.get('status') || '';

    let query = `
        SELECT
            event_id,
            pubsub_message_id,
            group_key,
            group_name,
            chat_id,
            source,
            channel,
            type,
            text,
            provider,
            status,
            provider_message_id,
            error,
            priority,
            duration_ms,
            enqueued_at,
            delivered_at,
            image_gcs_path
        FROM \`${PROJECT_ID}.dispatch.delivery_log\`
    `;

    const params: Record<string, string> = {};
    if (statusFilter && ['delivered', 'failed', 'skipped', 'dropped'].includes(statusFilter)) {
        query += ` WHERE status = @status`;
        params.status = statusFilter;
    }

    query += ` ORDER BY delivered_at DESC LIMIT @limit OFFSET @offset`;

    try {
        const [rows] = await bq.query({
            query,
            params: { ...params, limit, offset },
        });

        // Count total untuk pagination
        let countQuery = `SELECT COUNT(*) as total FROM \`${PROJECT_ID}.dispatch.delivery_log\``;
        if (statusFilter && ['delivered', 'failed', 'skipped', 'dropped'].includes(statusFilter)) {
            countQuery += ` WHERE status = @status`;
        }
        const [countResult] = await bq.query({ query: countQuery, params });
        const total = countResult[0]?.total || 0;

        return NextResponse.json({ rows, total, limit, offset });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[delivery-logs] BQ query error:', msg);
        // Kalau table belum ada (belum deploy CF), return empty
        if (msg.includes('Not found')) {
            return NextResponse.json({ rows: [], total: 0, limit, offset });
        }
        return NextResponse.json({ error: msg }, { status: 502 });
    }
}

// ══════════════════════════════════════════════════════════════════
//  DISPATCH ACTIONS (v1 — CC-B)
// ══════════════════════════════════════════════════════════════════
//
// Dispatch = Unified Messaging Gateway (pengganti Notifier, 2-way WAHA).
// FS doc: service_runtime_configs/dispatch
// BQ:  dispatch.delivery_log, waha.message_log, waha.event_log
//
// Handlers:
//   test-send        → Pub/Sub publish ke notifier-send (reuse Notifier transport)
//   inbound-logs     → GET — BQ query waha.message_log
//   event-logs       → GET — BQ query waha.event_log
//   add/edit/delete-group → Firestore dot-notation (tanpa resolve-invite — WAHA pakai chat_id @g.us)
//   verify-group     → Proxy ke Dispatch CF /admin/verify-group (butuh DISPATCH_ADMIN_KEY)
//   waha-status      → Proxy ke Dispatch CF /admin/waha-status
//   waha-restart     → Proxy ke Dispatch CF /admin/waha-restart

const DISPATCH_BASE_URL =
  process.env.DISPATCH_CF_URL ||
  'https://asia-southeast2-gcp-bridge-meshvpn.cloudfunctions.net/dispatch';

async function dispatchAdminCall(
  path: string,
  body?: Record<string, unknown>,
): Promise<{ status: number; data: Record<string, unknown> }> {
  const adminKey = await getSecret('dispatch-admin-key');
  const res = await fetch(`${DISPATCH_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'X-Admin-Key': adminKey,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data: Record<string, unknown> = {};
  try { data = await res.json(); } catch { /* non-json body */ }
  return { status: res.status, data };
}

// ── Dispatch: test-send ──

async function handleDispatchTestSend(body: Record<string, unknown>) {
  try {
    const { config } = await readConfig('dispatch');
    const groups = (config.groups as Record<string, any>) || {};

    const targetKey = typeof body.group === 'string' && body.group ? body.group : 'maintenance';
    if (!groups[targetKey]?.wa_chat_id) {
      throw new Error(`Group "${targetKey}" belum terdaftar atau tidak punya wa_chat_id`);
    }

    const timestamp = new Date().toLocaleString('id-ID', {
      timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    const userText = typeof body.text === 'string' && body.text.trim() ? body.text.trim() : null;
    const defaultText = `🧪 Test Dispatch — ${timestamp} WIB\n\nPesan ini dikirim dari Dashboard Cloud Console.\nPipeline: Dashboard → Pub/Sub → Dispatch CF → WAHA → WhatsApp.`;

    const payload = {
      group: targetKey,
      type: 'text',
      text: userText || defaultText,
      source: 'dashboard-test',
      channel: 'waha',
      priority: 'normal',
    };

    const eventId = await triggerEventarcNotifier(payload);
    console.log(`[console][dispatch] test-send trigger → ${eventId} (target: ${targetKey})`);

    return NextResponse.json({
      ok: true,
      event_id: eventId,
      target: targetKey,
      detail: 'Event triggered via Pub/Sub — cek log Dispatch CF + group WA',
    });
  } catch (err: any) {
    console.error(`[console][dispatch] test-send error: ${err.message}`);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

// ── Dispatch: inbound-logs + event-logs (BQ) ──

async function handleDispatchInboundLogs(request: NextRequest) {
  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200);
  const offset = parseInt(url.searchParams.get('offset') || '0');
  const direction = url.searchParams.get('direction') || '';
  const chatType = url.searchParams.get('chat_type') || '';

  const where: string[] = [];
  const params: Record<string, string> = {};
  if (direction && ['inbound', 'outbound'].includes(direction)) {
    where.push('direction = @direction'); params.direction = direction;
  }
  if (chatType && ['personal', 'group'].includes(chatType)) {
    where.push('chat_type = @chat_type'); params.chat_type = chatType;
  }
  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  try {
    const [rows] = await bq.query({
      query: `
        SELECT event_id, message_id, timestamp_wib, direction, from_id, from_name,
               to_id, chat_type, body, has_media, media_type, media_gcs_path, source, inserted_at
        FROM \`${PROJECT_ID}.waha.message_log\`
        ${whereClause}
        ORDER BY timestamp_wib DESC LIMIT @limit OFFSET @offset
      `,
      params: { ...params, limit, offset },
    });

    const [countResult] = await bq.query({
      query: `SELECT COUNT(*) as total FROM \`${PROJECT_ID}.waha.message_log\` ${whereClause}`,
      params,
    });
    const total = countResult[0]?.total || 0;

    return NextResponse.json({ rows, total, limit, offset });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('Not found')) return NextResponse.json({ rows: [], total: 0, limit, offset });
    console.error('[dispatch][inbound-logs] BQ error:', msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

async function handleDispatchEventLogs(request: NextRequest) {
  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200);
  const offset = parseInt(url.searchParams.get('offset') || '0');
  const eventType = url.searchParams.get('event_type') || '';

  const where: string[] = [];
  const params: Record<string, string> = {};
  if (eventType) { where.push('event_type = @event_type'); params.event_type = eventType; }
  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  try {
    const [rows] = await bq.query({
      query: `
        SELECT event_id, event_type, timestamp_wib, session, payload, inserted_at
        FROM \`${PROJECT_ID}.waha.event_log\`
        ${whereClause}
        ORDER BY timestamp_wib DESC LIMIT @limit OFFSET @offset
      `,
      params: { ...params, limit, offset },
    });

    const [countResult] = await bq.query({
      query: `SELECT COUNT(*) as total FROM \`${PROJECT_ID}.waha.event_log\` ${whereClause}`,
      params,
    });
    const total = countResult[0]?.total || 0;

    return NextResponse.json({ rows, total, limit, offset });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('Not found')) return NextResponse.json({ rows: [], total: 0, limit, offset });
    console.error('[dispatch][event-logs] BQ error:', msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

// ── Dispatch: Groups CRUD (Firestore dot-notation) ──

async function handleDispatchAddGroup(body: Record<string, unknown>) {
  try {
    const { groupName, wa_chat_id } = body as { groupName: string; wa_chat_id: string };

    if (!groupName || typeof groupName !== 'string') throw new Error('groupName wajib diisi.');
    if (!wa_chat_id || typeof wa_chat_id !== 'string') throw new Error('wa_chat_id wajib diisi.');
    if (!/^[a-z][a-z0-9_]*$/.test(groupName)) {
      throw new Error('groupName harus snake_case (huruf kecil, angka, underscore).');
    }
    if (!wa_chat_id.endsWith('@g.us')) {
      throw new Error('wa_chat_id harus format WhatsApp group ID (diakhiri @g.us).');
    }

    const { config } = await readConfig('dispatch');
    const groups = (config.groups as Record<string, any>) || {};
    if (groups[groupName]) throw new Error(`Group "${groupName}" sudah ada. Pakai Edit untuk mengubah.`);

    const nowWib = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Jakarta' }).replace(' ', 'T') + '+07:00';
    const def = await getServiceDef('dispatch');
    if (!def?.configCollection || !def?.configDocument) throw new Error('Service definition dispatch tidak ditemukan.');

    await db.collection(def.configCollection).doc(def.configDocument).update({
      [`groups.${groupName}.wa_chat_id`]: wa_chat_id,
      [`groups.${groupName}.wa_group_name`]: null,
      [`groups.${groupName}.wa_member_count`]: null,
      [`groups.${groupName}.enabled`]: true,
      [`groups.${groupName}.added_at`]: nowWib,
      [`groups.${groupName}.added_by`]: 'dashboard-admin',
      [`groups.${groupName}.verified_at`]: null,
    });
    console.log(`[dispatch][add-group] ${groupName} → ${wa_chat_id}`);

    return NextResponse.json({
      ok: true,
      message: `Group "${groupName}" berhasil ditambahkan. Klik Verify untuk sync metadata.`,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 400 });
  }
}

async function handleDispatchEditGroup(body: Record<string, unknown>) {
  try {
    const { groupName, wa_chat_id, enabled } = body as { groupName: string; wa_chat_id?: string; enabled?: boolean };
    if (!groupName) throw new Error('groupName wajib diisi.');

    const { config } = await readConfig('dispatch');
    const groups = (config.groups as Record<string, any>) || {};
    if (!groups[groupName]) throw new Error(`Group "${groupName}" tidak ditemukan.`);

    const def = await getServiceDef('dispatch');
    if (!def?.configCollection || !def?.configDocument) throw new Error('Service definition dispatch tidak ditemukan.');

    const update: Record<string, unknown> = {};
    if (wa_chat_id !== undefined) {
      if (!wa_chat_id.endsWith('@g.us')) throw new Error('wa_chat_id harus format @g.us.');
      update[`groups.${groupName}.wa_chat_id`] = wa_chat_id;
      update[`groups.${groupName}.wa_group_name`] = null;
      update[`groups.${groupName}.wa_member_count`] = null;
      update[`groups.${groupName}.verified_at`] = null;
    }
    if (enabled !== undefined) update[`groups.${groupName}.enabled`] = !!enabled;

    if (Object.keys(update).length === 0) throw new Error('Tidak ada field yang diubah.');

    await db.collection(def.configCollection).doc(def.configDocument).update(update);
    console.log(`[dispatch][edit-group] ${groupName} updated`);

    return NextResponse.json({
      ok: true,
      message: wa_chat_id
        ? `Chat ID group "${groupName}" berhasil diubah. Klik Verify untuk sync metadata baru.`
        : `Group "${groupName}" berhasil diupdate.`,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 400 });
  }
}

async function handleDispatchDeleteGroup(body: Record<string, unknown>) {
  try {
    const { groupName } = body as { groupName: string };
    if (!groupName) throw new Error('groupName wajib diisi.');

    const { config } = await readConfig('dispatch');
    const groups = (config.groups as Record<string, any>) || {};
    if (!groups[groupName]) throw new Error(`Group "${groupName}" tidak ditemukan.`);

    const def = await getServiceDef('dispatch');
    if (!def?.configCollection || !def?.configDocument) throw new Error('Service definition dispatch tidak ditemukan.');

    await db.collection(def.configCollection).doc(def.configDocument).update({
      [`groups.${groupName}`]: FieldValue.delete(),
    });
    console.log(`[dispatch][delete-group] ${groupName} deleted`);

    return NextResponse.json({
      ok: true,
      message: `Group "${groupName}" berhasil dihapus. Producer yang masih kirim ke key ini akan error.`,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 400 });
  }
}

// ── Dispatch: WAHA Proxy Actions ──

async function handleDispatchVerifyGroup(body: Record<string, unknown>) {
  try {
    const { groupName, wa_chat_id } = body as { groupName: string; wa_chat_id: string };
    if (!groupName || !wa_chat_id) throw new Error('groupName dan wa_chat_id wajib diisi.');

    const { status, data } = await dispatchAdminCall('/admin/verify-group', {
      groupKey: groupName, chatId: wa_chat_id,
    });

    if (status >= 200 && status < 300) {
      return NextResponse.json({
        ok: true,
        message: 'Sinkronisasi metadata grup berhasil.',
        reconciled: {
          wa_name: data.wa_group_name,
          members: data.wa_member_count,
          verified_at: data.verified_at,
        },
      });
    }
    return NextResponse.json({
      ok: false,
      error: (data.error as string) || `Dispatch HTTP ${status}`,
    }, { status: status === 401 ? 500 : status });
  } catch (err: any) {
    console.error(`[dispatch][verify-group] error: ${err.message}`);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

async function handleDispatchWahaStatus() {
  try {
    const { status, data } = await dispatchAdminCall('/admin/waha-status');
    if (status >= 200 && status < 300) {
      return NextResponse.json({ ok: true, ...data });
    }
    return NextResponse.json({
      ok: false,
      error: (data.error as string) || `Dispatch HTTP ${status}`,
    }, { status: 502 });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

async function handleDispatchWahaRestart() {
  try {
    const { status, data } = await dispatchAdminCall('/admin/waha-restart');
    if (status >= 200 && status < 300) {
      return NextResponse.json({ ok: true, message: 'Session restart triggered' });
    }
    return NextResponse.json({
      ok: false,
      error: (data.error as string) || `Dispatch HTTP ${status}`,
    }, { status: 502 });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

async function handleDispatchWagateStatus() {
  try {
    const { status, data } = await dispatchAdminCall('/admin/wagate/status');
    if (status >= 200 && status < 300) {
      return NextResponse.json({ ok: true, ...data });
    }
    return NextResponse.json({ ok: false, error: (data.error as string) || `Dispatch HTTP ${status}` }, { status: 502 });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

async function handleDispatchWagateRestart() {
  try {
    const { status, data } = await dispatchAdminCall('/admin/wagate/restart');
    if (status >= 200 && status < 300) {
      return NextResponse.json({ ok: true, message: 'WaGate restart triggered' });
    }
    return NextResponse.json({ ok: false, error: (data.error as string) || `Dispatch HTTP ${status}` }, { status: 502 });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

async function handleDispatchReloadConfig() {
  try {
    const { status, data } = await dispatchAdminCall('/admin/reload-config');
    if (status >= 200 && status < 300) {
      return NextResponse.json({ ok: true, ...data });
    }
    return NextResponse.json({ ok: false, error: (data.error as string) || `Dispatch HTTP ${status}` }, { status: 502 });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

// ══════════════════════════════════════════════════════════════════
//  WAGATE ACTIONS
// ══════════════════════════════════════════════════════════════════
//
// WaGate = Self-hosted WhatsApp gateway via Baileys. Parallel dengan WAHA.
// FS doc: service_runtime_configs/wagate
// BQ:  wagate.{delivery_log,message_log,event_log,audit_log}
//
// Semua aksi proxy via Dispatch /admin/wagate/* (Dispatch punya VPC egress + IAM ID token).
// Dashboard BE → Dispatch CF → WaGate internal.
//
// Handlers:
//   status          → proxy GET /api/sessions/default
//   me              → proxy GET /api/sessions/default/me
//   restart         → proxy POST /api/sessions/default/restart
//   logout          → proxy POST /api/sessions/default/logout
//   qr              → proxy GET /api/auth/qr
//   groups          → proxy GET /api/groups
//   test-send       → proxy POST /api/sendText
//   delivery-logs   → GET — BQ query wagate.delivery_log
//   message-logs    → GET — BQ query wagate.message_log (inbound + outbound)
//   event-logs      → GET — BQ query wagate.event_log
//   audit-logs      → GET — BQ query wagate.audit_log

// ─── WaGate DIRECT CALL (tab Cloud Console WaGate — test WaGate standalone) ────
// Dashboard → WaGate direct via ID token (ingress=internal friend: Cloud Run auto-routes
// service-to-service through Google internal backbone; local dev uses gcloud ADC).
// This is SEPARATE from Dispatch tab (which tests Dispatch routing flow via /admin/wagate/*).

const WAGATE_BASE_URL =
  process.env.WAGATE_URL ||
  'https://wagate-21805978769.asia-southeast2.run.app';

// google-auth-library ID token cache (5min)
let _idTokenCache: { token: string; expiresAt: number } | null = null;
async function getWagateIdToken(): Promise<string> {
  const now = Date.now();
  if (_idTokenCache && _idTokenCache.expiresAt > now + 30_000) {
    return _idTokenCache.token;
  }
  const { GoogleAuth } = await import('google-auth-library');
  const auth = new GoogleAuth();
  const client = await auth.getIdTokenClient(WAGATE_BASE_URL);
  const headers = await client.getRequestHeaders();
  // headers typed loosely — handle both Record<string,string> (old SDK) or Headers (new SDK)
  const h = headers as unknown as { Authorization?: string; get?: (k: string) => string | null };
  const authValue = typeof h.Authorization === 'string'
    ? h.Authorization
    : (h.get?.('Authorization') || '');
  const token = authValue.replace('Bearer ', '') || '';
  if (!token) throw new Error('Failed to obtain ID token for WaGate');
  _idTokenCache = { token, expiresAt: now + 55 * 60_000 };
  return token;
}

type WagateCall = { method: 'GET' | 'POST' | 'PUT' | 'DELETE'; path: string; body?: Record<string, unknown> };

async function callWagateDirect(
  call: WagateCall,
): Promise<{ status: number; data: Record<string, unknown> }> {
  const { status, data } = await callWagateDirectRaw(call);
  // Convert array responses to Record<> for backward-compat callers (legacy)
  if (Array.isArray(data)) {
    return { status, data: { items: data, count: data.length } as Record<string, unknown> };
  }
  return { status, data: data as Record<string, unknown> };
}

/** Raw — preserves array vs object shape from WaGate upstream. */
async function callWagateDirectRaw(
  call: WagateCall,
): Promise<{ status: number; data: unknown }> {
  const apiKey = await getSecret('wagate-api-key');
  const headers: Record<string, string> = {
    'X-Api-Key': apiKey,
    'Content-Type': 'application/json',
  };
  // Only attach Bearer ID token if acquisition succeeds (skip silently on local dev ADC limitations)
  try {
    const idToken = await getWagateIdToken();
    if (idToken) headers['Authorization'] = `Bearer ${idToken}`;
  } catch {
    // ADC cannot mint ID token on local (user credential) — rely on X-Api-Key + IAM at network layer
  }
  const res = await fetch(`${WAGATE_BASE_URL}${call.path}`, {
    method: call.method,
    headers,
    body: call.body ? JSON.stringify(call.body) : undefined,
    signal: AbortSignal.timeout(20_000),
    cache: 'no-store',  // prevent Next.js dev fetch cache menyimpan 404/response lama
  });
  let data: unknown = {};
  try {
    const text = await res.text();
    if (text) data = JSON.parse(text);
  } catch { /* non-json or empty */ }
  return { status: res.status, data };
}

/**
 * Call WaGate DIRECT for Dashboard "/cloud-console/wagate" tab (test WaGate standalone).
 *
 * Architecture: Dashboard → WaGate direct (auth: IAM run.invoker via ADC/ID token + X-Api-Key).
 * WaGate ingress=all (temp, dev phase). Will switch to ingress=internal for production,
 * at which point local dev needs VPC tunnel or deployed Dashboard for testing.
 *
 * Dispatch tab uses SEPARATE route via /admin/waha-* to test Dispatch routing flow.
 */
async function proxyWagate(wagateAction: string, body?: Record<string, unknown>) {
  const route = resolveWagateRoute(wagateAction, body);
  if (!route) {
    return NextResponse.json({ ok: false, error: `Unknown wagate action: ${wagateAction}` }, { status: 400 });
  }
  try {
    const { status, data } = await callWagateDirectRaw(route);
    if (status >= 200 && status < 300) {
      // If upstream returned an array (e.g. /api/groups), wrap explicitly to preserve shape
      if (Array.isArray(data)) {
        return NextResponse.json({ ok: true, items: data, count: data.length, _transport: 'direct' });
      }
      return NextResponse.json({ ok: true, ...(data as Record<string, unknown>), _transport: 'direct' });
    }
    return NextResponse.json({
      ok: false,
      error: ((data as Record<string, unknown>)?.error as string) || `WaGate HTTP ${status}`,
      _upstream: data,
      _transport: 'direct',
    }, { status: 502 });
  } catch (err: any) {
    console.error(`[wagate][${wagateAction}] direct-call error: ${err.message}`);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

/**
 * SSE passthrough: Dashboard BE → WaGate `/api/events/stream`.
 * Stream body as-is dengan auth (ID token + X-Api-Key). Client (browser EventSource) langsung
 * receive event lines. Response tidak buffer.
 */
async function handleWagateSseStream(): Promise<Response> {
  const apiKey = await getSecret('wagate-api-key');
  const headers: Record<string, string> = {
    'X-Api-Key': apiKey,
    'Accept': 'text/event-stream',
  };
  try {
    const idToken = await getWagateIdToken();
    if (idToken) headers['Authorization'] = `Bearer ${idToken}`;
  } catch {
    // local dev fallback
  }
  const upstream = await fetch(`${WAGATE_BASE_URL}/api/events/stream`, {
    method: 'GET',
    headers,
  });
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({
      ok: false,
      error: `Upstream SSE connect failed: HTTP ${upstream.status}`,
    }, { status: 502 });
  }
  return new Response(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

/** Map Dashboard action name → WaGate REST endpoint. */
function resolveWagateRoute(action: string, body?: Record<string, unknown>): WagateCall | null {
  const b = body || {};
  const session = (b.session as string) || 'default';
  switch (action) {
    // Session / auth
    case 'status':        return { method: 'GET', path: `/api/sessions/${session}` };
    case 'me':            return { method: 'GET', path: `/api/sessions/${session}/me` };
    case 'restart':       return { method: 'POST', path: `/api/sessions/${session}/restart` };
    case 'logout':        return { method: 'POST', path: `/api/sessions/${session}/logout` };
    case 'qr':            return { method: 'GET', path: `/api/auth/qr` };
    case 'pairing-code':  return { method: 'POST', path: `/api/sessions/${session}/pairing-code`, body: b };
    case 'sessions-list': return { method: 'GET', path: `/api/sessions` };
    case 'session-start': return { method: 'POST', path: `/api/sessions/${session}/start` };
    case 'session-destroy': return { method: 'DELETE', path: `/api/sessions/${session}` };
    case 'set-push-name': return { method: 'POST', path: `/api/sessions/${session}/set-push-name`, body: b };
    case 'contacts-list': return { method: 'GET', path: `/api/contacts` };
    case 'ping': return { method: 'GET', path: `/ping` };
    case 'healthz': return { method: 'GET', path: `/health` }; // renamed dari /healthz (GFE intercept)
    // Admin
    case 'reload-config': return { method: 'POST', path: `/api/admin/reload-config` };
    // Groups (read)
    case 'groups':        return { method: 'GET', path: `/api/groups` };
    case 'group-info':    return { method: 'GET', path: `/api/groups/${b.chatId}` };
    // Send (Tier 1)
    case 'test-send':     return { method: 'POST', path: `/api/sendText`, body: b };
    case 'send-text':     return { method: 'POST', path: `/api/sendText`, body: b };
    case 'send-image':    return { method: 'POST', path: `/api/sendImage`, body: b };
    case 'send-file':     return { method: 'POST', path: `/api/sendFile`, body: b };
    case 'send-location': return { method: 'POST', path: `/api/sendLocation`, body: b };
    // Send (Tier 2 extra)
    case 'send-voice':    return { method: 'POST', path: `/api/sendVoice`, body: b };
    case 'send-video':    return { method: 'POST', path: `/api/sendVideo`, body: b };
    case 'send-vcard':    return { method: 'POST', path: `/api/sendContactVcard`, body: b };
    case 'send-batch':    return { method: 'POST', path: `/api/sendBatch`, body: b };
    // Interactive
    case 'reaction':      return { method: 'POST', path: `/api/reaction`, body: b };
    case 'send-seen':     return { method: 'POST', path: `/api/sendSeen`, body: b };
    case 'start-typing':  return { method: 'POST', path: `/api/startTyping`, body: b };
    case 'stop-typing':   return { method: 'POST', path: `/api/stopTyping`, body: b };
    // Contacts
    case 'check-number':  return { method: 'POST', path: `/api/checkNumberStatus`, body: b };
    case 'profile-picture': return { method: 'GET', path: `/api/contacts/${b.phone}/picture` };
    // Group admin
    case 'group-create':  return { method: 'POST', path: `/api/groups`, body: b };
    case 'group-update':  return { method: 'PUT', path: `/api/groups/${b.chatId}`, body: b };
    case 'group-add-participants':   return { method: 'POST', path: `/api/groups/${b.chatId}/participants`, body: b };
    case 'group-remove-participants': return { method: 'DELETE', path: `/api/groups/${b.chatId}/participants`, body: b };
    case 'group-promote': return { method: 'POST', path: `/api/groups/${b.chatId}/promote`, body: b };
    case 'group-demote':  return { method: 'POST', path: `/api/groups/${b.chatId}/demote`, body: b };
    case 'group-invite-link': return { method: 'POST', path: `/api/groups/${b.chatId}/invite-link`, body: { regenerate: !!b.regenerate } };
    // Tier 3 message mgmt
    case 'forward-message': return { method: 'POST', path: `/api/forwardMessage`, body: b };
    case 'edit-message':  return { method: 'PUT', path: `/api/messages/${b.messageId}`, body: b };
    case 'delete-message': return { method: 'DELETE', path: `/api/messages/${b.messageId}`, body: b };
    case 'star-message':  return { method: 'POST', path: `/api/star`, body: b };
    // Tier 3 advanced send
    case 'send-list':     return { method: 'POST', path: `/api/sendList`, body: b };
    case 'send-buttons':  return { method: 'POST', path: `/api/send/buttons/reply`, body: b };
    case 'send-link-preview': return { method: 'POST', path: `/api/send/link-custom-preview`, body: b };
    case 'send-poll':     return { method: 'POST', path: `/api/sendPoll`, body: b };
    // Tier 3 status
    case 'status-text':   return { method: 'POST', path: `/api/sessions/${session}/status/text`, body: b };
    case 'status-image':  return { method: 'POST', path: `/api/sessions/${session}/status/image`, body: b };
    // Tier 4 advanced chat
    case 'chat-archive':  return { method: 'POST', path: `/api/chats/${b.chatId}/archive`, body: b };
    case 'labels-list':   return { method: 'GET', path: `/api/chats/${b.chatId}/labels` };
    case 'label-add':     return { method: 'POST', path: `/api/chats/${b.chatId}/labels`, body: b };
    case 'label-remove':  return { method: 'DELETE', path: `/api/chats/${b.chatId}/labels/${b.label}` };
    case 'history-export': return { method: 'GET', path: `/api/history/export?${new URLSearchParams(b as Record<string, string>).toString()}` };
    default: return null;
  }
}

async function handleWagateTestSend(body: Record<string, unknown>) {
  const { chatId, text } = body as { chatId?: string; text?: string };
  if (!chatId || !text) {
    return NextResponse.json({ ok: false, error: 'chatId dan text wajib diisi' }, { status: 400 });
  }
  return await proxyWagate('test-send', { chatId, text });
}

async function handleWagateSendImage(body: Record<string, unknown>) {
  const b = body as { chatId?: string; file?: { mimetype?: string; data?: string; url?: string; filename?: string }; caption?: string };
  if (!b.chatId || !b.file || (!b.file.data && !b.file.url)) {
    return NextResponse.json({ ok: false, error: 'chatId dan file.data atau file.url wajib diisi' }, { status: 400 });
  }
  return await proxyWagate('send-image', b as Record<string, unknown>);
}

async function handleWagateSendFile(body: Record<string, unknown>) {
  const b = body as { chatId?: string; file?: { mimetype?: string; data?: string; url?: string; filename?: string }; caption?: string };
  if (!b.chatId || !b.file || (!b.file.data && !b.file.url) || !b.file.filename) {
    return NextResponse.json({ ok: false, error: 'chatId, file.data/url, dan file.filename wajib diisi' }, { status: 400 });
  }
  return await proxyWagate('send-file', b as Record<string, unknown>);
}

async function handleWagateSendLocation(body: Record<string, unknown>) {
  const b = body as { chatId?: string; latitude?: number; longitude?: number; name?: string; address?: string };
  if (!b.chatId || typeof b.latitude !== 'number' || typeof b.longitude !== 'number') {
    return NextResponse.json({ ok: false, error: 'chatId, latitude, longitude wajib diisi (lat/lng harus number)' }, { status: 400 });
  }
  return await proxyWagate('send-location', b as Record<string, unknown>);
}

async function handleWagateGroupInfo(body: Record<string, unknown>) {
  const { chatId } = body as { chatId?: string };
  if (!chatId) return NextResponse.json({ ok: false, error: 'chatId wajib diisi' }, { status: 400 });
  return await proxyWagate('group-info', { chatId });
}

// ── WaGate: BQ Logs ──

/**
 * Media URL — return object URL that streams file bytes via this same Dashboard BE.
 * Dulu pakai signed URL GCS, tapi butuh private key (user ADC tidak punya).
 * Sekarang approach: return proxy URL `/api/console/services/wagate/actions/media-get?path=...`
 * yang stream bytes dengan authenticated download (works di dev + prod).
 */
async function handleWagateMediaUrl(body: Record<string, unknown>): Promise<Response> {
  try {
    const raw = typeof body.path === 'string' ? body.path : '';
    if (!raw) return NextResponse.json({ ok: false, error: 'path required' }, { status: 400 });
    // Verify object exists + authorized (so FE doesn't get broken URL)
    let bucket = 'wagate-media';
    let objectPath = raw;
    if (raw.startsWith('gs://')) {
      const m = raw.replace(/^gs:\/\//, '').match(/^([^/]+)\/(.+)$/);
      if (m) { bucket = m[1]; objectPath = m[2]; }
    }
    const { Storage } = await import('@google-cloud/storage');
    const storage = new Storage();
    const [exists] = await storage.bucket(bucket).file(objectPath).exists();
    if (!exists) return NextResponse.json({ ok: false, error: 'object not found' }, { status: 404 });
    // FE will call /actions/media-get?path=... GET — server streams bytes
    const proxyUrl = `/api/console/services/wagate/actions/media-get?path=${encodeURIComponent(raw)}`;
    return NextResponse.json({ ok: true, url: proxyUrl, bucket, path: objectPath, via: 'proxy' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

/**
 * Media GET proxy — stream file bytes dari GCS melalui Dashboard BE.
 * Dipanggil oleh <img src>, <audio src>, <iframe src>, dll setelah media-url resolve.
 */
async function handleWagateMediaGet(request: NextRequest): Promise<Response> {
  try {
    const url = new URL(request.url);
    const raw = url.searchParams.get('path') || '';
    if (!raw) return new Response('path required', { status: 400 });
    let bucket = 'wagate-media';
    let objectPath = raw;
    if (raw.startsWith('gs://')) {
      const m = raw.replace(/^gs:\/\//, '').match(/^([^/]+)\/(.+)$/);
      if (m) { bucket = m[1]; objectPath = m[2]; }
    }
    const { Storage } = await import('@google-cloud/storage');
    const storage = new Storage();
    const file = storage.bucket(bucket).file(objectPath);
    const [exists] = await file.exists();
    if (!exists) return new Response('not found', { status: 404 });
    const [metadata] = await file.getMetadata();
    const [buffer] = await file.download();
    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': metadata.contentType || 'application/octet-stream',
        'Content-Length': String(buffer.length),
        'Cache-Control': 'private, max-age=300',
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(`error: ${msg}`, { status: 500 });
  }
}

/**
 * Ping report — client-measured latency + cold start flag → persist ke FS
 * supaya next FE mount bisa langsung tahu "terakhir ping X ms Y detik lalu".
 * Body: { latency_ms: number, was_cold_start: boolean, server_uptime_ms?: number }
 * Body di-parse oleh caller di POST handler — kita terima sebagai object.
 */
async function handleWagatePingReport(body: Record<string, unknown>): Promise<Response> {
  try {
    if (typeof body.latency_ms !== 'number') {
      return NextResponse.json({ ok: false, error: 'latency_ms required' }, { status: 400 });
    }
    const latency = body.latency_ms as number;
    const wasCold = !!body.was_cold_start;
    const serverUptime = typeof body.server_uptime_ms === 'number' ? body.server_uptime_ms : null;
    const now = new Date().toISOString();
    await db.collection('service_runtime_configs').doc('wagate').update({
      'provider_snapshot.last_ping_latency_ms': latency,
      'provider_snapshot.last_ping_at': now,
      'provider_snapshot.last_ping_was_cold': wasCold,
      'provider_snapshot.last_ping_server_uptime_ms': serverUptime,
    });
    return NextResponse.json({ ok: true, persisted_at: now });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

/**
 * Architecture pipeline metrics — per pipe status + traffic counter + last 10 events.
 * Aggregates BQ + FS queries dalam satu response supaya FE polling cukup 1 call / 10s.
 */
async function handleWagateArchitectureMetrics(): Promise<Response> {
  try {
    // Parallel queries — 5 minutes window
    const fsPingStart = Date.now();
    const configDocPromise = db.collection('service_runtime_configs').doc('wagate').get();

    const [
      msgCountResult,
      lastMsgResult,
      eventCountResult,
      lastEventResult,
      deliveryStatsResult,
    ] = await Promise.all([
      bq.query({
        query: `
          SELECT direction, COUNT(*) as n
          FROM \`${PROJECT_ID}.wagate.message_log\`
          WHERE timestamp_wib >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 5 MINUTE)
          GROUP BY direction
        `,
      }).then((r) => r[0]).catch(() => []),
      bq.query({
        query: `
          SELECT message_id, direction, from_id, to_id, SUBSTR(body, 0, 80) as body_preview, timestamp_wib
          FROM \`${PROJECT_ID}.wagate.message_log\`
          ORDER BY timestamp_wib DESC LIMIT 10
        `,
      }).then((r) => r[0]).catch(() => []),
      bq.query({
        query: `
          SELECT event_type, COUNT(*) as n
          FROM \`${PROJECT_ID}.wagate.event_log\`
          WHERE timestamp_wib >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 5 MINUTE)
          GROUP BY event_type
        `,
      }).then((r) => r[0]).catch(() => []),
      bq.query({
        query: `
          SELECT event_id, event_type, session, timestamp_wib
          FROM \`${PROJECT_ID}.wagate.event_log\`
          ORDER BY timestamp_wib DESC LIMIT 10
        `,
      }).then((r) => r[0]).catch(() => []),
      bq.query({
        query: `
          SELECT status, COUNT(*) as n
          FROM \`${PROJECT_ID}.wagate.delivery_log\`
          WHERE sent_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 5 MINUTE)
          GROUP BY status
        `,
      }).then((r) => r[0]).catch(() => []),
    ]);

    const configDoc = await configDocPromise;
    const fsLatencyMs = Date.now() - fsPingStart;
    const cfg = configDoc.data() || {};

    // Build pipe metrics
    const inbound5m = Number((msgCountResult as Array<{ direction: string; n: unknown }>).find((r) => r.direction === 'inbound')?.n ?? 0);
    const outbound5m = Number((msgCountResult as Array<{ direction: string; n: unknown }>).find((r) => r.direction === 'outbound')?.n ?? 0);
    const inboundPerMin = Math.round((inbound5m / 5) * 10) / 10;
    const outboundPerMin = Math.round((outbound5m / 5) * 10) / 10;

    const totalDelivery5m = (deliveryStatsResult as Array<{ status: string; n: unknown }>).reduce((s, r) => s + Number(r.n ?? 0), 0);
    const sentDelivery5m = Number((deliveryStatsResult as Array<{ status: string; n: unknown }>).find((r) => r.status === 'sent')?.n ?? 0);
    const bqSuccessRate = totalDelivery5m > 0 ? Math.round((sentDelivery5m / totalDelivery5m) * 100) : 100;

    const providerSnap = (cfg.provider_snapshot ?? {}) as Record<string, unknown>;

    const response = {
      ok: true,
      generated_at: new Date().toISOString(),
      wagate: {
        status: providerSnap.status ?? 'unknown',
        ws_connected: providerSnap.ws_connected ?? false,
        reconnect_count: providerSnap.reconnect_count ?? 0,
      },
      pipes: {
        wa: {
          status: providerSnap.ws_connected === true ? 'healthy' : 'down',
          inbound_per_min: inboundPerMin,
          outbound_per_min: outboundPerMin,
          reconnect_count: providerSnap.reconnect_count ?? 0,
        },
        dashboard: {
          status: 'healthy',  // If this endpoint served, dashboard is alive
          note: 'Dashboard BE serving',
        },
        firestore: {
          status: fsLatencyMs < 500 ? 'healthy' : fsLatencyMs < 2000 ? 'slow' : 'down',
          latency_ms: fsLatencyMs,
        },
        bq: {
          status: bqSuccessRate >= 90 ? 'healthy' : bqSuccessRate >= 50 ? 'degraded' : 'down',
          success_rate_pct: bqSuccessRate,
          total_5m: totalDelivery5m,
          sent_5m: sentDelivery5m,
        },
        gcs: {
          status: 'healthy',  // assume — would need GCS API list for last upload
          note: 'Write-only sink',
        },
        dispatch: {
          status: 'unknown',  // TODO: query last webhook_fire success from event_log
          note: 'See event_log webhook.fire events',
        },
      },
      last_events: {
        messages: (lastMsgResult as Array<Record<string, unknown>>).map((r) => ({
          message_id: r.message_id,
          direction: r.direction,
          from: r.from_id,
          to: r.to_id,
          preview: r.body_preview || '',
          timestamp: (r.timestamp_wib as { value?: string } | undefined)?.value || r.timestamp_wib,
        })),
        system: (lastEventResult as Array<Record<string, unknown>>).map((r) => ({
          event_id: r.event_id,
          event_type: r.event_type,
          session: r.session,
          timestamp: (r.timestamp_wib as { value?: string } | undefined)?.value || r.timestamp_wib,
        })),
      },
      event_counts_5m: Object.fromEntries(
        (eventCountResult as Array<{ event_type: string; n: unknown }>).map((r) => [r.event_type, Number(r.n)])
      ),
    };

    return NextResponse.json(response);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

async function handleWagateDeliveryLogs(request: NextRequest) {
  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200);
  const offset = parseInt(url.searchParams.get('offset') || '0');
  const status = url.searchParams.get('status') || '';
  const operation = url.searchParams.get('operation') || '';

  const where: string[] = [];
  const params: Record<string, string> = {};
  if (status && ['sent', 'failed', 'queued'].includes(status)) {
    where.push('status = @status'); params.status = status;
  }
  if (operation) { where.push('operation = @operation'); params.operation = operation; }
  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  try {
    const [rows] = await bq.query({
      query: `
        SELECT event_id, operation, chat_id, chat_type, caller, text, status,
               provider_message_id, error, duration_ms, queued_at, sent_at,
               ack_status, ack_updated_at, media_gcs_path
        FROM \`${PROJECT_ID}.wagate.delivery_log\`
        ${whereClause}
        ORDER BY sent_at DESC LIMIT @limit OFFSET @offset
      `,
      params: { ...params, limit, offset },
    });

    const [countResult] = await bq.query({
      query: `SELECT COUNT(*) as total FROM \`${PROJECT_ID}.wagate.delivery_log\` ${whereClause}`,
      params,
    });
    const total = countResult[0]?.total || 0;

    return NextResponse.json({ rows, total, limit, offset });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('Not found')) return NextResponse.json({ rows: [], total: 0, limit, offset });
    console.error('[wagate][delivery-logs] BQ error:', msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

async function handleWagateMessageLogs(request: NextRequest) {
  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200);
  const offset = parseInt(url.searchParams.get('offset') || '0');
  const direction = url.searchParams.get('direction') || '';
  const chatType = url.searchParams.get('chat_type') || '';

  const where: string[] = [];
  const params: Record<string, string> = {};
  if (direction && ['inbound', 'outbound'].includes(direction)) {
    where.push('direction = @direction'); params.direction = direction;
  }
  if (chatType && ['personal', 'group'].includes(chatType)) {
    where.push('chat_type = @chat_type'); params.chat_type = chatType;
  }
  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  try {
    const [rows] = await bq.query({
      query: `
        SELECT event_id, message_id, timestamp_wib, direction, from_id, from_name,
               to_id, chat_type, body, has_media, media_type, media_gcs_path,
               quoted_message_id, inserted_at
        FROM \`${PROJECT_ID}.wagate.message_log\`
        ${whereClause}
        ORDER BY timestamp_wib DESC LIMIT @limit OFFSET @offset
      `,
      params: { ...params, limit, offset },
    });

    const [countResult] = await bq.query({
      query: `SELECT COUNT(*) as total FROM \`${PROJECT_ID}.wagate.message_log\` ${whereClause}`,
      params,
    });
    const total = countResult[0]?.total || 0;

    return NextResponse.json({ rows, total, limit, offset });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('Not found')) return NextResponse.json({ rows: [], total: 0, limit, offset });
    console.error('[wagate][message-logs] BQ error:', msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

async function handleWagateEventLogs(request: NextRequest) {
  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200);
  const offset = parseInt(url.searchParams.get('offset') || '0');
  const eventType = url.searchParams.get('event_type') || '';

  const where: string[] = [];
  const params: Record<string, string> = {};
  if (eventType) { where.push('event_type = @event_type'); params.event_type = eventType; }
  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  try {
    const [rows] = await bq.query({
      query: `
        SELECT event_id, event_type, timestamp_wib, session, payload, inserted_at
        FROM \`${PROJECT_ID}.wagate.event_log\`
        ${whereClause}
        ORDER BY timestamp_wib DESC LIMIT @limit OFFSET @offset
      `,
      params: { ...params, limit, offset },
    });

    const [countResult] = await bq.query({
      query: `SELECT COUNT(*) as total FROM \`${PROJECT_ID}.wagate.event_log\` ${whereClause}`,
      params,
    });
    const total = countResult[0]?.total || 0;

    return NextResponse.json({ rows, total, limit, offset });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('Not found')) return NextResponse.json({ rows: [], total: 0, limit, offset });
    console.error('[wagate][event-logs] BQ error:', msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

async function handleWagateAuditLogs(request: NextRequest) {
  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200);
  const offset = parseInt(url.searchParams.get('offset') || '0');

  try {
    const [rows] = await bq.query({
      query: `
        SELECT event_id, timestamp_wib, caller_type, caller_identity, action,
               resource, result, ip_address, duration_ms
        FROM \`${PROJECT_ID}.wagate.audit_log\`
        ORDER BY timestamp_wib DESC LIMIT @limit OFFSET @offset
      `,
      params: { limit, offset },
    });

    const [countResult] = await bq.query({
      query: `SELECT COUNT(*) as total FROM \`${PROJECT_ID}.wagate.audit_log\``,
    });
    const total = countResult[0]?.total || 0;

    return NextResponse.json({ rows, total, limit, offset });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('Not found')) return NextResponse.json({ rows: [], total: 0, limit, offset });
    console.error('[wagate][audit-logs] BQ error:', msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

// ── Route Handler ──

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; action: string }> }
) {
  try {
    const { id, action } = await params;

    if (id === 'notifier' && action === 'delivery-logs') {
      return await handleNotifierDeliveryLogs(request);
    }

    if (id === 'dispatch') {
      if (action === 'delivery-logs') return await handleNotifierDeliveryLogs(request);
      if (action === 'inbound-logs') return await handleDispatchInboundLogs(request);
      if (action === 'event-logs') return await handleDispatchEventLogs(request);
    }

    if (id === 'wagate') {
      if (action === 'delivery-logs') return await handleWagateDeliveryLogs(request);
      if (action === 'message-logs') return await handleWagateMessageLogs(request);
      if (action === 'event-logs') return await handleWagateEventLogs(request);
      if (action === 'audit-logs') return await handleWagateAuditLogs(request);
      if (action === 'events-stream') return await handleWagateSseStream();
      if (action === 'architecture-metrics') return await handleWagateArchitectureMetrics();
      if (action === 'media-get') return await handleWagateMediaGet(request);
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
    // Guard empty body — FE kadang kirim Content-Type: json dengan body kosong untuk
    // action ringan (ping, status, me). request.json() throw "Unexpected end of JSON input"
    // untuk empty body, rewrap jadi 502. Solusinya: try/catch + default {}.
    let body: Record<string, unknown> = {};
    if (request.headers.get('content-type')?.includes('json')) {
      try {
        const text = await request.text();
        if (text && text.trim()) {
          body = JSON.parse(text) as Record<string, unknown>;
        }
      } catch {
        body = {};
      }
    }

    if (id === 'notifier') {
      if (action === 'test-send') return await handleNotifierTestSend(body);
      if (action === 'verify-group') return await handleNotifierVerifyGroup(body);
      if (action === 'add-group') return await handleNotifierAddGroup(body);
      if (action === 'edit-group') return await handleNotifierEditGroup(body);
      if (action === 'delete-group') return await handleNotifierDeleteGroup(body);
      if (action === 'resolve-invite') return await handleNotifierResolveInvite(body);
    }

    if (id === 'dispatch') {
      if (action === 'test-send') return await handleDispatchTestSend(body);
      if (action === 'add-group') return await handleDispatchAddGroup(body);
      if (action === 'edit-group') return await handleDispatchEditGroup(body);
      if (action === 'delete-group') return await handleDispatchDeleteGroup(body);
      if (action === 'verify-group') return await handleDispatchVerifyGroup(body);
      if (action === 'waha-status') return await handleDispatchWahaStatus();
      if (action === 'waha-restart') return await handleDispatchWahaRestart();
      if (action === 'wagate-status') return await handleDispatchWagateStatus();
      if (action === 'wagate-restart') return await handleDispatchWagateRestart();
      if (action === 'reload-config') return await handleDispatchReloadConfig();
    }

    if (id === 'wagate') {
      if (action === 'status') return await proxyWagate('status');
      if (action === 'me') return await proxyWagate('me');
      if (action === 'restart') return await proxyWagate('restart');
      if (action === 'logout') return await proxyWagate('logout');
      if (action === 'qr') return await proxyWagate('qr');
      if (action === 'pairing-code') return await proxyWagate('pairing-code', body as Record<string, unknown>);
      if (action === 'groups') return await proxyWagate('groups');
      if (action === 'test-send') return await handleWagateTestSend(body);
      if (action === 'send-image') return await handleWagateSendImage(body);
      if (action === 'send-file') return await handleWagateSendFile(body);
      if (action === 'send-location') return await handleWagateSendLocation(body);
      if (action === 'group-info') return await handleWagateGroupInfo(body);
      // Ping-report — FE → Dashboard BE → FS (persist latency metrics)
      if (action === 'ping-report') return await handleWagatePingReport(body);
      if (action === 'media-url') return await handleWagateMediaUrl(body);
      // Generic fallback — any other wagate action routed via resolveWagateRoute
      if (resolveWagateRoute(action, body)) return await proxyWagate(action, body);
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
