"use client";

/**
 * /data-workspace/login — password gate for Data Workspace.
 *
 *  Simple single-password entry. Cookie HMAC 8h. Redirects to `next` query
 *  param on success, else defaults ke `/data-workspace`.
 */

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, Loader2, AlertTriangle, DatabaseZap } from "lucide-react";

export default function WorkspaceLoginPage() {
    return (
        <Suspense fallback={<div className="p-8 text-sm text-muted-foreground">Memuat...</div>}>
            <WorkspaceLoginInner />
        </Suspense>
    );
}

function WorkspaceLoginInner() {
    const router = useRouter();
    const params = useSearchParams();
    const next = params.get("next") || "/data-workspace";

    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        if (!password.trim()) return;
        setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/workspace/auth/login", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ password }),
            });
            if (!res.ok) {
                const j = await res.json().catch(() => null) as { error?: string } | null;
                throw new Error(j?.error ?? "Login failed");
            }
            router.replace(next);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Login failed");
            setLoading(false);
        }
    }

    return (
        <div className="flex-1 flex items-center justify-center p-6">
            <div className="w-full max-w-sm">
                <div className="flex flex-col items-center gap-2 mb-8">
                    <div className="h-12 w-12 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center">
                        <DatabaseZap className="h-6 w-6 text-primary" strokeWidth={2} />
                    </div>
                    <h1 className="ds-heading mt-2">Data Workspace</h1>
                    <p className="ds-small text-center opacity-70">
                        Dedicated BQ data-entry environment.<br />
                        Enter the shared password to continue.
                    </p>
                </div>

                <form onSubmit={submit} className="space-y-3">
                    <label className="block">
                        <span className="ds-label block mb-1.5">Password</span>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                            <input
                                type="password"
                                autoFocus
                                autoComplete="current-password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 text-sm rounded-md border border-border/60 bg-card/40 focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/20 ds-transition disabled:opacity-50"
                                placeholder="••••••••••"
                                disabled={loading}
                            />
                        </div>
                    </label>

                    {error && (
                        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                            <span>{error}</span>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading || !password.trim()}
                        className="ds-btn ds-btn-primary w-full"
                    >
                        {loading
                            ? <Loader2 className="h-4 w-4 animate-spin" />
                            : "Unlock workspace"}
                    </button>
                </form>

                <p className="ds-small text-center mt-6 opacity-50">
                    Session expires after 8 hours of inactivity.
                </p>
            </div>
        </div>
    );
}
