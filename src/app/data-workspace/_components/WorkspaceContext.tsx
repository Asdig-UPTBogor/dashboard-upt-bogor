"use client";

/**
 * WorkspaceContext — actions yang diprovide oleh Shell ke descendants.
 *
 *  Page / sidebar bisa trigger:
 *   ▸ openNewDataset()           → modal new dataset
 *   ▸ openNewTable(ds?)          → modal new table, optional pre-select ds
 *
 *  Zero hardcode — nambah action baru = append ke interface + provider.
 */

import { createContext, useContext } from "react";

import type { ConfirmOptions } from "./ConfirmDialog";

export interface WorkspaceActions {
    openNewDataset: () => void;
    openNewTable: (preselectDs?: string) => void;
    openNewGroup: () => void;
    /** Custom confirm dialog (themed). Returns Promise<boolean>. */
    confirm: (opts: ConfirmOptions) => Promise<boolean>;
}

const WorkspaceCtx = createContext<WorkspaceActions | null>(null);

export function WorkspaceProvider({
    value, children,
}: {
    value: WorkspaceActions;
    children: React.ReactNode;
}) {
    return <WorkspaceCtx.Provider value={value}>{children}</WorkspaceCtx.Provider>;
}

export function useWorkspace(): WorkspaceActions {
    const ctx = useContext(WorkspaceCtx);
    if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
    return ctx;
}
