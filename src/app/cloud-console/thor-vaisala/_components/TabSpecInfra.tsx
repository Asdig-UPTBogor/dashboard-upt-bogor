"use client";

/**
 * Tab 4: Spec & Infra — Service Reporter (SR) data.
 * Domain: "What is deployed" — static infrastructure metadata.
 *   - Cloud Function (infra_*)
 *   - Cloud Scheduler (scheduler_*)
 *   - BigQuery Tables (bq_*)
 *   - Auto-BBOX (from validation)
 * Visual Standard: Spreadsheet Sync v2.0 (Detail tab pattern)
 */

import { useState, useMemo, useCallback } from "react";
import { Server, Clock } from "lucide-react";
import type { ThorConfig } from "../_lib/types";
import { fmtWIB, fmtAgo } from "../_lib/api";
import { ServiceSection, ServiceGrid } from "../../_components/service-ui";

interface Props {
    config: Partial<ThorConfig>;
}

export default function TabSpecInfra({ config }: Props) {
    const c = config as Record<string, any>;
    const [copiedField, setCopiedField] = useState<string | null>(null);

    const copyToClipboard = useCallback((text: string, field: string) => {
        navigator.clipboard.writeText(text);
        setCopiedField(field);
        setTimeout(() => setCopiedField(null), 2000);
    }, []);

    /* Parse infra_* from SR cold-start report */
    const infra = useMemo(() => {
        if (!c.infra_service_name && !c.infra_region) return null;
        return {
            name: c.infra_service_name, function: c.infra_function_name,
            revision: c.infra_revision, region: c.infra_region,
            memory: c.infra_memory, cpu: c.infra_cpu,
            timeout: c.infra_timeout, runtime: c.infra_runtime,
            generation: c.infra_generation, entryPoint: c.infra_entry_point,
            minInstances: c.infra_min_instances, maxInstances: c.infra_max_instances,
            ingress: c.infra_ingress, functionState: c.infra_function_state,
            url: c.infra_url, serviceAccount: c.infra_service_account,
            source: c.infra_source,
            createdAt: c.infra_created_at, lastDeploy: c.infra_last_deploy,
            coldStartAt: c.infra_cold_start_at,
        };
    }, [c]);

    /* Parse scheduler_* from SR cold-start report */
    const sched = useMemo(() => {
        if (!c.scheduler_state && !c.scheduler_job_id) return null;
        return {
            jobId: c.scheduler_job_id, state: c.scheduler_state,
            schedule: c.scheduler_schedule, timezone: c.scheduler_timezone,
            nextRun: c.scheduler_next_run, lastAttempt: c.scheduler_last_attempt,
            lastStatusCode: c.scheduler_last_status_code,
            deadline: c.scheduler_attempt_deadline, description: c.scheduler_description,
            httpMethod: c.scheduler_http_method, retryCount: c.scheduler_retry_count,
            targetUrl: c.scheduler_target_url, serviceAccount: c.scheduler_service_account,
            updatedAt: c.scheduler_updated_at,
        };
    }, [c]);

    return (
        <div className="space-y-6">
            {/* Cloud Function — infra_* from SR */}
            {infra && (
                <ServiceSection title="Cloud Function" icon={<Server className="h-3.5 w-3.5" />} noCollapse>
                    <ServiceGrid items={[
                        { label: "Service Name", value: infra.name },
                        { label: "Function Name", value: infra.function },
                        { label: "Active Revision", value: infra.revision },
                        { label: "Region", value: infra.region },
                        { label: "Memory", value: infra.memory },
                        { label: "CPU", value: infra.cpu || "—" },
                        { label: "Timeout", value: infra.timeout ? `${infra.timeout}s` : "—" },
                        { label: "Runtime", value: infra.runtime },
                        { label: "Generation", value: infra.generation },
                        { label: "Entry Point", value: infra.entryPoint },
                        { label: "Min Instances", value: infra.minInstances },
                        { label: "Max Instances", value: infra.maxInstances },
                        { label: "Ingress", value: infra.ingress },
                        { label: "Function State", value: infra.functionState, highlight: infra.functionState === 'ACTIVE' ? 'emerald' : 'amber' },
                        { label: "Last Cold Start", value: infra.coldStartAt ? `${fmtWIB(infra.coldStartAt)} (${fmtAgo(infra.coldStartAt)})` : "—" },
                        { label: "Last Deploy", value: infra.lastDeploy ? `${fmtWIB(infra.lastDeploy)} (${fmtAgo(infra.lastDeploy)})` : "—" },
                        { label: "Created", value: infra.createdAt ? fmtWIB(infra.createdAt) : "—" },
                    ]} copyFields={{
                        "Service URL": infra.url,
                        "Service Account": infra.serviceAccount,
                        "Source": infra.source,
                    }} copiedField={copiedField} onCopy={copyToClipboard} />
                </ServiceSection>
            )}

            {/* Cloud Scheduler — scheduler_* from SR */}
            {sched && (
                <ServiceSection title="Cloud Scheduler" icon={<Clock className="h-3.5 w-3.5" />} noCollapse>
                    <ServiceGrid items={[
                        { label: "Job ID", value: sched.jobId },
                        { label: "State", value: sched.state, highlight: sched.state === 'ENABLED' ? 'emerald' : sched.state === 'PAUSED' ? 'amber' : undefined },
                        { label: "Cron Schedule", value: sched.schedule },
                        { label: "Timezone", value: sched.timezone },
                        { label: "HTTP Method", value: sched.httpMethod },
                        { label: "Next Scheduled Run", value: sched.nextRun ? `${fmtWIB(sched.nextRun)} (${fmtAgo(sched.nextRun)})` : "—" },
                        { label: "Last Attempt", value: sched.lastAttempt ? fmtWIB(sched.lastAttempt) : "—" },
                        { label: "Last Status", value: sched.lastStatusCode === 0 ? 'OK (0)' : sched.lastStatusCode != null ? `Error (code ${sched.lastStatusCode})` : "—",
                          highlight: sched.lastStatusCode === 0 ? 'emerald' : sched.lastStatusCode != null ? 'amber' : undefined },
                        { label: "Attempt Deadline", value: sched.deadline },
                        { label: "Retry Count", value: sched.retryCount },
                        { label: "Description", value: sched.description },
                        { label: "Updated", value: sched.updatedAt ? fmtWIB(sched.updatedAt) : "—" },
                    ]} copyFields={{
                        "Target URL": sched.targetUrl,
                        "Service Account": sched.serviceAccount,
                    }} copiedField={copiedField} onCopy={copyToClipboard} />
                </ServiceSection>
            )}


        </div>
    );
}
