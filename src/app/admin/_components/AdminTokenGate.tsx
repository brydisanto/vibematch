"use client";

import { useEffect, useState } from "react";
import { getAdminToken, setAdminToken, clearAdminToken } from "../_lib/adminFetch";

/**
 * Gates the admin UI behind a token entered into localStorage.
 *
 * On mount, checks localStorage for a saved token. If present, renders
 * children. If absent, renders a paste-token form. Verification of the
 * token happens server-side on the first admin API call — we intentionally
 * don't burn a round-trip just to validate it here, because the only way
 * to know "the token is right" is to hit an admin endpoint that needs it.
 *
 * If a child adminFetch() returns 403, it calls clearAdminToken() itself,
 * and the next render sees no token and shows the prompt again.
 */
export default function AdminTokenGate({ children }: { children: React.ReactNode }) {
    const [hasToken, setHasToken] = useState<boolean | null>(null);
    const [input, setInput] = useState("");
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setHasToken(!!getAdminToken());
        // Poll storage event so a 403 that clears the token shows the prompt
        // again without a full page reload.
        const onStorage = () => setHasToken(!!getAdminToken());
        window.addEventListener("storage", onStorage);
        const interval = setInterval(onStorage, 2000);
        return () => {
            window.removeEventListener("storage", onStorage);
            clearInterval(interval);
        };
    }, []);

    if (hasToken === null) {
        return null; // hydration flash guard
    }

    if (hasToken) {
        return (
            <>
                {children}
                <SignOutAdmin onSignOut={() => setHasToken(false)} />
            </>
        );
    }

    return (
        <div className="max-w-md mx-auto mt-20 bg-white/5 border border-white/10 rounded-xl p-8">
            <h1 className="font-display font-black text-2xl text-[#FFE048] uppercase tracking-wider mb-2">
                Admin Access
            </h1>
            <p className="text-sm text-white/60 mb-6">
                Enter the admin access token to continue. This is a separate factor from your account login.
            </p>
            <form
                onSubmit={e => {
                    e.preventDefault();
                    const trimmed = input.trim();
                    if (!trimmed) {
                        setError("Token is required");
                        return;
                    }
                    setAdminToken(trimmed);
                    setInput("");
                    setError(null);
                    setHasToken(true);
                }}
                className="space-y-3"
            >
                <input
                    type="password"
                    autoComplete="off"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    placeholder="Paste admin token"
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-sm font-mono focus:outline-none focus:border-[#FFE048]"
                />
                {error && <div className="text-red-400 text-xs">{error}</div>}
                <button
                    type="submit"
                    className="w-full bg-[#FFE048] text-black font-black uppercase tracking-wider py-3 rounded-lg hover:bg-[#FFE858] transition-colors"
                >
                    Unlock
                </button>
            </form>
        </div>
    );
}

function SignOutAdmin({ onSignOut }: { onSignOut: () => void }) {
    return (
        <button
            type="button"
            onClick={() => {
                clearAdminToken();
                onSignOut();
            }}
            className="fixed bottom-4 right-4 text-[10px] uppercase tracking-wider text-white/40 hover:text-white/80 bg-black/60 border border-white/10 rounded-full px-3 py-2"
        >
            Clear admin token
        </button>
    );
}
