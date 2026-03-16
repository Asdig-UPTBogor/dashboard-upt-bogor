"use client";

/**
 * Serverless Hub Layout — ServiceExplorer sidebar + content + log panels.
 *
 * Same 3-panel architecture as old worker-sync layout:
 *   Left: ServiceExplorer (reads from worker-registry)
 *   Center: Children (service page)
 *   Right: LogPanel(s) — one per checked service, 300px each
 */

import { useState, useCallback } from "react";
import { ServiceExplorer } from "./_components/ServiceExplorer";
import { LogPanel } from "./_components/LogPanel";
import { getActiveWorkers } from "@/lib/worker-registry";

export default function ServerlessHubLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const [checkedServices, setCheckedServices] = useState<Set<string>>(new Set());
    const workers = getActiveWorkers();

    const handleToggleLog = useCallback((serviceId: string) => {
        setCheckedServices((prev) => {
            const next = new Set(prev);
            if (next.has(serviceId)) {
                next.delete(serviceId);
            } else {
                next.add(serviceId);
            }
            return next;
        });
    }, []);

    const handleCloseLog = useCallback((serviceId: string) => {
        setCheckedServices((prev) => {
            const next = new Set(prev);
            next.delete(serviceId);
            return next;
        });
    }, []);

    const checkedWorkerDefs = workers.filter((w) => checkedServices.has(w.id));

    return (
        <div className="flex h-[calc(100vh-3.5rem)] -m-4 md:-m-6 gap-1.5 p-1.5 overflow-hidden">
            {/* Explorer — uses same Card styling: rounded-xl border bg-card shadow-sm */}
            <div className="shrink-0 rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                <ServiceExplorer
                    checkedServices={checkedServices}
                    onToggleLog={handleToggleLog}
                />
            </div>

            {/* Main content */}
            <div className="flex-1 min-w-0 overflow-y-auto rounded-xl border border-border bg-card shadow-sm">
                {children}
            </div>

            {/* Log panels */}
            {checkedWorkerDefs.map((worker) => (
                <div
                    key={worker.id}
                    className="shrink-0 rounded-xl border border-border bg-card shadow-sm overflow-hidden"
                    style={{ width: 300 }}
                >
                    <LogPanel
                        workerId={worker.id}
                        workerName={worker.name}
                        onClose={() => handleCloseLog(worker.id)}
                    />
                </div>
            ))}
        </div>
    );
}
