"use client";

/**
 * Tab Groups — list semua grup bot + View Members modal + Add to Dispatch routing.
 * Data source: WaGate /api/groups live via Dispatch admin proxy.
 * Shadcn: Table, Dialog, Button, Input, Badge, Tooltip.
 */

import { useState, useCallback, useEffect, memo } from 'react';
import { Users, RefreshCw, Copy, Check, Search, Eye, Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { getWagateGroups, getWagateGroupInfo } from '../_lib/api';
import type { WaGateGroupInfo } from '../_lib/types';
import { CLOUD_CONSOLE_API } from '@/lib/cloud-console-api';

const DISPATCH_ACTIONS = `${CLOUD_CONSOLE_API}/services/dispatch/actions`;

function TabGroupsImpl({
    showFeedback,
}: {
    config: unknown;
    showFeedback: (msg: string, ok: boolean) => void;
}) {
    const [groups, setGroups] = useState<WaGateGroupInfo[]>([]);
    const [loading, setLoading] = useState(false);
    const [initialLoaded, setInitialLoaded] = useState(false);
    const [filter, setFilter] = useState('');
    const [copied, setCopied] = useState<string | null>(null);
    const [memberDialog, setMemberDialog] = useState<{
        open: boolean;
        chatId: string | null;
        loading: boolean;
        data: Awaited<ReturnType<typeof getWagateGroupInfo>> | null;
    }>({ open: false, chatId: null, loading: false, data: null });
    const [addingTo, setAddingTo] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            const result = await getWagateGroups();
            setGroups(result);
            if (result.length === 0) {
                showFeedback('Belum ada grup — bot harus WORKING + di-add ke grup WA dulu', false);
            }
        } catch (err) {
            showFeedback(err instanceof Error ? err.message : 'Fetch groups failed', false);
        } finally {
            setLoading(false);
            setInitialLoaded(true);
        }
    }, [showFeedback]);

    useEffect(() => { refresh(); }, [refresh]);

    async function handleCopy(text: string, key: string) {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(key);
            setTimeout(() => setCopied(null), 2000);
        } catch {
            /* ignore */
        }
    }

    async function handleViewMembers(chatId: string) {
        setMemberDialog({ open: true, chatId, loading: true, data: null });
        try {
            const data = await getWagateGroupInfo(chatId);
            setMemberDialog({ open: true, chatId, loading: false, data });
        } catch (err) {
            showFeedback(err instanceof Error ? err.message : 'Fetch members failed', false);
            setMemberDialog({ open: false, chatId: null, loading: false, data: null });
        }
    }

    async function handleAddToDispatch(groupName: string, chatId: string) {
        const key = chatId.replace(/[^a-z0-9]/gi, '_').toLowerCase().slice(0, 40) || 'grp_' + Date.now();
        if (!confirm(`Tambah ke Dispatch routing dengan key "${key}"? Setelah itu bisa di-target dari Pub/Sub alert "group:${key}".\n\nGroup: ${groupName}\nChat ID: ${chatId}`)) return;
        setAddingTo(chatId);
        try {
            const res = await fetch(`${DISPATCH_ACTIONS}/add-group`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ groupName: key, wa_chat_id: chatId }),
            });
            const data = await res.json();
            if (data.ok) {
                showFeedback(`Ditambahkan ke Dispatch routing: ${key}`, true);
            } else {
                showFeedback(data.error || 'Add to Dispatch failed', false);
            }
        } catch (err) {
            showFeedback(err instanceof Error ? err.message : 'Add to Dispatch failed', false);
        } finally {
            setAddingTo(null);
        }
    }

    const filtered = filter.trim()
        ? groups.filter(g => g.subject?.toLowerCase().includes(filter.toLowerCase()) || g.id.includes(filter))
        : groups;

    // Initial loading skeleton — cegah flash empty state "Tidak ada grup" sebelum fetch pertama selesai
    if (!initialLoaded) {
        return (
            <div className="space-y-5">
                <div className="flex items-center justify-between gap-3">
                    <div className="h-10 flex-1 max-w-md rounded bg-muted/20 animate-pulse" />
                    <div className="h-9 w-24 rounded bg-muted/20 animate-pulse" />
                </div>
                <div className="rounded-lg border border-border/30 overflow-hidden">
                    {[0, 1, 2, 3, 4].map((i) => (
                        <div key={i} className="flex items-center gap-4 border-b border-border/20 p-3 last:border-0">
                            <div className="h-4 flex-1 rounded bg-muted/20 animate-pulse" />
                            <div className="h-4 w-40 rounded bg-muted/20 animate-pulse" />
                            <div className="h-4 w-16 rounded bg-muted/20 animate-pulse" />
                            <div className="h-4 w-12 rounded bg-muted/20 animate-pulse" />
                        </div>
                    ))}
                </div>
                <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-4 w-4 text-muted-foreground/40 animate-spin mr-2" />
                    <span className="ds-small text-muted-foreground">Loading groups from WaGate…</span>
                </div>
            </div>
        );
    }

    return (
        <TooltipProvider>
            <div className="space-y-5">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
                            <Input
                                type="text"
                                placeholder="Cari nama grup atau chat ID…"
                                value={filter}
                                onChange={e => setFilter(e.target.value)}
                                className="pl-8"
                            />
                        </div>
                        <span className="ds-small">{filtered.length} / {groups.length} grup</span>
                    </div>
                    <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
                        <RefreshCw className={loading ? 'animate-spin' : ''} />
                        Refresh
                    </Button>
                </div>

                {filtered.length === 0 ? (
                    <div className="rounded-lg border border-border/30 bg-muted/5 p-10 text-center">
                        <Users className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                        <div className="ds-title text-muted-foreground">Tidak ada grup</div>
                        <div className="ds-small mt-1">
                            {groups.length === 0
                                ? 'Bot belum join grup, atau WaGate belum WORKING.'
                                : 'Coba kata kunci lain.'}
                        </div>
                    </div>
                ) : (
                    <div className="rounded-lg border border-border/50 overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="ds-label uppercase tracking-wider">Nama Grup</TableHead>
                                    <TableHead className="ds-label uppercase tracking-wider">Chat ID</TableHead>
                                    <TableHead className="ds-label uppercase tracking-wider text-right">Members</TableHead>
                                    <TableHead className="ds-label uppercase tracking-wider text-center">Admin</TableHead>
                                    <TableHead className="ds-label uppercase tracking-wider text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filtered.map((g) => (
                                    <TableRow key={g.id}>
                                        <TableCell className="ds-label">{g.subject || '—'}</TableCell>
                                        <TableCell className="ds-data">{g.id}</TableCell>
                                        <TableCell className="ds-data text-right">{g.participant_count ?? '—'}</TableCell>
                                        <TableCell className="text-center">
                                            {g.is_admin
                                                ? <Badge variant="default" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">Yes</Badge>
                                                : <span className="ds-small">—</span>}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button size="icon-sm" variant="ghost" onClick={() => handleCopy(g.id, g.id)}>
                                                            {copied === g.id ? <Check className="text-emerald-400" /> : <Copy />}
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent><span className="ds-small">Copy chat ID</span></TooltipContent>
                                                </Tooltip>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button size="icon-sm" variant="ghost" onClick={() => handleViewMembers(g.id)}>
                                                            <Eye />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent><span className="ds-small">View members</span></TooltipContent>
                                                </Tooltip>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            size="icon-sm"
                                                            variant="ghost"
                                                            onClick={() => handleAddToDispatch(g.subject || g.id, g.id)}
                                                            disabled={addingTo === g.id}
                                                        >
                                                            {addingTo === g.id ? <Loader2 className="animate-spin" /> : <Plus />}
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent><span className="ds-small">Add to Dispatch routing</span></TooltipContent>
                                                </Tooltip>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}

                {/* Members Dialog */}
                <Dialog open={memberDialog.open} onOpenChange={(o) => !o && setMemberDialog({ open: false, chatId: null, loading: false, data: null })}>
                    <DialogContent className="max-w-2xl">
                        <DialogHeader>
                            <DialogTitle className="ds-title">
                                {memberDialog.data?.subject || 'Group Members'}
                            </DialogTitle>
                            <DialogDescription className="ds-small">
                                {memberDialog.chatId}
                            </DialogDescription>
                        </DialogHeader>
                        {memberDialog.loading ? (
                            <div className="flex items-center justify-center py-10">
                                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/50" />
                            </div>
                        ) : memberDialog.data?.participants ? (
                            <ScrollArea className="h-[400px]">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="ds-label uppercase tracking-wider">#</TableHead>
                                            <TableHead className="ds-label uppercase tracking-wider">Phone</TableHead>
                                            <TableHead className="ds-label uppercase tracking-wider text-center">Admin</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {memberDialog.data.participants.map((p, idx) => (
                                            <TableRow key={p.id}>
                                                <TableCell className="ds-small">{idx + 1}</TableCell>
                                                <TableCell className="ds-data">{p.id.split('@')[0]}</TableCell>
                                                <TableCell className="text-center">
                                                    {p.is_admin
                                                        ? <Badge variant="default" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">Admin</Badge>
                                                        : <span className="ds-small">—</span>}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </ScrollArea>
                        ) : (
                            <div className="py-6 text-center ds-small">Data members tidak tersedia</div>
                        )}
                        <DialogFooter>
                            <span className="ds-small">
                                Owner: <span className="ds-data">{memberDialog.data?.owner?.split('@')[0] || '—'}</span>
                            </span>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </TooltipProvider>
    );
}

const TabGroups = memo(TabGroupsImpl, (prev, next) =>
    prev.config === next.config && prev.showFeedback === next.showFeedback);
export default TabGroups;
