"use client";

import { useMemo, useState, type ReactNode } from "react";
import EventDrawer from "@/components/EventDrawer";
import { findPromoBadge } from "@/lib/promo-badges";

interface EventTrophyButtonProps {
    eventId: string;
    accent: string;
    children: ReactNode;
}

/**
 * Click-wrapper for the trophy-case event tile. Opens the same
 * EventDrawer used on the landing page so finalized leaderboards
 * remain one tap away from a player's profile. Works for any past
 * or present promo — looks up the PromoBadge by id.
 *
 * Falls back to a non-interactive div when no matching PromoBadge
 * exists (e.g. retired event whose definition was removed). The
 * trophy still displays; it just can't open a drawer.
 */
export default function EventTrophyButton({ eventId, accent, children }: EventTrophyButtonProps) {
    const [open, setOpen] = useState(false);
    const promo = useMemo(() => findPromoBadge(eventId), [eventId]);

    if (!promo) {
        return (
            <div
                className="rounded-xl p-4 flex flex-col items-center text-center"
                style={{
                    background: `linear-gradient(135deg, ${accent}18, ${accent}06)`,
                    border: `1.5px solid ${accent}40`,
                    boxShadow: `0 0 14px ${accent}33, 0 0 28px ${accent}18`,
                }}
            >
                {children}
            </div>
        );
    }

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="rounded-xl p-4 flex flex-col items-center text-center transition-transform hover:-translate-y-[2px] cursor-pointer w-full"
                style={{
                    background: `linear-gradient(135deg, ${accent}18, ${accent}06)`,
                    border: `1.5px solid ${accent}40`,
                    boxShadow: `0 0 14px ${accent}33, 0 0 28px ${accent}18`,
                }}
                aria-label={`Open ${promo.partnerName} event leaderboard`}
            >
                {children}
            </button>
            {open && (
                <EventDrawer
                    onClose={() => setOpen(false)}
                    promo={{
                        id: promo.id,
                        name: promo.name,
                        partnerName: promo.partnerName,
                        tabLabel: promo.tabLabel,
                        image: promo.image,
                        description: promo.description,
                        eventWindow: promo.eventWindow,
                        prizeNote: promo.prizeNote,
                        accentColor: promo.accentColor,
                        endsAt: promo.endsAt,
                        eventSetId: promo.eventSetId,
                    }}
                />
            )}
        </>
    );
}
