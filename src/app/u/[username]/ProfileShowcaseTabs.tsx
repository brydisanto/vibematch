"use client";

import { useState, type ReactNode } from "react";
import { GOLD, GOLD_DEEP } from "@/lib/arcade-tokens";

type Tab = "book" | "trophy";

/**
 * Tab toggle for the profile's showcase section. Both tabs are
 * server-rendered into the parent and passed in as ReactNodes; this
 * client island just manages which one is currently visible. Keeps
 * the page a server component while still letting the user flip
 * between PIN BOOK and TROPHY CASE without a navigation.
 *
 * Pill-style toggle on a dark track, centered above the content.
 * Active tab takes a gold gradient fill matching the home-screen
 * CHUNKY button treatment; inactive tabs sit transparent on the
 * track and brighten on hover. Cursor pointer makes the affordance
 * obvious.
 */
export default function ProfileShowcaseTabs({
    pinBook,
    trophyCase,
}: {
    pinBook: ReactNode;
    trophyCase: ReactNode;
}) {
    const [active, setActive] = useState<Tab>("book");
    return (
        <div>
            <div className="flex items-center justify-center mb-6">
                <div
                    className="inline-flex items-center gap-1 p-1 rounded-full"
                    style={{
                        background: "linear-gradient(180deg, #1A0A2E 0%, #0C0418 100%)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04), 0 4px 12px rgba(0,0,0,0.35)",
                    }}
                >
                    <TabButton active={active === "book"} onClick={() => setActive("book")}>
                        PIN BOOK
                    </TabButton>
                    <TabButton active={active === "trophy"} onClick={() => setActive("trophy")}>
                        TROPHY CASE
                    </TabButton>
                </div>
            </div>
            <div className={active === "book" ? "" : "hidden"}>{pinBook}</div>
            <div className={active === "trophy" ? "" : "hidden"}>{trophyCase}</div>
        </div>
    );
}

function TabButton({
    active,
    onClick,
    children,
}: {
    active: boolean;
    onClick: () => void;
    children: ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="font-display font-black tracking-[0.18em] text-xs sm:text-sm px-4 sm:px-5 py-2 rounded-full cursor-pointer transition-all"
            style={
                active
                    ? {
                          color: "#1A0E02",
                          background: `linear-gradient(180deg, ${GOLD} 0%, ${GOLD_DEEP} 100%)`,
                          boxShadow: `0 2px 0 ${GOLD_DEEP}, 0 4px 10px rgba(0,0,0,0.4)`,
                          textShadow: `0 1px 0 rgba(255,255,255,0.25)`,
                      }
                    : {
                          color: "rgba(255,255,255,0.45)",
                          background: "transparent",
                      }
            }
        >
            {children}
        </button>
    );
}
