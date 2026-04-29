"use client";

/**
 * Tab Docs — WaGate OpenAPI spec + command reference.
 * WaGate internal ingress tidak bisa di-iframe langsung dari browser,
 * jadi tab ini tampilkan static reference + copy-able curl examples.
 * Shadcn: Tabs, Card, Button, Badge, ScrollArea.
 */

import { useState, memo } from 'react';
import { BookOpen, Copy, Check, ExternalLink, Server } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';

const ENDPOINTS = [
    { group: 'Session', method: 'GET', path: '/api/sessions/:name', desc: 'Connection status + engine info + bot identity' },
    { group: 'Session', method: 'GET', path: '/api/sessions/:name/me', desc: 'Bot identity (id, phone, pushName, platform)' },
    { group: 'Session', method: 'POST', path: '/api/sessions/:name/restart', desc: 'Soft restart WS, keep auth state' },
    { group: 'Session', method: 'POST', path: '/api/sessions/:name/logout', desc: 'Logout + clear auth state (GCS FUSE)' },
    { group: 'Session', method: 'GET', path: '/api/auth/qr', desc: 'Fetch QR code untuk pairing (base64 data URI)' },
    { group: 'Send', method: 'POST', path: '/api/sendText', desc: 'Send text message' },
    { group: 'Send', method: 'POST', path: '/api/sendImage', desc: 'Send image (base64 data or URL) dengan caption optional' },
    { group: 'Send', method: 'POST', path: '/api/sendFile', desc: 'Send document/PDF/Excel dengan filename wajib' },
    { group: 'Send', method: 'POST', path: '/api/sendLocation', desc: 'Send location card (lat/lng + name/address optional)' },
    { group: 'Groups', method: 'GET', path: '/api/groups', desc: 'List semua grup bot member' },
    { group: 'Groups', method: 'GET', path: '/api/groups/:chatId', desc: 'Detail grup + participants + admin list' },
    { group: 'Ops', method: 'GET', path: '/ping', desc: 'Liveness probe (no auth, <50ms)' },
    { group: 'Ops', method: 'GET', path: '/healthz', desc: 'Deep health check (WS state, auth valid, GCS mount)' },
    { group: 'Ops', method: 'GET', path: '/version', desc: 'WaGate + Baileys + Node version' },
];

const WEBHOOK_EVENTS = [
    { event: 'message', trigger: 'Pesan masuk di grup/chat (inbound)' },
    { event: 'message.ack', trigger: 'Status update ACK (sent → delivered → read)' },
    { event: 'session.status', trigger: 'Connection state change (CONNECTING/WORKING/FAILED)' },
    { event: 'session.qr', trigger: 'QR code baru digenerate (saat pairing)' },
    { event: 'group.v2.join', trigger: 'Bot ditambah ke grup' },
    { event: 'group.v2.leave', trigger: 'Bot dikeluarkan dari grup' },
    { event: 'group.v2.participants', trigger: 'Member add/remove di grup' },
];

/** Build curl examples dinamis dari config — zero hardcode URL/project ID/admin key. */
function buildCurlExamples(dispatchBaseUrl: string, projectId: string): Record<string, string> {
    const base = dispatchBaseUrl || '<DISPATCH_URL>';
    const proj = projectId || '<PROJECT_ID>';
    return {
        status: `ADMIN_KEY=$(gcloud secrets versions access latest \\
  --secret=dispatch-admin-key --project=${proj})

curl -sS -X POST \\
  -H "X-Admin-Key: $ADMIN_KEY" \\
  ${base}/admin/wagate/status`,
        qr: `curl -sS -X POST \\
  -H "X-Admin-Key: $ADMIN_KEY" \\
  ${base}/admin/wagate/qr
# Response: { "qr": "data:image/png;base64,...", "qr_text": "1@...", "expires_in_sec": 60 }`,
        sendText: `curl -sS -X POST \\
  -H "X-Admin-Key: $ADMIN_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"chatId":"<CHAT_ID>@g.us","text":"Hello from Dashboard"}' \\
  ${base}/admin/wagate/test-send`,
        sendImage: `# base64-encode image client-side first, then:
curl -sS -X POST \\
  -H "X-Admin-Key: $ADMIN_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "chatId":"<CHAT_ID>@g.us",
    "file":{"mimetype":"image/png","data":"iVBORw0KGgo...","filename":"image.png"},
    "caption":"Optional caption"
  }' \\
  ${base}/admin/wagate/send-image`,
        logs: `gcloud logging read \\
  'resource.type=cloud_run_revision AND resource.labels.service_name=wagate' \\
  --project=${proj} --freshness=5m --limit=30`,
    };
}

interface TabDocsProps {
    /** Config dari FS — berisi infra_url, infra_project_id Dispatch */
    dispatchInfo?: { url?: string; projectId?: string };
}

export default function TabDocs({ dispatchInfo }: TabDocsProps = {}) {
    const [copied, setCopied] = useState<string | null>(null);

    const CURL_EXAMPLES = buildCurlExamples(
        dispatchInfo?.url || '',
        dispatchInfo?.projectId || '',
    );

    async function handleCopy(text: string, key: string) {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(key);
            setTimeout(() => setCopied(null), 2000);
        } catch {
            /* ignore */
        }
    }

    function MethodBadge({ method }: { method: string }) {
        const color =
            method === 'GET' ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' :
            method === 'POST' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
            method === 'DELETE' ? 'bg-red-500/10 text-red-400 border-red-500/30' :
            'bg-muted/10 text-muted-foreground border-border/30';
        return <Badge variant="outline" className={`${color} ds-data`}>{method}</Badge>;
    }

    function CodeBlock({ code, keyName }: { code: string; keyName: string }) {
        return (
            <div className="relative rounded-md border border-border/50 bg-muted/5">
                <pre className="ds-data text-xs p-4 overflow-x-auto leading-relaxed">
                    <code>{code}</code>
                </pre>
                <Button
                    variant="ghost"
                    size="icon-sm"
                    className="absolute top-2 right-2"
                    onClick={() => handleCopy(code, keyName)}
                >
                    {copied === keyName ? <Check className="text-emerald-400" /> : <Copy />}
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <BookOpen className="h-5 w-5 text-blue-400" />
                        <div>
                            <CardTitle className="ds-title">WaGate API Reference</CardTitle>
                            <CardDescription className="ds-small">
                                Tier 1 MVP · 13 endpoints · 7 webhook events
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap items-center gap-3">
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                            BAILEYS 6.7.x
                        </Badge>
                        <Badge variant="outline">ingress=internal</Badge>
                        <Badge variant="outline">HMAC SHA-512</Badge>
                        <Badge variant="outline">VPC + ID token auth</Badge>
                        <Button variant="outline" size="sm" asChild>
                            <a href="https://github.com/WhiskeySockets/Baileys" target="_blank" rel="noopener noreferrer">
                                <ExternalLink />
                                Baileys Docs
                            </a>
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Tabs defaultValue="endpoints" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="endpoints"><Server />Endpoints</TabsTrigger>
                    <TabsTrigger value="webhooks"><BookOpen />Webhook Events</TabsTrigger>
                    <TabsTrigger value="curl"><Copy />cURL Examples</TabsTrigger>
                </TabsList>

                <TabsContent value="endpoints">
                    <Card>
                        <CardHeader>
                            <CardTitle className="ds-title">HTTP Endpoints</CardTitle>
                            <CardDescription className="ds-small">
                                Semua endpoint require X-Api-Key + ID token (via Dispatch admin proxy)
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ScrollArea className="h-[500px] pr-2">
                                <div className="space-y-3">
                                    {['Session', 'Send', 'Groups', 'Ops'].map(group => (
                                        <div key={group} className="space-y-2">
                                            <div className="ds-label uppercase tracking-wider text-muted-foreground">{group}</div>
                                            <div className="space-y-1.5">
                                                {ENDPOINTS.filter(e => e.group === group).map((e, i) => (
                                                    <div key={i} className="flex items-start gap-3 rounded-md border border-border/30 bg-muted/5 p-3">
                                                        <MethodBadge method={e.method} />
                                                        <div className="min-w-0 flex-1">
                                                            <div className="ds-data break-all">{e.path}</div>
                                                            <div className="ds-small mt-0.5">{e.desc}</div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="webhooks">
                    <Card>
                        <CardHeader>
                            <CardTitle className="ds-title">Webhook Events (fire ke Dispatch)</CardTitle>
                            <CardDescription className="ds-small">
                                WaGate POST ke ${'${DISPATCH_WEBHOOK_URL}/webhook'} dengan HMAC SHA-512 di header X-Webhook-Hmac
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-1.5">
                                {WEBHOOK_EVENTS.map((e, i) => (
                                    <div key={i} className="flex items-start gap-3 rounded-md border border-border/30 bg-muted/5 p-3">
                                        <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30 ds-data">
                                            {e.event}
                                        </Badge>
                                        <div className="ds-small flex-1">{e.trigger}</div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="curl" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="ds-title">Get Session Status</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <CodeBlock code={CURL_EXAMPLES.status} keyName="status" />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="ds-title">Fetch QR Code</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <CodeBlock code={CURL_EXAMPLES.qr} keyName="qr" />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="ds-title">Send Text</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <CodeBlock code={CURL_EXAMPLES.sendText} keyName="sendText" />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="ds-title">Send Image</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <CodeBlock code={CURL_EXAMPLES.sendImage} keyName="sendImage" />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="ds-title">View Logs</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <CodeBlock code={CURL_EXAMPLES.logs} keyName="logs" />
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
