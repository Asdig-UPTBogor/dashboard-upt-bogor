"use client";

import React from "react";
import { ChevronDown, ChevronRight, Building2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { GI, Bay } from "./types";
import { C } from "./types";
import { getGIColumn, getBayNameColumn, SHEETS } from "./relation-utils";



interface DetailTableProps {
    filteredGIs: GI[];
    filteredBays: Bay[];
    expandedGI: string | null;
    setExpandedGI: (gi: string | null) => void;
    expandedTypes: Set<string>;
    setExpandedTypes: React.Dispatch<React.SetStateAction<Set<string>>>;
    bayTypeColorMap: Record<string, string>;
    setActiveULTG: (v: string | null) => void;
    setActiveGIType: (v: string | null) => void;
    setActiveVoltage: (v: string | null) => void;
    activeULTG: string | null;
    activeGIType: string | null;
    activeVoltage: string | null;
}

export function DetailTable({
    filteredGIs, filteredBays, expandedGI, setExpandedGI,
    expandedTypes, setExpandedTypes, bayTypeColorMap,
    setActiveULTG, setActiveGIType, setActiveVoltage,
    activeULTG, activeGIType, activeVoltage,
}: DetailTableProps) {
    return (
        <Card className="shadow-none">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-primary" /> Detail Gardu Induk
                    <span className="text-xs text-muted-foreground font-normal ml-1">— Klik baris untuk lihat Bay</span>
                    <Badge variant="secondary" className="ml-auto text-xs">{filteredGIs.length} GI ditampilkan</Badge>
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[30px]"></TableHead>
                                <TableHead className="w-[40px]">No</TableHead>
                                <TableHead>ULTG</TableHead>
                                <TableHead>Nama GI</TableHead>
                                <TableHead>Tipe</TableHead>
                                <TableHead>Tegangan</TableHead>
                                <TableHead>Jumlah Bay</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredGIs.map((gi, i) => {
                                const giName = gi["Master Gardu Induk"];
                                const giBays = filteredBays.filter((b) => (b as unknown as Record<string, string>)[getGIColumn(SHEETS.BAY)] === giName);
                                const isExpanded = expandedGI === giName;
                                return (
                                    <React.Fragment key={giName}>
                                        <TableRow
                                            className="cursor-pointer hover:bg-muted/50 transition-colors"
                                            onClick={() => { setExpandedGI(isExpanded ? null : giName); setExpandedTypes(new Set()); }}
                                        >
                                            <TableCell className="px-2">
                                                {isExpanded
                                                    ? <ChevronDown className="h-3.5 w-3.5 text-primary" />
                                                    : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant="outline"
                                                    className="text-xs cursor-pointer hover:bg-primary/10 transition-colors"
                                                    onClick={(e) => { e.stopPropagation(); setActiveULTG(activeULTG === gi["Master ULTG"] ? null : gi["Master ULTG"]); }}
                                                >
                                                    {gi["Master ULTG"]}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="font-medium">{giName}</TableCell>
                                            <TableCell>
                                                <Badge
                                                    className="text-xs cursor-pointer hover:opacity-80 transition-opacity"
                                                    style={{
                                                        backgroundColor: gi["Type Gardu Induk"]?.includes("GITET") ? `${C.amber}20` :
                                                            gi["Type Gardu Induk"]?.includes("GIS") ? `${C.teal}20` : `${C.indigo}20`,
                                                        color: gi["Type Gardu Induk"]?.includes("GITET") ? C.amber :
                                                            gi["Type Gardu Induk"]?.includes("GIS") ? C.teal : C.indigo,
                                                    }}
                                                    onClick={(e) => { e.stopPropagation(); setActiveGIType(activeGIType === gi["Type Gardu Induk"] ? null : gi["Type Gardu Induk"]); }}
                                                >
                                                    {gi["Type Gardu Induk"] || "N/A"}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <span
                                                    className="font-mono text-xs cursor-pointer hover:underline"
                                                    onClick={(e) => { e.stopPropagation(); const v = gi["Tegangan (kV)"]; setActiveVoltage(activeVoltage === v ? null : v); }}
                                                >
                                                    {gi["Tegangan (kV)"] || "-"}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <span className="font-bold" style={{ color: giBays.length > 20 ? C.amber : C.emerald }}>
                                                    {giBays.length}
                                                </span>
                                            </TableCell>
                                        </TableRow>
                                        {isExpanded && giBays.length > 0 && (
                                            <TableRow key={`${giName}-detail`}>
                                                <TableCell colSpan={7} className="p-0">
                                                    <div className="bg-muted/30 border-l-2 border-primary/30 ml-6 py-3 px-4">
                                                        <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wider">
                                                            Tipe Bay — {giName} ({giBays.length} bay)
                                                        </p>
                                                        {(() => {
                                                            const grouped: Record<string, string[]> = {};
                                                            giBays.forEach((bay) => {
                                                                const t = bay["Type Bay"] || "N/A";
                                                                if (!grouped[t]) grouped[t] = [];
                                                                grouped[t].push((bay as unknown as Record<string, string>)[getBayNameColumn(SHEETS.BAY) || "Master Bay"] || "-");
                                                            });
                                                            return Object.entries(grouped).map(([type, names]) => {
                                                                const typeColor = bayTypeColorMap[type] || C.indigo;
                                                                const typeKey = `${giName}::${type}`;
                                                                const isTypeExpanded = expandedTypes.has(typeKey);
                                                                return (
                                                                    <div key={type} className="mb-0.5">
                                                                        <div
                                                                            className="flex items-center gap-2 py-1.5 px-2 rounded cursor-pointer hover:bg-muted/50 transition-colors"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                setExpandedTypes((prev) => {
                                                                                    const next = new Set(prev);
                                                                                    if (next.has(typeKey)) next.delete(typeKey); else next.add(typeKey);
                                                                                    return next;
                                                                                });
                                                                            }}
                                                                        >
                                                                            {isTypeExpanded
                                                                                ? <ChevronDown className="h-3 w-3 text-primary shrink-0" />
                                                                                : <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />}
                                                                            <Badge
                                                                                className="text-xs cursor-pointer hover:opacity-80"
                                                                                style={{ backgroundColor: `${typeColor}20`, color: typeColor, borderColor: `${typeColor}40` }}
                                                                                variant="outline"
                                                                            >
                                                                                {type}
                                                                            </Badge>
                                                                            <span className="text-xs text-muted-foreground">({names.length})</span>
                                                                        </div>
                                                                        {isTypeExpanded && (
                                                                            <div className="ml-7 pl-3 border-l border-border/40 mb-2">
                                                                                {names.map((name, ni) => (
                                                                                    <div key={ni} className="text-xs text-foreground/80 py-1 px-2 hover:bg-muted/30 rounded transition-colors">
                                                                                        <span className="text-muted-foreground font-mono text-xs mr-2">{ni + 1}.</span>
                                                                                        {name}
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            });
                                                        })()}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}
