"use client";

import { useState } from "react";
import RerollNudge from "@/components/RerollNudge";

/**
 * Standalone preview of the reroll-reserve nudge (the real component, with
 * adjustable numbers). Not linked anywhere in the app — just for eyeballing
 * the pop-up. Visit /preview/reroll-nudge.
 */
export default function RerollNudgePreview() {
    const [open, setOpen] = useState(true);
    const [dupes, setDupes] = useState(354);
    const [rerolls, setRerolls] = useState(76);

    return (
        <div className="min-h-screen bg-[#0a0502] text-white flex flex-col items-center justify-center gap-6 p-6">
            <div className="text-center max-w-sm">
                <h1 className="font-display text-2xl font-black text-[#FFE048] uppercase mb-1">Reroll Nudge Preview</h1>
                <p className="text-white/40 text-sm">The live component with adjustable numbers. Close it, tweak, and reopen.</p>
            </div>

            <div className="w-full max-w-sm space-y-4 bg-white/[0.03] border border-white/10 rounded-xl p-5">
                <label className="block">
                    <span className="text-xs uppercase tracking-wider text-white/50">Duplicate pins: {dupes}</span>
                    <input type="range" min={10} max={2500} value={dupes} onChange={(e) => setDupes(+e.target.value)} className="w-full mt-2 accent-[#FFE048]" />
                </label>
                <label className="block">
                    <span className="text-xs uppercase tracking-wider text-white/50">Rerolls worth: {rerolls}</span>
                    <input type="range" min={5} max={660} value={rerolls} onChange={(e) => setRerolls(+e.target.value)} className="w-full mt-2 accent-[#FFE048]" />
                </label>
                <div className="flex gap-2 pt-1">
                    <button onClick={() => setOpen(true)} className="flex-1 py-2.5 rounded-lg bg-[#FFE048] text-black font-black uppercase text-sm tracking-wider hover:bg-[#FFE858]">Show nudge</button>
                    <button onClick={() => { setDupes(354); setRerolls(76); }} className="px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white/60 text-sm uppercase tracking-wider hover:bg-white/10">Reset</button>
                </div>
                <div className="flex gap-2 flex-wrap pt-1">
                    <button onClick={() => { setDupes(24); setRerolls(5); }} className="text-[11px] px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/50 hover:text-white/80">Small (min)</button>
                    <button onClick={() => { setDupes(354); setRerolls(76); }} className="text-[11px] px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/50 hover:text-white/80">Average</button>
                    <button onClick={() => { setDupes(2322); setRerolls(659); }} className="text-[11px] px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/50 hover:text-white/80">Whale (tutsya)</button>
                </div>
            </div>

            <RerollNudge
                isOpen={open}
                burnableDupes={dupes}
                rerolls={rerolls}
                onClose={() => setOpen(false)}
                onReroll={() => { setOpen(false); alert("(preview) this opens the Reroll modal in-game"); }}
            />
        </div>
    );
}
