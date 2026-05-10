/**
 * Sentry init for the Node.js serverless runtime — covers all our
 * `/api/*` routes that run on Vercel Functions.
 */

import * as Sentry from "@sentry/nextjs";

Sentry.init({
    dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,

    release: process.env.VERCEL_GIT_COMMIT_SHA || "dev",
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV,

    // 10% trace sample on the server matches the client. Bump if you
    // need richer perf data on a specific endpoint, or use
    // tracesSampler for per-route control.
    tracesSampleRate: 0.1,

    // KV / RPC errors that we already handle gracefully (fail-open
    // rate limits, isUserBanned fallback) shouldn't be reported as
    // user-impacting. Filter at the breadcrumb level.
    ignoreErrors: [
        // Wagmi / viem RPC retries that happen during normal fallback
        "HttpRequestError",
        // Vercel KV transient blips — we already handle these in code
        "ECONNRESET",
        "ETIMEDOUT",
    ],

    enabled:
        process.env.NODE_ENV === "production" ||
        process.env.SENTRY_ENABLE_DEV === "1",
});
