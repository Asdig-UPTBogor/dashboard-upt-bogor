/**
 * GET/POST /api/console/services/[id]/config
 * 
 * Read and update service configuration.
 * POST writes to Cloud Logging so changes appear in LogPanel.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServiceDef, readConfig, readConfigWithSpreadsheets, updateConfig } from '@/app/api/console/_lib/firestore';
import { writeLog } from '../../../_lib/logging';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // Use dataCollection from registry to decide (§8.7) — no hardcoded service ID
    const def = await getServiceDef(id);
    const result = def?.dataCollection
      ? await readConfigWithSpreadsheets(id)
      : await readConfig(id);
    return NextResponse.json(result);
  } catch (error) {
    const err = error as Error;
    const status = err.message.includes('not found') ? 404 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const fields = Object.keys(body);

    // 1. Write to Firestore
    await updateConfig(id, body);

    // 2. Re-read to verify consistency
    const verified = await readConfig(id);
    const verifiedConfig = verified.config || {};
    const mismatches: string[] = [];
    for (const key of fields) {
      if (key.startsWith('_')) continue; // skip internal fields
      const sent = JSON.stringify(body[key]);
      const saved = JSON.stringify(verifiedConfig[key]);
      if (sent !== saved) mismatches.push(`${key}: sent=${sent} saved=${saved}`);
    }

    // 3. Log to Cloud Logging (appears in LogPanel)
    if (mismatches.length > 0) {
      await writeLog(id, `Config update MISMATCH: ${fields.join(', ')}`, { fields: body, mismatches }, 'WARNING');
      console.warn(`[console] config MISMATCH for ${id}:`, mismatches);
    } else {
      await writeLog(id, `Config updated: ${fields.join(', ')}`, { fields: body }, 'INFO');
      console.log(`[console] config updated for ${id}: ${fields.join(', ')}`);
    }

    return NextResponse.json({
      ok: true,
      updated: fields,
      verified: mismatches.length === 0,
      mismatches: mismatches.length > 0 ? mismatches : undefined,
    });
  } catch (error) {
    const err = error as Error;
    const status = err.message.includes('not found') ? 404 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}

export { POST as PUT };
