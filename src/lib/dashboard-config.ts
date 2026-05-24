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
// Resolution order:
// 1. GCP_SA_KEY_BASE64 env var (Vercel — base64 encoded SA JSON)
// 2. Key file on disk (local dev — google-auth/key.json)
// 3. ADC (Cloud Run — attached service account)

const GCP_SA_KEY_B64 = process.env.GCP_SA_KEY_BASE64;
let _parsedCredentials: Record<string, string> | null = null;

if (GCP_SA_KEY_B64) {
    try {
        _parsedCredentials = JSON.parse(Buffer.from(GCP_SA_KEY_B64, "base64").toString("utf-8"));
    } catch { /* fall through to file/ADC */ }
}

const CREDS_CANDIDATES = [
    process.env.GOOGLE_CREDS_PATH,
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
    path.join(process.cwd(), "google-auth", "key.json"),
].filter(Boolean) as string[];

export const GOOGLE_CREDS_PATH =
    CREDS_CANDIDATES.find((p) => fs.existsSync(p)) || CREDS_CANDIDATES[0];

export const GOOGLE_CREDS_AVAILABLE = Boolean(
    _parsedCredentials || (GOOGLE_CREDS_PATH && fs.existsSync(GOOGLE_CREDS_PATH))
);

export const GOOGLE_SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
] as const;

function credentialOptions() {
    if (_parsedCredentials) return { credentials: _parsedCredentials };
    if (GOOGLE_CREDS_PATH && fs.existsSync(GOOGLE_CREDS_PATH)) return { keyFile: GOOGLE_CREDS_PATH };
    return {};
}

export function getGoogleAuth(scopes: readonly string[] | string[]) {
    return new google.auth.GoogleAuth({
        ...credentialOptions(),
        scopes: [...scopes],
    });
}

export function getGoogleAuthOptions(scopes?: string[]) {
    return {
        ...credentialOptions(),
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
