"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Lock, User, Sparkles, Loader2, ArrowRight } from "lucide-react";
import { toast } from "react-hot-toast";

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (username: string, avatarUrl: string) => void;
    initialMode?: "login" | "register";
}

export default function AuthModal({ isOpen, onClose, onSuccess, initialMode = "login" }: AuthModalProps) {
    const [mode, setMode] = useState<"login" | "register">(initialMode);
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
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
                body: JSON.stringify({ username, password }),
            });

            const data = await res.json();

            if (res.ok) {
                toast.success(mode === "login" ? "Logged in!" : "Account created!");
                onSuccess(username, data.user?.avatarUrl || "");
                onClose();
            } else {
                toast.error(data.error || "Something went wrong");
            }
        } catch (error) {
            toast.error("Network error. Try again.");
        } finally {
            setIsLoading(false);
        }
    };

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
                        {/* Enamel Tray Base */}
                        <div className="relative bg-[#110D17] rounded-[21px] p-6 shadow-[inset_0_2px_10px_rgba(0,0,0,0.8),inset_0_-1px_2px_rgba(255,255,255,0.05)] border border-[#3A3344] overflow-hidden">

                            {/* Decorative Background Elements */}
                            <div className="absolute -top-10 -right-10 w-32 h-32 bg-[#B366FF]/10 blur-[60px] pointer-events-none" />
                            <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-[#FFE048]/5 blur-[60px] pointer-events-none" />

                            {/* Close Button */}
                            <button
                                onClick={onClose}
                                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[#2A2333] flex items-center justify-center shadow-[inset_0_1px_3px_rgba(0,0,0,0.5),0_1px_1px_rgba(255,255,255,0.05)] border border-[#3A3344] hover:border-white/50 transition-colors z-20"
                            >
                                <X size={16} className="text-white/60 hover:text-white transition-colors" />
                            </button>

                            <div className="text-center mb-8 pt-4">
                                <h2 className="font-display text-4xl font-black text-white tracking-tight drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                                    {mode === "login" ? "Sign In!" : "Sign Up!"}
                                </h2>
                                <p className="text-white/50 text-[10px] font-mundial mt-3 uppercase tracking-[0.2em] font-bold mx-auto leading-relaxed px-4">
                                    {mode === "login"
                                        ? "Login to save your scores and play the daily challenge"
                                        : "Sign up to save your scores and play the daily challenge"}
                                </p>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-4">
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
                                                    Let's Freaking Vibe!
                                                </span>
                                                <ArrowRight size={18} className="text-white relative z-10 drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)] group-hover:translate-x-1 transition-transform" />
                                            </>
                                        )}
                                    </div>
                                </button>
                            </form>

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
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
