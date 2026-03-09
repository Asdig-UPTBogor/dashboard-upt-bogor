"use client";

/**
 * Grid CSS — uses theme variables from globals.css.
 * Auto light/dark via CSS custom properties.
 */
export function GridStyles() {
    return (
        <style jsx global>{`
            .master-grid {
                --rdg-color: var(--foreground);
                --rdg-background-color: var(--background);
                --rdg-header-background-color: var(--card);
                --rdg-row-hover-background-color: var(--accent);
                --rdg-border-color: var(--border);
                --rdg-selection-color: var(--ring);
                --rdg-font-size: 13px;
            }

            .master-grid .rdg-header-row {
                background: var(--card) !important;
                border-bottom: 1px solid var(--border) !important;
                overflow: visible !important;
            }
            .master-grid .rdg-header-row .rdg-cell {
                overflow: visible !important;
                font-weight: 500;
                color: var(--muted-foreground);
                font-size: 12px;
            }

            .master-grid .rdg-cell {
                border-right: 1px solid var(--border) !important;
                border-bottom: 1px solid var(--border) !important;
                padding: 0 8px !important;
                font-size: 13px !important;
                line-height: 28px !important;
            }

            .master-grid .rdg-row:nth-child(even) {
                background: var(--background);
            }
            .master-grid .rdg-row:nth-child(odd) {
                background: var(--card);
            }

            /* ULTG color banding */
            .rdg-row-ultg-bogor .rdg-cell {
                background: rgba(59, 130, 246, 0.05) !important;
            }
            .rdg-row-ultg-bogor:hover .rdg-cell {
                background: rgba(59, 130, 246, 0.10) !important;
            }
            .rdg-row-ultg-sukabumi .rdg-cell {
                background: rgba(16, 185, 129, 0.05) !important;
            }
            .rdg-row-ultg-sukabumi:hover .rdg-cell {
                background: rgba(16, 185, 129, 0.10) !important;
            }

            .rdg-row-num-cell {
                background: var(--card) !important;
                border-right: 1px solid var(--border) !important;
                user-select: none;
                color: var(--muted-foreground) !important;
                font-variant-numeric: tabular-nums;
            }
            .rdg-row-num-header {
                background: var(--card) !important;
                border-right: 1px solid var(--border) !important;
            }

            .rdg-row-new .rdg-cell {
                background: rgba(16, 185, 129, 0.06) !important;
            }
            .rdg-row-edited .rdg-cell {
                background: rgba(59, 130, 246, 0.06) !important;
            }

            .master-grid .rdg-cell[aria-selected="true"] {
                outline: 1.5px solid var(--ring) !important;
                outline-offset: -1.5px;
            }

            /* Scrollbar */
            .master-grid::-webkit-scrollbar { width: 6px; height: 6px; }
            .master-grid::-webkit-scrollbar-track { background: var(--background); }
            .master-grid::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
            .master-grid::-webkit-scrollbar-thumb:hover { background: var(--muted-foreground); }
            .master-grid::-webkit-scrollbar-corner { background: var(--background); }

            .no-scrollbar::-webkit-scrollbar { display: none; }
            .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        `}</style>
    );
}
