"use client";

/**
 * Tab Contacts — WaGate in-memory contacts cache + number check + profile picture.
 * §18 Data Contract: LIVE dari WaGate backend. Memoize + skeleton supaya tidak jitter.
 *
 * Features:
 *   1. List contacts yang udah observed (via messages/contacts events) dengan pushName
 *   2. Search by JID atau name
 *   3. Form check number: phone → apakah terdaftar di WhatsApp?
 *   4. Profile picture lookup per contact
 */

import { useState, useCallback, useEffect, useMemo, memo } from 'react';
import {
    Users, RefreshCw, Search, Loader2, CheckCircle2, XCircle, Phone, Image as ImageIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
    getWagateContacts, checkWagateNumber, getWagateProfilePicture,
    type WaGateContact,
} from '../_lib/api';

function TabContactsImpl({
    config,
    showFeedback,
}: {
    config: unknown;
    showFeedback: (msg: string, ok: boolean) => void;
}) {
    // Phone placeholder dinamis — baca dari bot_identity FS config. Fallback ke format generic.
    const botPhone = ((config as { bot_identity?: { phone?: string } })?.bot_identity?.phone) || '628xxxxxxxxxx';
    const [contacts, setContacts] = useState<WaGateContact[]>([]);
    const [loading, setLoading] = useState(false);
    const [initialLoaded, setInitialLoaded] = useState(false);
    const [filter, setFilter] = useState('');

    // Number check form
    const [checkPhone, setCheckPhone] = useState('');
    const [checking, setChecking] = useState(false);
    const [checkResult, setCheckResult] = useState<{ exists: boolean; jid?: string; phone: string } | null>(null);

    // Profile picture
    const [picPhone, setPicPhone] = useState('');
    const [pictureUrl, setPictureUrl] = useState<string | null>(null);
    const [fetchingPic, setFetchingPic] = useState(false);

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            const snap = await getWagateContacts();
            setContacts(snap.items);
        } catch (err) {
            showFeedback(err instanceof Error ? err.message : 'Fetch contacts failed', false);
        } finally {
            setLoading(false);
            setInitialLoaded(true);
        }
    }, [showFeedback]);

    useEffect(() => { refresh(); }, [refresh]);

    const filtered = useMemo(() => {
        const q = filter.trim().toLowerCase();
        if (!q) return contacts;
        return contacts.filter((c) => c.jid.toLowerCase().includes(q) || (c.name || '').toLowerCase().includes(q));
    }, [contacts, filter]);

    async function handleCheck() {
        const clean = checkPhone.replace(/\D/g, '');
        if (!clean || clean.length < 8) {
            showFeedback(`Phone invalid — masukkan digits saja, e.g. ${botPhone}`, false);
            return;
        }
        setChecking(true);
        setCheckResult(null);
        try {
            const r = await checkWagateNumber(clean);
            setCheckResult({ exists: r.exists, jid: r.jid, phone: clean });
            if (r.error) showFeedback(r.error, false);
        } catch (err) {
            showFeedback(err instanceof Error ? err.message : 'Check number failed', false);
        } finally {
            setChecking(false);
        }
    }

    async function handleFetchPicture() {
        const clean = picPhone.replace(/\D/g, '');
        if (!clean || clean.length < 8) {
            showFeedback('Phone invalid — digits saja', false);
            return;
        }
        setFetchingPic(true);
        setPictureUrl(null);
        try {
            const r = await getWagateProfilePicture(clean);
            if (r.url) {
                setPictureUrl(r.url);
            } else {
                showFeedback(r.error || 'No profile picture', false);
            }
        } catch (err) {
            showFeedback(err instanceof Error ? err.message : 'Fetch picture failed', false);
        } finally {
            setFetchingPic(false);
        }
    }

    // Initial loading skeleton — prevent flash empty contacts list
    if (!initialLoaded) {
        return (
            <div className="space-y-5">
                <div className="h-9 w-64 rounded bg-muted/20 animate-pulse" />
                <div className="rounded-lg border border-border/30 overflow-hidden">
                    {[0, 1, 2, 3].map((i) => (
                        <div key={i} className="flex items-center gap-4 border-b border-border/20 p-3 last:border-0">
                            <div className="h-4 flex-1 rounded bg-muted/20 animate-pulse" />
                            <div className="h-4 w-48 rounded bg-muted/20 animate-pulse" />
                            <div className="h-4 w-24 rounded bg-muted/20 animate-pulse" />
                        </div>
                    ))}
                </div>
                <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-4 w-4 text-muted-foreground/40 animate-spin mr-2" />
                    <span className="ds-small text-muted-foreground">Loading contacts cache…</span>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            {/* Section 1 — Contacts List */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                    <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-blue-400" />
                        <CardTitle className="ds-title">Contacts Cache</CardTitle>
                        <Badge variant="secondary" className="ml-2">{contacts.length}</Badge>
                    </div>
                    <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
                        <RefreshCw className={loading ? 'animate-spin' : ''} />
                        Refresh
                    </Button>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="relative max-w-md">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
                        <Input
                            type="text"
                            placeholder="Cari JID atau nama…"
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                            className="pl-8"
                        />
                    </div>

                    {filtered.length === 0 ? (
                        <Alert className="border-border/30 bg-muted/5">
                            <AlertDescription className="ds-small text-muted-foreground">
                                {contacts.length === 0
                                    ? 'Cache kosong — contacts ter-populate saat ada pesan masuk atau contacts.upsert event dari Baileys. Normal di fresh cold start.'
                                    : 'Tidak ada hasil untuk filter ini.'}
                            </AlertDescription>
                        </Alert>
                    ) : (
                        <div className="rounded-lg border border-border/50 overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="ds-label uppercase tracking-wider">Name</TableHead>
                                        <TableHead className="ds-label uppercase tracking-wider">JID</TableHead>
                                        <TableHead className="ds-label uppercase tracking-wider text-right">Last Seen</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filtered.slice(0, 200).map((c) => (
                                        <TableRow key={c.jid}>
                                            <TableCell className="ds-body">{c.name || <span className="text-muted-foreground">—</span>}</TableCell>
                                            <TableCell className="ds-data break-all">{c.jid}</TableCell>
                                            <TableCell className="ds-small text-right text-muted-foreground">
                                                {c.lastSeenAt ? new Date(c.lastSeenAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) : '—'}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                            {filtered.length > 200 && (
                                <div className="ds-small text-muted-foreground text-center py-2 border-t border-border/30">
                                    Showing first 200 of {filtered.length} — tambah filter untuk lebih spesifik
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Section 2 — Number Check */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-emerald-400" />
                        <CardTitle className="ds-title">Check Number on WhatsApp</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="flex flex-col md:flex-row gap-2">
                        <Input
                            type="text"
                            value={checkPhone}
                            onChange={(e) => setCheckPhone(e.target.value)}
                            placeholder={botPhone}
                            className="flex-1 font-mono"
                            disabled={checking}
                        />
                        <Button onClick={handleCheck} disabled={checking || !checkPhone.trim()} className="shrink-0">
                            {checking ? <Loader2 className="animate-spin" /> : <Phone />}
                            {checking ? 'Checking…' : 'Check'}
                        </Button>
                    </div>
                    {checkResult && (
                        <Alert className={checkResult.exists ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-red-500/30 bg-red-500/5'}>
                            {checkResult.exists
                                ? <CheckCircle2 className="text-emerald-400" />
                                : <XCircle className="text-red-400" />}
                            <AlertDescription className="ds-body">
                                <div>
                                    Nomor <span className="ds-data">{checkResult.phone}</span>{' '}
                                    {checkResult.exists ? (
                                        <span className="text-emerald-400">terdaftar di WhatsApp</span>
                                    ) : (
                                        <span className="text-red-400">TIDAK terdaftar di WhatsApp</span>
                                    )}
                                </div>
                                {checkResult.jid && (
                                    <div className="ds-small text-muted-foreground mt-1">JID: {checkResult.jid}</div>
                                )}
                            </AlertDescription>
                        </Alert>
                    )}
                </CardContent>
            </Card>

            {/* Section 3 — Profile Picture */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <ImageIcon className="h-4 w-4 text-purple-400" />
                        <CardTitle className="ds-title">Profile Picture Lookup</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="flex flex-col md:flex-row gap-2">
                        <Input
                            type="text"
                            value={picPhone}
                            onChange={(e) => setPicPhone(e.target.value)}
                            placeholder={botPhone}
                            className="flex-1 font-mono"
                            disabled={fetchingPic}
                        />
                        <Button onClick={handleFetchPicture} disabled={fetchingPic || !picPhone.trim()} className="shrink-0">
                            {fetchingPic ? <Loader2 className="animate-spin" /> : <ImageIcon />}
                            {fetchingPic ? 'Fetching…' : 'Fetch Picture'}
                        </Button>
                    </div>
                    {pictureUrl && (
                        <div className="rounded-lg border border-border/50 p-4 flex items-center gap-4">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={pictureUrl}
                                alt="Profile"
                                width={96}
                                height={96}
                                className="rounded-full border border-border/30"
                            />
                            <div className="space-y-1">
                                <div className="ds-label text-muted-foreground">Picture URL</div>
                                <a href={pictureUrl} target="_blank" rel="noopener noreferrer" className="ds-small text-blue-400 break-all hover:underline">
                                    {pictureUrl}
                                </a>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

const TabContacts = memo(TabContactsImpl, (prev, next) =>
    prev.config === next.config && prev.showFeedback === next.showFeedback);
export default TabContacts;
