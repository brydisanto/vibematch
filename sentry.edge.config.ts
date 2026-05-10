/**
 * Sentry init for the Edge runtime — covers /api/og/score and any
 * other route that opts into `export const runtime = "edge"`.
 */

import * as Sentry from "@sentry/nextjs";

Sentry.init({
    dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,

    release: process.env.VERCEL_GIT_COMMIT_SHA || "dev",
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV,

    tracesSampleRate: 0.1,

    enabled:
        process.env.NODE_ENV === "production" ||
        process.env.SENTRY_ENABLE_DEV === "1",
});
