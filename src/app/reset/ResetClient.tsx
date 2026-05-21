"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { Lock, ArrowRight, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "react-hot-toast";

export default function ResetClient() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get("token") || "";

    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [done, setDone] = useState(false);
    const [missingToken, setMissingToken] = useState(false);

    useEffect(() => {
        if (!token) setMissingToken(true);
    }, [token]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newPassword || newPassword.length < 8) {
            toast.error("Password must be at least 8 characters");
            return;
        }
        if (newPassword !== confirmPassword) {
            toast.error("Passwords don't match");
            return;
        }
        setIsLoading(true);
        try {
            const res = await fetch("/api/auth/reset-confirm", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, newPassword }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                toast.error(data?.error || "Couldn't reset password");
                return;
            }
            setDone(true);
            // Quick redirect home — they're now logged in via the cookie set
            // by the server on success.
            setTimeout(() => router.push("/"), 1500);
        } catch {
            toast.error("Network error. Try again.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-b from-[#1A0633] to-[#0a0015]">
            <div className="relative w-full max-w-sm rounded-[24px] bg-gradient-to-b from-[#2A2333] to-[#1A1525] p-[3px] shadow-[0_20px_40px_rgba(0,0,0,0.8),inset_0_1px_1px_rgba(255,255,255,0.2)]">
                <div className="relative bg-[#110D17] rounded-[21px] p-6 border border-[#3A3344] overflow-hidden">
                    <div className="absolute -top-10 -right-10 w-32 h-32 bg-[#FFE048]/10 blur-[60px] pointer-events-none" />
                    <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-[#B366FF]/5 blur-[60px] pointer-events-none" />

                    <div className="text-center mb-6 pt-2">
                        <div className="mx-auto mb-3 w-16 h-16 flex items-center justify-center">
                            <Image
                                src="/assets/gvc_shaka.png"
                                alt=""
                                width={64}
                                height={64}
                                className="object-contain"
                                priority
                            />
                        </div>
                        <h2 className="font-display text-3xl font-black text-white tracking-tight drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                            {done ? "All Set!" : missingToken ? "Reset Link Invalid" : "Reset Password"}
                        </h2>
                        <p className="text-white/50 text-[10px] font-mundial mt-3 uppercase tracking-[0.2em] font-bold leading-relaxed px-2">
                            {done
                                ? "You're signed in. Sending you to the game."
                                : missingToken
                                    ? "This link is missing a reset token. Request a new reset from the sign-in modal."
                                    : "Choose a new password for your account."}
                        </p>
                    </div>

                    {!missingToken && !done && (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="block text-white/50 text-[10px] font-bold uppercase tracking-wider ml-1">
                                    New password
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                                        <Lock size={16} className="text-white/20" />
                                    </div>
                                    <input
                                        type="password"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        placeholder="At least 8 characters"
                                        autoFocus
                                        autoComplete="new-password"
                                        className="w-full bg-[#1A1525] border border-[#3A3344] rounded-xl pl-11 pr-4 py-3 text-white font-bold placeholder:text-white/10 focus:outline-none focus:border-[#FFE048] focus:shadow-[0_0_15px_rgba(255,224,72,0.2)] transition-all shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)]"
                                        disabled={isLoading}
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="block text-white/50 text-[10px] font-bold uppercase tracking-wider ml-1">
                                    Confirm new password
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                                        <Lock size={16} className="text-white/20" />
                                    </div>
                                    <input
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="Type it again"
                                        autoComplete="new-password"
                                        className="w-full bg-[#1A1525] border border-[#3A3344] rounded-xl pl-11 pr-4 py-3 text-white font-bold placeholder:text-white/10 focus:outline-none focus:border-[#FFE048] focus:shadow-[0_0_15px_rgba(255,224,72,0.2)] transition-all shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)]"
                                        disabled={isLoading}
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full relative group bg-gradient-to-b from-[#FFE048] to-[#c9a84c] rounded-xl py-3.5 flex items-center justify-center gap-2 shadow-[0_4px_0_#8b6b15,0_8px_20px_rgba(0,0,0,0.4)] hover:shadow-[0_2px_0_#8b6b15,0_4px_10px_rgba(0,0,0,0.4)] hover:translate-y-[2px] active:translate-y-[4px] active:shadow-[0_0_0_#8b6b15,0_0_5px_rgba(0,0,0,0.4)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isLoading ? (
                                    <Loader2 size={18} className="text-[#1A0633] animate-spin" />
                                ) : (
                                    <>
                                        <span className="text-sm font-black tracking-widest text-[#1A0633] uppercase">
                                            Set New Password
                                        </span>
                                        <ArrowRight size={18} className="text-[#1A0633] group-hover:translate-x-1 transition-transform" />
                                    </>
                                )}
                            </button>
                        </form>
                    )}

                    {done && (
                        <div className="flex items-center justify-center py-6">
                            <ShieldCheck size={48} className="text-[#2EEA88]" />
                        </div>
                    )}

                    {missingToken && (
                        <div className="text-center pt-2">
                            <button
                                onClick={() => router.push("/")}
                                className="text-[#FFE048] text-xs font-black uppercase tracking-widest hover:text-white transition-colors"
                            >
                                Back to Pin Drop
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
