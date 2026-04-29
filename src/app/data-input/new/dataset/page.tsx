"use client";

/**
 * /data-input/new/dataset — thin wrapper pakai NewDatasetForm shared.
 */

import { useRouter } from "next/navigation";
import Link from "next/link";
import { FolderPlus, ArrowLeft, ChevronRight } from "lucide-react";
import { NewDatasetForm } from "../_shared/NewDatasetForm";

export default function NewDatasetPage() {
    const router = useRouter();

    return (
        <div className="mx-auto max-w-2xl p-6 md:p-8 space-y-6">
            <nav className="flex items-center gap-1 ds-small opacity-70">
                <Link href="/data-input" className="ds-transition hover:text-foreground inline-flex items-center gap-1">
                    <ArrowLeft className="h-3 w-3" /> Data Input
                </Link>
                <ChevronRight className="h-3 w-3 opacity-40" />
                <span>Tambah Dataset</span>
            </nav>

            <header>
                <div className="flex items-center gap-2 mb-1">
                    <FolderPlus className="h-5 w-5 text-primary" />
                    <h1 className="ds-heading">Tambah Dataset Baru</h1>
                </div>
                <p className="ds-body opacity-80">
                    Dataset = container untuk sekumpulan table terkait (ekuivalen spreadsheet file).
                    Dibuat dengan label <code className="font-mono">origin=user</code> — full CRUD permission.
                </p>
            </header>

            <NewDatasetForm
                onCancel={() => router.push("/data-input")}
                onSuccess={(id) => router.push(`/data-input/${encodeURIComponent(id)}`)}
            />
        </div>
    );
}
