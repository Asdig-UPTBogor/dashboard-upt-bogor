"use client";

/**
 * SchemaTab — render table schema (Column / Type / Mode).
 */

import { Loader2 } from "lucide-react";
import type { SchemaResponse } from "./useTableMeta";

export function SchemaTab({
    schema,
    loading,
}: {
    schema: SchemaResponse | null;
    loading: boolean;
}) {
    if (loading) {
        return (
            <div className="flex items-center justify-center h-48">
                <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
            </div>
        );
    }
    return (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
                <thead className="bg-muted/40 sticky top-0">
                    <tr>
                        <th className="text-left px-3 py-2 ds-label">Column</th>
                        <th className="text-left px-3 py-2 ds-label">Type</th>
                        <th className="text-left px-3 py-2 ds-label">Mode</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-border">
                    {(schema?.columns ?? []).map((c) => (
                        <tr key={c.name}>
                            <td className="px-3 py-2 font-mono text-xs">
                                {c.name}
                                {c.description && (
                                    <p className="ds-small opacity-60 mt-0.5">{c.description}</p>
                                )}
                            </td>
                            <td className="px-3 py-2">
                                <span className="ds-data rounded bg-blue-500/10 text-blue-400 px-1.5 py-0.5 text-xs">
                                    {c.type}
                                </span>
                            </td>
                            <td className="px-3 py-2 ds-small opacity-70 font-mono">{c.mode}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
