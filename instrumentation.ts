/**
 * Next.js instrumentation hook — runs once at server start. Branches
 * into the Sentry init for whichever runtime this serverless function
 * is running on (Node.js vs Edge runtime).
 *
 * The `register` export is the canonical Next.js shape. We also export
 * `onRequestError` so server-side errors that bubble up from React
 * Server Components / route handlers get reported to Sentry.
 */

import * as Sentry from "@sentry/nextjs";

export async function register() {
    if (process.env.NEXT_RUNTIME === "nodejs") {
        await import("./sentry.server.config");
    }
    if (process.env.NEXT_RUNTIME === "edge") {
        await import("./sentry.edge.config");
    }
}

export const onRequestError = Sentry.captureRequestError;
