"use client";

/**
 * (authed) layout — persistent WorkspaceShell untuk semua authenticated
 * data-workspace pages. TIDAK apply ke `/login` karena login di luar route
 * group ini.
 *
 * Kunci: shell di layout → DatasetTree state persist antar navigasi.
 * Hanya `children` (main area) yang re-render saat pindah /[ds] ↔ /[ds]/[t].
 */

import { useMemo } from "react";
import { useParams, usePathname } from "next/navigation";
import { WorkspaceShell } from "../_components/WorkspaceShell";

export default function AuthedLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname() ?? "";
    const params = useParams<{ dataset?: string; table?: string }>();

    const breadcrumb = useMemo(() => {
        const crumbs: Array<{ label: string; href?: string }> = [];
        const ds = params?.dataset ? decodeURIComponent(params.dataset) : null;
        const t = params?.table ? decodeURIComponent(params.table) : null;
        if (ds) crumbs.push({ label: ds, href: `/data-workspace/${encodeURIComponent(ds)}` });
        if (t) crumbs.push({ label: t });
        return crumbs;
    }, [params?.dataset, params?.table, pathname]);

    return <WorkspaceShell breadcrumb={breadcrumb}>{children}</WorkspaceShell>;
}
