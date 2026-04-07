/**
 * SpreadsheetLink — Reusable "Open Spreadsheet" button.
 *
 * Auto-constructs the Google Sheets URL from spreadsheetId(s).
 * Drop into any page that uses usePageData → spreadsheetIds.
 *
 * Usage:
 *   <SpreadsheetLink spreadsheetIds={spreadsheetIds} />
 */
"use client";

import { memo } from "react";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
    /** One or more Google Sheets document IDs */
    spreadsheetIds: string[];
    /** Optional label override */
    label?: string;
    /** compact = icon-only button */
    compact?: boolean;
}

function buildUrl(id: string) {
    return `https://docs.google.com/spreadsheets/d/${encodeURIComponent(id)}`;
}

function SpreadsheetLinkInner({ spreadsheetIds, label, compact = false }: Props) {
    if (!spreadsheetIds.length) return null;

    if (spreadsheetIds.length === 1) {
        return (
            <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1.5 border-border/40 text-xs"
                asChild
            >
                <a
                    href={buildUrl(spreadsheetIds[0])}
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    <ExternalLink className="h-3 w-3" />
                    {!compact && (label || "Buka Spreadsheet")}
                </a>
            </Button>
        );
    }

    // Multiple spreadsheets — render one button each
    return (
        <div className="flex gap-1">
            {spreadsheetIds.map((id, i) => (
                <Button
                    key={id}
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1.5 border-border/40 text-xs"
                    asChild
                >
                    <a
                        href={buildUrl(id)}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        <ExternalLink className="h-3 w-3" />
                        {!compact && (label || `Spreadsheet ${i + 1}`)}
                    </a>
                </Button>
            ))}
        </div>
    );
}

export const SpreadsheetLink = memo(SpreadsheetLinkInner);
