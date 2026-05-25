import Link from "next/link";
import Image from "next/image";
import { GOLD, ORANGE } from "@/lib/arcade-tokens";

export default function NotFound() {
    return (
        <div
            className="min-h-screen w-full flex items-center justify-center px-6"
            style={{ background: "linear-gradient(180deg, #1a0c2e 0%, #0a0418 60%, #14081f 100%)" }}
        >
            <div
                className="max-w-md w-full rounded-2xl p-8 text-center"
                style={{
                    background: "rgba(255,255,255,0.03)",
                    border: `1px solid ${GOLD}22`,
                    boxShadow: `0 10px 40px -10px ${ORANGE}22`,
                }}
            >
                <div className="mx-auto mb-4 w-16 h-16 relative">
                    <Image
                        src="/assets/gvc_shaka.png"
                        alt=""
                        fill
                        sizes="64px"
                        className="object-contain"
                    />
                </div>
                <h1 className="font-display font-black text-2xl text-white tracking-tight mb-2">
                    PLAYER NOT FOUND
                </h1>
                <p className="font-mundial text-[11px] uppercase tracking-[0.22em] text-white/40 mb-6">
                    This profile does not exist or is no longer active.
                </p>
                <Link
                    href="/"
                    className="inline-block font-display text-[11px] tracking-[0.28em] px-6 py-3 rounded-lg transition-all"
                    style={{
                        color: GOLD,
                        background: "rgba(255,255,255,0.04)",
                        border: `1px solid ${GOLD}33`,
                    }}
                >
                    BACK TO PIN DROP →
                </Link>
            </div>
        </div>
    );
}
