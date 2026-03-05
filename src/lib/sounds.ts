"use client";

// ===== Web Audio API Sound Engine for VibeMatch =====
// Generates all sounds procedurally — no audio files needed.

let audioCtx: AudioContext | null = null;
export let isMuted = false;

// ===== MUTE TOGGLE =====
export function toggleMute(muted: boolean): boolean {
    isMuted = muted;
    if (bgmAudio) {
        bgmAudio.volume = muted ? 0 : 0.3;
    }

    // Explicitly try to resume AudioContext here — Safari requires this within a user gesture!
    if (!muted && audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => { });
    }

    return isMuted;
}

// ===== BACKGROUND MUSIC =====
let bgmAudio: HTMLAudioElement | null = null;
let currentBGMTrack = 0;

export const BGM_TRACK_NAMES = [
    "Feel The Beat",
    "Retro Wave",
    "Neon Beach",
    "Miami Sun",
    "Arcade Pop"
];

const BGM_FILES = [
    "/music/feel-the-beat.mp3"
];

function stopMP3() {
    if (bgmAudio) {
        bgmAudio.pause();
        bgmAudio.currentTime = 0;
    }
}

function startMP3() {
    try {
        if (!bgmAudio) {
            bgmAudio = new Audio();
            bgmAudio.loop = true;
        }

        // We only have 1 actual MP3 file right now.
        // Even if the UI cycles through track *names*, loop the same source safely.
        const targetSrc = BGM_FILES[currentBGMTrack % BGM_FILES.length] || BGM_FILES[0];
        if (!bgmAudio.src.endsWith(targetSrc)) {
            bgmAudio.src = targetSrc;
            bgmAudio.load();
        }

        bgmAudio.volume = isMuted ? 0 : 0.3;

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
    startMP3();
}

// Ensure AudioContext is only created immediately when needed, or unlocked on touch
export function unlockAudio() {
    getAudioContext();
}

function getAudioContext(): AudioContext {
    if (!audioCtx) {
        const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (AudioContextClass) {
            audioCtx = new AudioContextClass();
        }
    }
    if (audioCtx.state === "suspended") {
        audioCtx.resume().catch(() => { });
    }
    return audioCtx;
}

// Utility: play a note with envelope
function playNote(
    freq: number,
    duration: number,
    type: OscillatorType = "sine",
    volume: number = 0.15,
    delay: number = 0
) {
    try {
        const ctx = getAudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
        gain.gain.setValueAtTime(0, ctx.currentTime + delay);
        gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + delay + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + duration);
    } catch {
        // Audio not available
    }
}

// Utility: white noise burst
function playNoise(duration: number, volume: number = 0.05, delay: number = 0) {
    try {
        const ctx = getAudioContext();
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
        filter.type = "highpass";
        filter.frequency.value = 2000;

        source.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        source.start(ctx.currentTime + delay);
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

// Combo fire — rising power tone
export function playComboSound(comboLevel: number) {
    const baseFreq = 400 + comboLevel * 150;
    playNote(baseFreq, 0.1, "sawtooth", 0.06);
    playNote(baseFreq * 1.5, 0.12, "sine", 0.1, 0.04);
    playNote(baseFreq * 2, 0.15, "sine", 0.12, 0.08);
    if (comboLevel >= 3) {
        playNoise(0.15, 0.05, 0.06);
        playNote(baseFreq * 2.5, 0.2, "sine", 0.12, 0.12);
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

// Context-aware match sound based on score value
export function playMatchSound(scoreGained: number, combo: number, matchSize: number) {
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
