/**
 * /data-workspace — dedicated god-mode Data Input workspace.
 *
 *  ▸ Full-bleed fixed overlay (covers main sidebar + header of parent dashboard layout).
 *  ▸ Own chrome: compact top bar dengan brand + breadcrumb + user + logout.
 *  ▸ Password gate di middleware.ts, route-level enforcement.
 *
 *  Strategy: overlay `fixed inset-0 z-50` covers root layout's sidebar + header
 *  without requiring route-group refactor. Own scroll context.
 */

import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Data Workspace — PLN UPT Bogor",
    description: "Dedicated BigQuery-backed data entry workspace",
};

export default function DataWorkspaceLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="fixed inset-0 z-50 bg-background text-foreground flex flex-col overflow-hidden">
            {children}
        </div>
    );
}
