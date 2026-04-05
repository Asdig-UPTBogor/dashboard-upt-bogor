/**
 * Console API — Cloud Run Service
 *
 * Read infrastructure info for Cloud Run / Cloud Functions Gen2 services.
 * Gen2 CF is built on Cloud Run, so we use ServicesClient.
 */

import { ServicesClient } from '@google-cloud/run';
import { PROJECT_ID, getServiceDef } from './firestore';

const client = new ServicesClient();
const DEFAULT_REGION = process.env.CLOUD_RUN_REGION || 'asia-southeast2';

/**
 * Map service ID → Cloud Run service name and region.
 * Uses logServiceName from registry as the Cloud Run service name.
 */
async function getServicePath(serviceId: string): Promise<string> {
    const def = await getServiceDef(serviceId);
    if (!def) throw new Error(`Service '${serviceId}' not found in registry`);

    const serviceName = def.logServiceName;
    const region = DEFAULT_REGION;

    return `projects/${PROJECT_ID}/locations/${region}/services/${serviceName}`;
}

export interface CloudRunInfo {
    name: string;
    region: string;
    url: string | null;
    image: string | null;
    memory: string | null;
    cpu: string | null;
    timeout: string | null;
    concurrency: number | null;
    minInstances: number | null;
    maxInstances: number | null;
    revision: string | null;
    lastDeployed: string | null;
}

/**
 * Get Cloud Run service info via SDK.
 */
export async function getServiceInfo(serviceId: string): Promise<CloudRunInfo> {
    const name = await getServicePath(serviceId);

    const [service] = await client.getService({ name });

    const container = service.template?.containers?.[0];
    const scaling = service.template?.scaling;
    const limits = container?.resources?.limits;

    return {
        name: service.name?.split('/').pop() || '',
        region: DEFAULT_REGION,
        url: service.uri || null,
        image: container?.image || null,
        memory: limits?.memory || null,
        cpu: limits?.cpu || null,
        timeout: service.template?.timeout
            ? `${service.template.timeout.seconds}s`
            : null,
        concurrency: service.template?.maxInstanceRequestConcurrency || null,
        minInstances: scaling?.minInstanceCount || null,
        maxInstances: scaling?.maxInstanceCount || null,
        revision: service.template?.revision || null,
        lastDeployed: service.updateTime
            ? new Date(
                Number(service.updateTime.seconds) * 1000
            ).toISOString()
            : null,
    };
}
