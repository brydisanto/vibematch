"use client";

import { useState, type ReactNode } from "react";
import { GOLD } from "@/lib/arcade-tokens";

type Tab = "book" | "trophy";

/**
 * Tab toggle for the profile's showcase section. Both tabs are
 * server-rendered into the parent and passed in as ReactNodes; this
 * client island just manages which one is currently visible. Keeps
 * the page a server component while still letting the user flip
 * between PIN BOOK and TROPHY CASE without a navigation.
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
            <div className="flex items-center gap-4 mb-5">
                <TabButton active={active === "book"} onClick={() => setActive("book")}>
                    PIN BOOK
                </TabButton>
                <TabButton active={active === "trophy"} onClick={() => setActive("trophy")}>
                    TROPHY CASE
                </TabButton>
                <div
                    className="flex-1 h-px"
                    style={{ background: `linear-gradient(90deg, ${GOLD}44, transparent)` }}
                />
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
            className="font-display font-black tracking-[0.18em] transition-colors text-base sm:text-xl"
            style={{
                color: active ? GOLD : "rgba(255,255,255,0.35)",
            }}
        >
            {children}
        </button>
    );
}
