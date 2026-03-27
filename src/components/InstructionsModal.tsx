"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence, type PanInfo } from "framer-motion";
import {
    X,
    Sparkles,
    Zap,
    MousePointerClick,
    Bomb,
    Flame,
    Trophy,
    ChevronLeft,
    ChevronRight,
    Grid3X3,
    ArrowDown,
    Star,
    Target,
    TrendingUp,
    Gift,
    Lightbulb,
} from "lucide-react";
import { TIER_COLORS } from "@/lib/badges";

interface InstructionsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

/* ─── Slide Data ─── */

const SLIDE_COUNT = 3;
const SWIPE_THRESHOLD = 50;

/* ─── Shared Sub-Components ─── */

function ContentCard({
    icon: Icon,
    color,
    title,
    children,
    delay = 0,
}: {
    icon: React.ElementType;
    color: string;
    title: string;
    children: React.ReactNode;
    delay?: number;
}) {
    return (
        <motion.div
            className="rounded-2xl p-3.5 relative overflow-hidden"
            style={{
                background: `linear-gradient(135deg, ${color}12, ${color}06)`,
                border: `1px solid ${color}25`,
            }}
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay, duration: 0.35, ease: "easeOut" }}
        >
            {/* Subtle corner glow */}
            <div
                className="absolute -top-8 -right-8 w-24 h-24 rounded-full blur-2xl opacity-20 pointer-events-none"
                style={{ background: color }}
            />
            <div className="flex items-start gap-3 relative z-10">
                <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{
                        background: `${color}18`,
                        boxShadow: `0 0 16px ${color}20`,
                    }}
                >
                    <Icon size={17} style={{ color }} />
                </div>
                <div className="flex-1 min-w-0">
                    <h4
                        className="font-display font-black text-[13px] mb-1"
                        style={{ color }}
                    >
                        {title}
                    </h4>
                    <div className="text-white/55 text-[11.5px] font-mundial leading-[1.55] space-y-0.5">
                        {children}
                    </div>
                </div>
            </div>
        </motion.div>
    );
}

function SlideTitle({
    icon: Icon,
    color,
    title,
    subtitle,
}: {
    icon: React.ElementType;
    color: string;
    title: string;
    subtitle: string;
}) {
    return (
        <motion.div
            className="text-center mb-5"
            initial={{ y: -12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
        >
            <div
                className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center relative"
                style={{
                    background: `linear-gradient(135deg, ${color}30, ${color}15)`,
                    border: `1.5px solid ${color}40`,
                    boxShadow: `0 0 32px ${color}25, 0 0 64px ${color}10`,
                }}
            >
                <Icon size={26} style={{ color }} />
                {/* Pulsing ring */}
                <motion.div
                    className="absolute inset-0 rounded-2xl"
                    style={{ border: `1px solid ${color}30` }}
                    animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0, 0.5] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                />
            </div>
            <h2 className="font-display text-2xl font-black text-white tracking-tight">
                {title}
            </h2>
            <p className="text-white/40 text-xs font-mundial mt-1">{subtitle}</p>
        </motion.div>
    );
}

/* ─── Individual Slides ─── */

function SlideBasics() {
    return (
        <div className="space-y-3">
            <SlideTitle
                icon={Grid3X3}
                color="#4A9EFF"
                title="The Basics"
                subtitle="Everything you need to start matching"
            />

            <ContentCard icon={Grid3X3} color="#4A9EFF" title="The Board" delay={0.05}>
                <p><span className="text-white/80 font-semibold">6 badge types</span> on an 8x8 grid. You've got <span className="text-[#FFE048] font-semibold">30 moves</span> to stack the highest score possible.</p>
            </ContentCard>

            <ContentCard icon={MousePointerClick} color="#B366FF" title="Swap It" delay={0.1}>
                <p>Tap a badge, then tap one <span className="text-white/80 font-semibold">next to it</span> to swap. No match? It bounces back.</p>
            </ContentCard>

            <ContentCard icon={Sparkles} color="#FFE048" title="Match 3+" delay={0.15}>
                <p>Line up <span className="text-white/80 font-semibold">3 or more</span> of the same badge in a row or column. They clear, you score. That's the vibe.</p>
            </ContentCard>

            <ContentCard icon={ArrowDown} color="#FF5F1F" title="Cascades" delay={0.2}>
                <p>When badges clear, new ones drop in from above. If they land into another match, that's a <span className="text-[#FF5F1F] font-semibold">combo chain</span> — free points!</p>
            </ContentCard>
        </div>
    );
}

function SlidePowerMoves() {
    return (
        <div className="space-y-3">
            <SlideTitle
                icon={Bomb}
                color="#FF5F1F"
                title="Power Moves"
                subtitle="Bigger matches unlock fire abilities"
            />

            {/* Special tiles grid */}
            <motion.div
                className="grid grid-cols-1 gap-2.5"
                initial={{ y: 16, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.05, duration: 0.35 }}
            >
                {/* Bomb */}
                <div
                    className="rounded-2xl p-3 relative overflow-hidden"
                    style={{
                        background: "linear-gradient(135deg, #FF5F1F12, #FF5F1F06)",
                        border: "1px solid #FF5F1F25",
                    }}
                >
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#FF5F1F18", boxShadow: "0 0 20px #FF5F1F20" }}>
                            <Bomb size={20} style={{ color: "#FF5F1F" }} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="font-display font-black text-[13px] text-[#FF5F1F]">Bomb</span>
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold font-mundial bg-[#FF5F1F]/15 text-[#FF5F1F]/80">MATCH 4</span>
                            </div>
                            <p className="text-white/50 text-[11px] font-mundial">Blows up a 3x3 area around it</p>
                        </div>
                    </div>
                </div>

                {/* Laser Party */}
                <div
                    className="rounded-2xl p-3 relative overflow-hidden"
                    style={{
                        background: "linear-gradient(135deg, #FFE04812, #FFE04806)",
                        border: "1px solid #FFE04825",
                    }}
                >
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#FFE04818", boxShadow: "0 0 20px #FFE04820" }}>
                            <Zap size={20} style={{ color: "#FFE048" }} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="font-display font-black text-[13px] text-[#FFE048]">Laser Party</span>
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold font-mundial bg-[#FFE048]/15 text-[#FFE048]/80">MATCH 5</span>
                            </div>
                            <p className="text-white/50 text-[11px] font-mundial">Wipes the full row + column</p>
                        </div>
                    </div>
                </div>

                {/* Cosmic Blast */}
                <div
                    className="rounded-2xl p-3 relative overflow-hidden"
                    style={{
                        background: "linear-gradient(135deg, #B366FF12, #B366FF06)",
                        border: "1px solid #B366FF25",
                    }}
                >
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#B366FF18", boxShadow: "0 0 20px #B366FF20" }}>
                            <Star size={20} style={{ color: "#B366FF" }} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="font-display font-black text-[13px] text-[#B366FF]">Cosmic Blast</span>
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold font-mundial bg-[#B366FF]/15 text-[#B366FF]/80">MATCH 6+</span>
                            </div>
                            <p className="text-white/50 text-[11px] font-mundial">Removes every badge of one type from the board</p>
                        </div>
                    </div>
                </div>
            </motion.div>

            <ContentCard icon={Flame} color="#FF5F1F" title="Chain Reactions" delay={0.1}>
                <p>Tap a special tile to set it off. If the blast hits <span className="text-white/80 font-semibold">another special tile</span>, they chain together for massive clears!</p>
            </ContentCard>

            <ContentCard icon={Target} color="#4A9EFF" title="Shape Bonuses" delay={0.15}>
                <div className="flex flex-wrap gap-1.5 mt-1">
                    {[
                        { shape: "L", mult: "1.5x", color: "#4A9EFF" },
                        { shape: "T", mult: "2.5x", color: "#FFE048" },
                        { shape: "Cross", mult: "4x", color: "#B366FF" },
                    ].map((s) => (
                        <span
                            key={s.shape}
                            className="px-2.5 py-1 rounded-lg text-[10px] font-bold font-mundial"
                            style={{
                                background: `${s.color}15`,
                                color: s.color,
                                border: `1px solid ${s.color}25`,
                            }}
                        >
                            {s.shape} = {s.mult}
                        </span>
                    ))}
                </div>
                <p className="mt-1.5"><span className="text-[#FFE048] font-semibold">T</span> and <span className="text-[#B366FF] font-semibold">Cross</span> shapes also grant <span className="text-white/80 font-semibold">+1 Pin Capsule</span>!</p>
            </ContentCard>
        </div>
    );
}

function SlideScoring() {
    return (
        <div className="space-y-3">
            <SlideTitle
                icon={Trophy}
                color="#FFE048"
                title="Score Big"
                subtitle="Play smart, stack points, earn rewards"
            />

            {/* Scoring Formula Visual */}
            <motion.div
                className="rounded-2xl p-4 relative overflow-hidden"
                style={{
                    background: "linear-gradient(135deg, #FFE04812, #FF5F1F08)",
                    border: "1px solid #FFE04820",
                }}
                initial={{ y: 16, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.05, duration: 0.35 }}
            >
                <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full blur-3xl opacity-15 pointer-events-none bg-[#FFE048]" />
                <div className="flex items-center gap-2 mb-3">
                    <Zap size={13} className="text-[#FFE048]" />
                    <span className="font-display text-[10px] font-bold text-[#FFE048] uppercase tracking-widest">
                        How Scoring Works
                    </span>
                </div>
                <div className="flex items-center justify-center gap-2 text-sm font-mundial font-semibold mb-3">
                    <span className="px-3 py-1.5 rounded-lg bg-white/10 text-white text-[12px]">Base</span>
                    <span className="text-white/30">x</span>
                    <span className="px-3 py-1.5 rounded-lg bg-[#FFE048]/12 text-[#FFE048] border border-[#FFE048]/20 text-[12px]">Tier</span>
                    <span className="text-white/30">x</span>
                    <span className="px-3 py-1.5 rounded-lg bg-[#FF5F1F]/12 text-[#FF5F1F] border border-[#FF5F1F]/20 text-[12px]">Combo</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-white/5 p-2">
                        <p className="text-white/80 font-display font-black text-sm">100</p>
                        <p className="text-white/35 text-[9px] font-mundial">Match-3</p>
                    </div>
                    <div className="rounded-lg bg-white/5 p-2">
                        <p className="text-white/80 font-display font-black text-sm">300</p>
                        <p className="text-white/35 text-[9px] font-mundial">Match-4</p>
                    </div>
                    <div className="rounded-lg bg-white/5 p-2">
                        <p className="text-white/80 font-display font-black text-sm">600</p>
                        <p className="text-white/35 text-[9px] font-mundial">Match-5+</p>
                    </div>
                </div>
            </motion.div>

            {/* Tier multipliers */}
            <motion.div
                className="rounded-2xl p-3.5 relative overflow-hidden"
                style={{
                    background: "linear-gradient(135deg, #B366FF08, #4A9EFF06)",
                    border: "1px solid #B366FF20",
                }}
                initial={{ y: 16, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1, duration: 0.35 }}
            >
                <h4 className="font-display font-black text-[12px] text-white/70 mb-2.5 uppercase tracking-wider">Tier Multipliers</h4>
                <div className="flex flex-wrap gap-1.5">
                    {[
                        { name: "Common", mult: "1x", color: TIER_COLORS.blue },
                        { name: "Uncommon", mult: "1.5x", color: TIER_COLORS.silver },
                        { name: "Gold", mult: "2x", color: TIER_COLORS.gold },
                        { name: "Cosmic", mult: "3x", color: TIER_COLORS.cosmic },
                    ].map((t) => (
                        <span
                            key={t.name}
                            className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold font-mundial flex items-center gap-1.5"
                            style={{
                                background: `${t.color}12`,
                                border: `1px solid ${t.color}25`,
                            }}
                        >
                            <span
                                className="w-2 h-2 rounded-full"
                                style={{ background: t.color, boxShadow: `0 0 6px ${t.color}` }}
                            />
                            <span style={{ color: t.color }}>{t.name}</span>
                            <span className="text-white/40">{t.mult}</span>
                        </span>
                    ))}
                </div>
            </motion.div>

            {/* Combo + Special tile scores */}
            <ContentCard icon={TrendingUp} color="#FF5F1F" title="Combos" delay={0.15}>
                <p>Each cascade chain adds <span className="text-white/80 font-semibold">+50%</span> score. Land a 3-chain and you carry <span className="text-[#FFE048]">1</span> into your next turn. 4+ chains carry <span className="text-[#FFE048]">2</span>.</p>
            </ContentCard>

            <ContentCard icon={Bomb} color="#B366FF" title="Tile Scores" delay={0.2}>
                <div className="space-y-0.5">
                    <p><span className="text-[#FF5F1F] font-semibold">Bomb:</span> 500 + 50 per tile cleared</p>
                    <p><span className="text-[#FFE048] font-semibold">Laser Party:</span> 750 + 60 per tile</p>
                    <p><span className="text-[#B366FF] font-semibold">Cosmic Blast:</span> 1000 + 75 per tile</p>
                </div>
            </ContentCard>

            {/* Pin Book capsule callout */}
            <motion.div
                className="rounded-2xl p-3.5 relative overflow-hidden"
                style={{
                    background: "linear-gradient(135deg, #FFE04815, #B366FF10)",
                    border: "1px solid #FFE04830",
                }}
                initial={{ y: 16, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.25, duration: 0.35 }}
            >
                <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full blur-2xl opacity-20 pointer-events-none bg-[#FFE048]" />
                <div className="flex items-center gap-3 relative z-10">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-[#FFE048]/15" style={{ boxShadow: "0 0 20px #FFE04820" }}>
                        <Gift size={18} className="text-[#FFE048]" />
                    </div>
                    <div>
                        <h4 className="font-display font-black text-[13px] text-[#FFE048]">Pin Capsule</h4>
                        <p className="text-white/50 text-[11px] font-mundial">Hit <span className="text-[#FFE048] font-semibold">15,000+</span> points and you earn a capsule.</p>
                        <p className="text-white/50 text-[11px] font-mundial mt-1"><span className="text-white/80 font-semibold">T</span> and <span className="text-white/80 font-semibold">Cross</span> shapes also grant <span className="text-[#FFE048] font-semibold">+1 bonus capsule</span>.</p>
                        <p className="text-white/40 text-[10px] font-mundial mt-1">Capsules are earnable during your first <span className="text-[#FFE048] font-semibold">15 games</span> each day, plus the Daily Challenge.</p>
                    </div>
                </div>
            </motion.div>

            {/* Pro tip */}
            <motion.div
                className="rounded-2xl p-3 relative overflow-hidden"
                style={{
                    background: "linear-gradient(135deg, #B366FF10, #B366FF05)",
                    border: "1px solid #B366FF20",
                }}
                initial={{ y: 16, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.35 }}
            >
                <div className="flex items-start gap-2.5">
                    <Lightbulb size={14} className="text-[#B366FF] mt-0.5 flex-shrink-0" />
                    <p className="text-[11px] text-white/55 font-mundial leading-relaxed">
                        <span className="text-[#B366FF] font-bold">Pro Tip:</span>{" "}
                        Hunt for Gold and Cosmic badges first — they multiply everything. Set up cascades with high-tier badges and you'll blast past 15k.
                    </p>
                </div>
            </motion.div>
        </div>
    );
}

const SLIDES = [SlideBasics, SlidePowerMoves, SlideScoring];
const SLIDE_LABELS = ["The Basics", "Power Moves", "Score Big"];

/* ─── Slide transition variants ─── */

const slideVariants = {
    enter: (direction: number) => ({
        x: direction > 0 ? 280 : -280,
        opacity: 0,
        scale: 0.96,
    }),
    center: {
        x: 0,
        opacity: 1,
        scale: 1,
    },
    exit: (direction: number) => ({
        x: direction > 0 ? -280 : 280,
        opacity: 0,
        scale: 0.96,
    }),
};

/* ─── Main Modal ─── */

export default function InstructionsModal({ isOpen, onClose }: InstructionsModalProps) {
    const [[page, direction], setPage] = useState<[number, number]>([0, 0]);

    const paginate = useCallback(
        (newDirection: number) => {
            setPage(([prev]) => {
                const next = prev + newDirection;
                if (next < 0 || next >= SLIDE_COUNT) return [prev, 0];
                return [next, newDirection];
            });
        },
        []
    );

    const goToPage = useCallback((target: number) => {
        setPage(([prev]) => [target, target > prev ? 1 : -1]);
    }, []);

    const handleDragEnd = useCallback(
        (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
            const { offset, velocity } = info;
            if (Math.abs(offset.x) > SWIPE_THRESHOLD || Math.abs(velocity.x) > 300) {
                paginate(offset.x < 0 ? 1 : -1);
            }
        },
        [paginate]
    );

    // Reset to first slide when modal opens
    const handleAnimationComplete = useCallback(() => {}, []);

    return (
        <AnimatePresence
            onExitComplete={() => setPage([0, 0])}
        >
            {isOpen && (
                <motion.div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onAnimationComplete={handleAnimationComplete}
                >
                    {/* Backdrop */}
                    <motion.div
                        className="absolute inset-0 bg-black/85"
                        onClick={onClose}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    />

                    {/* Modal Container */}
                    <motion.div
                        className="relative w-full max-w-lg max-h-[88vh] flex flex-col rounded-3xl overflow-hidden"
                        style={{
                            background: "linear-gradient(165deg, #1a0a30 0%, #110321 30%, #21083B 70%, #1a0a30 100%)",
                            border: "1.5px solid rgba(179, 102, 255, 0.25)",
                            boxShadow:
                                "0 0 60px rgba(179, 102, 255, 0.12), 0 0 120px rgba(179, 102, 255, 0.06), 0 25px 50px rgba(0, 0, 0, 0.5)",
                        }}
                        initial={{ scale: 0.88, y: 30, opacity: 0 }}
                        animate={{ scale: 1, y: 0, opacity: 1 }}
                        exit={{ scale: 0.88, y: 30, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 320, damping: 28 }}
                    >
                        {/* Header */}
                        <div
                            className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0"
                            style={{
                                borderBottom: "1px solid rgba(179, 102, 255, 0.12)",
                            }}
                        >
                            <div className="flex items-center gap-2.5">
                                <div
                                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                                    style={{
                                        background: "linear-gradient(135deg, #B366FF25, #B366FF10)",
                                        boxShadow: "0 0 12px #B366FF15",
                                    }}
                                >
                                    <Sparkles size={16} className="text-[#FFE048]" />
                                </div>
                                <div>
                                    <h2 className="font-display text-lg font-black text-white leading-tight">
                                        How to Play
                                    </h2>
                                    <p className="text-white/30 text-[10px] font-mundial">
                                        {SLIDE_LABELS[page]} ({page + 1}/{SLIDE_COUNT})
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 group hover:scale-110"
                                style={{
                                    background: "rgba(255,255,255,0.06)",
                                    border: "1px solid rgba(255,255,255,0.1)",
                                }}
                            >
                                <X
                                    size={15}
                                    className="text-white/50 group-hover:text-white transition-colors"
                                />
                            </button>
                        </div>

                        {/* Slide Content Area */}
                        <div className="flex-1 overflow-hidden relative min-h-0" style={{ minHeight: "50vh" }}>
                            <AnimatePresence initial={false} custom={direction} mode="wait">
                                <motion.div
                                    key={page}
                                    custom={direction}
                                    variants={slideVariants}
                                    initial="enter"
                                    animate="center"
                                    exit="exit"
                                    transition={{
                                        x: { type: "spring", stiffness: 350, damping: 32 },
                                        opacity: { duration: 0.2 },
                                        scale: { duration: 0.2 },
                                    }}
                                    drag="x"
                                    dragConstraints={{ left: 0, right: 0 }}
                                    dragElastic={0.15}
                                    onDragEnd={handleDragEnd}
                                    className="absolute inset-0 overflow-y-auto px-5 py-4"
                                    style={{
                                        scrollbarWidth: "none",
                                        msOverflowStyle: "none",
                                    }}
                                >
                                    {/* Hide webkit scrollbar */}
                                    <style>{`
                                        .slide-scroll::-webkit-scrollbar { display: none; }
                                    `}</style>
                                    <div className="slide-scroll">
                                        {(() => {
                                            const SlideComponent = SLIDES[page];
                                            return <SlideComponent />;
                                        })()}
                                        {/* Bottom spacing for nav area */}
                                        <div className="h-4" />
                                    </div>
                                </motion.div>
                            </AnimatePresence>

                            {/* Edge fade gradients */}
                            <div
                                className="absolute top-0 left-0 right-0 h-3 pointer-events-none z-10"
                                style={{
                                    background: "linear-gradient(to bottom, #130825, transparent)",
                                }}
                            />
                            <div
                                className="absolute bottom-0 left-0 right-0 h-6 pointer-events-none z-10"
                                style={{
                                    background: "linear-gradient(to top, #150a28, transparent)",
                                }}
                            />
                        </div>

                        {/* Navigation Footer */}
                        <div
                            className="flex-shrink-0 px-5 pb-5 pt-3"
                            style={{
                                borderTop: "1px solid rgba(179, 102, 255, 0.1)",
                                background: "linear-gradient(to top, #110321, transparent)",
                            }}
                        >
                            <div className="flex items-center justify-between">
                                {/* Left Arrow */}
                                <button
                                    onClick={() => paginate(-1)}
                                    disabled={page === 0}
                                    className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 disabled:opacity-20 disabled:cursor-not-allowed hover:scale-105 active:scale-95"
                                    style={{
                                        background: page > 0 ? "rgba(179,102,255,0.12)" : "rgba(255,255,255,0.04)",
                                        border: `1px solid ${page > 0 ? "rgba(179,102,255,0.25)" : "rgba(255,255,255,0.06)"}`,
                                    }}
                                    aria-label="Previous slide"
                                >
                                    <ChevronLeft size={18} className="text-white/70" />
                                </button>

                                {/* Dot Indicators */}
                                <div className="flex items-center gap-2.5">
                                    {Array.from({ length: SLIDE_COUNT }).map((_, i) => (
                                        <button
                                            key={i}
                                            onClick={() => goToPage(i)}
                                            className="relative transition-all duration-300"
                                            aria-label={`Go to slide ${i + 1}: ${SLIDE_LABELS[i]}`}
                                        >
                                            <motion.div
                                                className="rounded-full"
                                                animate={{
                                                    width: i === page ? 28 : 8,
                                                    height: 8,
                                                    background:
                                                        i === page
                                                            ? "linear-gradient(90deg, #B366FF, #FFE048)"
                                                            : "rgba(255,255,255,0.18)",
                                                }}
                                                transition={{ type: "spring", stiffness: 400, damping: 28 }}
                                                style={{
                                                    boxShadow: i === page ? "0 0 12px rgba(179,102,255,0.4)" : "none",
                                                }}
                                            />
                                        </button>
                                    ))}
                                </div>

                                {/* Right Arrow / Got It button */}
                                {page < SLIDE_COUNT - 1 ? (
                                    <button
                                        onClick={() => paginate(1)}
                                        className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95"
                                        style={{
                                            background: "rgba(179,102,255,0.12)",
                                            border: "1px solid rgba(179,102,255,0.25)",
                                        }}
                                        aria-label="Next slide"
                                    >
                                        <ChevronRight size={18} className="text-white/70" />
                                    </button>
                                ) : (
                                    <motion.button
                                        onClick={onClose}
                                        className="px-5 h-10 rounded-xl font-display font-black text-sm text-black flex items-center gap-1.5 transition-all duration-200 hover:scale-105 active:scale-95"
                                        style={{
                                            background: "linear-gradient(135deg, #FFE048, #FFD000)",
                                            boxShadow: "0 0 20px rgba(255,224,72,0.3), 0 4px 12px rgba(0,0,0,0.3)",
                                        }}
                                        initial={{ scale: 0.9, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        transition={{ type: "spring", stiffness: 400, damping: 20 }}
                                    >
                                        Got It!
                                    </motion.button>
                                )}
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
