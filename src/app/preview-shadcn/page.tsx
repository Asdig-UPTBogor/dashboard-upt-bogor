/**
 * Preview: shadcn Components vs Custom (globals.css ds-*)
 *
 * Page ini menunjukkan SEMUA komponen shadcn yang dipakai di dashboard,
 * dan menjelaskan APA yang shadcn atur vs APA yang TIDAK.
 */
"use client";

import { useState } from "react";

// ── shadcn components ──
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
    Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// ── Section wrapper ──
function Section({ title, description, children, annotation }: {
    title: string;
    description: string;
    children: React.ReactNode;
    annotation?: React.ReactNode;
}) {
    return (
        <div className="border rounded-lg p-6 space-y-4" style={{ borderColor: "var(--ds-border-default)" }}>
            <div>
                <h2 className="ds-heading text-lg">{title}</h2>
                <p className="ds-body mt-1">{description}</p>
            </div>
            <div className="space-y-4">
                {children}
            </div>
            {annotation && (
                <div className="mt-4 p-3 rounded-md text-sm" style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)" }}>
                    {annotation}
                </div>
            )}
        </div>
    );
}

// ── Annotation label ──
function Tag({ type, children }: { type: "shadcn" | "custom"; children: React.ReactNode }) {
    const bg = type === "shadcn"
        ? "rgba(34,197,94,0.15)"
        : "rgba(251,146,60,0.15)";
    const color = type === "shadcn"
        ? "rgb(34,197,94)"
        : "rgb(251,146,60)";
    const border = type === "shadcn"
        ? "rgba(34,197,94,0.3)"
        : "rgba(251,146,60,0.3)";
    return (
        <span
            className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
            style={{ background: bg, color, border: `1px solid ${border}` }}
        >
            {children}
        </span>
    );
}

export default function PreviewShadcn() {
    const [inputVal, setInputVal] = useState("");

    return (
        <div className="max-w-5xl mx-auto p-8 space-y-8">
            {/* Page header */}
            <div className="space-y-2">
                <h1 className="ds-heading text-2xl">Preview: shadcn vs Custom Components</h1>
                <p className="ds-body">
                    Halaman ini menunjukkan komponen shadcn yang dipakai di Dashboard PLN UPT Bogor.
                    <br />
                    <Tag type="shadcn">SHADCN</Tag>{" "}
                    <span className="ds-small">= diatur oleh shadcn (file di src/components/ui/)</span>
                    {" "}<Tag type="custom">CUSTOM</Tag>{" "}
                    <span className="ds-small">= diatur oleh globals.css ds-* atau code kamu sendiri</span>
                </p>
            </div>

            {/* ══════════════════════════════════════════════════════════════
                1. CARD
               ══════════════════════════════════════════════════════════════ */}
            <Section
                title="1. Card"
                description="Kotak pembungkus dengan border, background, dan rounded corner. File: src/components/ui/card.tsx"
                annotation={
                    <div className="space-y-2 text-xs">
                        <p className="font-bold">Yang diatur shadcn Card:</p>
                        <p>• <code>Card</code> → border (ring-1), background (bg-card), rounded (rounded-lg)</p>
                        <p>• <code>CardHeader</code> → padding (px-4), layout grid</p>
                        <p>• <code>CardTitle</code> → font (text-[15px] font-semibold font-heading)</p>
                        <p>• <code>CardDescription</code> → font (text-xs text-muted-foreground)</p>
                        <p>• <code>CardContent</code> → padding (px-4)</p>
                        <p>• <code>CardFooter</code> → padding (px-4), flex layout</p>
                        <p className="font-bold mt-2">Yang TIDAK diatur shadcn (harus pakai ds-* atau custom):</p>
                        <p>• Semua isi di dalam CardContent (teks, angka, chart, button custom, bar, dll)</p>
                    </div>
                }
            >
                {/* Card kosong — shadcn murni */}
                <div>
                    <p className="ds-small mb-2">Card kosong (100% shadcn):</p>
                    <Card>
                        <CardHeader>
                            <CardTitle>Ini CardTitle <Tag type="shadcn">SHADCN</Tag></CardTitle>
                            <CardDescription>Ini CardDescription <Tag type="shadcn">SHADCN</Tag></CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p className="ds-body">Ini area CardContent — shadcn cuma kasih padding. Teks ini pakai ds-body. <Tag type="custom">CUSTOM</Tag></p>
                        </CardContent>
                        <CardFooter>
                            <p className="ds-small">Ini CardFooter — shadcn cuma kasih flex layout <Tag type="shadcn">SHADCN</Tag></p>
                        </CardFooter>
                    </Card>
                </div>

                {/* Card dengan isi custom — seperti KPI */}
                <div>
                    <p className="ds-small mb-2">Card dengan isi custom (seperti KPI &quot;Total Unit MTU&quot;):</p>
                    <Card className="border-border/30 py-0 gap-0">
                        <CardContent className="px-4 pt-3 pb-4 flex flex-col gap-3">
                            {/* Header — custom */}
                            <div className="flex items-start justify-between gap-2">
                                <p className="ds-title leading-snug">
                                    Total Unit MTU <Tag type="custom">ds-title</Tag>
                                </p>
                                <p className="flex-none text-right">
                                    <span className="ds-kpi">3,249</span>{" "}
                                    <span className="ml-1.5 ds-body font-medium">unit</span>{" "}
                                    <Tag type="custom">ds-kpi</Tag>
                                </p>
                            </div>

                            {/* Bar segment — custom */}
                            <div>
                                <div className="flex gap-0.5 h-2.5 rounded overflow-hidden">
                                    <div className="h-full" style={{ width: "63%", backgroundColor: "#2dd4bf" }} />
                                    <div className="h-full" style={{ width: "37%", backgroundColor: "#a78bfa" }} />
                                </div>
                                <p className="ds-small mt-1">
                                    Bar warna ini 100% custom — shadcn tidak mengatur ini <Tag type="custom">CUSTOM</Tag>
                                </p>
                            </div>

                            {/* Metric rows — custom buttons */}
                            <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-muted/15 cursor-pointer">
                                    <div className="w-2 h-2 rounded-[2px]" style={{ backgroundColor: "#2dd4bf" }} />
                                    <span className="ds-label flex-1">BOGOR <Tag type="custom">ds-label</Tag></span>
                                    <span className="ds-data">2,057 <Tag type="custom">ds-data</Tag></span>
                                    <span className="ds-data text-muted-foreground">63% <Tag type="custom">ds-data</Tag></span>
                                </div>
                                <div className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-muted/15 cursor-pointer">
                                    <div className="w-2 h-2 rounded-[2px]" style={{ backgroundColor: "#a78bfa" }} />
                                    <span className="ds-label flex-1">SUKABUMI</span>
                                    <span className="ds-data">1,192</span>
                                    <span className="ds-data text-muted-foreground">37%</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <div className="mt-2 p-3 rounded-md" style={{ background: "rgba(251,146,60,0.06)", border: "1px solid rgba(251,146,60,0.15)" }}>
                        <p className="ds-small">
                            <strong>Kesimpulan:</strong> dari seluruh Card KPI ini, shadcn HANYA mengatur kotak luar (border + background + rounded).
                            Semua isi (judul, angka 3249, bar warna, label BOGOR, angka 2057, persentase 63%) = CUSTOM pakai globals.css ds-*.
                        </p>
                    </div>
                </div>
            </Section>

            {/* ══════════════════════════════════════════════════════════════
                2. BADGE
               ══════════════════════════════════════════════════════════════ */}
            <Section
                title="2. Badge (shadcn)"
                description="Label status kecil berbentuk pill. File: src/components/ui/badge.tsx"
                annotation={
                    <div className="text-xs space-y-1">
                        <p className="font-bold">Yang diatur shadcn Badge:</p>
                        <p>• Tinggi (h-5), font (text-[0.625rem] = 10px), padding (px-2), rounded-full, warna per variant</p>
                        <p className="font-bold mt-2">JANGAN bingung dengan ds-data!</p>
                        <p>• shadcn Badge = komponen pill untuk status (CRITICAL, GOOD)</p>
                        <p>• ds-data = class typography untuk angka kecil inline (skor 85.2, prioritas P0)</p>
                    </div>
                }
            >
                <div className="flex flex-wrap gap-3 items-center">
                    <div className="space-y-1 text-center">
                        <Badge variant="default">Default</Badge>
                        <p className="ds-small">default</p>
                    </div>
                    <div className="space-y-1 text-center">
                        <Badge variant="secondary">Secondary</Badge>
                        <p className="ds-small">secondary</p>
                    </div>
                    <div className="space-y-1 text-center">
                        <Badge variant="destructive">Destructive</Badge>
                        <p className="ds-small">destructive</p>
                    </div>
                    <div className="space-y-1 text-center">
                        <Badge variant="outline">Outline</Badge>
                        <p className="ds-small">outline</p>
                    </div>
                    <div className="space-y-1 text-center">
                        <Badge variant="ghost">Ghost</Badge>
                        <p className="ds-small">ghost</p>
                    </div>
                </div>
                <div className="mt-3 pt-3 border-t" style={{ borderColor: "var(--ds-border-subtle)" }}>
                    <p className="ds-small mb-2">Perbandingan: shadcn Badge vs ds-data</p>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <Badge variant="destructive">CRITICAL</Badge>
                            <span className="ds-small">← shadcn Badge (komponen pill)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="ds-data" style={{ color: "#fb7185" }}>85.2</span>
                            <span className="ds-small">← ds-data (class typography angka)</span>
                        </div>
                    </div>
                </div>
            </Section>

            {/* ══════════════════════════════════════════════════════════════
                3. BUTTON
               ══════════════════════════════════════════════════════════════ */}
            <Section
                title="3. Button"
                description="Tombol interaktif. File: src/components/ui/button.tsx"
                annotation={
                    <div className="text-xs space-y-1">
                        <p className="font-bold">Yang diatur shadcn Button:</p>
                        <p>• Tinggi (h-7), font (text-xs font-medium), padding, rounded, warna, hover, focus ring</p>
                        <p>• 6 variant warna: default, outline, secondary, ghost, destructive, link</p>
                        <p>• 4 ukuran: xs, sm, default, lg (+ icon sizes)</p>
                    </div>
                }
            >
                <div className="space-y-3">
                    <p className="ds-small">Variants:</p>
                    <div className="flex flex-wrap gap-2">
                        <Button variant="default">Default</Button>
                        <Button variant="outline">Outline</Button>
                        <Button variant="secondary">Secondary</Button>
                        <Button variant="ghost">Ghost</Button>
                        <Button variant="destructive">Destructive</Button>
                        <Button variant="link">Link</Button>
                    </div>
                    <p className="ds-small">Sizes:</p>
                    <div className="flex flex-wrap gap-2 items-center">
                        <Button size="xs">Extra Small</Button>
                        <Button size="sm">Small</Button>
                        <Button size="default">Default</Button>
                        <Button size="lg">Large</Button>
                    </div>
                </div>
            </Section>

            {/* ══════════════════════════════════════════════════════════════
                4. INPUT
               ══════════════════════════════════════════════════════════════ */}
            <Section
                title="4. Input"
                description="Kotak input teks. File: src/components/ui/input.tsx"
                annotation={
                    <div className="text-xs space-y-1">
                        <p className="font-bold">Yang diatur shadcn Input:</p>
                        <p>• Tinggi (h-7), font (text-sm), border (border-input), background, rounded, focus ring, placeholder color</p>
                    </div>
                }
            >
                <div className="max-w-sm space-y-2">
                    <Input placeholder="Cari data..." value={inputVal} onChange={(e) => setInputVal(e.target.value)} />
                    <Input placeholder="Disabled..." disabled />
                </div>
            </Section>

            {/* ══════════════════════════════════════════════════════════════
                5. SELECT
               ══════════════════════════════════════════════════════════════ */}
            <Section
                title="5. Select"
                description="Dropdown pilihan. File: src/components/ui/select.tsx"
                annotation={
                    <div className="text-xs space-y-1">
                        <p className="font-bold">Yang diatur shadcn Select:</p>
                        <p>• Trigger: tinggi, font, border, rounded, icon chevron</p>
                        <p>• Content: popup dropdown, background, shadow, border</p>
                        <p>• Item: padding, hover state, check icon</p>
                    </div>
                }
            >
                <div className="max-w-48">
                    <Select defaultValue="25">
                        <SelectTrigger>
                            <SelectValue placeholder="Rows per page" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="10">10 rows</SelectItem>
                            <SelectItem value="25">25 rows</SelectItem>
                            <SelectItem value="50">50 rows</SelectItem>
                            <SelectItem value="100">100 rows</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </Section>

            {/* ══════════════════════════════════════════════════════════════
                6. TABLE
               ══════════════════════════════════════════════════════════════ */}
            <Section
                title="6. Table"
                description="Tabel data. File: src/components/ui/table.tsx"
                annotation={
                    <div className="text-xs space-y-1">
                        <p className="font-bold">Yang diatur shadcn Table:</p>
                        <p>• Table: width (w-full), font (text-xs), overflow scroll</p>
                        <p>• TableHead: height (h-10), padding (px-2), font-medium</p>
                        <p>• TableRow: border-b, hover (hover:bg-muted/50)</p>
                        <p>• TableCell: padding (p-2)</p>
                        <p className="font-bold mt-2">Yang TIDAK diatur (custom):</p>
                        <p>• Isi cell (angka, badge status, warna) = pakai ds-* atau custom styling</p>
                    </div>
                }
            >
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>No <Tag type="shadcn">TableHead</Tag></TableHead>
                            <TableHead>MTU</TableHead>
                            <TableHead>GI</TableHead>
                            <TableHead>Status HI</TableHead>
                            <TableHead>Nilai HI</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        <TableRow>
                            <TableCell>1</TableCell>
                            <TableCell>CT</TableCell>
                            <TableCell>Cibinong</TableCell>
                            <TableCell><Badge variant="destructive">CRITICAL</Badge> <Tag type="shadcn">Badge</Tag></TableCell>
                            <TableCell><span className="ds-data" style={{ color: "#fb7185" }}>23.5</span> <Tag type="custom">ds-data</Tag></TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell>2</TableCell>
                            <TableCell>PMS</TableCell>
                            <TableCell>Depok Baru</TableCell>
                            <TableCell><Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">GOOD</Badge></TableCell>
                            <TableCell><span className="ds-data" style={{ color: "#34d399" }}>78.9</span></TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell>3</TableCell>
                            <TableCell>CVT</TableCell>
                            <TableCell>Bogor Baru</TableCell>
                            <TableCell><Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">FAIR</Badge></TableCell>
                            <TableCell><span className="ds-data" style={{ color: "#fbbf24" }}>55.2</span></TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </Section>

            {/* ══════════════════════════════════════════════════════════════
                7. TOOLTIP
               ══════════════════════════════════════════════════════════════ */}
            <Section
                title="7. Tooltip"
                description="Popup info saat hover. File: src/components/ui/tooltip.tsx"
                annotation={
                    <div className="text-xs space-y-1">
                        <p className="font-bold">Yang diatur shadcn Tooltip:</p>
                        <p>• Background (bg-primary), text color (text-primary-foreground), padding, rounded, shadow, animasi appear/disappear</p>
                    </div>
                }
            >
                <TooltipProvider>
                    <div className="flex gap-4">
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="outline">Hover saya</Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Ini tooltip dari shadcn</p>
                            </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className="w-8 h-8 rounded cursor-pointer" style={{ background: "#fb7185" }} />
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>CRITICAL: 23 unit</p>
                            </TooltipContent>
                        </Tooltip>
                    </div>
                </TooltipProvider>
            </Section>

            {/* ══════════════════════════════════════════════════════════════
                8. SKELETON
               ══════════════════════════════════════════════════════════════ */}
            <Section
                title="8. Skeleton"
                description="Loading placeholder animasi pulse. File: src/components/ui/skeleton.tsx"
                annotation={
                    <div className="text-xs space-y-1">
                        <p className="font-bold">Yang diatur shadcn Skeleton:</p>
                        <p>• Animasi (animate-pulse), background (bg-muted), rounded (rounded-md)</p>
                        <p>• Ukuran (width/height) ditentukan oleh KAMU via className</p>
                    </div>
                }
            >
                <div className="space-y-3">
                    <div className="flex gap-3">
                        <Skeleton className="h-20 w-40" />
                        <Skeleton className="h-20 w-40" />
                        <Skeleton className="h-20 w-40" />
                    </div>
                    <Skeleton className="h-8 w-72" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                </div>
            </Section>

            {/* ══════════════════════════════════════════════════════════════
                9. TABS
               ══════════════════════════════════════════════════════════════ */}
            <Section
                title="9. Tabs"
                description="Tab navigasi. File: src/components/ui/tabs.tsx"
                annotation={
                    <div className="text-xs space-y-1">
                        <p className="font-bold">Yang diatur shadcn Tabs:</p>
                        <p>• TabsList: background, padding, rounded, gap</p>
                        <p>• TabsTrigger: font, padding, active state, hover, transition</p>
                        <p>• TabsContent: padding top, animasi show/hide</p>
                    </div>
                }
            >
                <Tabs defaultValue="tab1">
                    <TabsList>
                        <TabsTrigger value="tab1">Overview</TabsTrigger>
                        <TabsTrigger value="tab2">Detail</TabsTrigger>
                        <TabsTrigger value="tab3">Settings</TabsTrigger>
                    </TabsList>
                    <TabsContent value="tab1">
                        <p className="ds-body">Konten tab 1 — ini teks custom, bukan shadcn <Tag type="custom">ds-body</Tag></p>
                    </TabsContent>
                    <TabsContent value="tab2">
                        <p className="ds-body">Konten tab 2</p>
                    </TabsContent>
                    <TabsContent value="tab3">
                        <p className="ds-body">Konten tab 3</p>
                    </TabsContent>
                </Tabs>
            </Section>

            {/* ══════════════════════════════════════════════════════════════
                SUMMARY
               ══════════════════════════════════════════════════════════════ */}
            <div className="border-2 rounded-lg p-6 space-y-4" style={{ borderColor: "rgba(99,102,241,0.4)" }}>
                <h2 className="ds-heading text-lg">Kesimpulan: Siapa Mengatur Apa?</h2>

                <div className="grid grid-cols-2 gap-4">
                    {/* shadcn */}
                    <div className="rounded-md p-4" style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.2)" }}>
                        <p className="font-bold text-sm mb-2" style={{ color: "rgb(34,197,94)" }}>shadcn mengatur:</p>
                        <ul className="text-xs space-y-1 text-muted-foreground">
                            <li>• <strong>Card</strong> — kotak border, bg, rounded</li>
                            <li>• <strong>CardTitle</strong> — font judul card</li>
                            <li>• <strong>Badge</strong> — pill status (CRITICAL, GOOD)</li>
                            <li>• <strong>Button</strong> — tombol (warna, size, hover)</li>
                            <li>• <strong>Input</strong> — kotak input form</li>
                            <li>• <strong>Select</strong> — dropdown</li>
                            <li>• <strong>Table</strong> — struktur tabel</li>
                            <li>• <strong>Tooltip</strong> — popup hover</li>
                            <li>• <strong>Skeleton</strong> — loading state</li>
                            <li>• <strong>Tabs</strong> — tab navigasi</li>
                        </ul>
                        <p className="text-xs mt-3 font-medium" style={{ color: "rgb(34,197,94)" }}>
                            = Wadah, form, interaksi standar
                        </p>
                    </div>

                    {/* Custom */}
                    <div className="rounded-md p-4" style={{ background: "rgba(251,146,60,0.06)", border: "1px solid rgba(251,146,60,0.2)" }}>
                        <p className="font-bold text-sm mb-2" style={{ color: "rgb(251,146,60)" }}>globals.css ds-* mengatur:</p>
                        <ul className="text-xs space-y-1 text-muted-foreground">
                            <li>• <strong>ds-heading</strong> — judul page (H1)</li>
                            <li>• <strong>ds-title</strong> — judul section (non-Card)</li>
                            <li>• <strong>ds-label</strong> — label baris/field</li>
                            <li>• <strong>ds-body</strong> — teks paragraf</li>
                            <li>• <strong>ds-small</strong> — header kolom, section label</li>
                            <li>• <strong>ds-small</strong> — teks bantu kecil</li>
                            <li>• <strong>ds-kpi</strong> — angka hero besar</li>
                            <li>• <strong>ds-data</strong> — angka data mono</li>
                            <li>• <strong>ds-data</strong> — angka kecil inline</li>
                            <li>• <strong>ds-overlay</strong> — teks di atas canvas</li>
                            <li>• <strong>ds-transition-*</strong> — animasi</li>
                            <li>• <strong>--ds-*</strong> — warna theme dark/light</li>
                        </ul>
                        <p className="text-xs mt-3 font-medium" style={{ color: "rgb(251,146,60)" }}>
                            = Semua isi, typography, warna, animasi
                        </p>
                    </div>
                </div>

                <div className="rounded-md p-4" style={{ background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.2)" }}>
                    <p className="font-bold text-sm mb-2" style={{ color: "rgb(99,102,241)" }}>design-tokens.ts mengatur:</p>
                    <p className="text-xs text-muted-foreground">
                        • <strong>ECHART_COLORS</strong> — warna chart canvas (donut, bar, heatmap)
                        {" "}• <strong>ECHART_FONT</strong> — font size chart canvas
                        {" "}• <strong>getTooltipPreset()</strong> — tooltip chart
                        {" "}• Karena canvas BUKAN HTML, tidak bisa pakai CSS class
                    </p>
                </div>
            </div>

            <p className="ds-small text-center pb-8">
                Preview page — bukan bagian dari dashboard production
            </p>
        </div>
    );
}
