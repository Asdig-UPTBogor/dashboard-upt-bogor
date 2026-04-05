/**
 * Console API — OIDC Auth Helper
 * 
 * Generate OIDC tokens for calling other Cloud Run services.
 */

import { GoogleAuth } from 'google-auth-library';

const auth = new GoogleAuth();

export async function getOidcHeaders(audience: string): Promise<Record<string, string>> {
  const client = await auth.getIdTokenClient(audience);
  return await client.getRequestHeaders() as unknown as Record<string, string>;
}

export async function authenticatedFetch(
  url: string,
  options: RequestInit = {},
  timeoutMs = 15000,
): Promise<Response> {
  const urlObj = new URL(url);
  const audience = `${urlObj.protocol}//${urlObj.host}`;

  const headers = await getOidcHeaders(audience);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      headers: { ...headers, ...options.headers },
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}
