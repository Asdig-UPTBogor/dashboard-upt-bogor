"use client";

/**
 * DataLevelConfig — main container (Layer 2-B).
 *
 * Per tabel user di BQ, user tentukan level hirarki (UPT/ULTG/GI/BAY/FLAT) +
 * kolom mana yang berisi nama hirarki. Tersimpan di Firestore `bq_table_levels/`.
 *
 * Ref: Spreadsheet Sync/docs/SS_V5_SYSTEM.md §7b
 */

import { useMemo, useState } from "react";
import { useTables } from "./useTables";
import { tableKey } from "./constants";
import { TableList } from "./TableList";
import { EditPanel } from "./EditPanel";
import { EmptyState } from "./EmptyState";

export default function DataLevelConfig() {
    const { tables, loading, error, reload } = useTables();
    const [activeKey, setActiveKey] = useState<string | null>(null);

    const activeTable = useMemo(
        () => tables.find((t) => tableKey(t) === activeKey) || null,
        [tables, activeKey]
    );

    return (
        <div className="flex h-full w-full min-h-0">
            <TableList
                tables={tables}
                loading={loading}
                error={error}
                activeKey={activeKey}
                onSelect={setActiveKey}
                onRefresh={reload}
            />
            <div className="flex-1 overflow-y-auto min-w-0">
                {activeTable ? (
                    <EditPanel
                        key={tableKey(activeTable)}
                        entry={activeTable}
                        onSaved={reload}
                        onClose={() => setActiveKey(null)}
                    />
                ) : (
                    <EmptyState />
                )}
            </div>
        </div>
    );
}
