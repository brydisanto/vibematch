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
    uid: string;
    type: TileType;
    /** True for the swap leg that immediately precedes a match — drives the
     *  initial pre-burst frame so the player perceives the swap landing. */
    clearing?: boolean;
    /** True when this cell was just spawned by gravity (drives cascade-fall). */
    fresh?: boolean;
};

type Board = (Cell | null)[][];
type Pos = { r: number; c: number };
type ScorePopup = {
    id: number;
    r: number;
    c: number;
    text: string;
    color: string;
};

let uidCounter = 0;
const nextUid = () => `t${++uidCounter}`;
let popupCounter = 0;

function randomType(): TileType {
    return TILES[Math.floor(Math.random() * TILES.length)];
}

function makeCell(type?: TileType, fresh?: boolean): Cell {
    return { uid: nextUid(), type: type ?? randomType(), fresh };
}

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

/** Returns one match group per detected run (≥3) — preserves run length so
 *  callers can play match-3 vs match-4 vs match-5 sounds and award accordingly. */
function findMatchGroups(board: Board): Array<{ cells: Pos[]; length: number }> {
    const groups: Array<{ cells: Pos[]; length: number }> = [];

    for (let r = 0; r < SIZE; r++) {
        let runStart = 0;
        for (let c = 1; c <= SIZE; c++) {
            const prev = board[r][runStart];
            const cur = c < SIZE ? board[r][c] : null;
            const same = prev && cur && prev.type.id === cur.type.id;
            if (!same) {
                if (c - runStart >= 3 && prev) {
                    const cells: Pos[] = [];
                    for (let k = runStart; k < c; k++) cells.push({ r, c: k });
                    groups.push({ cells, length: c - runStart });
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
                    const cells: Pos[] = [];
                    for (let k = runStart; k < r; k++) cells.push({ r: k, c });
                    groups.push({ cells, length: r - runStart });
                }
                runStart = r;
            }
        }
    }

    return groups;
}

function settle(board: Board): Board {
    const out: Board = board.map((row) => row.map((c) => (c ? { ...c, fresh: false } : null)));
    for (let c = 0; c < SIZE; c++) {
        const survivors: Cell[] = [];
        for (let r = SIZE - 1; r >= 0; r--) {
            if (out[r][c] !== null) survivors.push(out[r][c]!);
        }
        for (let r = SIZE - 1; r >= 0; r--) {
            const idx = SIZE - 1 - r;
            out[r][c] = idx < survivors.length ? survivors[idx] : makeCell(undefined, true);
        }
    }
    return out;
}

function clone(board: Board): Board {
    return board.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
}

/** Loads the sound lib lazily so first paint isn't gated on the audio bundle. */
let soundCache: typeof import("@/lib/sounds") | null = null;
async function sfx(): Promise<typeof import("@/lib/sounds") | null> {
    if (typeof window === "undefined") return null;
    if (soundCache) return soundCache;
    try {
        soundCache = await import("@/lib/sounds");
        return soundCache;
    } catch {
        return null;
    }
}

export default function PartnerDemoBoard() {
    const [board, setBoard] = useState<Board>(() => buildInitialBoard());
    const [selected, setSelected] = useState<Pos | null>(null);
    const [score, setScore] = useState(0);
    const [partnerFinds, setPartnerFinds] = useState(0);
    const [combo, setCombo] = useState(0);
    const [busy, setBusy] = useState(false);
    const [flash, setFlash] = useState<string | null>(null);
    const [shake, setShake] = useState<Pos | null>(null);
    const [matchedKeys, setMatchedKeys] = useState<Set<string>>(new Set());
    const [popups, setPopups] = useState<ScorePopup[]>([]);
    const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const popupTimers = useRef<Array<ReturnType<typeof setTimeout>>>([]);

    useEffect(
        () => () => {
            if (flashTimer.current) clearTimeout(flashTimer.current);
            popupTimers.current.forEach(clearTimeout);
        },
        [],
    );

    const triggerFlash = useCallback((text: string) => {
        if (flashTimer.current) clearTimeout(flashTimer.current);
        setFlash(text);
        flashTimer.current = setTimeout(() => setFlash(null), 1200);
    }, []);

    const pushPopup = useCallback((r: number, c: number, text: string, color: string) => {
        const id = ++popupCounter;
        setPopups((p) => [...p, { id, r, c, text, color }]);
        const t = setTimeout(() => {
            setPopups((p) => p.filter((x) => x.id !== id));
        }, 820);
        popupTimers.current.push(t);
    }, []);

    const cascade = useCallback(
        async (startBoard: Board) => {
            let current = startBoard;
            let chain = 0;
            // eslint-disable-next-line no-constant-condition
            while (true) {
                const groups = findMatchGroups(current);
                if (groups.length === 0) break;
                chain++;

                const sounds = await sfx();
                let partnerCleared = 0;
                let totalMatched = 0;
                const matched = new Set<string>();
                const longestRun = groups.reduce((m, g) => Math.max(m, g.length), 0);

                for (const g of groups) {
                    let groupPartner = 0;
                    for (const p of g.cells) {
                        matched.add(`${p.r}-${p.c}`);
                        totalMatched++;
                        const cell = current[p.r][p.c];
                        if (cell?.type.isPartner) {
                            partnerCleared++;
                            groupPartner++;
                        }
                    }
                    const centerIdx = Math.floor(g.cells.length / 2);
                    const cp = g.cells[centerIdx];
                    const runPoints = g.length * 100 + (g.length > 3 ? (g.length - 3) * 100 : 0);
                    pushPopup(
                        cp.r,
                        cp.c,
                        groupPartner > 0
                            ? `+${runPoints + groupPartner * 150}`
                            : `+${runPoints}`,
                        groupPartner > 0 ? OS_BLUE : g.length >= 5 ? "#FF6FB5" : GOLD,
                    );
                }

                // Sound sequencing: longest run drives the match tier sound;
                // chain depth drives the cascade overlay sound.
                if (sounds) {
                    if (longestRun >= 5) sounds.playMatch5Sound();
                    else if (longestRun === 4) sounds.playMatch4Sound();
                    else sounds.playMatch3Sound();
                    if (chain > 1) sounds.playCascadeSound(chain);
                    if (chain >= 3) sounds.playComboSound(chain);
                    if (partnerCleared > 0) sounds.playMilestoneSound();
                }

                const matchPoints = totalMatched * 100;
                const lengthBonus = groups.reduce(
                    (sum, g) => sum + (g.length > 3 ? (g.length - 3) * 100 : 0),
                    0,
                );
                const partnerBonus = partnerCleared * 150;
                const chainBonus = chain > 1 ? (chain - 1) * 50 : 0;
                setScore((s) => s + matchPoints + lengthBonus + partnerBonus + chainBonus);

                if (partnerCleared > 0) {
                    setPartnerFinds((n) => n + partnerCleared);
                    triggerFlash(`AYE AYE! +${partnerBonus} bonus`);
                } else if (chain > 1) {
                    triggerFlash(`Combo x${chain}`);
                }
                setCombo(chain);

                setMatchedKeys(matched);

                // Hold for the burst animation duration in globals.css (.tile-matched ≈ 420ms)
                await new Promise((res) => setTimeout(res, 420));

                const emptied = clone(current);
                for (const k of matched) {
                    const [r, c] = k.split("-").map(Number);
                    emptied[r][c] = null;
                }
                current = settle(emptied);
                setMatchedKeys(new Set());
                setBoard(current);

                // Let cascade-fall play out before checking the next chain
                await new Promise((res) => setTimeout(res, 320));
            }
            setCombo(0);
            setBusy(false);
        },
        [pushPopup, triggerFlash],
    );

    const attemptSwap = useCallback(
        async (a: Pos, b: Pos) => {
            if (busy) return;
            const swapped = clone(board);
            const tmp = swapped[a.r][a.c];
            swapped[a.r][a.c] = swapped[b.r][b.c];
            swapped[b.r][b.c] = tmp;

            const groups = findMatchGroups(swapped);
            const sounds = await sfx();
            if (groups.length === 0) {
                sounds?.playInvalidSwapSound();
                setShake(b);
                setTimeout(() => setShake(null), 400);
                setSelected(null);
                return;
            }
            setBusy(true);
            setSelected(null);
            sounds?.playSelectSound();
            setBoard(swapped);
            await new Promise((res) => setTimeout(res, 140));
            cascade(swapped);
        },
        [board, busy, cascade],
    );

    const handleClick = async (r: number, c: number) => {
        if (busy) return;
        const sounds = await sfx();
        if (!selected) {
            sounds?.playSelectSound();
            setSelected({ r, c });
            return;
        }
        if (selected.r === r && selected.c === c) {
            sounds?.playDeselectSound();
            setSelected(null);
            return;
        }
        if (adjacent(selected, { r, c })) {
            attemptSwap(selected, { r, c });
        } else {
            sounds?.playSelectSound();
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
        setMatchedKeys(new Set());
        setPopups([]);
    };

    return (
        <div className="w-full">
            <div
                className="rounded-2xl p-4 sm:p-6 relative overflow-hidden"
                style={{
                    background:
                        "linear-gradient(180deg, rgba(74,158,255,0.18) 0%, rgba(12,8,28,0.94) 60%, rgba(8,4,20,0.96) 100%)",
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
                        comboActive={combo > 1}
                    />
                </div>

                <div className="relative">
                    {flash && (
                        <div
                            className="absolute top-1.5 left-1/2 -translate-x-1/2 z-30 font-display font-black text-[11px] sm:text-[13px] tracking-[0.22em] uppercase px-3 py-1.5 rounded-full pointer-events-none"
                            style={{
                                background: OS_BLUE,
                                color: "#0A0418",
                                boxShadow: `0 0 18px ${OS_BLUE}88`,
                                animation: "vmDemoFlash 1.2s ease-out forwards",
                            }}
                        >
                            {flash}
                        </div>
                    )}
                    <div
                        className="grid gap-1 sm:gap-1.5 p-2 rounded-xl relative"
                        style={{
                            gridTemplateColumns: `repeat(${SIZE}, minmax(0,1fr))`,
                            background: "rgba(0,0,0,0.5)",
                            border: `1.5px solid ${GOLD}88`,
                            boxShadow: `inset 0 0 18px rgba(0,0,0,0.6), 0 0 14px ${GOLD}33`,
                        }}
                    >
                        {board.map((row, r) =>
                            row.map((cell, c) => {
                                const isSelected =
                                    selected?.r === r && selected?.c === c;
                                const isShaking = shake?.r === r && shake?.c === c;
                                const isMatched = matchedKeys.has(`${r}-${c}`);
                                return (
                                    <Tile
                                        key={cell?.uid ?? `${r}-${c}-empty`}
                                        cell={cell}
                                        isSelected={isSelected}
                                        isShaking={isShaking}
                                        isMatched={isMatched}
                                        onClick={() => handleClick(r, c)}
                                    />
                                );
                            }),
                        )}

                        {popups.map((p) => (
                            <ScorePopupNode key={p.id} popup={p} />
                        ))}
                    </div>
                </div>

                <div className="flex items-center justify-between mt-4 gap-3">
                    <p className="font-mundial text-white/55 text-[11px] sm:text-[12px] leading-snug max-w-[360px]">
                        Tap two adjacent pins to swap. Match three or more of the
                        same pin. Matching the OpenSea pin scores big.
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
    comboActive,
}: {
    label: string;
    value: string;
    color: string;
    comboActive?: boolean;
}) {
    return (
        <div
            className="rounded-lg px-2.5 py-2 text-center"
            style={{
                background: "rgba(0,0,0,0.5)",
                border: `1px solid ${color}40`,
            }}
        >
            <div
                className="font-mundial text-[8px] sm:text-[9px] tracking-[0.22em] uppercase mb-0.5"
                style={{ color: "rgba(255,255,255,0.45)" }}
            >
                {label}
            </div>
            <div
                className={`font-display font-black text-[14px] sm:text-[18px] leading-none ${
                    comboActive ? "combo-fire" : ""
                }`}
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
    isMatched,
    onClick,
}: {
    cell: Cell | null;
    isSelected: boolean;
    isShaking: boolean;
    isMatched: boolean;
    onClick: () => void;
}) {
    if (!cell) {
        return <div className="aspect-square" />;
    }
    const { type, fresh } = cell;
    const classes = [
        "relative aspect-square rounded-md cursor-pointer",
        isSelected ? "tile-selected" : "",
        isMatched ? "tile-matched" : "",
        isShaking ? "tile-shake" : "",
        fresh && !isMatched && !isSelected ? "tile-cascade" : "",
    ]
        .filter(Boolean)
        .join(" ");

    return (
        <button
            type="button"
            onClick={onClick}
            className={classes}
            style={{
                background: `linear-gradient(135deg, ${type.accent}33, ${type.accent}11)`,
                border: `1px solid ${type.accent}66`,
                boxShadow: type.isPartner
                    ? `0 0 8px ${type.accent}88, inset 0 0 4px ${type.accent}33`
                    : "inset 0 0 4px rgba(255,255,255,0.06)",
                transition:
                    "background 180ms ease-out, box-shadow 180ms ease-out, border-color 180ms",
                willChange: "transform, opacity",
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
                }}
            />
        </button>
    );
}

function ScorePopupNode({ popup }: { popup: ScorePopup }) {
    const left = `calc(${(popup.c + 0.5) * (100 / SIZE)}% )`;
    const top = `calc(${(popup.r + 0.5) * (100 / SIZE)}% )`;
    return (
        <div
            className="score-popup absolute pointer-events-none z-20"
            style={{
                left,
                top,
                transform: "translate(-50%, -50%)",
                color: popup.color,
                textShadow: `0 0 8px ${popup.color}, 0 2px 4px rgba(0,0,0,0.6)`,
                fontFamily: "var(--font-display, inherit)",
                fontWeight: 900,
                fontSize: "clamp(14px, 2vw, 22px)",
                letterSpacing: "0.04em",
            }}
        >
            {popup.text}
        </div>
    );
}
