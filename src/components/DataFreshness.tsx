"use client";

interface DataFreshnessProps {
    pagePath?: string;
}

// Legacy page-level freshness bar is intentionally disabled.
// Dashboard freshness now lives in the compact header sync control.
export function DataFreshness(_props: DataFreshnessProps = {}) {
    return null;
}
