"use client";

// ===== Web Audio API Sound Engine for VibeMatch =====
// Generates all sounds procedurally — no audio files needed.

let audioCtx: AudioContext | null = null;

// ===== Mixer Bus Architecture =====
let sfxGain: GainNode | null = null;
let musicGain: GainNode | null = null;
let masterGain: GainNode | null = null;

// ===== Voice Limiter =====
const MAX_VOICES = 14;
let activeVoiceCount = 0;

// Fix #3: Persist mute state — read from localStorage on module init.
const MUTE_STORAGE_KEY = 'vibmatch_muted';
export let isMuted: boolean = (() => {
    if (typeof window !== 'undefined') {
        return localStorage.getItem(MUTE_STORAGE_KEY) === 'true';
    }
    return false;
})();

// Fix #3: Exported helper so callers can explicitly sync module state from storage.
export function loadMuteState(): boolean {
    if (typeof window !== 'undefined') {
        isMuted = localStorage.getItem(MUTE_STORAGE_KEY) === 'true';
    }
    return isMuted;
}

// ===== MUTE TOGGLE =====
export function toggleMute(muted: boolean): boolean {
    isMuted = muted;

    // Fix #3: Persist mute preference to localStorage.
    if (typeof window !== 'undefined') {
        localStorage.setItem(MUTE_STORAGE_KEY, String(muted));
    }

    // Silence SFX via the mixer bus
    if (sfxGain) {
        sfxGain.gain.value = muted ? 0 : 0.8;
    }

    // Silence music via mixer bus (or element volume as fallback)
    if (musicGain) {
        musicGain.gain.value = muted ? 0 : 0.3;
    }

    if (bgmAudio) {
        if (muted) {
            bgmAudio.pause();
        } else {
            if (!bgmMediaSource) {
                bgmAudio.volume = 0.3;
            }
            // Only try to play if we actually have a source loaded to prevent empty play requests
            if (bgmAudio.src) {
                bgmAudio.play().catch(console.error);
            }
        }
    }

    // Fix #4: When unmuting, restart BGM if it should be playing but isn't.
    if (!muted) {
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume().catch(console.error);
        }
        // If BGM should be playing (bgmShouldPlay flag is set) but audio is not
        // currently playing (no element, or element is paused/ended), start it.
        if (bgmShouldPlay && (!bgmAudio || bgmAudio.paused)) {
            startMP3();
        }
    }

    return isMuted;
}

// ===== BACKGROUND MUSIC =====
let bgmAudio: HTMLAudioElement | null = null;
let currentBGMTrack = 0;
// Fix #4: Track whether BGM has been requested to play.
let bgmShouldPlay = false;

export const BGM_TRACK_NAMES = [
    "Feel The Beat",
    "Bean",
    "Werq",
    "Late Night Radio",
    "Funkorama",
    "Voxel Revolution",
    "Electrodoodle"
];

const BGM_FILES = [
    "/music/feel-the-beat.mp3",
    "/music/bean.mp3",
    "/music/werq.mp3",
    "/music/late-night-radio.mp3",
    "/music/funkorama.mp3",
    "/music/voxel-revolution.mp3",
    "/music/electrodoodle.mp3"
];

function stopMP3() {
    if (bgmAudio) {
        bgmAudio.pause();
        bgmAudio.currentTime = 0;
    }
}

let bgmMediaSource: MediaElementAudioSourceNode | null = null;

function routeBGMThroughMixer() {
    if (bgmAudio && !bgmMediaSource) {
        const ctx = getAudioContext();
        if (ctx && musicGain) {
            try {
                bgmMediaSource = ctx.createMediaElementSource(bgmAudio);
                bgmMediaSource.connect(musicGain);
                // Once routed through Web Audio, set element volume to 1
                // (musicGain controls actual volume)
                bgmAudio.volume = 1;
            } catch {
                // Already connected or not available
            }
        }
    }
}

function startMP3() {
    try {
        if (!bgmAudio) {
            bgmAudio = new Audio();
            bgmAudio.loop = true;
            bgmAudio.crossOrigin = "anonymous";
        }
        // Load the selected track
        const targetSrc = BGM_FILES[currentBGMTrack % BGM_FILES.length] || BGM_FILES[0];
        if (!bgmAudio.src.endsWith(targetSrc)) {
            bgmAudio.src = targetSrc;
            bgmAudio.load();
        }

        // Route through Web Audio mixer for ducking support
        routeBGMThroughMixer();

        // If not routed through mixer, use element volume as fallback
        if (!bgmMediaSource) {
            bgmAudio.volume = isMuted ? 0 : 0.3;
        }

        // Safari/iOS strict play policy requires handling the promise
        const playPromise = bgmAudio.play();
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                console.warn("Autoplay prevented by browser:", error);
            });
        }
    } catch {
        // Audio not available
    }
}

export function getCurrentTrackIndex(): number {
    return currentBGMTrack;
}

export function selectBGMTrack(index: number): string {
    currentBGMTrack = index % BGM_TRACK_NAMES.length;
    if (bgmAudio) {
        stopMP3();
    }
    if (bgmShouldPlay) {
        startMP3();
    }
    return BGM_TRACK_NAMES[currentBGMTrack];
}

export function switchBGMTrack(): string {
    currentBGMTrack = (currentBGMTrack + 1) % BGM_TRACK_NAMES.length;

    // Actually switch the playing music if unmuted!
    if (bgmAudio) {
        stopMP3();
    }
    startMP3();

    return BGM_TRACK_NAMES[currentBGMTrack];
}

export function startBGM() {
    // Fix #4: Record that BGM should be playing so unmute can restart it.
    bgmShouldPlay = true;
    startMP3();
}

// Ensure AudioContext is only created immediately when needed, or unlocked on touch
export function unlockAudio() {
    getAudioContext();
}

function getAudioContext(): AudioContext | null {
    if (!audioCtx) {
        if (typeof window === "undefined") return null;
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioContextClass) {
            audioCtx = new AudioContextClass();

            // Initialize mixer bus architecture
            masterGain = audioCtx.createGain();
            masterGain.gain.value = 1.0;
            masterGain.connect(audioCtx.destination);

            sfxGain = audioCtx.createGain();
            sfxGain.gain.value = 0.8;
            sfxGain.connect(masterGain);

            musicGain = audioCtx.createGain();
            musicGain.gain.value = 0.3;
            musicGain.connect(masterGain);
        }
    }
    if (audioCtx && audioCtx.state === "suspended") {
        audioCtx.resume().catch(() => { });
    }
    return audioCtx;
}

// ===== Volume Controls =====
export function setSFXVolume(v: number) {
    const ctx = getAudioContext();
    if (ctx && sfxGain) {
        sfxGain.gain.setValueAtTime(v, ctx.currentTime);
    }
}

export function setMusicVolume(v: number) {
    const ctx = getAudioContext();
    if (ctx && musicGain) {
        musicGain.gain.setValueAtTime(v, ctx.currentTime);
    }
}

export function setMasterVolume(v: number) {
    const ctx = getAudioContext();
    if (ctx && masterGain) {
        masterGain.gain.setValueAtTime(v, ctx.currentTime);
    }
}

// Utility: get the SFX output node (mixer bus or fallback to destination)
function getSFXOutput(ctx: AudioContext): AudioNode {
    return sfxGain || ctx.destination;
}

// Utility: play a note with envelope — routed through sfxGain bus
function playNote(
    freq: number,
    duration: number,
    type: OscillatorType = "sine",
    volume: number = 0.15,
    delay: number = 0
) {
    try {
        const ctx = getAudioContext();
        if (!ctx) return;

        // Voice limiter
        if (activeVoiceCount >= MAX_VOICES) return;

        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
        gainNode.gain.setValueAtTime(0, ctx.currentTime + delay);
        gainNode.gain.linearRampToValueAtTime(volume, ctx.currentTime + delay + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);

        osc.connect(gainNode);
        gainNode.connect(getSFXOutput(ctx));

        osc.start(ctx.currentTime + delay);
        activeVoiceCount++;
        osc.stop(ctx.currentTime + delay + duration);

        // Fix #5: Disconnect nodes after they stop to prevent memory leaks.
        setTimeout(() => {
            osc.disconnect();
            gainNode.disconnect();
            activeVoiceCount--;
        }, (delay + duration + 0.2) * 1000);
    } catch {
        // Audio not available
    }
}

// Utility: white noise burst — routed through sfxGain bus
function playNoise(duration: number, volume: number = 0.05, delay: number = 0, filterType: BiquadFilterType = "highpass", filterFreq: number = 2000) {
    try {
        const ctx = getAudioContext();
        if (!ctx) return;

        // Voice limiter
        if (activeVoiceCount >= MAX_VOICES) return;

        const bufferSize = ctx.sampleRate * duration;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
        }

        const source = ctx.createBufferSource();
        source.buffer = buffer;

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(volume, ctx.currentTime + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);

        const filter = ctx.createBiquadFilter();
        filter.type = filterType;
        filter.frequency.value = filterFreq;

        source.connect(filter);
        filter.connect(gain);
        gain.connect(getSFXOutput(ctx));

        source.start(ctx.currentTime + delay);
        activeVoiceCount++;

        setTimeout(() => {
            source.disconnect();
            filter.disconnect();
            gain.disconnect();
            activeVoiceCount--;
        }, (delay + duration + 0.2) * 1000);
    } catch {
        // Audio not available
    }
}

// ===== GAME SOUNDS =====

// Tile select — soft click
export function playSelectSound() {
    playNote(800, 0.08, "sine", 0.08);
    playNote(1200, 0.05, "sine", 0.05, 0.02);
}

// Tile deselect
export function playDeselectSound() {
    playNote(600, 0.06, "sine", 0.06);
}

// Invalid swap — dull thud
export function playInvalidSwapSound() {
    playNote(150, 0.15, "square", 0.06);
    playNote(100, 0.15, "square", 0.04, 0.05);
}

// Match-3 — bright ascending chime
export function playMatch3Sound() {
    playNote(523, 0.12, "sine", 0.12); // C5
    playNote(659, 0.12, "sine", 0.12, 0.06); // E5
    playNote(784, 0.15, "sine", 0.14, 0.12); // G5
}

// Match-4 — bigger chord + sparkle
export function playMatch4Sound() {
    playNote(523, 0.15, "sine", 0.14); // C5
    playNote(659, 0.15, "triangle", 0.12, 0.05); // E5
    playNote(784, 0.15, "sine", 0.14, 0.1); // G5
    playNote(1047, 0.2, "sine", 0.16, 0.15); // C6
    playNoise(0.15, 0.04, 0.1);
}

// Match-5 — epic ascending fanfare
export function playMatch5Sound() {
    playNote(523, 0.12, "sine", 0.15); // C5
    playNote(659, 0.12, "sine", 0.15, 0.04); // E5
    playNote(784, 0.12, "sine", 0.15, 0.08); // G5
    playNote(1047, 0.15, "triangle", 0.18, 0.12); // C6
    playNote(1319, 0.25, "sine", 0.2, 0.16); // E6
    playNoise(0.2, 0.06, 0.12);
    // Sub bass thump
    playNote(80, 0.3, "sine", 0.15, 0.08);
}

// Cascade — descending sparkle
export function playCascadeSound(cascadeLevel: number) {
    const baseFreq = 700 + cascadeLevel * 200;
    playNote(baseFreq, 0.08, "sine", 0.08);
    playNote(baseFreq * 1.25, 0.08, "sine", 0.08, 0.04);
    playNote(baseFreq * 1.5, 0.1, "sine", 0.1, 0.08);
}

// Combo fire — rising power tone with 5 distinct tiers
export function playComboSound(comboLevel: number) {
    const ctx = getAudioContext();
    if (!ctx) return;

    const baseFreq = 300 + comboLevel * 200;

    if (comboLevel >= 6) {
        // Tier 5 (rkf4trrgrggrgh, combo 6+): Deliberately glitched
        // Rapid random frequency jumps through distortion — intentionally broken/chaotic
        try {
            const osc = ctx.createOscillator();
            osc.type = "square";
            const oscGain = ctx.createGain();
            oscGain.gain.setValueAtTime(0.1, ctx.currentTime);

            // WaveShaperNode with hard clip distortion curve
            const distortion = ctx.createWaveShaper();
            const curveLen = 256;
            const curve = new Float32Array(curveLen);
            for (let i = 0; i < curveLen; i++) {
                const x = (i * 2) / curveLen - 1;
                curve[i] = x > 0.3 ? 1 : x < -0.3 ? -1 : x * 3.33;
            }
            distortion.curve = curve;
            distortion.oversample = "4x";

            // Rapid random frequency jumps
            for (let i = 0; i < 12; i++) {
                const t = ctx.currentTime + i * 0.03;
                osc.frequency.setValueAtTime(50 + Math.random() * 1950, t);
            }

            osc.connect(distortion);
            distortion.connect(oscGain);
            oscGain.connect(getSFXOutput(ctx));
            oscGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

            osc.start(ctx.currentTime);
            activeVoiceCount++;
            osc.stop(ctx.currentTime + 0.4);

            setTimeout(() => {
                osc.disconnect();
                distortion.disconnect();
                oscGain.disconnect();
                activeVoiceCount--;
            }, 600);

            // Noise burst on top
            playNoise(0.3, 0.1, 0, "bandpass", 1000);
        } catch {
            // Audio not available
        }
    } else if (comboLevel >= 5) {
        // Tier 4 (MAX STOKED!, combo 5): Detuned chorus + rising arpeggio 4 notes
        playNote(baseFreq, 0.2, "sawtooth", 0.08, 0);
        // Detuned pair for chorus beating
        try {
            const osc1 = ctx.createOscillator();
            const osc2 = ctx.createOscillator();
            const g1 = ctx.createGain();
            const g2 = ctx.createGain();
            osc1.type = "sawtooth";
            osc2.type = "sawtooth";
            osc1.frequency.setValueAtTime(baseFreq * 2 + 3, ctx.currentTime);
            osc2.frequency.setValueAtTime(baseFreq * 2 - 3, ctx.currentTime);
            g1.gain.setValueAtTime(0.06, ctx.currentTime);
            g1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
            g2.gain.setValueAtTime(0.06, ctx.currentTime);
            g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
            osc1.connect(g1);
            g1.connect(getSFXOutput(ctx));
            osc2.connect(g2);
            g2.connect(getSFXOutput(ctx));
            osc1.start(ctx.currentTime);
            osc2.start(ctx.currentTime);
            activeVoiceCount += 2;
            osc1.stop(ctx.currentTime + 0.25);
            osc2.stop(ctx.currentTime + 0.25);
            setTimeout(() => {
                osc1.disconnect(); g1.disconnect();
                osc2.disconnect(); g2.disconnect();
                activeVoiceCount -= 2;
            }, 450);
        } catch {
            // Audio not available
        }
        // Rising arpeggio 4 notes
        [1, 1.25, 1.5, 2].forEach((multiplier, i) => {
            playNote(baseFreq * multiplier, 0.1, "sine", 0.08, 0.1 + i * 0.03);
        });
    } else if (comboLevel >= 4) {
        // Tier 3 (ELECTRIC!!, combo 4): Two detuned oscillators for chorus beating
        try {
            const osc1 = ctx.createOscillator();
            const osc2 = ctx.createOscillator();
            const g1 = ctx.createGain();
            const g2 = ctx.createGain();
            osc1.type = "sawtooth";
            osc2.type = "sawtooth";
            osc1.frequency.setValueAtTime(baseFreq + 3, ctx.currentTime);
            osc2.frequency.setValueAtTime(baseFreq - 3, ctx.currentTime);
            g1.gain.setValueAtTime(0.08, ctx.currentTime);
            g1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
            g2.gain.setValueAtTime(0.08, ctx.currentTime);
            g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
            osc1.connect(g1);
            g1.connect(getSFXOutput(ctx));
            osc2.connect(g2);
            g2.connect(getSFXOutput(ctx));
            osc1.start(ctx.currentTime);
            osc2.start(ctx.currentTime);
            activeVoiceCount += 2;
            osc1.stop(ctx.currentTime + 0.25);
            osc2.stop(ctx.currentTime + 0.25);
            setTimeout(() => {
                osc1.disconnect(); g1.disconnect();
                osc2.disconnect(); g2.disconnect();
                activeVoiceCount -= 2;
            }, 450);
        } catch {
            // Audio not available
        }
        playNote(baseFreq * 2, 0.2, "sine", 0.12, 0.05);
    } else if (comboLevel >= 3) {
        // Tier 2 (VIBES!, combo 3): Basic sweep + harmony note (fifth above)
        playNote(baseFreq, 0.2, "sawtooth", 0.08, 0);
        playNote(baseFreq * 1.5, 0.2, "sawtooth", 0.06, 0); // fifth above
        playNote(baseFreq * 2, 0.2, "sine", 0.12, 0.05);
    } else {
        // Tier 1 (NICE!, combo 2): Basic sawtooth sweep — original behavior
        playNote(baseFreq, 0.2, "sawtooth", 0.08, 0);
        playNote(baseFreq * 2, 0.2, "sine", 0.12, 0.05);
    }
}

// Bomb explosion
export function playBombSound() {
    playNote(60, 0.4, "sine", 0.2);
    playNote(80, 0.35, "square", 0.08);
    playNoise(0.3, 0.12);
    playNote(120, 0.2, "sawtooth", 0.08, 0.05);
}

// Cosmic blast — ethereal sweep
export function playCosmicBlastSound() {
    for (let i = 0; i < 8; i++) {
        playNote(400 + i * 200, 0.25, "sine", 0.06, i * 0.03);
    }
    playNote(60, 0.5, "sine", 0.15);
    playNoise(0.4, 0.08, 0.05);
}

// Game over — descending melody
export function playGameOverSound() {
    playNote(784, 0.2, "sine", 0.12); // G5
    playNote(659, 0.2, "sine", 0.12, 0.15); // E5
    playNote(523, 0.2, "sine", 0.12, 0.3); // C5
    playNote(392, 0.4, "sine", 0.15, 0.45); // G4
}

// Score milestone — victory sting
export function playMilestoneSound() {
    playNote(523, 0.1, "sine", 0.15);
    playNote(659, 0.1, "sine", 0.15, 0.06);
    playNote(784, 0.1, "sine", 0.15, 0.12);
    playNote(1047, 0.3, "triangle", 0.18, 0.18);
    playNote(1319, 0.2, "sine", 0.1, 0.24);
}

// ===== NEW SOUNDS =====

// Vibestreak — electric zap/crackle
export function playVibestreakSound() {
    const ctx = getAudioContext();
    if (!ctx) return;

    // Fast noise burst through bandpass filter at 2kHz, Q=5
    try {
        if (activeVoiceCount >= MAX_VOICES) return;

        const bufferSize = ctx.sampleRate * 0.15;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
        }
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        const bpFilter = ctx.createBiquadFilter();
        bpFilter.type = "bandpass";
        bpFilter.frequency.value = 2000;
        bpFilter.Q.value = 5;
        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.12, ctx.currentTime);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
        source.connect(bpFilter);
        bpFilter.connect(noiseGain);
        noiseGain.connect(getSFXOutput(ctx));
        source.start(ctx.currentTime);
        activeVoiceCount++;
        setTimeout(() => {
            source.disconnect();
            bpFilter.disconnect();
            noiseGain.disconnect();
            activeVoiceCount--;
        }, 350);
    } catch {
        // Audio not available
    }

    // Descending pitch sweep: sawtooth from 1200Hz to 200Hz over 0.3s
    try {
        if (activeVoiceCount >= MAX_VOICES) return;

        const osc = ctx.createOscillator();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(1200, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.3);
        const sweepGain = ctx.createGain();
        sweepGain.gain.setValueAtTime(0.1, ctx.currentTime);
        sweepGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc.connect(sweepGain);
        sweepGain.connect(getSFXOutput(ctx));
        osc.start(ctx.currentTime);
        activeVoiceCount++;
        osc.stop(ctx.currentTime + 0.3);
        setTimeout(() => {
            osc.disconnect();
            sweepGain.disconnect();
            activeVoiceCount--;
        }, 500);
    } catch {
        // Audio not available
    }

    // Sub bass hit: sine at 60Hz, gain 0.4, duration 0.2s
    playNote(60, 0.2, "sine", 0.4);
}

// Final move warning — heartbeat tension
export function playFinalMoveWarning(movesLeft: number) {
    // Speed increases as movesLeft decreases
    let gap: number;
    if (movesLeft <= 1) {
        gap = 0.3;
    } else if (movesLeft <= 2) {
        gap = 0.5;
    } else {
        gap = 0.8;
    }

    // Two sine pulses at 80Hz (sub bass), like a heartbeat: thump-thump
    playNote(80, 0.15, "sine", 0.5);
    playNote(80, 0.15, "sine", 0.5, gap);
}

// Shape bonus — chord stab
export function playShapeBonusSound(shape: 'L' | 'T' | 'cross') {
    const ctx = getAudioContext();
    if (!ctx) return;

    if (shape === 'L') {
        // C major triad (C4-E4-G4) as triangle waves, 0.15s
        playNote(262, 0.15, "triangle", 0.12);
        playNote(330, 0.15, "triangle", 0.12);
        playNote(392, 0.15, "triangle", 0.12);
    } else if (shape === 'T') {
        // C major 7th (C4-E4-G4-B4) as triangle waves, 0.2s
        playNote(262, 0.2, "triangle", 0.1);
        playNote(330, 0.2, "triangle", 0.1);
        playNote(392, 0.2, "triangle", 0.1);
        playNote(494, 0.2, "triangle", 0.1);
    } else if (shape === 'cross') {
        // Power chord (C4-G4-C5) as sawtooth through lowpass at 3kHz, 0.25s, with shimmer noise
        try {
            const freqs = [262, 392, 523];
            freqs.forEach(freq => {
                if (activeVoiceCount >= MAX_VOICES) return;
                const osc = ctx.createOscillator();
                osc.type = "sawtooth";
                osc.frequency.setValueAtTime(freq, ctx.currentTime);
                const lpFilter = ctx.createBiquadFilter();
                lpFilter.type = "lowpass";
                lpFilter.frequency.value = 3000;
                const g = ctx.createGain();
                g.gain.setValueAtTime(0.1, ctx.currentTime);
                g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
                osc.connect(lpFilter);
                lpFilter.connect(g);
                g.connect(getSFXOutput(ctx));
                osc.start(ctx.currentTime);
                activeVoiceCount++;
                osc.stop(ctx.currentTime + 0.25);
                setTimeout(() => {
                    osc.disconnect();
                    lpFilter.disconnect();
                    g.disconnect();
                    activeVoiceCount--;
                }, 450);
            });
        } catch {
            // Audio not available
        }
        // Shimmer noise
        playNoise(0.2, 0.04, 0, "highpass", 4000);
    }
}

// Hint — gentle nudge
export function playHintSound() {
    // Two ascending triangle wave notes: E5 then G5
    playNote(659, 0.1, "triangle", 0.15); // E5
    playNote(784, 0.1, "triangle", 0.15, 0.15); // G5 after 0.1s note + 0.05s gap
}

// UI click — button feedback
export function playUIClick() {
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
        if (activeVoiceCount >= MAX_VOICES) return;

        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.setValueAtTime(1000, ctx.currentTime);

        const gainNode = ctx.createGain();
        // Very fast attack and decay over 6ms
        gainNode.gain.setValueAtTime(0, ctx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.001);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.006);

        osc.connect(gainNode);
        gainNode.connect(getSFXOutput(ctx));

        osc.start(ctx.currentTime);
        activeVoiceCount++;
        osc.stop(ctx.currentTime + 0.006);

        setTimeout(() => {
            osc.disconnect();
            gainNode.disconnect();
            activeVoiceCount--;
        }, 50);
    } catch {
        // Audio not available
    }
}

// Game start — session opener
export function playGameStartSound() {
    // Ascending arpeggio: C4, E4, G4, C5 as triangle waves
    const notes = [262, 330, 392, 523];
    notes.forEach((freq, i) => {
        playNote(freq, 0.15, "triangle", 0.4, i * 0.08);
        // Small reverb-like tail using delayed quiet copy
        playNote(freq, 0.25, "triangle", 0.08, i * 0.08 + 0.05);
    });
}

// New high score — celebration
export function playNewHighScoreSound() {
    // 6-note ascending fanfare: C5, E5, G5, C6, E6, G6
    const notes = [523, 659, 784, 1047, 1319, 1568];
    notes.forEach((freq, i) => {
        // Mix of triangle + sine
        playNote(freq, 0.12, "triangle", 0.3, i * 0.06);
        playNote(freq, 0.12, "sine", 0.2, i * 0.06);
    });
    // Shimmer noise tail
    playNoise(0.3, 0.06, 0.3, "highpass", 4000);
}

// Tile drop landing — soft percussive
export function playTileLandSound(column: number) {
    // Short sine pip, pitch varies by column
    const freq = 400 + column * 25;
    playNote(freq, 0.015, "sine", 0.1);
}

// ===== Music Ducking =====
function duckMusic() {
    const ctx = getAudioContext();
    if (!ctx || !musicGain || isMuted) return;

    const now = ctx.currentTime;
    // Ramp musicGain to 0.15 over 50ms
    musicGain.gain.cancelScheduledValues(now);
    musicGain.gain.setValueAtTime(musicGain.gain.value, now);
    musicGain.gain.linearRampToValueAtTime(0.15, now + 0.05);
    // After 400ms, ramp back to 0.3 over 500ms
    musicGain.gain.linearRampToValueAtTime(0.15, now + 0.45);
    musicGain.gain.linearRampToValueAtTime(0.3, now + 0.95);
}

// ===== CAPSULE SOUNDS =====

// Capsule appear — heavy thud when capsule drops in
export function playCapsuleAppearSound() {
    // Deep impact thud
    playNote(60, 0.3, "sine", 0.35);
    playNote(90, 0.2, "sine", 0.2, 0.02);
    // Metallic ring
    playNote(800, 0.15, "triangle", 0.06, 0.03);
    playNote(1200, 0.1, "sine", 0.04, 0.04);
    // Impact noise burst
    playNoise(0.12, 0.08, 0.02, "lowpass", 800);
}

// Capsule anticipation — 2.8s building tension with micro-pause feel
export function playCapsuleAnticipateSound() {
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
        if (activeVoiceCount >= MAX_VOICES - 2) return;

        // Phase 1: Low rumble building (0-0.9s)
        const osc1 = ctx.createOscillator();
        osc1.type = "sine";
        osc1.frequency.setValueAtTime(60, ctx.currentTime);
        osc1.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.8);
        const g1 = ctx.createGain();
        g1.gain.setValueAtTime(0.03, ctx.currentTime);
        g1.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.8);
        // Micro-pause: brief volume dip at ~0.9s
        g1.gain.linearRampToValueAtTime(0.04, ctx.currentTime + 0.95);
        g1.gain.linearRampToValueAtTime(0.04, ctx.currentTime + 1.0);
        // Phase 2: Medium build (1.0-1.7s)
        g1.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 1.6);
        // Micro-pause 2: volume dip at ~1.7s
        g1.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 1.75);
        g1.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 1.85);
        // Phase 3: Frantic finale (1.85-2.7s)
        osc1.frequency.exponentialRampToValueAtTime(500, ctx.currentTime + 2.6);
        g1.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 2.5);
        g1.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 2.65);
        g1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2.8);

        osc1.connect(g1);
        g1.connect(getSFXOutput(ctx));
        osc1.start(ctx.currentTime);
        activeVoiceCount++;
        osc1.stop(ctx.currentTime + 2.8);
        setTimeout(() => { osc1.disconnect(); g1.disconnect(); activeVoiceCount--; }, 3000);

        // Rattling noise that intensifies with micro-pauses
        const bufferSize = Math.floor(ctx.sampleRate * 2.8);
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            const progress = i / bufferSize;
            // Micro-pause dips at 32% and 62%
            const pauseZone1 = progress > 0.30 && progress < 0.36;
            const pauseZone2 = progress > 0.60 && progress < 0.66;
            const pauseMul = (pauseZone1 || pauseZone2) ? 0.1 : 1;
            // Rattle gets faster and louder toward the end
            const rattle = Math.sin(progress * 300 * Math.PI) > 0 ? 1 : -1;
            data[i] = (Math.random() * 0.5 + rattle * 0.5) * progress * progress * pauseMul;
        }
        const source = ctx.createBufferSource();
        source.buffer = buffer;

        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.015, ctx.currentTime);
        noiseGain.gain.linearRampToValueAtTime(0.04, ctx.currentTime + 0.8);
        noiseGain.gain.linearRampToValueAtTime(0.02, ctx.currentTime + 1.0); // pause
        noiseGain.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 1.6);
        noiseGain.gain.linearRampToValueAtTime(0.025, ctx.currentTime + 1.85); // pause
        noiseGain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 2.5);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2.8);

        const filter = ctx.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.setValueAtTime(200, ctx.currentTime);
        filter.frequency.exponentialRampToValueAtTime(2500, ctx.currentTime + 2.6);
        filter.Q.value = 2;

        source.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(getSFXOutput(ctx));
        source.start(ctx.currentTime);
        activeVoiceCount++;
        setTimeout(() => { source.disconnect(); filter.disconnect(); noiseGain.disconnect(); activeVoiceCount--; }, 3000);

        // High tension tone — crystalline anxiety (last 1.5s)
        const tensionOsc = ctx.createOscillator();
        tensionOsc.type = "sine";
        tensionOsc.frequency.setValueAtTime(3000, ctx.currentTime + 1.3);
        const tensionGain = ctx.createGain();
        tensionGain.gain.setValueAtTime(0, ctx.currentTime + 1.3);
        tensionGain.gain.linearRampToValueAtTime(0.03, ctx.currentTime + 1.8);
        tensionGain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 2.6);
        tensionGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2.8);
        tensionOsc.connect(tensionGain);
        tensionGain.connect(getSFXOutput(ctx));
        tensionOsc.start(ctx.currentTime + 1.3);
        activeVoiceCount++;
        tensionOsc.stop(ctx.currentTime + 2.8);
        setTimeout(() => { tensionOsc.disconnect(); tensionGain.disconnect(); activeVoiceCount--; }, 3000);
    } catch {
        // Audio not available
    }

    // Heartbeat-like sub thumps — 3 phases matching micro-pauses
    // Phase 1: slow
    const thumps1 = [0, 0.4, 0.7];
    thumps1.forEach((t, i) => playNote(50 + i * 3, 0.1, "sine", 0.06 + i * 0.015, t));
    // Phase 2: medium (after pause)
    const thumps2 = [1.0, 1.25, 1.45, 1.6];
    thumps2.forEach((t, i) => playNote(55 + i * 5, 0.1, "sine", 0.1 + i * 0.02, t));
    // Phase 3: frantic (after second pause)
    const thumps3 = [1.85, 2.0, 2.12, 2.22, 2.32, 2.4, 2.48, 2.55, 2.62];
    thumps3.forEach((t, i) => playNote(60 + i * 5, 0.08, "sine", Math.min(0.12 + i * 0.025, 0.35), t));
}

// Capsule crack — explosive burst
export function playCapsuleCrackSound(tier: 'blue' | 'silver' | 'gold' | 'cosmic' = 'blue') {
    const ctx = getAudioContext();
    if (!ctx) return;

    const isHigh = tier === 'gold' || tier === 'cosmic';

    // Deep explosive impact
    playNote(40, 0.4, "sine", 0.4);
    playNote(65, 0.3, "sine", 0.3, 0.01);
    // Cracking noise
    playNoise(0.25, isHigh ? 0.15 : 0.1, 0, "highpass", 1500);
    // Shattering glass-like tones
    playNote(2000, 0.08, "square", 0.06, 0.02);
    playNote(3200, 0.06, "square", 0.04, 0.03);
    playNote(4800, 0.04, "square", 0.03, 0.04);

    if (isHigh) {
        // Extra dramatic boom for gold/cosmic
        playNote(30, 0.5, "sine", 0.35, 0.02);
        playNoise(0.35, 0.12, 0.05, "lowpass", 600);
        // Rising shimmer
        for (let i = 0; i < 5; i++) {
            playNote(1000 + i * 400, 0.12, "sine", 0.04, 0.05 + i * 0.02);
        }
    }

    if (tier === 'cosmic') {
        // Ethereal sweep for cosmic
        try {
            if (activeVoiceCount >= MAX_VOICES) return;
            const osc = ctx.createOscillator();
            osc.type = "sine";
            osc.frequency.setValueAtTime(200, ctx.currentTime + 0.05);
            osc.frequency.exponentialRampToValueAtTime(2000, ctx.currentTime + 0.4);
            const g = ctx.createGain();
            g.gain.setValueAtTime(0.12, ctx.currentTime + 0.05);
            g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
            osc.connect(g);
            g.connect(getSFXOutput(ctx));
            osc.start(ctx.currentTime + 0.05);
            activeVoiceCount++;
            osc.stop(ctx.currentTime + 0.5);
            setTimeout(() => { osc.disconnect(); g.disconnect(); activeVoiceCount--; }, 700);
        } catch { /* */ }
    }
}

// Capsule reveal — magical fanfare (tier-dependent richness)
export function playCapsuleRevealSound(tier: 'blue' | 'silver' | 'gold' | 'cosmic' = 'blue') {
    // Base reveal chime — ascending
    const baseNotes = [523, 659, 784]; // C5, E5, G5
    baseNotes.forEach((freq, i) => {
        playNote(freq, 0.2, "triangle", 0.15, 0.05 + i * 0.07);
    });

    if (tier === 'silver' || tier === 'gold' || tier === 'cosmic') {
        // Extended arpeggio
        playNote(1047, 0.25, "sine", 0.15, 0.26); // C6
        playNote(1319, 0.2, "sine", 0.1, 0.33); // E6
    }

    if (tier === 'gold' || tier === 'cosmic') {
        // Sparkle shimmer
        playNoise(0.3, 0.05, 0.2, "highpass", 5000);
        // Warm pad chord
        playNote(262, 0.5, "triangle", 0.06, 0.1); // C4
        playNote(330, 0.5, "triangle", 0.06, 0.1); // E4
        playNote(392, 0.5, "triangle", 0.06, 0.1); // G4
        // Victory stinger
        playNote(1568, 0.3, "sine", 0.12, 0.38); // G6
    }

    if (tier === 'cosmic') {
        // Ethereal choir-like overtones
        for (let i = 0; i < 6; i++) {
            playNote(500 + i * 250, 0.4, "sine", 0.04, 0.1 + i * 0.04);
        }
        // Deep cosmic boom
        playNote(40, 0.6, "sine", 0.15, 0.05);
        // Shimmer cascade
        for (let i = 0; i < 4; i++) {
            playNoise(0.15, 0.03, 0.3 + i * 0.08, "highpass", 4000 + i * 1000);
        }
    }
}

// Capsule collect — satisfying swoosh into pin book
export function playCapsuleCollectSound() {
    const ctx = getAudioContext();
    if (!ctx) return;

    // Descending swoosh
    try {
        if (activeVoiceCount >= MAX_VOICES) return;
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.setValueAtTime(1200, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.3);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.12, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        osc.connect(g);
        g.connect(getSFXOutput(ctx));
        osc.start(ctx.currentTime);
        activeVoiceCount++;
        osc.stop(ctx.currentTime + 0.35);
        setTimeout(() => { osc.disconnect(); g.disconnect(); activeVoiceCount--; }, 550);
    } catch { /* */ }

    // Soft impact at end
    playNote(300, 0.08, "sine", 0.1, 0.2);
    playNote(150, 0.12, "sine", 0.08, 0.22);
    // Noise whoosh
    playNoise(0.2, 0.06, 0, "bandpass", 1500);
}

// Context-aware match sound based on score value
export function playMatchSound(scoreGained: number, combo: number, matchSize: number) {
    // Duck music on match
    duckMusic();

    if (matchSize >= 5) {
        playMatch5Sound();
    } else if (matchSize >= 4) {
        playMatch4Sound();
    } else {
        playMatch3Sound();
    }

    // Layer combo sound on top
    if (combo >= 2) {
        setTimeout(() => playComboSound(combo), 100);
    }

    // Milestone at big scores
    if (scoreGained >= 1000) {
        setTimeout(() => playMilestoneSound(), 200);
    }
}
