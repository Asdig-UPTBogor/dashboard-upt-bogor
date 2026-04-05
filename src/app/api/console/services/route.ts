/**
 * GET /api/console/services
 * 
 * List all registered services from Firestore cloud_console registry.
 */

import { NextResponse } from 'next/server';
import { getRegistry } from '../_lib/firestore';

export async function GET() {
  try {
    const registry = await getRegistry();
    return NextResponse.json(registry);
  } catch (error) {
    const err = error as Error;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
