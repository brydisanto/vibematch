"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GOLD, GOLD_DEEP } from "@/lib/arcade-tokens";

const SIZE = 6;
const OS_BLUE = "#4A9EFF";

type TileType = {
    id: string;
    image: string;
    accent: string;
    isPartner?: boolean;
};

const TILES: TileType[] = [
    {
        id: "opensea",
        image: "/badges/promo/opensea.webp",
        accent: OS_BLUE,
        isPartner: true,
    },
    { id: "shaka", image: "/badges/any_gvc_1759173799963.webp", accent: "#FFD600" },
    { id: "king", image: "/badges/king_1759173882056.webp", accent: "#B366FF" },
    { id: "doge", image: "/badges/doge_1759173842640.webp", accent: "#FFA64A" },
    { id: "plastic", image: "/badges/plastic_lover_1759173806081.webp", accent: "#FF6FB5" },
    { id: "surfer", image: "/badges/surfer_1759173830462.webp", accent: "#5FD1A3" },
];

type Cell = {
    /** Stable id per spawned tile — drives mount/unmount animations. */
    uid: string;
    type: TileType;
    /** True while a clearing animation plays. */
    clearing?: boolean;
};

type Board = (Cell | null)[][];
type Pos = { r: number; c: number };

let uidCounter = 0;
const nextUid = () => `t${++uidCounter}`;

function randomType(): TileType {
    return TILES[Math.floor(Math.random() * TILES.length)];
}

function makeCell(type?: TileType): Cell {
    return { uid: nextUid(), type: type ?? randomType() };
}

/** Builds a starting board that has zero pre-existing matches. */
function buildInitialBoard(): Board {
    const board: Board = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
    for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
            let candidate: TileType;
            let safety = 0;
            do {
                candidate = randomType();
                safety++;
            } while (
                safety < 40 &&
                ((c >= 2 &&
                    board[r][c - 1]?.type.id === candidate.id &&
                    board[r][c - 2]?.type.id === candidate.id) ||
                    (r >= 2 &&
                        board[r - 1][c]?.type.id === candidate.id &&
                        board[r - 2][c]?.type.id === candidate.id))
            );
            board[r][c] = makeCell(candidate);
        }
    }
    return board;
}

function adjacent(a: Pos, b: Pos): boolean {
    return Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1;
}

function findMatches(board: Board): Set<string> {
    const matched = new Set<string>();
    const key = (r: number, c: number) => `${r}-${c}`;

    for (let r = 0; r < SIZE; r++) {
        let runStart = 0;
        for (let c = 1; c <= SIZE; c++) {
            const prev = board[r][runStart];
            const cur = c < SIZE ? board[r][c] : null;
            const same = prev && cur && prev.type.id === cur.type.id;
            if (!same) {
                if (c - runStart >= 3 && prev) {
                    for (let k = runStart; k < c; k++) matched.add(key(r, k));
                }
                runStart = c;
            }
        }
    }

    for (let c = 0; c < SIZE; c++) {
        let runStart = 0;
        for (let r = 1; r <= SIZE; r++) {
            const prev = board[runStart][c];
            const cur = r < SIZE ? board[r][c] : null;
            const same = prev && cur && prev.type.id === cur.type.id;
            if (!same) {
                if (r - runStart >= 3 && prev) {
                    for (let k = runStart; k < r; k++) matched.add(key(k, c));
                }
                runStart = r;
            }
        }
    }

    return matched;
}

/** Drops surviving cells down each column and refills the top with fresh tiles. */
function settle(board: Board): Board {
    const out: Board = board.map((row) => [...row]);
    for (let c = 0; c < SIZE; c++) {
        const survivors: Cell[] = [];
        for (let r = SIZE - 1; r >= 0; r--) {
            if (out[r][c] !== null) survivors.push(out[r][c]!);
        }
        for (let r = SIZE - 1; r >= 0; r--) {
            const idx = SIZE - 1 - r;
            out[r][c] = idx < survivors.length ? survivors[idx] : makeCell();
        }
    }
    return out;
}

function clone(board: Board): Board {
    return board.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
}

interface PartnerDemoBoardProps {
    /** Soft cap for the title above the board. */
    title?: string;
}

export default function PartnerDemoBoard({ title }: PartnerDemoBoardProps) {
    const [board, setBoard] = useState<Board>(() => buildInitialBoard());
    const [selected, setSelected] = useState<Pos | null>(null);
    const [score, setScore] = useState(0);
    const [partnerFinds, setPartnerFinds] = useState(0);
    const [combo, setCombo] = useState(0);
    const [busy, setBusy] = useState(false);
    const [flash, setFlash] = useState<string | null>(null);
    const [shake, setShake] = useState<Pos | null>(null);
    const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => () => {
        if (flashTimer.current) clearTimeout(flashTimer.current);
    }, []);

    const triggerFlash = useCallback((text: string) => {
        if (flashTimer.current) clearTimeout(flashTimer.current);
        setFlash(text);
        flashTimer.current = setTimeout(() => setFlash(null), 1200);
    }, []);

    const cascade = useCallback(
        async (startBoard: Board) => {
            let current = startBoard;
            let chain = 0;
            // eslint-disable-next-line no-constant-condition
            while (true) {
                const matches = findMatches(current);
                if (matches.size === 0) break;
                chain++;

                let partnerCleared = 0;
                const next = clone(current);
                for (const k of matches) {
                    const [r, c] = k.split("-").map(Number);
                    const cell = next[r][c];
                    if (cell) {
                        cell.clearing = true;
                        if (cell.type.isPartner) partnerCleared++;
                    }
                }

                const matchPoints = matches.size * 100;
                const partnerBonus = partnerCleared * 150;
                const chainBonus = chain > 1 ? (chain - 1) * 50 : 0;
                setScore((s) => s + matchPoints + partnerBonus + chainBonus);
                if (partnerCleared > 0) {
                    setPartnerFinds((n) => n + partnerCleared);
                    triggerFlash(`AYE AYE! +${partnerBonus} bonus`);
                } else if (chain > 1) {
                    triggerFlash(`Combo x${chain}`);
                }
                setCombo(chain);
                setBoard(next);

                await new Promise((res) => setTimeout(res, 360));

                const emptied = clone(next);
                for (const k of matches) {
                    const [r, c] = k.split("-").map(Number);
                    emptied[r][c] = null;
                }
                current = settle(emptied);
                setBoard(current);

                await new Promise((res) => setTimeout(res, 280));
            }
            setCombo(0);
            setBusy(false);
        },
        [triggerFlash],
    );

    const attemptSwap = useCallback(
        async (a: Pos, b: Pos) => {
            if (busy) return;
            const swapped = clone(board);
            const tmp = swapped[a.r][a.c];
            swapped[a.r][a.c] = swapped[b.r][b.c];
            swapped[b.r][b.c] = tmp;

            const matches = findMatches(swapped);
            if (matches.size === 0) {
                setShake(b);
                setTimeout(() => setShake(null), 360);
                setSelected(null);
                return;
            }
            setBusy(true);
            setSelected(null);
            setBoard(swapped);
            await new Promise((res) => setTimeout(res, 180));
            cascade(swapped);
        },
        [board, busy, cascade],
    );

    const handleClick = (r: number, c: number) => {
        if (busy) return;
        if (!selected) {
            setSelected({ r, c });
            return;
        }
        if (selected.r === r && selected.c === c) {
            setSelected(null);
            return;
        }
        if (adjacent(selected, { r, c })) {
            attemptSwap(selected, { r, c });
        } else {
            setSelected({ r, c });
        }
    };

    const reset = () => {
        if (busy) return;
        setBoard(buildInitialBoard());
        setScore(0);
        setPartnerFinds(0);
        setCombo(0);
        setSelected(null);
        setFlash(null);
    };

    return (
        <div className="w-full max-w-[640px] mx-auto">
            <div
                className="rounded-2xl p-4 sm:p-6 relative overflow-hidden"
                style={{
                    background:
                        "linear-gradient(180deg, rgba(74,158,255,0.18) 0%, rgba(12,8,28,0.92) 60%, rgba(8,4,20,0.95) 100%)",
                    border: `1px solid ${OS_BLUE}55`,
                    boxShadow: `0 0 32px ${OS_BLUE}22, 0 12px 32px -12px rgba(0,0,0,0.6)`,
                }}
            >
                <div className="grid grid-cols-3 gap-2 mb-3">
                    <Stat label="Score" value={score.toLocaleString()} color={GOLD} />
                    <Stat
                        label="OpenSea Pins"
                        value={String(partnerFinds)}
                        color={OS_BLUE}
                    />
                    <Stat
                        label="Combo"
                        value={combo > 1 ? `x${combo}` : "—"}
                        color={combo > 1 ? "#FF6FB5" : "rgba(255,255,255,0.35)"}
                    />
                </div>

                <div className="relative">
                    {flash && (
                        <div
                            className="absolute top-1.5 left-1/2 -translate-x-1/2 z-30 font-display font-black text-[11px] sm:text-[13px] tracking-[0.22em] uppercase px-3 py-1.5 rounded-full pointer-events-none"
                            style={{
                                background: `${OS_BLUE}`,
                                color: "#0A0418",
                                boxShadow: `0 0 18px ${OS_BLUE}88`,
                                animation: "vmDemoFlash 1.2s ease-out forwards",
                            }}
                        >
                            {flash}
                        </div>
                    )}
                    <div
                        className="grid gap-1 sm:gap-1.5 p-2 rounded-xl"
                        style={{
                            gridTemplateColumns: `repeat(${SIZE}, minmax(0,1fr))`,
                            background: "rgba(0,0,0,0.45)",
                            border: `1.5px solid ${GOLD}88`,
                            boxShadow: `inset 0 0 18px rgba(0,0,0,0.6), 0 0 14px ${GOLD}33`,
                        }}
                    >
                        {board.map((row, r) =>
                            row.map((cell, c) => {
                                const isSelected =
                                    selected?.r === r && selected?.c === c;
                                const isShaking = shake?.r === r && shake?.c === c;
                                return (
                                    <Tile
                                        key={cell?.uid ?? `${r}-${c}-empty`}
                                        cell={cell}
                                        isSelected={isSelected}
                                        isShaking={isShaking}
                                        onClick={() => handleClick(r, c)}
                                    />
                                );
                            }),
                        )}
                    </div>
                </div>

                <div className="flex items-center justify-between mt-4 gap-3">
                    <p className="font-mundial text-white/55 text-[11px] sm:text-[12px] leading-snug max-w-[360px]">
                        Tap two adjacent pins to swap. Match three or more of the same
                        pin. Matching the OpenSea pin scores big.
                    </p>
                    <button
                        type="button"
                        onClick={reset}
                        disabled={busy}
                        className="shrink-0 font-display font-black text-[10px] sm:text-[11px] tracking-[0.22em] uppercase px-4 py-2 rounded-full transition-transform hover:-translate-y-[1px] disabled:opacity-50"
                        style={{
                            background: `linear-gradient(180deg, ${GOLD} 0%, ${GOLD_DEEP} 100%)`,
                            color: "#1A0E02",
                            boxShadow: `0 2px 0 ${GOLD_DEEP}, 0 4px 12px rgba(0,0,0,0.4)`,
                            textShadow: "0 1px 0 rgba(255,255,255,0.25)",
                        }}
                    >
                        Reset Board
                    </button>
                </div>
            </div>

            <style jsx>{`
                @keyframes vmDemoFlash {
                    0% {
                        opacity: 0;
                        transform: translate(-50%, -8px) scale(0.85);
                    }
                    18% {
                        opacity: 1;
                        transform: translate(-50%, 0) scale(1);
                    }
                    80% {
                        opacity: 1;
                        transform: translate(-50%, 0) scale(1);
                    }
                    100% {
                        opacity: 0;
                        transform: translate(-50%, -4px) scale(0.95);
                    }
                }
            `}</style>
        </div>
    );
}

function Stat({
    label,
    value,
    color,
}: {
    label: string;
    value: string;
    color: string;
}) {
    return (
        <div
            className="rounded-lg px-2.5 py-2 text-center"
            style={{
                background: "rgba(0,0,0,0.45)",
                border: `1px solid ${color}33`,
            }}
        >
            <div
                className="font-mundial text-[8px] sm:text-[9px] tracking-[0.22em] uppercase mb-0.5"
                style={{ color: "rgba(255,255,255,0.45)" }}
            >
                {label}
            </div>
            <div
                className="font-display font-black text-[14px] sm:text-[18px] leading-none"
                style={{ color, textShadow: `0 0 10px ${color}55` }}
            >
                {value}
            </div>
        </div>
    );
}

function Tile({
    cell,
    isSelected,
    isShaking,
    onClick,
}: {
    cell: Cell | null;
    isSelected: boolean;
    isShaking: boolean;
    onClick: () => void;
}) {
    if (!cell) {
        return <div className="aspect-square" />;
    }
    const { type, clearing } = cell;
    return (
        <button
            type="button"
            onClick={onClick}
            className="relative aspect-square rounded-md transition-transform"
            style={{
                background: `linear-gradient(135deg, ${type.accent}33, ${type.accent}11)`,
                border: isSelected
                    ? `2px solid ${GOLD}`
                    : `1px solid ${type.accent}66`,
                boxShadow: isSelected
                    ? `0 0 14px ${GOLD}cc, inset 0 0 6px ${GOLD}66`
                    : type.isPartner
                      ? `0 0 8px ${type.accent}88, inset 0 0 4px ${type.accent}33`
                      : "inset 0 0 4px rgba(255,255,255,0.06)",
                transform: isSelected ? "scale(1.04)" : isShaking ? undefined : "scale(1)",
                opacity: clearing ? 0 : 1,
                transition:
                    "opacity 320ms ease-out, transform 180ms ease-out, box-shadow 180ms",
                animation: isShaking ? "vmDemoShake 360ms ease-in-out" : undefined,
            }}
        >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src={type.image}
                alt=""
                className="absolute inset-1 w-[calc(100%-8px)] h-[calc(100%-8px)] object-contain pointer-events-none select-none"
                draggable={false}
                style={{
                    filter: type.isPartner
                        ? `drop-shadow(0 0 6px ${type.accent}aa)`
                        : "drop-shadow(0 2px 3px rgba(0,0,0,0.5))",
                    transform: clearing ? "scale(1.2)" : "scale(1)",
                    transition: "transform 320ms ease-out",
                }}
            />
            <style jsx>{`
                @keyframes vmDemoShake {
                    0%,
                    100% {
                        transform: translateX(0);
                    }
                    20% {
                        transform: translateX(-4px);
                    }
                    40% {
                        transform: translateX(4px);
                    }
                    60% {
                        transform: translateX(-3px);
                    }
                    80% {
                        transform: translateX(3px);
                    }
                }
            `}</style>
        </button>
    );
}
