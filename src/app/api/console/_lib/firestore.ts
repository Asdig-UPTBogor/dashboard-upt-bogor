/**
 * Console API — Firestore Service (Unified)
 *
 * Single file for ALL Firestore operations:
 *   - Registry: read cloud_console doc (service discovery)
 *   - Config: read/write service configs with sensitive field masking
 *
 * MERGED from: registry.ts + firestore.ts (old)
 */

import { Firestore } from '@google-cloud/firestore';

// ── Firestore Client ──

export const PROJECT_ID = process.env.GCP_PROJECT || 'gcp-bridge-meshvpn';
export const db = new Firestore({ projectId: PROJECT_ID });

// ══════════════════════════════════════════════════
//  Registry (ex registry.ts)
// ══════════════════════════════════════════════════

export interface ServiceDefinition {
  name: string;
  description?: string;
  logServiceName: string;
  serviceType: 'cloud_function' | 'cloud_run';
  configCollection: string;
  configDocument: string;
  dataCollection?: string | null;
  schedulerJobId?: string;
  sensitiveFields?: string[];
  icon: string;
  color: string;
  subtitle?: string;
  status: 'active' | 'planned' | 'disabled';
}

export interface HubRegistry {
  services: Record<string, ServiceDefinition>;
}

export async function getRegistry(): Promise<HubRegistry> {
  const doc = await db.collection('service_runtime_configs').doc('cloud_console').get();
  if (!doc.exists) {
    console.warn('[registry] cloud_console document not found — using empty registry');
    return { services: {} };
  }
  return doc.data() as HubRegistry;
}

/** Invalidate cache — no longer needed since getRegistry is real-time */
export function invalidateRegistryCache(): void {
  // no-op
}

export async function getServiceDef(serviceId: string): Promise<ServiceDefinition | null> {
  const registry = await getRegistry();
  return registry.services[serviceId] || null;
}

export async function getServiceIds(): Promise<string[]> {
  const registry = await getRegistry();
  return Object.keys(registry.services);
}

export async function getActiveServices(): Promise<Record<string, ServiceDefinition>> {
  const registry = await getRegistry();
  const active: Record<string, ServiceDefinition> = {};
  for (const [id, def] of Object.entries(registry.services)) {
    if (def.status === 'active') active[id] = def;
  }
  return active;
}

// ══════════════════════════════════════════════════
//  Config CRUD
// ══════════════════════════════════════════════════

function maskSensitiveFields(
  data: Record<string, unknown>,
  sensitiveFields: string[],
): Record<string, unknown> {
  const masked = { ...data };
  for (const field of sensitiveFields) {
    if (masked[field] && typeof masked[field] === 'string') {
      const val = masked[field] as string;
      masked[field] = val.length > 8
        ? val.slice(0, 4) + '•'.repeat(Math.min(val.length - 4, 20))
        : '•'.repeat(val.length);
    }
  }
  return masked;
}

export async function readConfig(serviceId: string): Promise<{
  config: Record<string, unknown>;
  collection: string;
  document: string;
}> {
  const def = await getServiceDef(serviceId);
  if (!def) throw new Error(`Service '${serviceId}' not found in registry`);
  if (!def.configCollection || !def.configDocument) {
    return { config: {}, collection: '', document: '' };
  }

  const doc = await db.collection(def.configCollection).doc(def.configDocument).get();
  if (!doc.exists) {
    return { config: {}, collection: def.configCollection, document: def.configDocument };
  }

  const rawConfig = doc.data() || {};
  const maskedConfig = def.sensitiveFields?.length
    ? maskSensitiveFields(rawConfig, def.sensitiveFields)
    : rawConfig;

  return { config: maskedConfig, collection: def.configCollection, document: def.configDocument };
}

export async function updateConfig(
  serviceId: string,
  updates: Record<string, unknown>,
): Promise<void> {
  const def = await getServiceDef(serviceId);
  if (!def) throw new Error(`Service '${serviceId}' not found in registry`);

  const collection = (updates._collection as string) || def.configCollection;
  const document = (updates._document as string) || def.configDocument;

  const clean = { ...updates };
  delete clean._collection;
  delete clean._document;

  // Don't allow writing masked sensitive fields back to Firestore
  if (def.sensitiveFields) {
    for (const field of def.sensitiveFields) {
      if (field in clean) {
        const value = clean[field] as string;
        if (typeof value === 'string' && /^.{0,4}•{4,}/.test(value)) {
          delete clean[field];
        }
      }
    }
  }

  await db.collection(collection).doc(document).set(clean, { merge: true });
}

export async function readConfigWithSpreadsheets(serviceId: string): Promise<{
  config: Record<string, unknown>;
  collection: string;
  document: string;
  spreadsheets: Array<Record<string, unknown>>;
}> {
  const base = await readConfig(serviceId);
  const def = await getServiceDef(serviceId);
  if (!def) return { ...base, spreadsheets: [] };

  const dataCollectionName = def.dataCollection;
  if (!dataCollectionName) return { ...base, spreadsheets: [] };

  const snapshot = await db.collection(dataCollectionName).get();
  const spreadsheets: Array<Record<string, unknown>> = [];

  for (const doc of snapshot.docs) {
    if (doc.id.startsWith('_')) continue;
    spreadsheets.push({ id: doc.id, ...doc.data() });
  }

  return { ...base, spreadsheets };
}
