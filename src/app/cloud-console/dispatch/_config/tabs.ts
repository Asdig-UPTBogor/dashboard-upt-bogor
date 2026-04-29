/**
 * Dispatch — Tab Registry
 *
 * Single source of truth: id, label, icon, domain description.
 * Tambah tab baru: push ke array ini + add case di page.tsx renderer.
 *
 * Setiap tab punya "domain" (penjelasan 1 kalimat — what this tab is for)
 * supaya user non-coder langsung paham tanpa harus tanya.
 */

import { Activity, Users, Radio, ScrollText, Inbox, Settings, Workflow, type LucideIcon } from 'lucide-react';

export type DispatchTabId = 'status' | 'architecture' | 'provider' | 'groups' | 'logs' | 'inbound' | 'settings';

export interface DispatchTabDef {
    id: DispatchTabId;
    label: string;
    icon: LucideIcon;
    /** 1-kalimat deskripsi domain tab ini — tampil di InfoHeader tiap tab */
    domain: string;
}

export const DISPATCH_TABS: DispatchTabDef[] = [
    {
        id: 'status',
        label: 'Status',
        icon: Activity,
        domain: 'Snapshot kondisi Dispatch: provider aktif, counter hari ini, last delivery.',
    },
    {
        id: 'architecture',
        label: 'Architecture',
        icon: Workflow,
        domain: 'Arsitektur data flow end-to-end: outbound, inbound, storage, recent activity.',
    },
    {
        id: 'provider',
        label: 'Provider',
        icon: Radio,
        domain: 'Kontrol Gateway. Swap primary⇄secondary, restart session, refresh status.',
    },
    {
        id: 'groups',
        label: 'Groups',
        icon: Users,
        domain: 'Mapping alias group → chatId. Publisher pakai alias, Dispatch resolve ke chatId sesungguhnya.',
    },
    {
        id: 'logs',
        label: 'Logs',
        icon: ScrollText,
        domain: 'Audit outbound delivery — tiap attempt tercatat (delivered/failed/dropped/skipped).',
    },
    {
        id: 'inbound',
        label: 'Inbound',
        icon: Inbox,
        domain: 'Pesan masuk dari user (reply ke bot). Gateway fire webhook ke Dispatch.',
    },
    {
        id: 'settings',
        label: 'Settings',
        icon: Settings,
        domain: 'Kill switch global, test send, runtime config read-only.',
    },
];

/** Helper lookup — tab definition by id */
export function getTabDef(id: DispatchTabId): DispatchTabDef {
    const def = DISPATCH_TABS.find((t) => t.id === id);
    if (!def) throw new Error(`Unknown dispatch tab id: ${id}`);
    return def;
}
