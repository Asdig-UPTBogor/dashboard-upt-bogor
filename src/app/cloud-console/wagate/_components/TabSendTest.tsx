"use client";

/**
 * Tab Send Test — interactive send form untuk 14 type send + interactive action.
 *
 * Tier 1: text, image, file, location
 * Tier 2 media: voice, video, vcard
 * Tier 2 interactive: reaction, seen, typing-on, typing-off
 * Tier 3 advanced: poll, list, buttons, link-preview
 *
 * Design §18 data contract: LIVE via Dashboard BE → WaGate. Semua route sudah terdaftar di
 * `/api/console/services/wagate/actions/*` dan handler WaGate sudah ready.
 */

import { useState, useEffect, useCallback, memo } from 'react';
import {
    Send, Loader2, CheckCircle2, AlertCircle, Upload, MapPin, FileText, Image as ImageIcon,
    Type, Mic, Video, UserSquare, Vote, Smile, Eye, Keyboard, Link as LinkIcon, ListChecks, MousePointer,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
    Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { CLOUD_CONSOLE_API } from '@/lib/cloud-console-api';
import { MAX_FILE_SIZE_BYTES } from '../_lib/constants';
import {
    getWagateGroups, testSend, sendImage, sendFile, sendLocation,
} from '../_lib/api';
import type { WaGateConfig, WaGateGroupInfo } from '../_lib/types';

type SendType =
    | 'text' | 'image' | 'file' | 'location'
    | 'voice' | 'video' | 'vcard'
    | 'reaction' | 'seen' | 'typing-on' | 'typing-off'
    | 'poll' | 'list' | 'buttons' | 'link-preview';

const TYPE_META: Record<SendType, { label: string; icon: React.ComponentType<{ className?: string }>; tier: 1 | 2 | 3; group: string }> = {
    'text': { label: 'Text', icon: Type, tier: 1, group: 'Basic' },
    'image': { label: 'Image', icon: ImageIcon, tier: 1, group: 'Basic' },
    'file': { label: 'File', icon: FileText, tier: 1, group: 'Basic' },
    'location': { label: 'Location', icon: MapPin, tier: 1, group: 'Basic' },
    'voice': { label: 'Voice (OGG/Opus)', icon: Mic, tier: 2, group: 'Media' },
    'video': { label: 'Video', icon: Video, tier: 2, group: 'Media' },
    'vcard': { label: 'Contact vCard', icon: UserSquare, tier: 2, group: 'Media' },
    'reaction': { label: 'Reaction (emoji)', icon: Smile, tier: 2, group: 'Interactive' },
    'seen': { label: 'Mark as Read', icon: Eye, tier: 2, group: 'Interactive' },
    'typing-on': { label: 'Start Typing', icon: Keyboard, tier: 2, group: 'Interactive' },
    'typing-off': { label: 'Stop Typing', icon: Keyboard, tier: 2, group: 'Interactive' },
    'poll': { label: 'Poll', icon: Vote, tier: 3, group: 'Advanced' },
    'list': { label: 'List Menu', icon: ListChecks, tier: 3, group: 'Advanced' },
    'buttons': { label: 'Quick Reply Buttons', icon: MousePointer, tier: 3, group: 'Advanced' },
    'link-preview': { label: 'Link Preview', icon: LinkIcon, tier: 3, group: 'Advanced' },
};

const MAX_FILE_SIZE = MAX_FILE_SIZE_BYTES;

const ACTIONS_API = `${CLOUD_CONSOLE_API}/services/wagate/actions`;

async function postAction(action: string, body: Record<string, unknown>): Promise<{ ok: boolean; error?: string; key?: { id: string } }> {
    try {
        const res = await fetch(`${ACTIONS_API}/${action}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.ok === false) {
            return { ok: false, error: data.error || `HTTP ${res.status}` };
        }
        return { ok: true, ...data };
    } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
}

function TabSendTestImpl({
    config,
    showFeedback,
}: {
    config: WaGateConfig;
    showFeedback: (msg: string, ok: boolean) => void;
}) {
    const botPhone = ((config as unknown as { bot_identity?: { phone?: string } })?.bot_identity?.phone) || '628xxxxxxxxxx';
    const [groups, setGroups] = useState<WaGateGroupInfo[]>([]);
    const [chatId, setChatId] = useState('');
    const [manualChatId, setManualChatId] = useState('');
    const [sendType, setSendType] = useState<SendType>('text');
    const [sending, setSending] = useState(false);
    const [lastResult, setLastResult] = useState<{ ok: boolean; messageId?: string; ts: string } | null>(null);

    // Per-type state
    const [textBody, setTextBody] = useState('');
    const [imageFile, setImageFile] = useState<{ name: string; mimetype: string; base64: string } | null>(null);
    const [imageCaption, setImageCaption] = useState('');
    const [docFile, setDocFile] = useState<{ name: string; mimetype: string; base64: string } | null>(null);
    const [docCaption, setDocCaption] = useState('');
    const [latitude, setLatitude] = useState('');
    const [longitude, setLongitude] = useState('');
    const [locationName, setLocationName] = useState('');
    const [locationAddress, setLocationAddress] = useState('');
    // Voice
    const [voiceFile, setVoiceFile] = useState<{ name: string; mimetype: string; base64: string } | null>(null);
    // Video
    const [videoFile, setVideoFile] = useState<{ name: string; mimetype: string; base64: string } | null>(null);
    const [videoCaption, setVideoCaption] = useState('');
    // vCard
    const [vcardName, setVcardName] = useState('');
    const [vcardPhone, setVcardPhone] = useState('');
    // Reaction
    const [reactionMsgId, setReactionMsgId] = useState('');
    const [reactionEmoji, setReactionEmoji] = useState('👍');
    // Seen
    const [seenMsgId, setSeenMsgId] = useState('');
    // Poll
    const [pollQuestion, setPollQuestion] = useState('');
    const [pollOptionsText, setPollOptionsText] = useState('Option A\nOption B\nOption C');
    const [pollSelectableCount, setPollSelectableCount] = useState('1');
    // List
    const [listTitle, setListTitle] = useState('');
    const [listText, setListText] = useState('');
    const [listButtonText, setListButtonText] = useState('Open menu');
    const [listSections, setListSections] = useState('Section: Main\n- Item 1: Description 1\n- Item 2: Description 2');
    // Buttons
    const [buttonText, setButtonText] = useState('');
    const [buttonList, setButtonList] = useState('Yes|yes\nNo|no\nMaybe|maybe');
    // Link preview
    const [linkUrl, setLinkUrl] = useState('');
    const [linkTitle, setLinkTitle] = useState('');
    const [linkDesc, setLinkDesc] = useState('');

    const [groupsError, setGroupsError] = useState<string | null>(null);
    const loadGroups = useCallback(async () => {
        try {
            const list = await getWagateGroups();
            setGroups(list);
            setGroupsError(null);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            setGroupsError(msg);
            showFeedback(`Gagal load daftar grup: ${msg}`, false);
        }
    }, [showFeedback]);

    useEffect(() => { loadGroups(); }, [loadGroups]);

    const effectiveChatId = manualChatId.trim() || chatId;

    async function handleFileToBase64(file: File, setter: (v: { name: string; mimetype: string; base64: string }) => void): Promise<void> {
        if (file.size > MAX_FILE_SIZE) {
            showFeedback(`File terlalu besar — max 16MB (size: ${(file.size / 1048576).toFixed(1)}MB)`, false);
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            const dataUrl = reader.result as string;
            const base64 = dataUrl.split(',')[1] || '';
            setter({ name: file.name, mimetype: file.type || 'application/octet-stream', base64 });
        };
        reader.readAsDataURL(file);
    }

    function parsePollOptions(): string[] {
        return pollOptionsText.split('\n').map((o) => o.trim()).filter(Boolean);
    }

    function parseButtons(): Array<{ buttonText: string; buttonId: string }> {
        return buttonList.split('\n')
            .map((line) => {
                const [txt, id] = line.split('|').map((s) => s.trim());
                return { buttonText: txt || '', buttonId: id || txt || '' };
            })
            .filter((b) => b.buttonText);
    }

    function parseListSections(): Array<{ title: string; rows: Array<{ title: string; description: string; rowId: string }> }> {
        // Format:
        // Section: Section Name
        // - Row Title: Row Description
        // Section: Other
        // - A: desc A
        const out: Array<{ title: string; rows: Array<{ title: string; description: string; rowId: string }> }> = [];
        const lines = listSections.split('\n').map((l) => l.trim()).filter(Boolean);
        let current: { title: string; rows: Array<{ title: string; description: string; rowId: string }> } | null = null;
        for (const line of lines) {
            if (line.startsWith('Section:')) {
                if (current) out.push(current);
                current = { title: line.replace(/^Section:\s*/, ''), rows: [] };
            } else if (line.startsWith('-')) {
                const body = line.replace(/^-\s*/, '');
                const colonIdx = body.indexOf(':');
                const title = colonIdx >= 0 ? body.slice(0, colonIdx).trim() : body;
                const description = colonIdx >= 0 ? body.slice(colonIdx + 1).trim() : '';
                if (!current) current = { title: 'Main', rows: [] };
                current.rows.push({ title, description, rowId: title.toLowerCase().replace(/\s+/g, '_') });
            }
        }
        if (current) out.push(current);
        return out;
    }

    async function handleSend() {
        if (sendType !== 'seen' && sendType !== 'typing-on' && sendType !== 'typing-off' && !effectiveChatId) {
            showFeedback('Chat ID wajib diisi', false);
            return;
        }
        setSending(true);
        setLastResult(null);
        try {
            let result: { ok: boolean; key?: { id: string }; error?: string } = { ok: false };
            switch (sendType) {
                case 'text':
                    if (!textBody.trim()) throw new Error('Pesan wajib diisi');
                    result = await testSend({ chatId: effectiveChatId, text: textBody });
                    break;
                case 'image':
                    if (!imageFile) throw new Error('Pilih file gambar dulu');
                    result = await sendImage({
                        chatId: effectiveChatId,
                        file: { mimetype: imageFile.mimetype, data: imageFile.base64, filename: imageFile.name },
                        caption: imageCaption.trim() || undefined,
                    });
                    break;
                case 'file':
                    if (!docFile) throw new Error('Pilih file dulu');
                    result = await sendFile({
                        chatId: effectiveChatId,
                        file: { mimetype: docFile.mimetype, data: docFile.base64, filename: docFile.name },
                        caption: docCaption.trim() || undefined,
                    });
                    break;
                case 'location': {
                    const lat = parseFloat(latitude); const lng = parseFloat(longitude);
                    if (isNaN(lat) || isNaN(lng)) throw new Error('Lat/Lng invalid');
                    result = await sendLocation({
                        chatId: effectiveChatId, latitude: lat, longitude: lng,
                        name: locationName.trim() || undefined, address: locationAddress.trim() || undefined,
                    });
                    break;
                }
                case 'voice':
                    if (!voiceFile) throw new Error('Pilih file audio (OGG/Opus recommended)');
                    result = await postAction('send-voice', {
                        chatId: effectiveChatId,
                        file: { mimetype: voiceFile.mimetype, data: voiceFile.base64, filename: voiceFile.name },
                    });
                    break;
                case 'video':
                    if (!videoFile) throw new Error('Pilih file video');
                    result = await postAction('send-video', {
                        chatId: effectiveChatId,
                        file: { mimetype: videoFile.mimetype, data: videoFile.base64, filename: videoFile.name },
                        caption: videoCaption.trim() || undefined,
                    });
                    break;
                case 'vcard':
                    if (!vcardName.trim() || !vcardPhone.trim()) throw new Error('Nama + nomor HP wajib');
                    // BE expect `displayName` (bukan `name`)
                    result = await postAction('send-vcard', { chatId: effectiveChatId, displayName: vcardName.trim(), phone: vcardPhone.trim() });
                    break;
                case 'reaction':
                    if (!reactionMsgId.trim()) throw new Error('messageId wajib (ambil dari Logs)');
                    if (!reactionEmoji.trim()) throw new Error('Emoji wajib');
                    result = await postAction('reaction', { chatId: effectiveChatId, messageId: reactionMsgId.trim(), emoji: reactionEmoji.trim() });
                    break;
                case 'seen':
                    if (!seenMsgId.trim()) throw new Error('messageId wajib');
                    result = await postAction('send-seen', { chatId: effectiveChatId, messageId: seenMsgId.trim() });
                    break;
                case 'typing-on':
                    result = await postAction('start-typing', { chatId: effectiveChatId });
                    break;
                case 'typing-off':
                    result = await postAction('stop-typing', { chatId: effectiveChatId });
                    break;
                case 'poll': {
                    if (!pollQuestion.trim()) throw new Error('Pertanyaan wajib');
                    const opts = parsePollOptions();
                    if (opts.length < 2) throw new Error('Minimum 2 opsi poll');
                    const selectable = parseInt(pollSelectableCount, 10) || 1;
                    result = await postAction('send-poll', { chatId: effectiveChatId, name: pollQuestion, values: opts, selectableCount: selectable });
                    break;
                }
                case 'list': {
                    const sections = parseListSections();
                    if (!listText.trim() || sections.length === 0) throw new Error('Body text + minimal 1 section wajib');
                    result = await postAction('send-list', {
                        chatId: effectiveChatId, title: listTitle.trim() || undefined,
                        text: listText, buttonText: listButtonText || 'Open', sections,
                    });
                    break;
                }
                case 'buttons': {
                    const btns = parseButtons();
                    if (!buttonText.trim() || btns.length === 0) throw new Error('Body text + minimal 1 button wajib');
                    result = await postAction('send-buttons', { chatId: effectiveChatId, text: buttonText, buttons: btns });
                    break;
                }
                case 'link-preview': {
                    if (!linkUrl.trim()) throw new Error('URL wajib');
                    // Backend expect: text (berisi URL untuk auto-preview) + matchedText + canonicalUrl
                    // + optional title/description/jpegThumbnail untuk manual override.
                    const body = linkTitle.trim()
                        ? `${linkTitle.trim()}\n${linkUrl.trim()}`
                        : linkUrl.trim();
                    result = await postAction('send-link-preview', {
                        chatId: effectiveChatId,
                        text: body,
                        matchedText: linkUrl.trim(),
                        canonicalUrl: linkUrl.trim(),
                        title: linkTitle.trim() || undefined,
                        description: linkDesc.trim() || undefined,
                    });
                    break;
                }
            }

            if (result.ok) {
                setLastResult({ ok: true, messageId: result.key?.id, ts: new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) });
                showFeedback(`${TYPE_META[sendType].label} terkirim${result.key?.id ? ` (${result.key.id.substring(0, 16)}…)` : ''}`, true);
            } else {
                setLastResult({ ok: false, ts: new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) });
                showFeedback(result.error || `${TYPE_META[sendType].label} gagal`, false);
            }
        } catch (err) {
            showFeedback(err instanceof Error ? err.message : 'Send failed', false);
            setLastResult({ ok: false, ts: new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) });
        } finally {
            setSending(false);
        }
    }

    const readyToSend: boolean =
        (sendType === 'text' && !!textBody.trim()) ||
        (sendType === 'image' && !!imageFile) ||
        (sendType === 'file' && !!docFile) ||
        (sendType === 'location' && !!latitude && !!longitude) ||
        (sendType === 'voice' && !!voiceFile) ||
        (sendType === 'video' && !!videoFile) ||
        (sendType === 'vcard' && !!vcardName.trim() && !!vcardPhone.trim()) ||
        (sendType === 'reaction' && !!reactionMsgId.trim()) ||
        (sendType === 'seen' && !!seenMsgId.trim()) ||
        (sendType === 'typing-on') ||
        (sendType === 'typing-off') ||
        (sendType === 'poll' && !!pollQuestion.trim()) ||
        (sendType === 'list' && !!listText.trim()) ||
        (sendType === 'buttons' && !!buttonText.trim()) ||
        (sendType === 'link-preview' && !!linkUrl.trim());

    const CurrentIcon = TYPE_META[sendType].icon;

    // Group types for select
    const groupedTypes = (['Basic', 'Media', 'Interactive', 'Advanced'] as const).map((g) => ({
        group: g,
        types: (Object.keys(TYPE_META) as SendType[]).filter((t) => TYPE_META[t].group === g),
    }));

    return (
        <div className="space-y-5 max-w-3xl">
            <Card>
                <CardHeader>
                    <CardTitle className="ds-title flex items-center gap-2">
                        <Send className="h-4 w-4 text-blue-400" />
                        Send Test — 15 types
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Chat target */}
                    <div className="space-y-2">
                        <Label className="ds-label">Chat Target</Label>
                        <div className="flex flex-col md:flex-row gap-2">
                            <Select value={chatId} onValueChange={(v) => { if (v !== '__no_groups__') { setChatId(v); setManualChatId(''); } }}>
                                <SelectTrigger className="flex-1">
                                    <SelectValue placeholder="Pilih grup dari list…" />
                                </SelectTrigger>
                                <SelectContent>
                                    {groups.length === 0 ? (
                                        // Radix Select tidak boleh value="" — pakai sentinel yang di-filter di onValueChange
                                        <SelectItem value="__no_groups__" disabled>
                                            {groupsError ? `Gagal load grup: ${groupsError.substring(0, 40)}` : 'Belum ada grup (buka tab Groups dulu)'}
                                        </SelectItem>
                                    ) : groups.map((g) => (
                                        <SelectItem key={g.id} value={g.id}>
                                            {g.subject || '(no name)'} — {g.id.substring(0, 24)}…
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Input
                                type="text"
                                placeholder="atau manual chatId/phone"
                                value={manualChatId}
                                onChange={(e) => { setManualChatId(e.target.value); if (e.target.value.trim()) setChatId(''); }}
                                className="flex-1 font-mono"
                            />
                        </div>
                        {effectiveChatId && <div className="ds-small text-muted-foreground">Target: <span className="ds-data">{effectiveChatId}</span></div>}
                    </div>

                    {/* Type selector */}
                    <div className="space-y-2">
                        <Label className="ds-label">Send Type</Label>
                        <Select value={sendType} onValueChange={(v) => setSendType(v as SendType)}>
                            <SelectTrigger>
                                <SelectValue>
                                    <div className="flex items-center gap-2">
                                        <CurrentIcon className="h-4 w-4" />
                                        <span>{TYPE_META[sendType].label}</span>
                                        <Badge variant="outline" className="ml-auto">Tier {TYPE_META[sendType].tier}</Badge>
                                    </div>
                                </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                                {groupedTypes.map(({ group, types }) => (
                                    <SelectGroup key={group}>
                                        <SelectLabel>{group}</SelectLabel>
                                        {types.map((t) => {
                                            const Icon = TYPE_META[t].icon;
                                            return (
                                                <SelectItem key={t} value={t}>
                                                    <span className="flex items-center gap-2">
                                                        <Icon className="h-3.5 w-3.5" />
                                                        {TYPE_META[t].label}
                                                    </span>
                                                </SelectItem>
                                            );
                                        })}
                                    </SelectGroup>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Per-type form */}
                    <div className="rounded-lg border border-border/40 bg-muted/5 p-4 space-y-3">
                        {sendType === 'text' && (
                            <div className="space-y-2">
                                <Label className="ds-label">Message Text</Label>
                                <Textarea value={textBody} onChange={(e) => setTextBody(e.target.value)} rows={4} placeholder="Hello world" />
                            </div>
                        )}

                        {sendType === 'image' && (
                            <>
                                <div className="space-y-2">
                                    <Label className="ds-label">Image File</Label>
                                    <Input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && handleFileToBase64(e.target.files[0], setImageFile)} />
                                    {imageFile && <div className="ds-small text-muted-foreground"><Upload className="inline h-3 w-3 mr-1" />{imageFile.name} ({(imageFile.base64.length * 0.75 / 1024).toFixed(1)}KB)</div>}
                                </div>
                                <div className="space-y-2">
                                    <Label className="ds-label">Caption (optional)</Label>
                                    <Input value={imageCaption} onChange={(e) => setImageCaption(e.target.value)} />
                                </div>
                            </>
                        )}

                        {sendType === 'file' && (
                            <>
                                <div className="space-y-2">
                                    <Label className="ds-label">Document File</Label>
                                    <Input type="file" onChange={(e) => e.target.files?.[0] && handleFileToBase64(e.target.files[0], setDocFile)} />
                                    {docFile && <div className="ds-small text-muted-foreground"><Upload className="inline h-3 w-3 mr-1" />{docFile.name}</div>}
                                </div>
                                <div className="space-y-2">
                                    <Label className="ds-label">Caption (optional)</Label>
                                    <Input value={docCaption} onChange={(e) => setDocCaption(e.target.value)} />
                                </div>
                            </>
                        )}

                        {sendType === 'location' && (
                            <>
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-2">
                                        <Label className="ds-label">Latitude</Label>
                                        <Input type="text" value={latitude} onChange={(e) => setLatitude(e.target.value)} placeholder="-6.2088" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="ds-label">Longitude</Label>
                                        <Input type="text" value={longitude} onChange={(e) => setLongitude(e.target.value)} placeholder="106.8456" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label className="ds-label">Name (optional)</Label>
                                    <Input value={locationName} onChange={(e) => setLocationName(e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label className="ds-label">Address (optional)</Label>
                                    <Input value={locationAddress} onChange={(e) => setLocationAddress(e.target.value)} />
                                </div>
                            </>
                        )}

                        {sendType === 'voice' && (
                            <div className="space-y-2">
                                <Label className="ds-label">Voice File (OGG/Opus recommended — MP3 bisa tapi play mungkin bermasalah)</Label>
                                <Input type="file" accept="audio/*" onChange={(e) => e.target.files?.[0] && handleFileToBase64(e.target.files[0], setVoiceFile)} />
                                {voiceFile && <div className="ds-small text-muted-foreground"><Upload className="inline h-3 w-3 mr-1" />{voiceFile.name}</div>}
                            </div>
                        )}

                        {sendType === 'video' && (
                            <>
                                <div className="space-y-2">
                                    <Label className="ds-label">Video File (MP4)</Label>
                                    <Input type="file" accept="video/*" onChange={(e) => e.target.files?.[0] && handleFileToBase64(e.target.files[0], setVideoFile)} />
                                    {videoFile && <div className="ds-small text-muted-foreground"><Upload className="inline h-3 w-3 mr-1" />{videoFile.name}</div>}
                                </div>
                                <div className="space-y-2">
                                    <Label className="ds-label">Caption (optional)</Label>
                                    <Input value={videoCaption} onChange={(e) => setVideoCaption(e.target.value)} />
                                </div>
                            </>
                        )}

                        {sendType === 'vcard' && (
                            <>
                                <div className="space-y-2">
                                    <Label className="ds-label">Contact Name</Label>
                                    <Input value={vcardName} onChange={(e) => setVcardName(e.target.value)} placeholder="John Doe" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="ds-label">Phone (digits)</Label>
                                    <Input value={vcardPhone} onChange={(e) => setVcardPhone(e.target.value)} placeholder={botPhone} className="font-mono" />
                                </div>
                            </>
                        )}

                        {sendType === 'reaction' && (
                            <>
                                <div className="space-y-2">
                                    <Label className="ds-label">Message ID (ambil dari Logs tab)</Label>
                                    <Input value={reactionMsgId} onChange={(e) => setReactionMsgId(e.target.value)} placeholder="3EB0…" className="font-mono" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="ds-label">Emoji</Label>
                                    <Input value={reactionEmoji} onChange={(e) => setReactionEmoji(e.target.value)} className="w-24" />
                                </div>
                            </>
                        )}

                        {sendType === 'seen' && (
                            <div className="space-y-2">
                                <Label className="ds-label">Message ID to mark as read</Label>
                                <Input value={seenMsgId} onChange={(e) => setSeenMsgId(e.target.value)} className="font-mono" />
                            </div>
                        )}

                        {(sendType === 'typing-on' || sendType === 'typing-off') && (
                            <Alert className="border-border/30 bg-muted/5">
                                <AlertDescription className="ds-small">
                                    {sendType === 'typing-on' ? 'Show "typing…" indicator to chat.' : 'Stop "typing…" indicator.'}
                                    Gak butuh field lain — cukup Target chat + Send.
                                </AlertDescription>
                            </Alert>
                        )}

                        {sendType === 'poll' && (
                            <>
                                <div className="space-y-2">
                                    <Label className="ds-label">Question</Label>
                                    <Input value={pollQuestion} onChange={(e) => setPollQuestion(e.target.value)} placeholder="Mau makan apa?" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="ds-label">Options (1 per line, min 2)</Label>
                                    <Textarea value={pollOptionsText} onChange={(e) => setPollOptionsText(e.target.value)} rows={4} className="font-mono" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="ds-label">Selectable count</Label>
                                    <Input type="number" min={1} value={pollSelectableCount} onChange={(e) => setPollSelectableCount(e.target.value)} className="w-24" />
                                </div>
                            </>
                        )}

                        {sendType === 'list' && (
                            <>
                                <div className="space-y-2">
                                    <Label className="ds-label">Title (optional)</Label>
                                    <Input value={listTitle} onChange={(e) => setListTitle(e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label className="ds-label">Body Text</Label>
                                    <Textarea value={listText} onChange={(e) => setListText(e.target.value)} rows={3} />
                                </div>
                                <div className="space-y-2">
                                    <Label className="ds-label">Button Text</Label>
                                    <Input value={listButtonText} onChange={(e) => setListButtonText(e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label className="ds-label">Sections (format di placeholder)</Label>
                                    <Textarea value={listSections} onChange={(e) => setListSections(e.target.value)} rows={6} className="font-mono text-xs" />
                                </div>
                            </>
                        )}

                        {sendType === 'buttons' && (
                            <>
                                <div className="space-y-2">
                                    <Label className="ds-label">Body Text</Label>
                                    <Textarea value={buttonText} onChange={(e) => setButtonText(e.target.value)} rows={3} />
                                </div>
                                <div className="space-y-2">
                                    <Label className="ds-label">Buttons (format: `label|id`, 1 per line)</Label>
                                    <Textarea value={buttonList} onChange={(e) => setButtonList(e.target.value)} rows={4} className="font-mono" />
                                </div>
                            </>
                        )}

                        {sendType === 'link-preview' && (
                            <>
                                <div className="space-y-2">
                                    <Label className="ds-label">URL</Label>
                                    <Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://example.com" className="font-mono" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="ds-label">Title (optional)</Label>
                                    <Input value={linkTitle} onChange={(e) => setLinkTitle(e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label className="ds-label">Description (optional)</Label>
                                    <Textarea value={linkDesc} onChange={(e) => setLinkDesc(e.target.value)} rows={2} />
                                </div>
                            </>
                        )}
                    </div>

                    <Button onClick={handleSend} disabled={sending || !readyToSend} className="w-full">
                        {sending ? <Loader2 className="animate-spin" /> : <Send />}
                        {sending ? 'Sending…' : `Send ${TYPE_META[sendType].label}`}
                    </Button>

                    {lastResult && (
                        <Alert className={lastResult.ok ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-red-500/30 bg-red-500/5'}>
                            {lastResult.ok ? <CheckCircle2 className="text-emerald-400" /> : <AlertCircle className="text-red-400" />}
                            <AlertDescription className="ds-body">
                                {lastResult.ok ? 'Send OK' : 'Send failed'} · <span className="ds-small text-muted-foreground">{lastResult.ts}</span>
                                {lastResult.messageId && <div className="ds-small text-muted-foreground font-mono break-all mt-1">msgId: {lastResult.messageId}</div>}
                            </AlertDescription>
                        </Alert>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

const TabSendTest = memo(TabSendTestImpl, (prev, next) =>
    prev.config === next.config && prev.showFeedback === next.showFeedback);
export default TabSendTest;
