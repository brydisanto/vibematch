"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import { X, Upload, Save, Volume2, VolumeX, Music, ChevronLeft, ChevronRight, Copy, Check, Link, Wallet } from "lucide-react";
import { isMuted, toggleMute, BGM_TRACK_NAMES, getCurrentTrackIndex, selectBGMTrack, startBGM } from "@/lib/sounds";

const WalletProvider = dynamic(
    () => import("@/components/WalletProvider").then(m => m.WalletProvider),
    { ssr: false }
);
const RainbowConnectButton = dynamic(
    () => import("@rainbow-me/rainbowkit").then(m => m.ConnectButton),
    { ssr: false }
);

interface ProfileModalProps {
    currentUsername: string;
    currentAvatarUrl: string;
    onSave: (username: string, avatarUrl: string) => void;
    onClose: () => void;
    pinsCollected?: number;
    streak?: number;
    capsuleCount?: number;
}

export default function ProfileModal({ currentUsername, currentAvatarUrl, onSave, onClose, pinsCollected = 0, streak = 0, capsuleCount = 0 }: ProfileModalProps) {
    const [username, setUsername] = useState(currentUsername);
    const [avatarUrl, setAvatarUrl] = useState(currentAvatarUrl);
    const [soundEnabled, setSoundEnabled] = useState(!isMuted);
    const [trackIndex, setTrackIndex] = useState(getCurrentTrackIndex());
    const [referralStats, setReferralStats] = useState<{ totalReferrals: number; capsulesCredited: number; maxCapsules: number } | null>(null);
    const [copied, setCopied] = useState(false);
    const [showWallet, setShowWallet] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setSoundEnabled(!isMuted);
        setTrackIndex(getCurrentTrackIndex());
        // Fetch referral stats
        fetch('/api/referral').then(r => r.json()).then(setReferralStats).catch(() => {});
    }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            // Resize to 128x128 thumbnail to keep data URL small (~5-10KB vs 200KB+)
            const img = document.createElement("img");
            img.onload = () => {
                const canvas = document.createElement("canvas");
                const size = 128;
                canvas.width = size;
                canvas.height = size;
                const ctx = canvas.getContext("2d")!;
                // Center-crop to square
                const min = Math.min(img.width, img.height);
                const sx = (img.width - min) / 2;
                const sy = (img.height - min) / 2;
                ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
                setAvatarUrl(canvas.toDataURL("image/jpeg", 0.8));
                URL.revokeObjectURL(img.src);
            };
            img.src = URL.createObjectURL(file);
        }
    };

    const handleSoundToggle = () => {
        const newEnabled = !soundEnabled;
        setSoundEnabled(newEnabled);
        toggleMute(!newEnabled);
        if (newEnabled) {
            startBGM();
        }
    };

    const handleTrackChange = (direction: -1 | 1) => {
        const newIndex = (trackIndex + direction + BGM_TRACK_NAMES.length) % BGM_TRACK_NAMES.length;
        setTrackIndex(newIndex);
        selectBGMTrack(newIndex);
        if (!soundEnabled) {
            setSoundEnabled(true);
            toggleMute(false);
            startBGM();
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/80">
            <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative w-full max-w-sm rounded-[24px] bg-gradient-to-b from-[#2A2333] to-[#1A1525] p-[3px] shadow-[0_20px_40px_rgba(0,0,0,0.8),inset_0_1px_1px_rgba(255,255,255,0.2)]"
            >
                {/* Enamel Tray Base */}
                <div className="relative bg-[#110D17] rounded-[21px] p-6 pb-8 shadow-[inset_0_2px_10px_rgba(0,0,0,0.8),inset_0_-1px_2px_rgba(255,255,255,0.05)] border border-[#3A3344] overflow-hidden flex flex-col items-center">

                    {/* Close Button */}
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[#2A2333] flex items-center justify-center shadow-[inset_0_1px_3px_rgba(0,0,0,0.5),0_1px_1px_rgba(255,255,255,0.05)] border border-[#3A3344] hover:border-white/50 transition-colors z-20"
                    >
                        <X size={16} className="text-white/60 hover:text-white transition-colors" />
                    </button>

                    {/* Avatar + Username compact header */}
                    <div
                        className="relative w-[100px] h-[100px] rounded-full bg-gradient-to-b from-[#3A3344] to-[#2A2333] p-[3px] mb-3 shadow-[0_8px_16px_rgba(0,0,0,0.6)] cursor-pointer group"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <div className="w-full h-full rounded-full bg-[#110D17] flex items-center justify-center shadow-[inset_0_2px_6px_rgba(0,0,0,0.8)] overflow-hidden relative">
                            {avatarUrl ? (
                                <Image src={avatarUrl} alt="Avatar" fill className="object-cover" />
                            ) : (
                                <Upload size={24} className="text-white/20 group-hover:text-white/40 transition-colors" />
                            )}
                            <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <Upload size={16} className="text-white mb-0.5" />
                                <span className="text-[8px] font-bold text-white uppercase tracking-wider">Change</span>
                            </div>
                        </div>
                        <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                        />
                    </div>
                    <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="VibeMaster99"
                        maxLength={20}
                        className="w-full max-w-[200px] bg-[#1A1525] border border-[#3A3344] rounded-xl px-4 py-2 text-white font-bold placeholder:text-white/20 focus:outline-none focus:border-[#B366FF] focus:shadow-[0_0_15px_rgba(179,102,255,0.2)] transition-all shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)] text-center text-base mb-4"
                    />

                    {/* Stats Row */}
                    <div className="w-full flex gap-2 mb-4">
                        {[
                            { value: pinsCollected, label: "Pins", color: "text-white" },
                            { value: streak, label: "Streak", color: "text-[#FFE048]" },
                            { value: capsuleCount, label: "Capsules", color: "text-[#B366FF]" },
                        ].map(s => (
                            <div
                                key={s.label}
                                className="flex-1 rounded-xl py-2.5 text-center"
                                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                            >
                                <div className={`text-lg font-display font-black ${s.color}`}>{s.value}</div>
                                <div className="text-[9px] text-white/35 font-bold uppercase tracking-wider mt-0.5">{s.label}</div>
                            </div>
                        ))}
                    </div>

                    {/* Music Settings */}
                    <div className="w-full mb-4 bg-[#1A1525] rounded-xl border border-[#3A3344] p-4 shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]">
                        <div className="flex items-center gap-2 mb-3">
                            <Music size={14} className="text-[#B366FF]" />
                            <span className="text-white/50 text-xs font-bold uppercase tracking-wider">Music</span>
                        </div>

                        {/* Sound Toggle */}
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                {soundEnabled ? (
                                    <Volume2 size={16} className="text-[#B366FF]" />
                                ) : (
                                    <VolumeX size={16} className="text-white/30" />
                                )}
                                <span className="text-white/70 text-sm font-bold font-mundial">
                                    {soundEnabled ? "On" : "Off"}
                                </span>
                            </div>
                            <button
                                onClick={handleSoundToggle}
                                className={`relative w-11 h-6 rounded-full transition-colors duration-300 focus:outline-none ${soundEnabled ? "bg-[#B366FF]" : "bg-white/20"}`}
                            >
                                <motion.div
                                    className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md"
                                    animate={{ left: soundEnabled ? "calc(100% - 22px)" : "2px" }}
                                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                />
                            </button>
                        </div>

                        {/* Track Selector */}
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => handleTrackChange(-1)}
                                className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors flex-shrink-0"
                            >
                                <ChevronLeft size={14} className="text-white/50" />
                            </button>
                            <div className="flex-1 text-center min-w-0">
                                <div className="text-white/80 text-sm font-black font-mundial truncate">
                                    {BGM_TRACK_NAMES[trackIndex]}
                                </div>
                                <div className="text-white/25 text-[9px] font-bold font-mundial uppercase tracking-wider">
                                    Track {trackIndex + 1} / {BGM_TRACK_NAMES.length}
                                </div>
                            </div>
                            <button
                                onClick={() => handleTrackChange(1)}
                                className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors flex-shrink-0"
                            >
                                <ChevronRight size={14} className="text-white/50" />
                            </button>
                        </div>
                    </div>

                    {/* Referral Section */}
                    <div className="w-full rounded-xl p-4 mb-4" style={{
                        background: "linear-gradient(135deg, rgba(255,224,72,0.05), rgba(179,102,255,0.05))",
                        border: "1px solid rgba(255,224,72,0.12)",
                    }}>
                        <div className="flex items-center gap-2 mb-2">
                            <Link size={14} className="text-[#FFE048]" />
                            <span className="text-xs font-bold text-[#FFE048] uppercase tracking-wider">
                                Refer Friends
                            </span>
                        </div>
                        <p className="text-white/50 text-[11px] font-mundial leading-relaxed mb-3">
                            Share your link and you both get a free capsule when they join.
                        </p>
                        <div className="flex gap-2">
                            <div
                                className="flex-1 rounded-lg px-3 py-2 text-[11px] font-mono text-white/60 truncate"
                                style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.08)" }}
                            >
                                vibematch.app?ref={currentUsername}
                            </div>
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(`https://vibematch.app?ref=${currentUsername}`);
                                    setCopied(true);
                                    setTimeout(() => setCopied(false), 2000);
                                }}
                                className="shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-all"
                                style={{
                                    background: copied ? "rgba(46,234,136,0.2)" : "rgba(255,224,72,0.12)",
                                    border: copied ? "1px solid rgba(46,234,136,0.4)" : "1px solid rgba(255,224,72,0.3)",
                                }}
                            >
                                {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} className="text-[#FFE048]" />}
                            </button>
                        </div>
                        {referralStats && referralStats.totalReferrals > 0 && (
                            <div className="mt-3 flex items-center justify-between text-[10px] text-white/40 font-mundial">
                                <span>{referralStats.totalReferrals} {referralStats.totalReferrals === 1 ? 'friend' : 'friends'} referred</span>
                                <span className="text-[#FFE048]">{referralStats.capsulesCredited} / {referralStats.maxCapsules} capsules earned</span>
                            </div>
                        )}
                    </div>

                    {/* Wallet Connection */}
                    <div
                        className="w-full rounded-xl p-4 mb-4"
                        style={{
                            background: "rgba(255,255,255,0.03)",
                            border: "1px solid rgba(255,255,255,0.06)",
                        }}
                    >
                        <div className="flex items-center gap-2 mb-2">
                            <Wallet size={14} className="text-[#B366FF]" />
                            <span className="text-xs font-bold text-[#B366FF] uppercase tracking-wider">
                                Wallet
                            </span>
                        </div>
                        {showWallet ? (
                            <WalletProvider>
                                <div className="flex justify-center">
                                    <RainbowConnectButton />
                                </div>
                            </WalletProvider>
                        ) : (
                            <button
                                onClick={() => setShowWallet(true)}
                                className="w-full py-2.5 rounded-lg text-[12px] font-bold font-mundial uppercase tracking-wider transition-all hover:brightness-110"
                                style={{
                                    background: "linear-gradient(135deg, rgba(179,102,255,0.15), rgba(179,102,255,0.08))",
                                    border: "1px solid rgba(179,102,255,0.3)",
                                    color: "#B366FF",
                                }}
                            >
                                Connect Wallet
                            </button>
                        )}
                        <p className="text-white/30 text-[10px] font-mundial mt-2 text-center">
                            Link your wallet to buy prize games with $VIBESTR
                        </p>
                    </div>

                    {/* Save Button Enamel Pin */}
                    <button
                        onClick={() => {
                            onSave(username, avatarUrl);
                            onClose();
                        }}
                        className="group relative w-full mt-2 overflow-hidden transition-all duration-300 transform hover:-translate-y-1 active:translate-y-0.5 rounded-xl bg-gradient-to-b from-[#25B869] to-[#168E4D] p-[3px] shadow-[0_8px_16px_rgba(0,0,0,0.4),inset_0_2px_4px_rgba(255,255,255,0.3),inset_0_-2px_4px_rgba(0,0,0,0.2)]"
                    >
                        <div className="relative bg-[#2EEA88] rounded-lg py-3 flex items-center justify-center gap-2 overflow-hidden shadow-[inset_0_2px_6px_rgba(0,0,0,0.2),inset_0_-2px_6px_rgba(255,255,255,0.3)]">
                            <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/40 to-transparent mix-blend-overlay pointer-events-none" />
                            <Save size={18} className="relative z-10 text-[#0E542D] drop-shadow-[0_1px_1px_rgba(255,255,255,0.5)] group-hover:text-black transition-colors" />
                            <span className="relative z-10 text-sm font-black tracking-widest text-[#0E542D] drop-shadow-[0_1px_1px_rgba(255,255,255,0.5)] group-hover:text-black transition-colors uppercase">
                                Save Profile
                            </span>
                        </div>
                    </button>
                </div>
            </motion.div>
        </div>
    );
}
