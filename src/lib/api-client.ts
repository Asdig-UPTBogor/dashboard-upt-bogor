/**
 * Standard API client dengan timeout + error handling.
 *
 * Pakai AbortController supaya request yang hang tidak spin forever di UI.
 * Semua fetch data-input lewat helper ini.
 */

export class ApiError extends Error {
    constructor(public status: number, public code: string, message: string) {
        super(message);
        this.name = "ApiError";
    }
}

export class TimeoutError extends Error {
    constructor(public ms: number) {
        super(`Request timeout setelah ${ms / 1000}s`);
        this.name = "TimeoutError";
    }
}

export interface ApiResponse<T = unknown> {
    ok: boolean;
    error?: string;
    message?: string;
    [key: string]: unknown;
}

const DEFAULT_TIMEOUT_MS = 15_000; // 15 detik — cukup untuk BQ cold query + Firestore

export interface ApiOptions {
    method?: "GET" | "POST" | "PATCH" | "DELETE" | "PUT";
    body?: unknown;
    timeoutMs?: number;
    signal?: AbortSignal;
}

/** Fetch JSON dengan timeout + error handling konsisten.
 *
 * Auto:
 *  - AbortController timeout (default 15s)
 *  - Content-Type header untuk body
 *  - Parse JSON response
 *  - Throw ApiError dengan status + message dari server
 *  - Throw TimeoutError kalau hang
 */
export async function apiFetch<T = ApiResponse>(url: string, opts: ApiOptions = {}): Promise<T> {
    const { method = "GET", body, timeoutMs = DEFAULT_TIMEOUT_MS, signal: externalSignal } = opts;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    // Compose signal (external + internal abort)
    let signal: AbortSignal = controller.signal;
    if (externalSignal) {
        if ("any" in AbortSignal && typeof (AbortSignal as unknown as { any: (a: AbortSignal[]) => AbortSignal }).any === "function") {
            signal = (AbortSignal as unknown as { any: (a: AbortSignal[]) => AbortSignal }).any([controller.signal, externalSignal]);
        }
    }

    const init: RequestInit = { method, signal };
    if (body !== undefined) {
        init.body = JSON.stringify(body);
        init.headers = { "content-type": "application/json" };
    }

    let res: Response;
    try {
        res = await fetch(url, init);
    } catch (err) {
        clearTimeout(timeoutId);
        if (err instanceof Error && err.name === "AbortError") {
            throw new TimeoutError(timeoutMs);
        }
        throw err;
    }
    clearTimeout(timeoutId);

    let json: ApiResponse;
    try {
        json = await res.json();
    } catch {
        throw new ApiError(res.status, "invalid_json", `Response bukan JSON valid (status ${res.status})`);
    }

    if (!res.ok || json.ok === false) {
        throw new ApiError(
            res.status,
            (json.error as string) || "unknown",
            (json.message as string) || `Request gagal (${res.status})`
        );
    }

    return json as T;
}

/** Format error untuk ditampilkan ke user secara konsisten. */
export function formatApiError(err: unknown): string {
    if (err instanceof TimeoutError) {
        return `${err.message}. Server mungkin cold-start atau koneksi lambat — coba lagi.`;
    }
    if (err instanceof ApiError) {
        if (err.status === 409) return "Konflik: data sudah diubah orang lain. Refresh dulu.";
        if (err.status === 404) return "Data tidak ditemukan.";
        if (err.status === 401 || err.status === 403) return "Tidak diizinkan.";
        if (err.status === 413) return "Data terlalu besar. Split ke batch lebih kecil (max ~4MB per request).";
        // BQ streaming buffer: rows baru di-insert masih di buffer ~30-90 menit,
        // DML UPDATE/DELETE tidak boleh sampai rows commit ke storage.
        if (/streaming buffer/i.test(err.message)) {
            return "Row baru dibuat, tunggu ~90 detik sebelum edit/hapus. BQ streaming buffer belum commit.";
        }
        if (err.status >= 500) return `Server error: ${err.message}`;
        return err.message;
    }
    if (err instanceof Error) return err.message;
    return String(err);
}
