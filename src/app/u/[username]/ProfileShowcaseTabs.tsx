"use client";

import { useState, type ReactNode } from "react";
import { GOLD } from "@/lib/arcade-tokens";

type Tab = "book" | "trophy";

/**
 * Tab toggle for the profile's showcase section. Both tabs are
 * server-rendered into the parent and passed in as ReactNodes; this
 * client island just manages which one is currently visible.
 *
 * Underline style — centered text buttons with a gold underline
 * under the active tab + a hairline divider running across the
 * full width. Matches the "Option G" treatment from the design
 * preview: no pill, no chunky button, just clean type + a single
 * accent under the active label.
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
            <div
                className="flex items-center justify-center gap-8 sm:gap-12 mb-6"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
            >
                <TabButton active={active === "book"} onClick={() => setActive("book")}>
                    PIN BOOK
                </TabButton>
                <TabButton active={active === "trophy"} onClick={() => setActive("trophy")}>
                    TROPHY CASE
                </TabButton>
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
            className="relative font-display font-black tracking-[0.18em] text-sm sm:text-base px-1 py-3 sm:py-4 cursor-pointer transition-colors bg-transparent border-0"
            style={{ color: active ? GOLD : "rgba(255,255,255,0.4)" }}
        >
            {children}
            {active && (
                <span
                    className="absolute left-0 right-0 -bottom-px h-[2px]"
                    style={{ background: GOLD, boxShadow: `0 0 8px ${GOLD}80` }}
                />
            )}
        </button>
    );
}
