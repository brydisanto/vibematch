import { NextResponse } from "next/server";

/**
 * User-Agent blocklist for game-affecting write endpoints.
 *
 * Goal: stop opportunistic CLI / agent abuse where the attacker is
 * driving the game from a tool (Codex, Claude Code, Playwright, curl,
 * etc.) without bothering to spoof their User-Agent. This is a friction
 * layer, NOT a security boundary — anyone can set
 * `--header "User-Agent: Mozilla/5.0..."` and bypass it. But for the
 * 80% case of "someone pointed an AI agent at our API to see if it'd
 * work," it stops them at the door and emits a clear audit signal.
 *
 * Wired into the high-stakes write paths only:
 *   - /api/scores POST (score submission)
 *   - /api/pinbook POST (all game-affecting actions)
 *   - /api/pinbook/reroll POST
 *   - /api/pinbook/purchase-prize-games POST
 *
 * READS are intentionally unblocked. Leaderboard / pin / quest reads
 * are fine to allow from third-party tools (community dashboards,
 * stats sites, mobile shortcuts, etc.); the harm vector is writes.
 *
 * The blocklist is intentionally tilted toward modern AI agents
 * (Codex, Claude, OpenAI, Anthropic) since those are the immediate
 * threat surface — players asking ChatGPT/Claude to "play this game
 * for me" and pointing them at the API directly. Generic HTTP-client
 * agents (curl, python-requests, etc.) are blocked too as a catch-all.
 */

// Case-insensitive substring matches against the User-Agent header.
// Each entry is matched as `ua.toLowerCase().includes(pattern)` so
// patterns are plain lowercase strings, not regexes.
const BLOCKED_UA_PATTERNS: string[] = [
    // ─── AI agent CLIs / SDKs ─────────────────────────────────
    "codex/",          // OpenAI Codex CLI
    "claude-code",     // Anthropic Claude Code
    "claude/",         // Claude CLI / Anthropic SDK variant
    "anthropic-sdk",   // Anthropic Python/JS SDK default UA
    "anthropic ",
    "openai-python",
    "openai-node",
    "openai/",
    // ─── Headless / automation frameworks ─────────────────────
    "headlesschrome",  // Default Puppeteer / Playwright Chromium
    "headless",
    "playwright",
    "puppeteer",
    "selenium",
    "phantomjs",
    "webdriver",
    // ─── Generic HTTP clients ─────────────────────────────────
    "curl/",
    "wget/",
    "python-requests",
    "python-urllib",
    "aiohttp/",
    "httpx/",
    "node-fetch",
    "got/",            // Node `got` library default UA
    "axios/",          // Bare axios (without a browser prefix) — browser axios
                       // includes a Mozilla prefix in the UA, so this hits
                       // server-side / CLI axios callers
    "okhttp/",
    "apache-httpclient",
    "go-http-client/",
    "java/",           // Default Java URLConnection UA
    "ruby",            // Default Ruby net/http
    "postmanruntime/",
    "insomnia/",
];

export interface AutomationCheck {
    blocked: boolean;
    reason?: string;
    matchedPattern?: string;
    ua: string;
}

/** Returns `{ blocked: true, ... }` if the request's User-Agent matches
 *  a known automated-agent signature OR is empty. Returns
 *  `{ blocked: false }` otherwise. Never throws. */
export function checkAutomatedAgent(req: Request): AutomationCheck {
    const ua = (req.headers.get("user-agent") || "").trim();

    // Empty UA is itself a signal. Real browsers always send one. CLI
    // tools sometimes omit it entirely (e.g., `fetch()` in Deno without
    // a configured UA).
    if (!ua) {
        return { blocked: true, reason: "missing_user_agent", ua: "" };
    }

    const lower = ua.toLowerCase();
    for (const pattern of BLOCKED_UA_PATTERNS) {
        if (lower.includes(pattern)) {
            return {
                blocked: true,
                reason: "automated_agent",
                matchedPattern: pattern,
                ua,
            };
        }
    }

    return { blocked: false, ua };
}

/**
 * Origin / Referer enforcement.
 *
 * Real browsers automatically include an `Origin` header on every POST
 * (and most cross-origin GETs) — JavaScript on the page cannot override
 * it; the browser sets it. CLI tools (curl, Codex, Python clients)
 * typically omit it. Requiring the header to be present AND to point at
 * a known domain raises the bar a notch further than the UA blocklist.
 *
 * Allowed origins:
 *   - https://pindropgame.com (the canonical production domain)
 *   - https://*.vercel.app (any of our preview / fallback deploy URLs)
 *   - http://localhost:* (local dev)
 *
 * Bypassable by `--header "Origin: https://pindropgame.com"`, so this is
 * defense-in-depth rather than a hard boundary. Same philosophy as the
 * UA check — kills 80% of opportunistic abuse, raises the cost on the
 * rest, and emits an audit signal when it fires.
 *
 * Referer is checked as a fallback only when Origin is missing — some
 * privacy modes strip it on cross-origin POSTs. Both being missing is
 * treated as a block.
 */

const ALLOWED_HOSTNAMES = new Set<string>([
    "pindropgame.com",
    "localhost",
    "127.0.0.1",
]);
const ALLOWED_HOSTNAME_SUFFIXES: string[] = [
    ".vercel.app", // any of our Vercel deployments (prod alias + previews)
];

function isAllowedHost(hostname: string): boolean {
    const h = hostname.toLowerCase();
    if (ALLOWED_HOSTNAMES.has(h)) return true;
    for (const suffix of ALLOWED_HOSTNAME_SUFFIXES) {
        if (h.endsWith(suffix)) return true;
    }
    return false;
}

export interface OriginCheck {
    blocked: boolean;
    reason?: string;
    origin: string | null;
    referer: string | null;
}

/** Returns `{ blocked: true, ... }` if the request's Origin (or, as
 *  fallback, Referer) doesn't point at a known domain. Returns
 *  `{ blocked: false }` otherwise. */
export function checkOrigin(req: Request): OriginCheck {
    const origin = req.headers.get("origin");
    const referer = req.headers.get("referer");

    // At least one must be present. Browsers always include Origin on
    // POST; some lock down referer-policy modes still let Origin through.
    if (!origin && !referer) {
        return { blocked: true, reason: "missing_origin", origin, referer };
    }

    // Origin is the canonical signal when present. Falls back to Referer
    // host parsing if only that's available.
    const candidate = origin || referer || "";
    try {
        const url = new URL(candidate);
        if (!isAllowedHost(url.hostname)) {
            return { blocked: true, reason: "bad_origin", origin, referer };
        }
    } catch {
        return { blocked: true, reason: "malformed_origin", origin, referer };
    }

    return { blocked: false, origin, referer };
}

/** Convenience helper for API routes. Returns null if the request is
 *  allowed, or a NextResponse 403 if it should be rejected by either
 *  the UA blocklist or Origin check.
 *
 *  Call sites should:
 *      const blocked = rejectIfAutomated(req);
 *      if (blocked) return blocked;
 *
 *  Pairs with logAuditEvent — callers that already audit can also
 *  emit a rejection event using the same helper functions to capture
 *  which gate fired.
 */
export function rejectIfAutomated(req: Request): NextResponse | null {
    const uaCheck = checkAutomatedAgent(req);
    if (uaCheck.blocked) {
        return NextResponse.json({ error: "Browser required" }, { status: 403 });
    }
    const originCheck = checkOrigin(req);
    if (originCheck.blocked) {
        return NextResponse.json({ error: "Browser required" }, { status: 403 });
    }
    return null;
}
