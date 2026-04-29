"use client";

/**
 * /data-input/new/table — thin wrapper pakai NewTableWizard shared.
 */

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Table2, ArrowLeft, ChevronRight } from "lucide-react";
import { NewTableWizard } from "../_shared/NewTableWizard";

export default function NewTablePage() {
    return (
        <Suspense fallback={<div className="p-8 text-sm text-muted-foreground">Memuat...</div>}>
            <NewTableInner />
        </Suspense>
    );
}

function NewTableInner() {
    const router = useRouter();
    const qp = useSearchParams();
    const preselectDs = qp?.get("ds") ?? qp?.get("dataset") ?? undefined;

    return (
        <div className="mx-auto max-w-3xl p-6 md:p-8 space-y-6">
            <nav className="flex items-center gap-1 ds-small opacity-70">
                <Link href="/data-input" className="ds-transition hover:text-foreground inline-flex items-center gap-1">
                    <ArrowLeft className="h-3 w-3" /> Data Input
                </Link>
                <ChevronRight className="h-3 w-3 opacity-40" />
                <span>Tambah Table</span>
            </nav>

            <header>
                <div className="flex items-center gap-2 mb-1">
                    <Table2 className="h-5 w-5 text-primary" />
                    <h1 className="ds-heading">Tambah Table Baru</h1>
                </div>
                <p className="ds-body opacity-80">Table = sheet tab dalam dataset. Define schema + audit.</p>
            </header>

            <NewTableWizard
                preselectDs={preselectDs ?? undefined}
                onCancel={() => router.push("/data-input")}
                onSuccess={(ds, tbl) => router.push(`/data-input/${encodeURIComponent(ds)}/${encodeURIComponent(tbl)}`)}
            />
        </div>
    );
}
