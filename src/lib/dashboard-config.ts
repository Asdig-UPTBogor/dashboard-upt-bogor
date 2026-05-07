/**
 * Dashboard Configuration — Single source of truth
 *
 * Centralized config for credentials, caching, and app settings.
 * All API routes import from here instead of duplicating logic.
 */

import fs from "fs";
import path from "path";
import { google } from "googleapis";

// ── Google Credentials ──────────────────────────────────────
// Resolution: env var → standard GCP env → local key file
// On Cloud Run: no key file exists → GoogleAuth uses ADC automatically.

const CREDS_CANDIDATES = [
    process.env.GOOGLE_CREDS_PATH,
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
    path.join(process.cwd(), "google-auth", "key.json"),
    "d:\\TES\\Google Auth\\automaticspreadsheet-de108e1d5b56.json",
].filter(Boolean) as string[];

export const GOOGLE_CREDS_PATH =
    CREDS_CANDIDATES.find((p) => fs.existsSync(p)) || CREDS_CANDIDATES[0];

export const GOOGLE_CREDS_AVAILABLE = Boolean(
    GOOGLE_CREDS_PATH && fs.existsSync(GOOGLE_CREDS_PATH)
);

export const GOOGLE_SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
] as const;

/**
 * Factory: create a GoogleAuth instance with proper credential resolution.
 *
 * - Local dev: uses keyFile from `google-auth/key.json`
 * - Cloud Run: skips keyFile, uses ADC (attached service account)
 *
 * Usage: `const auth = getGoogleAuth(["https://www.googleapis.com/auth/spreadsheets"]);`
 */
export function getGoogleAuth(scopes: readonly string[] | string[]) {
    return new google.auth.GoogleAuth({
        ...(GOOGLE_CREDS_AVAILABLE ? { keyFile: GOOGLE_CREDS_PATH } : {}),
        scopes: [...scopes],
    });
}

/**
 * Options-only variant for consumers that dynamically import `google-auth-library`.
 *
 * Usage:
 * ```
 * const { GoogleAuth } = await import('google-auth-library');
 * const auth = new GoogleAuth(getGoogleAuthOptions(scopes));
 * ```
 */
export function getGoogleAuthOptions(scopes?: string[]) {
    return {
        ...(GOOGLE_CREDS_AVAILABLE ? { keyFile: GOOGLE_CREDS_PATH } : {}),
        ...(scopes ? { scopes } : {}),
    };
}

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
//   /api/proteksi-petir│  300    │ 5 min — proteksi petir tower
//   /api/kondisi-row   │  300    │ 5 min — ROW conditions
//   /api/healthy-index │  300    │ 5 min — tower healthy index
//   /api/program-kerja-│  300    │ 5 min — program kerja jaringan
//    jaringan          │         │
//
