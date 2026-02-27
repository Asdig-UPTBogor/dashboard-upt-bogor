/**
 * Dashboard Configuration — Single source of truth
 *
 * Centralized config for credentials, caching, and app settings.
 * All API routes import from here instead of duplicating logic.
 */

import fs from "fs";
import path from "path";

// ── Google Sheets Credentials ──────────────────────────────────────
// Priority: env var → known local paths (dev fallback)

const CREDS_CANDIDATES = [
    process.env.GOOGLE_CREDS_PATH,
    "/home/server-01/google-auth/automaticspreadsheet-de108e1d5b56.json",
    path.join(process.cwd(), "..", "Google Auth", "automaticspreadsheet-de108e1d5b56.json"),
].filter(Boolean) as string[];

export const GOOGLE_CREDS_PATH =
    CREDS_CANDIDATES.find((p) => fs.existsSync(p)) || CREDS_CANDIDATES[0];

export const GOOGLE_SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets.readonly",
] as const;

// ── Cache TTL Reference (seconds) — Next.js ISR revalidate ────────
// Next.js requires literal values in route files for static analysis,
// so `revalidate` is set directly in each route.ts file.
// This table serves as the single reference for all TTL values:
//
//   Route              │ TTL (s) │ Notes
//   ───────────────────┼─────────┼─────────────────────────
//   /api/overview      │  300    │ 5 min — Overview ULTG/GI/BAY
//   /api/towers        │  300    │ 5 min — tower positions
//   /api/strikes       │   60    │ 1 min — lightning (dynamic)
//   /api/gardu-induk   │  300    │ 5 min — substation data
//
