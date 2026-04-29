/**
 * DesignDictionary — Live visual reference for Dashboard PLN UPT Bogor.
 *
 * Setiap section menampilkan contoh HIDUP — bukan teks definisi,
 * tapi komponen yang bisa dilihat, di-hover, dan di-klik langsung.
 *
 * Sections:
 *  1. Color Palette — swatch warna dari CSS tokens + status colors
 *  2. Typography — semua ds-* classes rendered live
 *  3. Components — shadcn/ui components showcase
 *  4. Interactions — hover, active, dimmed, transition demos
 *  5. Layout — grid, flex, spacing, responsive demos
 *  6. Chart — mini ECharts donut + bar
 */
"use client";

import { useState } from "react";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs";
import {
    Palette,
    Type,
    Component,
    MousePointerClick,
    LayoutGrid,
    BarChart3,
    Layers,
    Boxes,
    Search,
    ChevronRight,
    Check,
    AlertTriangle,
    Info,
    X,
    Plus,
    Settings,
    Zap,
} from "lucide-react";
import { StatusKpiBar1 } from "@/components/shared/StatusKpiBar1";
import { SummaryCard1 } from "@/components/shared/SummaryCard1";
import { ProgressBar1 } from "@/components/shared/ProgressBar1";

/* ══════════════════════════════════════════════════════════════
 * Section wrapper — consistent spacing + anchor
 * ══════════════════════════════════════════════════════════════ */
function Section({
    id,
    title,
    description,
    icon: Icon,
    children,
}: {
    id: string;
    title: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    children: React.ReactNode;
}) {
    return (
        <section id={id} className="scroll-mt-6">
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2.5">
                        <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary/10 text-primary">
                            <Icon className="h-4 w-4" />
                        </div>
                        <div>
                            <CardTitle>{title}</CardTitle>
                            <CardDescription className="ds-body mt-0.5">
                                {description}
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">{children}</CardContent>
            </Card>
        </section>
    );
}

/* Label for sub-sections */
function SubLabel({ children }: { children: React.ReactNode }) {
    return <h3 className="ds-small mb-2">{children}</h3>;
}

/* Code snippet display */
function Code({ children }: { children: string }) {
    return (
        <code className="text-[11px] font-mono bg-muted/50 text-muted-foreground px-1.5 py-0.5 rounded">
            {children}
        </code>
    );
}

/* ══════════════════════════════════════════════════════════════
 * 1. COLOR PALETTE
 * ══════════════════════════════════════════════════════════════ */
const CSS_COLORS = [
    { name: "background", label: "Background", desc: "Warna dasar halaman" },
    { name: "foreground", label: "Foreground", desc: "Warna teks utama" },
    { name: "card", label: "Card", desc: "Background kartu" },
    { name: "primary", label: "Primary", desc: "Warna aksen utama (tombol, link)" },
    { name: "secondary", label: "Secondary", desc: "Warna aksen sekunder" },
    { name: "muted", label: "Muted", desc: "Background elemen subtle" },
    { name: "muted-foreground", label: "Muted Foreground", desc: "Teks sekunder/redup" },
    { name: "accent", label: "Accent", desc: "Background hover sidebar/menu" },
    { name: "destructive", label: "Destructive", desc: "Warna bahaya/error (merah)" },
    { name: "border", label: "Border", desc: "Garis pembatas elemen" },
    { name: "ring", label: "Ring", desc: "Outline focus elemen interaktif" },
];

const STATUS_COLORS = [
    { name: "Very Good", color: "#22C55E", desc: "Kondisi terbaik" },
    { name: "Good", color: "#3B82F6", desc: "Kondisi baik" },
    { name: "Fair", color: "#EAB308", desc: "Kondisi sedang" },
    { name: "Poor", color: "#F97316", desc: "Kondisi buruk" },
    { name: "Critical", color: "#EF4444", desc: "Kondisi kritis" },
];

const CHART_COLORS = [
    { name: "Blue", color: "#3B82F6" },
    { name: "Amber", color: "#F59E0B" },
    { name: "Violet", color: "#8B5CF6" },
    { name: "Cyan", color: "#06B6D4" },
    { name: "Pink", color: "#EC4899" },
];

function ColorPaletteSection() {
    return (
        <Section
            id="colors"
            title="Color Palette"
            description="Semua warna menggunakan CSS token — otomatis berubah saat switch dark/light mode."
            icon={Palette}
        >
            {/* CSS Token Colors */}
            <div>
                <SubLabel>CSS Color Tokens</SubLabel>
                <p className="ds-small mb-3">
                    Warna dari <Code>var(--nama)</Code> di globals.css — berubah otomatis sesuai theme.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                    {CSS_COLORS.map((c) => (
                        <div
                            key={c.name}
                            className="rounded-lg border border-border/40 overflow-hidden"
                        >
                            <div
                                className="h-12 border-b border-border/30"
                                style={{ backgroundColor: `var(--${c.name})` }}
                            />
                            <div className="px-3 py-2">
                                <span className="ds-label block">{c.label}</span>
                                <span className="ds-small block">
                                    <Code>{`var(--${c.name})`}</Code>
                                </span>
                                <span className="ds-small block mt-0.5">{c.desc}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <Separator />

            {/* Status Colors */}
            <div>
                <SubLabel>Status Colors — Healthy Index</SubLabel>
                <p className="ds-small mb-3">
                    5 warna status dari design-tokens.ts. Hanya untuk DATA, bukan dekorasi.
                </p>
                <div className="flex gap-2 flex-wrap">
                    {STATUS_COLORS.map((s) => (
                        <div key={s.name} className="flex items-center gap-2 rounded-lg border border-border/30 px-3 py-2 min-w-[140px]">
                            <div
                                className="h-6 w-6 rounded-md shrink-0"
                                style={{ backgroundColor: s.color }}
                            />
                            <div>
                                <span className="ds-label block">{s.name}</span>
                                <span className="ds-small font-mono">{s.color}</span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Live segmented bar */}
                <div className="mt-4">
                    <span className="ds-small block mb-1.5">Contoh: Segmented Bar</span>
                    <div className="flex h-8 rounded-md overflow-hidden gap-0.5">
                        {[
                            { color: "#EF4444", pct: 3.4 },
                            { color: "#F97316", pct: 2.5 },
                            { color: "#EAB308", pct: 7.4 },
                            { color: "#3B82F6", pct: 18.1 },
                            { color: "#22C55E", pct: 68.6 },
                        ].map((seg, i) => (
                            <div
                                key={i}
                                className="h-full flex items-center justify-center"
                                style={{
                                    width: `${Math.max(seg.pct, 3)}%`,
                                    backgroundColor: seg.color,
                                }}
                            >
                                <span className="ds-overlay px-1 drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">
                                    {seg.pct}%
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <Separator />

            {/* Chart Palette */}
            <div>
                <SubLabel>Chart Palette</SubLabel>
                <p className="ds-small mb-3">
                    5 warna untuk data visualisasi (bukan status). Mudah dibedakan satu sama lain.
                </p>
                <div className="flex gap-3">
                    {CHART_COLORS.map((c) => (
                        <div key={c.name} className="text-center">
                            <div
                                className="h-10 w-10 rounded-full mx-auto mb-1"
                                style={{ backgroundColor: c.color }}
                            />
                            <span className="ds-small">{c.name}</span>
                            <span className="ds-small block font-mono">{c.color}</span>
                        </div>
                    ))}
                </div>
            </div>
        </Section>
    );
}

/* ══════════════════════════════════════════════════════════════
 * 2. TYPOGRAPHY
 * ══════════════════════════════════════════════════════════════ */
const DS_TYPO = [
    { cls: "ds-heading", label: "ds-heading", text: "Healthy Index MTU", spec: "24px · Bold · Tracking tight" },
    { cls: "ds-title", label: "ds-title", text: "Status Healthy Index", spec: "16px · Semibold" },
    { cls: "ds-label", label: "ds-label", text: "Very Good", spec: "14px · Medium" },
    { cls: "ds-body", label: "ds-body", text: "Evaluasi kondisi MTU Gardu Induk berdasarkan Healthy Index.", spec: "14px · Normal · Muted" },
    { cls: "ds-small", label: "ds-small", text: "Critical Ratio", spec: "12px · Semibold · UPPERCASE · Tracking wider · Foreground/70" },
    { cls: "ds-small", label: "ds-small", text: "50 unit · Halaman 1 dari 12", spec: "12px · Normal · Muted" },
];

const DS_DATA_TYPO = [
    { cls: "ds-kpi", label: "ds-kpi", text: "3.249", spec: "28px · Extrabold · Mono · Tabular" },
    { cls: "ds-data", label: "ds-data", text: "2.057", spec: "14px · Mono · Tabular" },
    { cls: "ds-data", label: "ds-data", text: "68.9%", spec: "12px · Bold · Mono" },
    { cls: "ds-overlay", label: "ds-overlay", text: "24.5%", spec: "12px · Bold · White (di atas warna)" },
];

function TypographySection() {
    return (
        <Section
            id="typography"
            title="Typography"
            description="Semua ds-* classes dari globals.css — rendered live. Copy class name langsung ke komponen."
            icon={Type}
        >
            {/* Structural Typography */}
            <div>
                <SubLabel>Structural — Judul, Label, Body</SubLabel>
                <div className="space-y-4">
                    {DS_TYPO.map((t) => (
                        <div key={t.cls} className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-4 pb-3 border-b border-border/20 last:border-0">
                            <div className="shrink-0 w-32">
                                <Code>{t.cls}</Code>
                            </div>
                            <div className="flex-1">
                                <span className={t.cls}>{t.text}</span>
                            </div>
                            <span className="ds-small shrink-0">{t.spec}</span>
                        </div>
                    ))}
                </div>
            </div>

            <Separator />

            {/* Data Typography */}
            <div>
                <SubLabel>Data — Angka, KPI, Badge</SubLabel>
                <p className="ds-small mb-3">
                    Semua pakai <Code>font-mono</Code> + <Code>tabular-nums</Code> supaya angka rata dan sejajar.
                </p>
                <div className="space-y-4">
                    {DS_DATA_TYPO.map((t) => (
                        <div key={t.cls} className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-4 pb-3 border-b border-border/20 last:border-0">
                            <div className="shrink-0 w-32">
                                <Code>{t.cls}</Code>
                            </div>
                            <div className="flex-1">
                                {t.cls === "ds-overlay" ? (
                                    <span className="inline-flex items-center px-3 py-1 rounded" style={{ backgroundColor: "#3B82F6" }}>
                                        <span className={t.cls}>{t.text}</span>
                                    </span>
                                ) : (
                                    <span className={t.cls}>{t.text}</span>
                                )}
                            </div>
                            <span className="ds-small shrink-0">{t.spec}</span>
                        </div>
                    ))}
                </div>
            </div>

            <Separator />

            {/* Tabular nums demo */}
            <div>
                <SubLabel>Tabular Nums — Kenapa Penting</SubLabel>
                <p className="ds-small mb-3">
                    Dengan <Code>tabular-nums</Code>, semua digit punya lebar sama. Kolom angka jadi rata sempurna.
                </p>
                <div className="grid grid-cols-2 gap-8 max-w-sm">
                    <div>
                        <span className="ds-small block mb-2">Tanpa tabular-nums</span>
                        <div className="space-y-0.5 text-right text-[13px]" style={{ fontVariantNumeric: "proportional-nums" }}>
                            <div>1.137</div>
                            <div>588</div>
                            <div>239</div>
                            <div>82</div>
                            <div>3.249</div>
                        </div>
                    </div>
                    <div>
                        <span className="ds-small block mb-2">Dengan tabular-nums</span>
                        <div className="space-y-0.5 text-right">
                            <div className="ds-data">1.137</div>
                            <div className="ds-data">588</div>
                            <div className="ds-data">239</div>
                            <div className="ds-data">82</div>
                            <div className="ds-data">3.249</div>
                        </div>
                    </div>
                </div>
            </div>
        </Section>
    );
}

/* ══════════════════════════════════════════════════════════════
 * 3. COMPONENTS — shadcn/ui showcase
 * ══════════════════════════════════════════════════════════════ */
function ComponentsSection() {
    const [switchOn, setSwitchOn] = useState(false);
    const [inputVal, setInputVal] = useState("");

    return (
        <Section
            id="components"
            title="shadcn/ui Components"
            description="Komponen dari src/components/ui/ — fondasi visual seluruh dashboard. Semua bisa di-klik dan di-hover."
            icon={Component}
        >
            {/* Buttons */}
            <div>
                <SubLabel>Button</SubLabel>
                <p className="ds-small mb-3">
                    Import: <Code>{`import { Button } from "@/components/ui/button"`}</Code>
                </p>
                <div className="flex flex-wrap gap-2">
                    <Button variant="default" size="sm">
                        <Plus className="h-3.5 w-3.5" /> Default
                    </Button>
                    <Button variant="secondary" size="sm">Secondary</Button>
                    <Button variant="outline" size="sm">Outline</Button>
                    <Button variant="ghost" size="sm">Ghost</Button>
                    <Button variant="destructive" size="sm">
                        <AlertTriangle className="h-3.5 w-3.5" /> Destructive
                    </Button>
                    <Button variant="link" size="sm">Link</Button>
                    <Button variant="default" size="sm" disabled>Disabled</Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                    <span className="ds-small self-center mr-1">Sizes:</span>
                    <Button variant="outline" size="sm">Small</Button>
                    <Button variant="outline" size="default">Default</Button>
                    <Button variant="outline" size="lg">Large</Button>
                    <Button variant="outline" size="icon"><Settings className="h-4 w-4" /></Button>
                </div>
            </div>

            <Separator />

            {/* Custom Buttons (cc-btn) */}
            <div>
                <SubLabel>Custom Buttons — cc-btn</SubLabel>
                <p className="ds-small mb-3">
                    Class: <Code>cc-btn cc-btn-primary</Code> dan <Code>cc-btn cc-btn-secondary</Code> — dipakai di Cloud Console pages.
                </p>
                <div className="flex flex-wrap gap-2">
                    <button className="cc-btn cc-btn-primary">Primary</button>
                    <button className="cc-btn cc-btn-secondary">Secondary</button>
                    <button className="cc-btn cc-btn-primary" disabled>Disabled</button>
                </div>
            </div>

            <Separator />

            {/* Badge */}
            <div>
                <SubLabel>Badge</SubLabel>
                <p className="ds-small mb-3">
                    Import: <Code>{`import { Badge } from "@/components/ui/badge"`}</Code>
                </p>
                <div className="flex flex-wrap gap-2">
                    <Badge variant="default">Default</Badge>
                    <Badge variant="secondary">Secondary</Badge>
                    <Badge variant="outline">Outline</Badge>
                    <Badge variant="destructive">Destructive</Badge>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                    <span className="ds-small self-center mr-1">Status pakai warna:</span>
                    {STATUS_COLORS.map((s) => (
                        <span
                            key={s.name}
                            className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-bold font-mono text-white"
                            style={{ backgroundColor: s.color }}
                        >
                            {s.name}
                        </span>
                    ))}
                </div>
            </div>

            <Separator />

            {/* Card */}
            <div>
                <SubLabel>Card — Stripe Elevated</SubLabel>
                <p className="ds-small mb-3">
                    Card dengan subtle shadow. Hover untuk lihat efek elevation naik.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Card>
                        <CardHeader>
                            <CardTitle>Card Default</CardTitle>
                            <CardDescription>Shadow tipis, border halus</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <span className="ds-kpi">1.234</span>
                            <span className="ds-small block mt-1">Hover untuk shadow lebih dalam</span>
                        </CardContent>
                    </Card>
                    <Card className="border-primary/40 bg-primary/5">
                        <CardHeader>
                            <CardTitle>Card Active</CardTitle>
                            <CardDescription>Border primary, tint background</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <span className="ds-kpi text-primary">5.678</span>
                            <span className="ds-small block mt-1">State saat terpilih</span>
                        </CardContent>
                    </Card>
                    <Card className="border-border/30">
                        <CardHeader>
                            <CardTitle>Card with Left Accent</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex overflow-hidden rounded-md border border-border/30">
                                <div className="w-[3px] shrink-0" style={{ backgroundColor: "#22C55E" }} />
                                <div className="px-3 py-2">
                                    <span className="ds-label">Very Good</span>
                                    <div className="flex items-baseline gap-2">
                                        <span className="ds-kpi text-[20px]">2.239</span>
                                        <span className="ds-data text-muted-foreground">68.9%</span>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            <Separator />

            {/* Input, Switch, Progress */}
            <div>
                <SubLabel>Input, Switch, Progress</SubLabel>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    <div className="space-y-2">
                        <span className="ds-label block">Input</span>
                        <Input
                            placeholder="Ketik sesuatu..."
                            value={inputVal}
                            onChange={(e) => setInputVal(e.target.value)}
                        />
                        <input
                            className="cc-input w-full"
                            placeholder="cc-input style"
                        />
                    </div>
                    <div className="space-y-2">
                        <span className="ds-label block">Switch</span>
                        <div className="flex items-center gap-2">
                            <Switch checked={switchOn} onCheckedChange={setSwitchOn} />
                            <span className="ds-small">{switchOn ? "On" : "Off"}</span>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <span className="ds-label block">Progress</span>
                        <Progress value={68.9} className="h-2" />
                        <span className="ds-small">68.9%</span>
                    </div>
                </div>
            </div>

            <Separator />

            {/* Skeleton */}
            <div>
                <SubLabel>Skeleton — Loading State</SubLabel>
                <p className="ds-small mb-3">
                    Placeholder saat data belum dimuat. Animasi pulse memberi kesan &quot;sedang loading&quot;.
                </p>
                <div className="flex gap-3">
                    <div className="rounded-lg border border-border/30 px-4 py-3 w-48 space-y-2">
                        <Skeleton className="h-3 w-20" />
                        <Skeleton className="h-7 w-16" />
                        <Skeleton className="h-1.5 w-full rounded-full" />
                    </div>
                    <div className="rounded-lg border border-border/30 px-4 py-3 w-48 space-y-2">
                        <Skeleton className="h-3 w-24" />
                        <Skeleton className="h-7 w-12" />
                        <Skeleton className="h-1.5 w-3/4 rounded-full" />
                    </div>
                </div>
            </div>

            <Separator />

            {/* Table */}
            <div>
                <SubLabel>Table</SubLabel>
                <p className="ds-small mb-3">
                    Import: <Code>{`import { Table, TableHeader, TableRow, ... } from "@/components/ui/table"`}</Code>
                </p>
                <div className="rounded-lg border border-border/30 overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="ds-small">No</TableHead>
                                <TableHead className="ds-small">Gardu Induk</TableHead>
                                <TableHead className="ds-small">MTU</TableHead>
                                <TableHead className="ds-small text-right">Total</TableHead>
                                <TableHead className="ds-small">Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {[
                                { no: 1, gi: "Cibinong", mtu: "TRAFO", total: 245, status: "Very Good", color: "#22C55E" },
                                { no: 2, gi: "Depok Baru", mtu: "PMT", total: 182, status: "Good", color: "#3B82F6" },
                                { no: 3, gi: "Gunung Putri", mtu: "KOPEL", total: 67, status: "Fair", color: "#EAB308" },
                            ].map((row) => (
                                <TableRow key={row.no}>
                                    <TableCell className="ds-data">{row.no}</TableCell>
                                    <TableCell className="ds-label">{row.gi}</TableCell>
                                    <TableCell className="ds-label">{row.mtu}</TableCell>
                                    <TableCell className="ds-data text-right">{row.total.toLocaleString("id-ID")}</TableCell>
                                    <TableCell>
                                        <span
                                            className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold font-mono text-white"
                                            style={{ backgroundColor: row.color }}
                                        >
                                            {row.status}
                                        </span>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </div>

            <Separator />

            {/* Tabs */}
            <div>
                <SubLabel>Tabs</SubLabel>
                <Tabs defaultValue="overview">
                    <TabsList>
                        <TabsTrigger value="overview">Overview</TabsTrigger>
                        <TabsTrigger value="detail">Detail</TabsTrigger>
                        <TabsTrigger value="chart">Chart</TabsTrigger>
                    </TabsList>
                    <TabsContent value="overview">
                        <div className="rounded-lg border border-border/30 px-4 py-3">
                            <span className="ds-body">Konten tab Overview — section utama.</span>
                        </div>
                    </TabsContent>
                    <TabsContent value="detail">
                        <div className="rounded-lg border border-border/30 px-4 py-3">
                            <span className="ds-body">Konten tab Detail — data lengkap.</span>
                        </div>
                    </TabsContent>
                    <TabsContent value="chart">
                        <div className="rounded-lg border border-border/30 px-4 py-3">
                            <span className="ds-body">Konten tab Chart — visualisasi data.</span>
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </Section>
    );
}

/* ══════════════════════════════════════════════════════════════
 * 4. INTERACTIONS — hover, active, dimmed, transition
 * ══════════════════════════════════════════════════════════════ */
function InteractionsSection() {
    const [activeCard, setActiveCard] = useState<string | null>(null);
    const [hoveredCard, setHoveredCard] = useState<string | null>(null);

    const items = [
        { key: "VG", label: "Very Good", count: 2239, pct: 68.9, color: "#22C55E" },
        { key: "G", label: "Good", count: 588, pct: 18.1, color: "#3B82F6" },
        { key: "F", label: "Fair", count: 239, pct: 7.4, color: "#EAB308" },
        { key: "P", label: "Poor", count: 82, pct: 2.5, color: "#F97316" },
        { key: "C", label: "Critical", count: 110, pct: 3.4, color: "#EF4444" },
    ];

    const anyActive = activeCard != null;

    return (
        <Section
            id="interactions"
            title="Interactions & States"
            description="Klik card di bawah untuk lihat semua state: default, hover, active, dimmed. Klik lagi untuk reset."
            icon={MousePointerClick}
        >
            {/* Interactive KPI cards */}
            <div>
                <SubLabel>Cross Filter Demo — Klik untuk Toggle</SubLabel>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    {items.map((item) => {
                        const isActive = activeCard === item.key;
                        const isHovered = hoveredCard === item.key;
                        const isDimmed = anyActive && !isActive;

                        return (
                            <button
                                key={item.key}
                                type="button"
                                onClick={() => setActiveCard(isActive ? null : item.key)}
                                onMouseEnter={() => setHoveredCard(item.key)}
                                onMouseLeave={() => setHoveredCard(null)}
                                className="rounded-lg border text-left cursor-pointer ds-transition flex overflow-hidden"
                                style={{
                                    borderColor: isActive
                                        ? item.color
                                        : isHovered
                                        ? "var(--border)"
                                        : "rgba(148,163,184,0.12)",
                                    background: isActive
                                        ? `color-mix(in srgb, ${item.color} 6%, transparent)`
                                        : isHovered
                                        ? "var(--accent)"
                                        : "transparent",
                                    opacity: isDimmed ? 0.35 : 1,
                                    boxShadow: isActive
                                        ? "0 2px 8px rgba(0,0,0,0.15)"
                                        : "none",
                                }}
                            >
                                <div
                                    className="w-[3px] shrink-0 ds-transition-fast"
                                    style={{
                                        backgroundColor: item.color,
                                        opacity: isActive ? 1 : isDimmed ? 0.25 : 0.5,
                                    }}
                                />
                                <div className="px-3 py-2.5 flex flex-col gap-0.5 flex-1 min-w-0">
                                    <span className="ds-label text-muted-foreground">
                                        {item.label}
                                    </span>
                                    <div className="flex items-baseline justify-between gap-2">
                                        <span
                                            className="ds-kpi text-[20px]"
                                            style={{ color: isActive ? item.color : undefined }}
                                        >
                                            {item.count.toLocaleString("id-ID")}
                                        </span>
                                        <span className="ds-data text-muted-foreground">
                                            {item.pct}%
                                        </span>
                                    </div>
                                    <div className="h-1 rounded-full overflow-hidden bg-border/25 mt-0.5">
                                        <div
                                            className="h-full rounded-full ds-transition-fast"
                                            style={{
                                                width: `${item.pct}%`,
                                                backgroundColor: item.color,
                                                opacity: isActive ? 1 : 0.5,
                                            }}
                                        />
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
                <div className="mt-3 rounded-lg border border-border/20 px-4 py-2.5 bg-muted/20">
                    <span className="ds-small">
                        {activeCard
                            ? `Filter aktif: ${items.find(i => i.key === activeCard)?.label}. Card lain di-dim ke opacity 35%. Klik lagi untuk reset.`
                            : "Belum ada filter aktif. Klik salah satu card di atas."
                        }
                    </span>
                </div>
            </div>

            <Separator />

            {/* Transition speeds */}
            <div>
                <SubLabel>Transition Speeds</SubLabel>
                <p className="ds-small mb-3">
                    Hover tiap box untuk lihat perbedaan kecepatan transisi.
                </p>
                <div className="flex gap-3">
                    {[
                        { cls: "ds-transition-fast", label: "Fast", ms: "150ms" },
                        { cls: "ds-transition", label: "Standard", ms: "200ms" },
                        { cls: "ds-transition-slow", label: "Slow", ms: "300ms" },
                    ].map((t) => (
                        <div
                            key={t.cls}
                            className={`${t.cls} rounded-lg border border-border/30 px-4 py-3 cursor-pointer hover:bg-primary/10 hover:border-primary/40 hover:scale-105 text-center`}
                        >
                            <span className="ds-label block">{t.label}</span>
                            <Code>{t.cls}</Code>
                            <span className="ds-small block mt-1">{t.ms}</span>
                        </div>
                    ))}
                </div>
            </div>

            <Separator />

            {/* Elevation levels */}
            <div>
                <SubLabel>Elevation / Shadow Levels</SubLabel>
                <p className="ds-small mb-3">
                    Semakin tinggi elevation = semakin penting/interaktif.
                </p>
                <div className="flex gap-4">
                    {[
                        { label: "Flat", shadow: "none", desc: "Inline element" },
                        { label: "Resting", shadow: "0 1px 3px rgba(0,0,0,0.08)", desc: "Card default" },
                        { label: "Raised", shadow: "0 2px 8px rgba(0,0,0,0.12)", desc: "Card hover" },
                        { label: "Overlay", shadow: "0 4px 16px rgba(0,0,0,0.18)", desc: "Dropdown, modal" },
                    ].map((e) => (
                        <div
                            key={e.label}
                            className="rounded-lg border border-border/30 bg-card px-4 py-3 text-center flex-1"
                            style={{ boxShadow: e.shadow }}
                        >
                            <span className="ds-label block">{e.label}</span>
                            <span className="ds-small block mt-0.5">{e.desc}</span>
                        </div>
                    ))}
                </div>
            </div>
        </Section>
    );
}

/* ══════════════════════════════════════════════════════════════
 * 5. LAYOUT
 * ══════════════════════════════════════════════════════════════ */
function LayoutSection() {
    return (
        <Section
            id="layout"
            title="Layout & Spacing"
            description="Grid, Flex, Gap, Padding — semua pattern layout yang dipakai di dashboard."
            icon={LayoutGrid}
        >
            {/* Grid demo */}
            <div>
                <SubLabel>Grid — Responsive Columns</SubLabel>
                <p className="ds-small mb-3">
                    <Code>grid-cols-2 sm:grid-cols-3 lg:grid-cols-5</Code> — kolom berubah sesuai lebar layar.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                    {[1, 2, 3, 4, 5].map((n) => (
                        <div
                            key={n}
                            className="rounded-lg border border-dashed border-primary/30 bg-primary/5 px-3 py-4 text-center"
                        >
                            <span className="ds-data">{n}</span>
                        </div>
                    ))}
                </div>
            </div>

            <Separator />

            {/* Flex demo */}
            <div>
                <SubLabel>Flex — Justify & Align</SubLabel>
                <div className="space-y-3">
                    <div>
                        <span className="ds-small block mb-1"><Code>flex items-center justify-between</Code></span>
                        <div className="flex items-center justify-between rounded-lg border border-dashed border-border/40 px-4 py-2">
                            <span className="ds-label">Kiri</span>
                            <span className="ds-label">Kanan</span>
                        </div>
                    </div>
                    <div>
                        <span className="ds-small block mb-1"><Code>flex items-baseline gap-2</Code></span>
                        <div className="flex items-baseline gap-2 rounded-lg border border-dashed border-border/40 px-4 py-2">
                            <span className="ds-kpi text-[20px]">3.249</span>
                            <span className="ds-small">unit</span>
                        </div>
                    </div>
                    <div>
                        <span className="ds-small block mb-1"><Code>flex flex-col gap-1</Code></span>
                        <div className="flex flex-col gap-1 rounded-lg border border-dashed border-border/40 px-4 py-2 w-48">
                            <span className="ds-label">Label</span>
                            <span className="ds-kpi text-[20px]">1.234</span>
                            <span className="ds-small">deskripsi</span>
                        </div>
                    </div>
                </div>
            </div>

            <Separator />

            {/* Spacing scale */}
            <div>
                <SubLabel>Spacing Scale — Gap & Padding</SubLabel>
                <p className="ds-small mb-3">
                    Tailwind spacing: <Code>gap-1</Code> = 4px, <Code>gap-2</Code> = 8px, <Code>gap-3</Code> = 12px, <Code>gap-4</Code> = 16px
                </p>
                <div className="space-y-2">
                    {[
                        { val: "gap-1", px: "4px" },
                        { val: "gap-2", px: "8px" },
                        { val: "gap-3", px: "12px" },
                        { val: "gap-4", px: "16px" },
                        { val: "gap-6", px: "24px" },
                    ].map((g) => (
                        <div key={g.val} className="flex items-center gap-3">
                            <Code>{g.val}</Code>
                            <div
                                className="h-4 bg-primary/20 rounded"
                                style={{ width: g.px }}
                            />
                            <span className="ds-small">{g.px}</span>
                        </div>
                    ))}
                </div>
            </div>

            <Separator />

            {/* Breakpoints */}
            <div>
                <SubLabel>Responsive Breakpoints</SubLabel>
                <div className="overflow-hidden rounded-lg border border-border/30">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="ds-small">Prefix</TableHead>
                                <TableHead className="ds-small">Min Width</TableHead>
                                <TableHead className="ds-small">Device</TableHead>
                                <TableHead className="ds-small">Contoh</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {[
                                { prefix: "(none)", w: "< 640px", device: "HP portrait", ex: "grid-cols-2" },
                                { prefix: "sm:", w: "640px", device: "HP landscape", ex: "sm:grid-cols-3" },
                                { prefix: "md:", w: "768px", device: "Tablet", ex: "md:grid-cols-4" },
                                { prefix: "lg:", w: "1024px", device: "Laptop", ex: "lg:grid-cols-5" },
                                { prefix: "xl:", w: "1280px", device: "Desktop", ex: "xl:grid-cols-6" },
                            ].map((bp) => (
                                <TableRow key={bp.prefix}>
                                    <TableCell><Code>{bp.prefix}</Code></TableCell>
                                    <TableCell className="ds-data">{bp.w}</TableCell>
                                    <TableCell className="ds-label">{bp.device}</TableCell>
                                    <TableCell><Code>{bp.ex}</Code></TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </Section>
    );
}

/* ══════════════════════════════════════════════════════════════
 * 6. CHARTS — Mini visual examples
 * ══════════════════════════════════════════════════════════════ */
function ChartsSection() {
    return (
        <Section
            id="charts"
            title="Chart & Visualisasi"
            description="Pattern chart yang dipakai di dashboard — semua pakai ECharts. Ini contoh visual statis untuk referensi."
            icon={BarChart3}
        >
            {/* Segmented bar */}
            <div>
                <SubLabel>Segmented Bar (Critical Ratio)</SubLabel>
                <p className="ds-small mb-2">
                    Bar horizontal terpotong sesuai proporsi. Setiap segment menampilkan persentase.
                </p>
                <div className="flex h-10 rounded-md overflow-hidden gap-0.5">
                    {[
                        { color: "#EF4444", pct: 3.4, label: "Critical" },
                        { color: "#F97316", pct: 2.5, label: "Poor" },
                        { color: "#EAB308", pct: 7.4, label: "Fair" },
                        { color: "#3B82F6", pct: 18.1, label: "Good" },
                        { color: "#22C55E", pct: 68.6, label: "Very Good" },
                    ].map((seg, i) => (
                        <div
                            key={i}
                            className="h-full flex items-center justify-center relative group cursor-default"
                            style={{
                                width: `${Math.max(seg.pct, 3)}%`,
                                backgroundColor: seg.color,
                            }}
                            title={`${seg.label}: ${seg.pct}%`}
                        >
                            <span className="ds-overlay px-1 drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">
                                {seg.pct}%
                            </span>
                        </div>
                    ))}
                </div>
                <div className="flex gap-3 mt-2">
                    {[
                        { color: "#22C55E", label: "Very Good" },
                        { color: "#3B82F6", label: "Good" },
                        { color: "#EAB308", label: "Fair" },
                        { color: "#F97316", label: "Poor" },
                        { color: "#EF4444", label: "Critical" },
                    ].map((l) => (
                        <div key={l.label} className="flex items-center gap-1">
                            <div className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: l.color }} />
                            <span className="ds-small">{l.label}</span>
                        </div>
                    ))}
                </div>
            </div>

            <Separator />

            {/* Stacked bar per ULTG */}
            <div>
                <SubLabel>Stacked Horizontal Bar (Per ULTG)</SubLabel>
                <p className="ds-small mb-3">
                    Setiap baris = 1 ULTG. Segment di-stack horizontal.
                </p>
                <div className="space-y-2">
                    {[
                        { name: "BOGOR", data: [890, 210, 80, 15, 8] },
                        { name: "DEPOK", data: [650, 180, 70, 25, 12] },
                        { name: "SUKABUMI", data: [420, 98, 45, 22, 50] },
                    ].map((ultg) => {
                        const total = ultg.data.reduce((a, b) => a + b, 0);
                        const colors = ["#22C55E", "#3B82F6", "#EAB308", "#F97316", "#EF4444"];
                        return (
                            <div key={ultg.name} className="flex items-center gap-3">
                                <span className="ds-small w-24 text-right">{ultg.name}</span>
                                <div className="flex-1 flex h-6 rounded overflow-hidden gap-px">
                                    {ultg.data.map((val, i) => {
                                        const pct = (val / total) * 100;
                                        if (pct < 1) return null;
                                        return (
                                            <div
                                                key={i}
                                                className="h-full"
                                                style={{
                                                    width: `${pct}%`,
                                                    backgroundColor: colors[i],
                                                }}
                                                title={`${val}`}
                                            />
                                        );
                                    })}
                                </div>
                                <span className="ds-data w-12 text-right">{total.toLocaleString("id-ID")}</span>
                            </div>
                        );
                    })}
                </div>
            </div>

            <Separator />

            {/* Donut placeholder */}
            <div>
                <SubLabel>Donut Chart (ECharts)</SubLabel>
                <p className="ds-small mb-3">
                    Rendered oleh ECharts di <Code>&lt;canvas&gt;</Code>. Config di design-tokens.ts.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[
                        { title: "Status HI", center: "3.249", slices: [68.9, 18.1, 7.4, 2.5, 3.4] },
                        { title: "Prioritas", center: "3.249", slices: [42, 35, 23] },
                        { title: "Status Usia", center: "3.249", slices: [55, 30, 15] },
                    ].map((d) => {
                        const colors = d.slices.length === 5
                            ? ["#22C55E", "#3B82F6", "#EAB308", "#F97316", "#EF4444"]
                            : d.slices.length === 3
                            ? ["#22C55E", "#EAB308", "#EF4444"]
                            : ["#3B82F6", "#F59E0B", "#8B5CF6"];
                        return (
                            <div key={d.title} className="text-center">
                                <span className="ds-label block mb-3">{d.title}</span>
                                {/* CSS-only donut approximation */}
                                <div className="relative w-32 h-32 mx-auto">
                                    <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                                        {(() => {
                                            let offset = 0;
                                            const total = d.slices.reduce((a, b) => a + b, 0);
                                            return d.slices.map((val, i) => {
                                                const pct = (val / total) * 100;
                                                const circumference = Math.PI * 60; // r=30
                                                const strokeLen = (pct / 100) * circumference;
                                                const gapLen = circumference - strokeLen;
                                                const currentOffset = offset;
                                                offset += pct;
                                                return (
                                                    <circle
                                                        key={i}
                                                        cx="50"
                                                        cy="50"
                                                        r="30"
                                                        fill="none"
                                                        stroke={colors[i]}
                                                        strokeWidth="14"
                                                        strokeDasharray={`${strokeLen} ${gapLen}`}
                                                        strokeDashoffset={-(currentOffset / 100) * circumference}
                                                        className="ds-transition"
                                                    />
                                                );
                                            });
                                        })()}
                                    </svg>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <span className="ds-kpi text-[18px]">{d.center}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
                <p className="ds-small mt-3">
                    Config: <Code>innerRadius: &quot;44%&quot;</Code> &middot; <Code>outerRadius: &quot;78%&quot;</Code> &middot;
                    <Code>padAngle: 2</Code> &middot; <Code>borderRadius: 6</Code>
                </p>
            </div>

            <Separator />

            {/* Progress bar in card */}
            <div>
                <SubLabel>KPI Card with Progress Bar</SubLabel>
                <p className="ds-small mb-3">
                    Pattern: left accent + label + angka + thin progress bar.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    {[
                        { label: "Very Good", count: 2239, pct: 68.9, color: "#22C55E" },
                        { label: "Good", count: 588, pct: 18.1, color: "#3B82F6" },
                        { label: "Fair", count: 239, pct: 7.4, color: "#EAB308" },
                        { label: "Poor", count: 82, pct: 2.5, color: "#F97316" },
                        { label: "Critical", count: 110, pct: 3.4, color: "#EF4444" },
                    ].map((item) => (
                        <div
                            key={item.label}
                            className="rounded-lg border border-border/30 flex overflow-hidden"
                        >
                            <div className="w-[3px] shrink-0" style={{ backgroundColor: item.color }} />
                            <div className="px-3 py-2.5 flex flex-col gap-0.5 flex-1">
                                <span className="ds-label text-muted-foreground">{item.label}</span>
                                <div className="flex items-baseline justify-between gap-2">
                                    <span className="ds-kpi text-[18px]">
                                        {item.count.toLocaleString("id-ID")}
                                    </span>
                                    <span className="ds-data text-muted-foreground">{item.pct}%</span>
                                </div>
                                <div className="h-1 rounded-full overflow-hidden bg-border/25 mt-0.5">
                                    <div
                                        className="h-full rounded-full"
                                        style={{ width: `${item.pct}%`, backgroundColor: item.color }}
                                    />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </Section>
    );
}

/* ══════════════════════════════════════════════════════════════
 * 7. DESIGN TOKENS REFERENCE
 * ══════════════════════════════════════════════════════════════ */
function DesignTokensSection() {
    return (
        <Section
            id="tokens"
            title="Design Tokens & Architecture"
            description="Arsitektur 3-layer: shadcn (structural) + globals.css ds-* (typography) + design-tokens.ts (ECharts canvas)."
            icon={Layers}
        >
            {/* 3-layer architecture */}
            <div>
                <SubLabel>3-Layer Architecture</SubLabel>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                        {
                            layer: "Layer 1",
                            name: "shadcn/ui",
                            file: "src/components/ui/",
                            desc: "Komponen structural — Card, Button, Table, Badge, dll. Foundation.",
                            color: "#3B82F6",
                        },
                        {
                            layer: "Layer 2",
                            name: "globals.css ds-*",
                            file: "src/app/globals.css",
                            desc: "Typography classes + color tokens. Theme-aware via CSS variables.",
                            color: "#8B5CF6",
                        },
                        {
                            layer: "Layer 3",
                            name: "design-tokens.ts",
                            file: "_components/design-tokens.ts",
                            desc: "ECharts canvas values — hex colors, px sizes. Canvas tidak bisa pakai CSS var.",
                            color: "#F59E0B",
                        },
                    ].map((l) => (
                        <div
                            key={l.layer}
                            className="rounded-lg border border-border/30 overflow-hidden"
                        >
                            <div
                                className="px-3 py-2 flex items-center gap-2"
                                style={{ backgroundColor: `color-mix(in srgb, ${l.color} 10%, transparent)` }}
                            >
                                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: l.color }} />
                                <span className="ds-label">{l.layer}: {l.name}</span>
                            </div>
                            <div className="px-3 py-2.5">
                                <Code>{l.file}</Code>
                                <p className="ds-small mt-1.5">{l.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <Separator />

            {/* ECharts token reference */}
            <div>
                <SubLabel>ECharts Canvas Tokens</SubLabel>
                <p className="ds-small mb-3">
                    ECharts render ke <Code>&lt;canvas&gt;</Code> — tidak bisa pakai CSS variables.
                    Maka warna disimpan di <Code>ECHART_COLORS</Code> dan <Code>ECHART_FONT</Code>.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <span className="ds-label block mb-2">ECHART_COLORS.dark</span>
                        <div className="space-y-1.5">
                            {[
                                { key: "text", val: "#CBD5E1", desc: "Label, axis" },
                                { key: "textStrong", val: "#F8FAFC", desc: "Emphasis" },
                                { key: "textMuted", val: "#94A3B8", desc: "Secondary" },
                                { key: "cardBg", val: "#3B3B3B", desc: "Donut border (oklch 0.2435)" },
                                { key: "tooltipBg", val: "rgba(15,23,42,0.96)", desc: "Tooltip" },
                            ].map((t) => (
                                <div key={t.key} className="flex items-center gap-2">
                                    <div
                                        className="h-4 w-4 rounded border border-border/30 shrink-0"
                                        style={{ backgroundColor: t.val }}
                                    />
                                    <Code>{t.key}</Code>
                                    <span className="ds-small flex-1">{t.desc}</span>
                                    <span className="ds-small font-mono">{t.val.length > 20 ? t.val.slice(0, 18) + "..." : t.val}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div>
                        <span className="ds-label block mb-2">ECHART_FONT</span>
                        <div className="space-y-1.5">
                            {[
                                { key: "label", val: "12px", desc: "Axis, legend" },
                                { key: "tooltip", val: "12px", desc: "Tooltip body" },
                                { key: "data", val: "14px", desc: "Data labels" },
                                { key: "title", val: "16px", desc: "Chart title" },
                                { key: "kpi", val: "18px", desc: "Centre donut" },
                                { key: "hero", val: "28px", desc: "Large KPI" },
                            ].map((t) => (
                                <div key={t.key} className="flex items-center gap-2">
                                    <Code>{t.key}</Code>
                                    <span className="ds-data">{t.val}</span>
                                    <span className="ds-small flex-1">{t.desc}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <Separator />

            {/* File reference */}
            <div>
                <SubLabel>File Reference</SubLabel>
                <div className="space-y-1.5">
                    {[
                        { file: "src/app/globals.css", desc: "CSS variables, ds-* classes, card styles, transitions" },
                        { file: "src/components/ui/", desc: "shadcn/ui components — Card, Button, Table, Badge, dll" },
                        { file: "_components/design-tokens.ts", desc: "COLORS, ECHART_COLORS, ECHART_FONT, CHART presets" },
                        { file: "tailwind.config.ts", desc: "Tailwind config — font family, extended theme" },
                    ].map((f) => (
                        <div key={f.file} className="flex items-start gap-2">
                            <ChevronRight className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                            <div>
                                <Code>{f.file}</Code>
                                <span className="ds-small block">{f.desc}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </Section>
    );
}

/* ══════════════════════════════════════════════════════════════
 * NAV + MAIN EXPORT
 * ══════════════════════════════════════════════════════════════ */
/* ══════════════════════════════════════════════════════════════
 * 8. SHARED COMPONENTS — Reusable component library
 * ══════════════════════════════════════════════════════════════ */
function SharedComponentsSection() {
    const [statusFilter, setStatusFilter] = useState<string | null>(null);
    const [doneFilter1, setDoneFilter1] = useState<boolean | null>(null);
    const [doneFilter2, setDoneFilter2] = useState<boolean | null>(null);
    const [summaryFilter, setSummaryFilter] = useState<boolean | string | null>(null);

    return (
        <Section
            id="shared"
            title="Shared Components"
            description="Komponen reusable — tinggal panggil dengan props, data bebas."
            icon={Boxes}
        >
            {/* Registry table */}
            <SubLabel>Component Registry</SubLabel>
            <div className="overflow-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="ds-small">Nama</TableHead>
                            <TableHead className="ds-small">File</TableHead>
                            <TableHead className="ds-small">Fungsi</TableHead>
                            <TableHead className="ds-small">Props Utama</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        <TableRow>
                            <TableCell className="ds-data">StatusKpiBar1</TableCell>
                            <TableCell><Code>components/shared/StatusKpiBar1.tsx</Code></TableCell>
                            <TableCell className="ds-small">KPI cards per status + Close/Open bar</TableCell>
                            <TableCell className="ds-small">title, items[], close, open, onFilter</TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell className="ds-data">SummaryCard1</TableCell>
                            <TableCell><Code>components/shared/SummaryCard1.tsx</Code></TableCell>
                            <TableCell className="ds-small">Total hero + breakdown items dengan mini bar</TableCell>
                            <TableCell className="ds-small">title, total, items[], onFilter</TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell className="ds-data">ProgressBar1</TableCell>
                            <TableCell><Code>components/shared/ProgressBar1.tsx</Code></TableCell>
                            <TableCell className="ds-small">Segmented bar Close/Open + KPI tiles</TableCell>
                            <TableCell className="ds-small">title, close, open, onFilter</TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell className="ds-data">useMkDonut</TableCell>
                            <TableCell><Code>ce-next-level/_components/ce-donut-factory.ts</Code></TableCell>
                            <TableCell className="ds-small">Donut chart factory — zero hardcode, responsive</TableCell>
                            <TableCell className="ds-small">rawData[], selectedName</TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </div>

            {/* Live previews */}
            <SubLabel>StatusKpiBar1 — Live Preview</SubLabel>
            <StatusKpiBar1
                title="Contoh Status (sample data)"
                items={[
                    { key: "Very Good", count: 4910, color: "#22C55E" },
                    { key: "Good", count: 1292, color: "#3B82F6" },
                    { key: "Fair", count: 568, color: "#EAB308" },
                    { key: "Poor", count: 3, color: "#F97316" },
                    { key: "Critical", count: 16, color: "#EF4444" },
                ]}
                activeStatus={statusFilter}
                onStatusFilter={setStatusFilter}
                close={726}
                open={10053}
                activeDone={doneFilter1}
                onDoneFilter={setDoneFilter1}
            />

            <SubLabel>SummaryCard1 — Live Preview</SubLabel>
            <div className="max-w-[280px]">
                <SummaryCard1
                    title="Total CE (sample)"
                    total={10779}
                    items={[
                        { key: false, label: "Open", count: 10053, color: "#EF4444" },
                        { key: true, label: "Close", count: 726, color: "#22C55E" },
                    ]}
                    activeKey={summaryFilter}
                    onFilter={setSummaryFilter}
                />
            </div>

            <SubLabel>ProgressBar1 — Live Preview</SubLabel>
            <ProgressBar1
                title="Progress (sample data)"
                close={726}
                open={10053}
                activeFilter={doneFilter2}
                onFilter={setDoneFilter2}
            />
        </Section>
    );
}

const SECTIONS = [
    { id: "colors", label: "Colors", icon: Palette },
    { id: "typography", label: "Typography", icon: Type },
    { id: "components", label: "Components", icon: Component },
    { id: "interactions", label: "Interactions", icon: MousePointerClick },
    { id: "layout", label: "Layout", icon: LayoutGrid },
    { id: "charts", label: "Charts", icon: BarChart3 },
    { id: "tokens", label: "Tokens", icon: Layers },
    { id: "shared", label: "Shared", icon: Boxes },
];

export function DesignDictionary() {
    return (
        <div className="space-y-5">
            {/* Header */}
            <div>
                <h1 className="ds-heading">Kamus Design System FE</h1>
                <p className="ds-body mt-1">
                    Referensi visual lengkap — semua komponen, warna, tipografi, dan pattern yang dipakai di Dashboard PLN UPT Bogor.
                </p>
            </div>

            {/* Quick nav */}
            <div className="flex flex-wrap gap-1.5">
                {SECTIONS.map((s) => (
                    <a
                        key={s.id}
                        href={`#${s.id}`}
                        className="cc-btn cc-btn-secondary flex items-center gap-1.5"
                    >
                        <s.icon className="h-3.5 w-3.5" />
                        {s.label}
                    </a>
                ))}
            </div>

            {/* Sections */}
            <ColorPaletteSection />
            <TypographySection />
            <ComponentsSection />
            <InteractionsSection />
            <LayoutSection />
            <ChartsSection />
            <DesignTokensSection />
            <SharedComponentsSection />
        </div>
    );
}
