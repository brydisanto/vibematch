"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { X, Upload, Save } from "lucide-react";

interface ProfileModalProps {
    currentUsername: string;
    currentAvatarUrl: string;
    onSave: (username: string, avatarUrl: string) => void;
    onClose: () => void;
}

export default function ProfileModal({ currentUsername, currentAvatarUrl, onSave, onClose }: ProfileModalProps) {
    const [username, setUsername] = useState(currentUsername);
    const [avatarUrl, setAvatarUrl] = useState(currentAvatarUrl);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setAvatarUrl(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative w-full max-w-sm rounded-[24px] bg-gradient-to-b from-[#2A2333] to-[#1A1525] p-[3px] shadow-[0_20px_40px_rgba(0,0,0,0.8),inset_0_1px_1px_rgba(255,255,255,0.2)]"
            >
                {/* Enamel Tray Base */}
                <div className="relative bg-[#110D17] rounded-[21px] p-6 shadow-[inset_0_2px_10px_rgba(0,0,0,0.8),inset_0_-1px_2px_rgba(255,255,255,0.05)] border border-[#3A3344] overflow-hidden flex flex-col items-center">

                    {/* Close Button */}
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[#2A2333] flex items-center justify-center shadow-[inset_0_1px_3px_rgba(0,0,0,0.5),0_1px_1px_rgba(255,255,255,0.05)] border border-[#3A3344] hover:border-white/50 transition-colors z-20"
                    >
                        <X size={16} className="text-white/60 hover:text-white transition-colors" />
                    </button>

                    <h2 className="font-display text-2xl font-black text-white mb-6 tracking-wide drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                        Player Profile
                    </h2>

                    {/* Avatar Upload */}
                    <div
                        className="relative w-28 h-28 rounded-full bg-gradient-to-b from-[#3A3344] to-[#2A2333] p-1 mb-8 shadow-[0_8px_16px_rgba(0,0,0,0.6),inset_0_1px_2px_rgba(255,255,255,0.1)] cursor-pointer group"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <div className="w-full h-full rounded-full bg-[#110D17] flex items-center justify-center shadow-[inset_0_2px_8px_rgba(0,0,0,0.8)] overflow-hidden relative">
                            {avatarUrl ? (
                                <Image src={avatarUrl} alt="Avatar" fill className="object-cover" />
                            ) : (
                                <Upload size={32} className="text-white/20 group-hover:text-white/40 transition-colors" />
                            )}

                            {/* Hover overlay */}
                            <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <Upload size={20} className="text-white mb-1" />
                                <span className="text-[10px] font-bold text-white uppercase tracking-wider">Change</span>
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

                    {/* Username Input */}
                    <div className="w-full mb-8">
                        <label className="block text-white/50 text-xs font-bold uppercase tracking-wider mb-2 ml-1">
                            Username
                        </label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="VibeMaster99"
                            maxLength={20}
                            className="w-full bg-[#1A1525] border border-[#3A3344] rounded-xl px-4 py-3 text-white font-bold placeholder:text-white/20 focus:outline-none focus:border-[#B366FF] focus:shadow-[0_0_15px_rgba(179,102,255,0.2)] transition-all shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)] text-center text-lg"
                        />
                    </div>

                    {/* Save Button Enamel Pin */}
                    <button
                        onClick={() => {
                            onSave(username, avatarUrl);
                            onClose();
                        }}
                        className="group relative w-full overflow-hidden transition-all duration-300 transform hover:-translate-y-1 active:translate-y-0.5 rounded-xl bg-gradient-to-b from-[#25B869] to-[#168E4D] p-[3px] shadow-[0_8px_16px_rgba(0,0,0,0.4),inset_0_2px_4px_rgba(255,255,255,0.3),inset_0_-2px_4px_rgba(0,0,0,0.2)]"
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
