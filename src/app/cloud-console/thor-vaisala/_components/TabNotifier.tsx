"use client";

/**
 * Tab 5: Notifier — Read-only Pub/Sub notification status.
 * All controls (test-send) are in Config tab.
 * Visual Standard: Spreadsheet Sync v2.0
 */

import { MessageSquare, Activity, Radio } from "lucide-react";
import type { ThorConfig } from "../_lib/types";
import { fmtWIB } from "../_lib/api";
import { ServiceSection, ServiceGrid } from "../../_components/service-ui";

interface Props {
    config: Partial<ThorConfig>;
}

export default function TabNotifier({ config }: Props) {
    const c = config as Record<string, any>;
    const mode = String(c.NOTIFIER_MODE || "production");
    const group = mode === 'maintenance' ? 'maintenance' : 'thor_alert';

    return (
        <div className="space-y-6">
            {/* Pub/Sub Status */}
            <ServiceSection title="Pub/Sub Alert" icon={<Radio className="h-3.5 w-3.5" />}
                badge={c.NOTIFIER_STATUS || "—"}
                badgeColor={c.NOTIFIER_STATUS === 'connected' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}
                noCollapse>
                <ServiceGrid items={[
                    { label: "Topic", value: "notifier-send" },
                    { label: "Mode", value: mode, highlight: mode === 'maintenance' ? 'amber' : undefined },
                    { label: "Group", value: group },
                    { label: "Status", value: c.NOTIFIER_STATUS || "—", highlight: c.NOTIFIER_STATUS === 'connected' ? 'emerald' : 'amber' },
                    { label: "Error", value: c.NOTIFIER_ERROR || "—" },
                ]} copiedField={null} onCopy={() => {}} />
            </ServiceSection>

            {/* Anti-Spam State */}
            <ServiceSection title="Anti-Spam State" icon={<Activity className="h-3.5 w-3.5" />}>
                <ServiceGrid items={[
                    { label: "Error Count", value: c._error_count ?? 0, highlight: (c._error_count ?? 0) > 0 ? 'amber' : undefined },
                    { label: "Alert Sent", value: c._error_alert_sent ? "Yes" : "No" },
                    { label: "Last Alert", value: fmtWIB(c._last_error_alert_ts) },
                    { label: "Recovery Candidate", value: fmtWIB(c._recovery_candidate_ts) },
                ]} copiedField={null} onCopy={() => {}} />
            </ServiceSection>
        </div>
    );
}
