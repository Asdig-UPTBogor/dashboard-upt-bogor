"use client";

/**
 * Worker Sync Layout — Explorer sidebar + content + right log panels.
 *
 * Architecture:
 * - Left: WorkerExplorer (sidebar with checkboxes)
 * - Center: Children (config page for selected worker)
 * - Right: LogPanel(s) side-by-side, each 300px fixed
 *
 * Each log panel has a fixed 300px width so they don't squeeze
 * the content area, even with multiple panels open.
 */

import { useState, useCallback } from "react";
import { WorkerExplorer, WORKERS } from "./_components/WorkerExplorer";
import { LogPanel } from "./_components/LogPanel";

export default function WorkerSyncLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const [checkedWorkers, setCheckedWorkers] = useState<Set<string>>(new Set());

    const handleToggleLog = useCallback((workerId: string) => {
        setCheckedWorkers((prev) => {
            const next = new Set(prev);
            if (next.has(workerId)) {
                next.delete(workerId);
            } else {
                next.add(workerId);
            }
            return next;
        });
    }, []);

    const handleCloseLog = useCallback((workerId: string) => {
        setCheckedWorkers((prev) => {
            const next = new Set(prev);
            next.delete(workerId);
            return next;
        });
    }, []);

    const checkedWorkerDefs = WORKERS.filter((w) => checkedWorkers.has(w.id));

    return (
        <div className="flex h-[calc(100vh-64px)] overflow-hidden">
            {/* Explorer sidebar */}
            <WorkerExplorer
                checkedWorkers={checkedWorkers}
                onToggleLog={handleToggleLog}
            />

            {/* Main content area — takes remaining space */}
            <div className="flex-1 min-w-0 overflow-y-auto">
                {children}
            </div>

            {/* Log panels — side-by-side, each fixed 300px */}
            {checkedWorkerDefs.map((worker, i) => (
                <div
                    key={worker.id}
                    className={`shrink-0 ${i === 0 ? "border-l border-border" : "border-l border-border"}`}
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
