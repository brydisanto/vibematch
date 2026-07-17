"use client";

import { useMemo, useState, type ReactNode } from "react";
import EventDrawer from "@/components/EventDrawer";
import { findPromoBadge, findPromoEventSet, getEventSetPins } from "@/lib/promo-badges";

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
    // eventId is either a standalone PromoBadge id or (for rolled-up
    // set-event trophies) a PromoEventSet id. Resolve either into the
    // drawer's promo shape.
    const drawerPromo = useMemo(() => {
        const promo = findPromoBadge(eventId);
        if (promo) {
            return {
                id: promo.id,
                name: promo.name,
                partnerName: promo.partnerName,
                tabLabel: promo.tabLabel,
                image: promo.image,
                description: promo.description,
                eventWindow: promo.eventWindow,
                prizeNote: promo.prizeNote,
                accentColor: promo.accentColor,
                startsAt: undefined,
                endsAt: promo.endsAt,
                eventSetId: promo.eventSetId,
            };
        }
        const set = findPromoEventSet(eventId);
        if (set) {
            const pins = getEventSetPins(set.id);
            const heroPin = [...pins].sort((a, b) => (b.points ?? 1) - (a.points ?? 1))[0];
            return {
                id: set.id,
                name: set.name,
                partnerName: set.partnerName,
                tabLabel: set.tabLabel,
                image: set.heroImage ?? heroPin?.image ?? "",
                description: set.description,
                eventWindow: set.eventWindow,
                prizeNote: set.prizeNote,
                accentColor: set.accentColor,
                startsAt: set.startsAt,
                endsAt: set.endsAt,
                eventSetId: set.id,
            };
        }
        return null;
    }, [eventId]);

    if (!drawerPromo) {
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
                aria-label={`Open ${drawerPromo.partnerName || drawerPromo.name} event leaderboard`}
            >
                {children}
            </button>
            {open && (
                <EventDrawer
                    onClose={() => setOpen(false)}
                    promo={drawerPromo}
                />
            )}
        </>
    );
}
