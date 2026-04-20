"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Lock, User, Loader2, ArrowRight, ShieldAlert } from "lucide-react";
import { toast } from "react-hot-toast";

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (username: string, avatarUrl: string) => void;
    initialMode?: "login" | "register";
    referralCode?: string | null;
}

type Mode = "login" | "register" | "rotate";

export default function AuthModal({ isOpen, onClose, onSuccess, initialMode = "login", referralCode }: AuthModalProps) {
    const [mode, setMode] = useState<Mode>(initialMode);
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const resetRotationFields = () => {
        setNewPassword("");
        setConfirmPassword("");
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (mode === "rotate") {
            if (!newPassword || !confirmPassword) {
                toast.error("Enter a new password");
                return;
            }
            if (newPassword.length < 8) {
                toast.error("New password must be at least 8 characters");
                return;
            }
            if (newPassword !== confirmPassword) {
                toast.error("Passwords don't match");
                return;
            }
            if (newPassword === password) {
                toast.error("Choose a password different from your current one");
                return;
            }

            setIsLoading(true);
            try {
                const res = await fetch("/api/auth/login", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ username, password, newPassword }),
                });
                const data = await res.json();
                if (res.ok) {
                    toast.success("Password updated. Logged in!");
                    onSuccess(username, data.user?.avatarUrl || "");
                    resetRotationFields();
                    onClose();
                } else {
                    toast.error(data.error || "Couldn't update password");
                }
            } catch {
                toast.error("Network error. Try again.");
            } finally {
                setIsLoading(false);
            }
            return;
        }

        if (!username || !password) {
            toast.error("Please fill in all fields");
            return;
        }

        setIsLoading(true);
        const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";

        try {
            const res = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    username,
                    password,
                    ...(mode === "register" && referralCode ? { referralCode } : {}),
                }),
            });

            const data = await res.json();

            if (res.ok) {
                toast.success(mode === "login" ? "Logged in!" : "Account created!");
                if (data.referralApplied) {
                    setTimeout(() => toast.success("Referral bonus: 2 free capsules!"), 500);
                }
                onSuccess(username, data.user?.avatarUrl || "");
                onClose();
            } else if (data.requiresPasswordRotation) {
                // Server accepted the legacy password but won't issue a
                // session until the user picks a new one.
                setMode("rotate");
                resetRotationFields();
            } else {
                toast.error(data.error || "Something went wrong");
            }
        } catch (error) {
            toast.error("Network error. Try again.");
        } finally {
            setIsLoading(false);
        }
    };

    const title = mode === "login" ? "Sign In!" : mode === "register" ? "Sign Up!" : "Update Password";
    const subtitle = mode === "login"
        ? "Login to save your scores and play the daily challenge"
        : mode === "register"
            ? "Sign up to save your scores and play the daily challenge"
            : "One-time security update for your account";

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 bg-black/85">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="relative w-full max-w-sm rounded-[24px] bg-gradient-to-b from-[#2A2333] to-[#1A1525] p-[3px] shadow-[0_20px_40px_rgba(0,0,0,0.8),inset_0_1px_1px_rgba(255,255,255,0.2)]"
                    >
                        <div className="relative bg-[#110D17] rounded-[21px] p-6 shadow-[inset_0_2px_10px_rgba(0,0,0,0.8),inset_0_-1px_2px_rgba(255,255,255,0.05)] border border-[#3A3344] overflow-hidden">

                            <div className="absolute -top-10 -right-10 w-32 h-32 bg-[#B366FF]/10 blur-[60px] pointer-events-none" />
                            <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-[#FFE048]/5 blur-[60px] pointer-events-none" />

                            <button
                                onClick={onClose}
                                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[#2A2333] flex items-center justify-center shadow-[inset_0_1px_3px_rgba(0,0,0,0.5),0_1px_1px_rgba(255,255,255,0.05)] border border-[#3A3344] hover:border-white/50 transition-colors z-20"
                            >
                                <X size={16} className="text-white/60 hover:text-white transition-colors" />
                            </button>

                            <div className="text-center mb-8 pt-4">
                                <h2 className="font-display text-4xl font-black text-white tracking-tight drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                                    {title}
                                </h2>
                                <p className="text-white/50 text-[10px] font-mundial mt-3 uppercase tracking-[0.2em] font-bold mx-auto leading-relaxed px-4">
                                    {subtitle}
                                </p>
                            </div>

                            {mode === "rotate" && (
                                <div className="mb-4 bg-[#FFE048]/10 border border-[#FFE048]/30 rounded-xl p-3 flex gap-2 items-start">
                                    <ShieldAlert size={16} className="text-[#FFE048] shrink-0 mt-0.5" />
                                    <p className="text-[11px] text-white/80 leading-relaxed">
                                        Your account was created before we upgraded password storage. Please choose a new password to finish signing in.
                                    </p>
                                </div>
                            )}

                            <form onSubmit={handleSubmit} className="space-y-4">
                                {mode !== "rotate" && (
                                    <>
                                        <div className="space-y-1.5">
                                            <label className="block text-white/50 text-[10px] font-bold uppercase tracking-wider ml-1">
                                                Username
                                            </label>
                                            <div className="relative">
                                                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                                                    <User size={16} className="text-white/20" />
                                                </div>
                                                <input
                                                    type="text"
                                                    value={username}
                                                    onChange={(e) => setUsername(e.target.value.toLowerCase().trim())}
                                                    placeholder="vibemaster"
                                                    className="w-full bg-[#1A1525] border border-[#3A3344] rounded-xl pl-11 pr-4 py-3 text-white font-bold placeholder:text-white/10 focus:outline-none focus:border-[#B366FF] focus:shadow-[0_0_15px_rgba(179,102,255,0.2)] transition-all shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)]"
                                                    disabled={isLoading}
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="block text-white/50 text-[10px] font-bold uppercase tracking-wider ml-1">
                                                Password
                                            </label>
                                            <div className="relative">
                                                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                                                    <Lock size={16} className="text-white/20" />
                                                </div>
                                                <input
                                                    type="password"
                                                    value={password}
                                                    onChange={(e) => setPassword(e.target.value)}
                                                    placeholder="••••••••"
                                                    className="w-full bg-[#1A1525] border border-[#3A3344] rounded-xl pl-11 pr-4 py-3 text-white font-bold placeholder:text-white/10 focus:outline-none focus:border-[#B366FF] focus:shadow-[0_0_15px_rgba(179,102,255,0.2)] transition-all shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)]"
                                                    disabled={isLoading}
                                                />
                                            </div>
                                        </div>
                                    </>
                                )}

                                {mode === "rotate" && (
                                    <>
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
                                                    className="w-full bg-[#1A1525] border border-[#3A3344] rounded-xl pl-11 pr-4 py-3 text-white font-bold placeholder:text-white/10 focus:outline-none focus:border-[#B366FF] focus:shadow-[0_0_15px_rgba(179,102,255,0.2)] transition-all shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)]"
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
                                                    placeholder="Repeat new password"
                                                    className="w-full bg-[#1A1525] border border-[#3A3344] rounded-xl pl-11 pr-4 py-3 text-white font-bold placeholder:text-white/10 focus:outline-none focus:border-[#B366FF] focus:shadow-[0_0_15px_rgba(179,102,255,0.2)] transition-all shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)]"
                                                    disabled={isLoading}
                                                />
                                            </div>
                                        </div>
                                    </>
                                )}

                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="group relative w-full overflow-hidden transition-all duration-300 transform hover:-translate-y-1 active:translate-y-0.5 rounded-xl bg-gradient-to-b from-[#B366FF] to-[#8A2BE2] p-[3px] shadow-[0_8px_16px_rgba(0,0,0,0.4),inset_0_2px_4px_rgba(255,255,255,0.3),inset_0_-2px_4px_rgba(0,0,0,0.2)] mt-4"
                                >
                                    <div className="relative bg-[#9C4EEB] rounded-lg py-3.5 flex items-center justify-center gap-2 overflow-hidden shadow-[inset_0_2px_6px_rgba(0,0,0,0.2),inset_0_-2px_6px_rgba(255,255,255,0.3)]">
                                        <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/30 to-transparent mix-blend-overlay pointer-events-none" />
                                        {isLoading ? (
                                            <Loader2 className="animate-spin text-white" size={20} />
                                        ) : (
                                            <>
                                                <span className="relative z-10 text-sm font-black tracking-widest text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)] uppercase">
                                                    {mode === "rotate" ? "Update & Sign In" : "Let's Freaking Vibe!"}
                                                </span>
                                                <ArrowRight size={18} className="text-white relative z-10 drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)] group-hover:translate-x-1 transition-transform" />
                                            </>
                                        )}
                                    </div>
                                </button>
                            </form>

                            {mode !== "rotate" && (
                                <div className="mt-8 text-center pt-6 border-t border-[#3A3344]">
                                    <p className="text-white/30 text-[10px] font-mundial uppercase tracking-wider font-bold mb-2">
                                        {mode === "login" ? "Don't have an account?" : "Already a member?"}
                                    </p>
                                    <button
                                        onClick={() => setMode(mode === "login" ? "register" : "login")}
                                        className="text-[#B366FF] text-xs font-black uppercase tracking-widest hover:text-white transition-colors"
                                        disabled={isLoading}
                                    >
                                        {mode === "login" ? "Register New User" : "Back to Login"}
                                    </button>
                                </div>
                            )}

                            {mode === "rotate" && (
                                <div className="mt-6 text-center pt-4 border-t border-[#3A3344]">
                                    <button
                                        onClick={() => {
                                            setMode("login");
                                            resetRotationFields();
                                        }}
                                        className="text-white/40 text-[10px] font-bold uppercase tracking-widest hover:text-white/80 transition-colors"
                                        disabled={isLoading}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
