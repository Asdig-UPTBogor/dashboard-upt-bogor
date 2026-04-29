"use client";

/**
 * Tab Groups — CRUD routing targets (WA groups).
 * Dependencies: api helpers (add/edit/delete/verify group).
 * Pattern: Notifier TabGroups, simplified — no invite-link resolve (WAHA pakai @g.us langsung).
 */

import { useState } from 'react';
import { Users, Plus, CheckCircle2, RefreshCw, Edit3, Trash2, X, Info } from 'lucide-react';

import type { DispatchConfig, DispatchGroup } from '../_lib/types';
import { addGroup, editGroup, deleteGroup, verifyGroup } from '../_lib/api';
import { fmtWIB, fmtAgo } from '../_lib/api';

export default function TabGroups({
    config, showFeedback,
}: {
    config: DispatchConfig;
    showFeedback: (msg: string, ok: boolean) => void;
}) {
    const groups = config.groups || {};
    const entries = Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));

    const [showAddForm, setShowAddForm] = useState(false);
    const [newKey, setNewKey] = useState('');
    const [newChatId, setNewChatId] = useState('');
    const [busyKey, setBusyKey] = useState<string | null>(null);
    const [editingKey, setEditingKey] = useState<string | null>(null);
    const [editChatId, setEditChatId] = useState('');

    async function handleAdd() {
        if (!newKey.trim() || !newChatId.trim()) {
            showFeedback('Group key dan chat ID wajib diisi', false);
            return;
        }
        setBusyKey('_add');
        try {
            await addGroup(newKey.trim(), newChatId.trim());
            showFeedback(`Group "${newKey}" ditambahkan`, true);
            setNewKey('');
            setNewChatId('');
            setShowAddForm(false);
        } catch (err) {
            showFeedback(err instanceof Error ? err.message : 'Gagal tambah group', false);
        } finally {
            setBusyKey(null);
        }
    }

    async function handleVerify(key: string, chatId: string) {
        setBusyKey(key);
        try {
            const result = await verifyGroup(key, chatId);
            showFeedback(`${key} → "${result.reconciled.wa_name}" (${result.reconciled.members})`, true);
        } catch (err) {
            showFeedback(err instanceof Error ? err.message : 'Verify gagal', false);
        } finally {
            setBusyKey(null);
        }
    }

    async function handleToggleEnabled(key: string, current: boolean) {
        setBusyKey(key);
        try {
            await editGroup(key, { enabled: !current });
            showFeedback(`${key} ${!current ? 'enabled' : 'disabled'}`, true);
        } catch (err) {
            showFeedback(err instanceof Error ? err.message : 'Toggle gagal', false);
        } finally {
            setBusyKey(null);
        }
    }

    async function handleEditSave(key: string) {
        if (!editChatId.trim()) return;
        setBusyKey(key);
        try {
            await editGroup(key, { wa_chat_id: editChatId.trim() });
            showFeedback(`${key} chat ID diperbarui — klik Verify untuk sync metadata`, true);
            setEditingKey(null);
            setEditChatId('');
        } catch (err) {
            showFeedback(err instanceof Error ? err.message : 'Edit gagal', false);
        } finally {
            setBusyKey(null);
        }
    }

    async function handleDelete(key: string) {
        if (!confirm(`Hapus group "${key}"? Producer yang masih kirim ke key ini akan error.`)) return;
        setBusyKey(key);
        try {
            await deleteGroup(key);
            showFeedback(`Group "${key}" dihapus`, true);
        } catch (err) {
            showFeedback(err instanceof Error ? err.message : 'Delete gagal', false);
        } finally {
            setBusyKey(null);
        }
    }

    return (
        <div className="space-y-5">
            {/* Info domain */}
            <div className="flex items-start gap-2 rounded-md border border-border/30 bg-muted/5 p-3">
                <Info className="h-3.5 w-3.5 text-muted-foreground/60 mt-0.5 shrink-0" />
                <span className="ds-small text-muted-foreground/80">
                    <strong className="text-foreground/90">Tab Groups</strong> — mapping alias group → chatId.
                    Publisher kirim pakai alias, Dispatch resolve ke chatId. Verify sync metadata (nama + jumlah member) via Gateway aktif.
                </span>
            </div>

            {/* Header + Add button */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground/60" />
                    <span className="ds-label uppercase tracking-wider">Routing Groups ({entries.length})</span>
                </div>
                <button
                    type="button"
                    onClick={() => setShowAddForm((v) => !v)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors"
                >
                    <Plus className="h-3 w-3" />
                    {showAddForm ? 'Cancel' : 'Add Group'}
                </button>
            </div>

            {/* Add form */}
            {showAddForm && (
                <div className="rounded-lg border border-border/50 bg-muted/5 p-4 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <label className="ds-label mb-1 block">Group Key (snake_case)</label>
                            <input
                                type="text"
                                value={newKey}
                                onChange={(e) => setNewKey(e.target.value)}
                                placeholder="contoh: thor_alert"
                                className="w-full h-8 px-2 text-[12px] rounded-md border border-border/50 bg-muted/20 font-mono focus-visible:outline-none focus-visible:border-blue-500/50"
                            />
                        </div>
                        <div>
                            <label className="ds-label mb-1 block">WA Chat ID (@g.us)</label>
                            <input
                                type="text"
                                value={newChatId}
                                onChange={(e) => setNewChatId(e.target.value)}
                                placeholder="120363...@g.us"
                                className="w-full h-8 px-2 text-[12px] rounded-md border border-border/50 bg-muted/20 font-mono focus-visible:outline-none focus-visible:border-blue-500/50"
                            />
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={handleAdd}
                        disabled={busyKey === '_add'}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-medium hover:bg-blue-500/20 disabled:opacity-50"
                    >
                        {busyKey === '_add' ? 'Saving...' : 'Save Group'}
                    </button>
                </div>
            )}

            {/* Groups table */}
            {entries.length === 0 ? (
                <div className="rounded-lg border border-border/30 bg-muted/5 p-8 text-center">
                    <span className="ds-small">Belum ada group — klik Add Group untuk tambah.</span>
                </div>
            ) : (
                <div className="rounded-lg border border-border/50 overflow-hidden">
                    <table className="w-full text-xs">
                        <thead className="bg-muted/20 border-b border-border/50">
                            <tr className="text-left">
                                <th className="px-3 py-2 ds-label">Key</th>
                                <th className="px-3 py-2 ds-label">WA Name</th>
                                <th className="px-3 py-2 ds-label">Members</th>
                                <th className="px-3 py-2 ds-label">Enabled</th>
                                <th className="px-3 py-2 ds-label">Verified</th>
                                <th className="px-3 py-2 ds-label text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/30">
                            {entries.map(([key, g]: [string, DispatchGroup]) => {
                                const isEditing = editingKey === key;
                                return (
                                    <tr key={key} className="hover:bg-muted/5">
                                        <td className="px-3 py-2 font-mono text-foreground/90">{key}</td>
                                        <td className="px-3 py-2 text-foreground/70">{g.wa_group_name || '—'}</td>
                                        <td className="px-3 py-2 font-mono tabular-nums">{g.wa_member_count ?? '—'}</td>
                                        <td className="px-3 py-2">
                                            <button
                                                type="button"
                                                onClick={() => handleToggleEnabled(key, g.enabled !== false)}
                                                disabled={busyKey === key}
                                                className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                                                    g.enabled !== false ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-500/10 text-slate-400'
                                                } hover:opacity-80 disabled:opacity-50`}
                                            >
                                                {g.enabled !== false ? 'ON' : 'OFF'}
                                            </button>
                                        </td>
                                        <td className="px-3 py-2 ds-small">
                                            {g.verified_at ? `${fmtWIB(g.verified_at)} (${fmtAgo(g.verified_at)})` : '—'}
                                        </td>
                                        <td className="px-3 py-2">
                                            {isEditing ? (
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <input
                                                        type="text"
                                                        value={editChatId}
                                                        onChange={(e) => setEditChatId(e.target.value)}
                                                        placeholder={g.wa_chat_id || ''}
                                                        className="h-6 px-1.5 text-[11px] rounded border border-border/50 bg-muted/20 font-mono w-48"
                                                    />
                                                    <button
                                                        onClick={() => handleEditSave(key)}
                                                        disabled={busyKey === key}
                                                        className="p-1 rounded text-emerald-400 hover:bg-emerald-500/10"
                                                        aria-label="Save"
                                                    >
                                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={() => { setEditingKey(null); setEditChatId(''); }}
                                                        className="p-1 rounded text-muted-foreground hover:bg-muted/20"
                                                        aria-label="Cancel"
                                                    >
                                                        <X className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-end gap-1">
                                                    <button
                                                        onClick={() => handleVerify(key, g.wa_chat_id || '')}
                                                        disabled={busyKey === key || !g.wa_chat_id}
                                                        className="p-1.5 rounded text-muted-foreground hover:text-blue-400 hover:bg-blue-500/10 disabled:opacity-30"
                                                        title="Verify (sync metadata via WAHA)"
                                                    >
                                                        <RefreshCw className={`h-3.5 w-3.5 ${busyKey === key ? 'animate-spin' : ''}`} />
                                                    </button>
                                                    <button
                                                        onClick={() => { setEditingKey(key); setEditChatId(g.wa_chat_id || ''); }}
                                                        disabled={busyKey === key}
                                                        className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted/20 disabled:opacity-30"
                                                        title="Edit chat ID"
                                                    >
                                                        <Edit3 className="h-3.5 w-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(key)}
                                                        disabled={busyKey === key}
                                                        className="p-1.5 rounded text-muted-foreground hover:text-red-400 hover:bg-red-500/10 disabled:opacity-30"
                                                        title="Delete"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Chat ID preview (tooltip-style below table) */}
            {entries.length > 0 && (
                <div className="rounded-lg border border-border/30 bg-muted/5 p-3">
                    <div className="ds-label mb-2 uppercase tracking-wider">Chat IDs</div>
                    <div className="space-y-1">
                        {entries.map(([key, g]) => (
                            <div key={key} className="flex items-center justify-between text-xs">
                                <span className="font-mono text-muted-foreground">{key}</span>
                                <span className="font-mono text-foreground/60">{g.wa_chat_id || '—'}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
