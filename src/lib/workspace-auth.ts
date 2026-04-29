/**
 * workspace-auth — HMAC-signed session token untuk /data-workspace gate.
 *
 *  ▸ Token format: `${payloadB64Url}.${sigB64Url}` (JWT-lite, no header)
 *  ▸ HMAC SHA-256, secret dari env `DATA_WORKSPACE_SECRET`
 *  ▸ Pure Web Crypto API → edge (middleware) + node (route handler) compatible
 *  ▸ Cookie name: `dw_auth`, 8h TTL, HttpOnly + SameSite=Lax
 */

export const WORKSPACE_COOKIE = "dw_auth";
export const WORKSPACE_TTL_SECONDS = 8 * 60 * 60; // 8h

interface Payload {
    sub: string;
    exp: number; // unix ms
}

function b64url(bytes: Uint8Array): string {
    const bin = String.fromCharCode(...bytes);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Uint8Array {
    const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
    const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function getSecret(): string {
    return process.env.DATA_WORKSPACE_SECRET ?? "dev-insecure-change-me";
}

async function hmacKey(): Promise<CryptoKey> {
    return crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(getSecret()),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign", "verify"],
    );
}

export async function signToken(sub: string): Promise<string> {
    const payload: Payload = {
        sub,
        exp: Date.now() + WORKSPACE_TTL_SECONDS * 1000,
    };
    const payloadB64 = b64url(new TextEncoder().encode(JSON.stringify(payload)));
    const key = await hmacKey();
    const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadB64));
    return `${payloadB64}.${b64url(new Uint8Array(sig))}`;
}

export async function verifyToken(token: string): Promise<Payload | null> {
    const [payloadB64, sigB64] = token.split(".");
    if (!payloadB64 || !sigB64) return null;
    const key = await hmacKey();
    const sig = b64urlDecode(sigB64);
    const ok = await crypto.subtle.verify(
        "HMAC",
        key,
        sig.buffer.slice(sig.byteOffset, sig.byteOffset + sig.byteLength) as ArrayBuffer,
        new TextEncoder().encode(payloadB64),
    );
    if (!ok) return null;
    try {
        const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(payloadB64))) as Payload;
        if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
        return payload;
    } catch {
        return null;
    }
}

export function checkPassword(input: string): boolean {
    const expected = process.env.DATA_WORKSPACE_PASSWORD ?? "pln-bogor-2026";
    // Constant-time compare
    if (input.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < input.length; i++) diff |= input.charCodeAt(i) ^ expected.charCodeAt(i);
    return diff === 0;
}
