/**
 * Sentry browser-side init. Loaded by Next.js automatically via the
 * `instrumentation-client` hook (no manual import required).
 *
 * Captures:
 *   - Uncaught browser exceptions (the "Application error" white screens
 *     we've been chasing one-by-one)
 *   - Unhandled promise rejections
 *   - Performance traces of fetch requests (10% sampled)
 *   - Breadcrumbs (last N user actions before a crash) for context
 */

import * as Sentry from "@sentry/nextjs";

Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

    // Tag every event with the Vercel git SHA so errors are traceable
    // back to the exact deploy. Vercel injects VERCEL_GIT_COMMIT_SHA at
    // build time; falls through to "dev" locally.
    release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || "dev",
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.NODE_ENV,

    // Performance traces sampled at 10% — captures latency/spans for a
    // representative slice of traffic without the cost of tracing every
    // request. Bump on errors only (tracesSampler) if you want more
    // detail when things are breaking.
    tracesSampleRate: 0.1,

    // Don't collect Session Replay by default (it's expensive and can
    // record sensitive UI). Re-enable if we need it post-launch.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,

    // Drop noise we can't action: browser extensions, third-party
    // network blips, etc.
    ignoreErrors: [
        // Browser extension shenanigans
        "ResizeObserver loop limit exceeded",
        "ResizeObserver loop completed with undelivered notifications",
        "Non-Error promise rejection captured",
        // Wallet provider noise (Wagmi/RainbowKit retries on transient
        // RPC failures, not actionable bugs)
        "User rejected the request",
        "User denied transaction signature",
        // Network blips on the client side — fire-and-forget fetches
        // sometimes throw on unmount
        "Load failed",
        "NetworkError when attempting to fetch resource",
    ],

    // Filter out third-party domain errors
    denyUrls: [
        // Browser extensions
        /extensions\//i,
        /^chrome:\/\//i,
        /^chrome-extension:\/\//i,
        /^moz-extension:\/\//i,
    ],

    // Disable in dev unless you want to test it locally — set
    // SENTRY_ENABLE_DEV=1 in .env.local to opt in.
    enabled:
        process.env.NODE_ENV === "production" ||
        process.env.NEXT_PUBLIC_SENTRY_ENABLE_DEV === "1",
});

// Required by Next 15+ for client-side router transitions to be
// captured as performance spans.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
