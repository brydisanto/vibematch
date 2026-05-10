import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

/**
 * Security headers applied to every route. Tuned to the VibeMatch runtime:
 *  - wagmi / RainbowKit need to connect to Ethereum RPCs and WalletConnect
 *    over wss:/https:, so connect-src is broad but not open.
 *  - Next.js requires 'unsafe-inline' for runtime-injected <style> and
 *    'unsafe-eval' for dev mode only; we gate those off in production.
 *  - Images must allow all https: because pin avatars can point anywhere.
 *  - frame-ancestors 'none' blocks the whole app from being iframed, which
 *    defeats clickjacking attacks against the wallet-signing flow.
 */
const CSP_DIRECTIVES: Record<string, string[]> = {
  "default-src": ["'self'"],
  "script-src": [
    "'self'",
    "'unsafe-inline'",
    ...(process.env.NODE_ENV === "development" ? ["'unsafe-eval'"] : []),
    "https://vercel.live",
    "https://www.googletagmanager.com",
  ],
  "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
  "font-src": ["'self'", "data:", "https://fonts.gstatic.com"],
  "img-src": ["'self'", "data:", "blob:", "https:"],
  "connect-src": [
    "'self'",
    "https:",
    "wss:",
  ],
  "frame-src": ["'self'", "https://verify.walletconnect.org", "https://verify.walletconnect.com"],
  "frame-ancestors": ["'none'"],
  "base-uri": ["'self'"],
  "form-action": ["'self'"],
  "object-src": ["'none'"],
};

const cspValue = Object.entries(CSP_DIRECTIVES)
  .map(([k, v]) => `${k} ${v.join(" ")}`)
  .join("; ");

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: cspValue },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
          // HSTS: 1 year, include subdomains, preload. Only served in prod
          // to avoid 'upgrade' issues on local dev via http://localhost.
          ...(process.env.NODE_ENV === "production"
            ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" }]
            : []),
        ],
      },
    ];
  },
};

/**
 * Sentry wrapper. Adds the build-time plugin that uploads source maps
 * to Sentry so production stack traces show real file:line references
 * instead of minified gibberish. Without `SENTRY_AUTH_TOKEN` in the
 * build env this is a near-no-op (errors still arrive in the dashboard
 * but stacks point at obfuscated chunks).
 *
 *   silent: true                  → don't spam build logs with upload chatter
 *   widenClientFileUpload: true   → pick up Next.js's chunked client bundles
 *   reactComponentAnnotation      → tag React components in stacks for
 *                                   readable component-tree breadcrumbs
 *   tunnelRoute: "/monitoring"    → bypass ad-blockers that block direct
 *                                   sentry.io requests; events route through
 *                                   our own /monitoring path instead
 */
export default withSentryConfig(nextConfig, {
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    authToken: process.env.SENTRY_AUTH_TOKEN,

    silent: !process.env.CI,
    widenClientFileUpload: true,
    reactComponentAnnotation: { enabled: true },
    tunnelRoute: "/monitoring",
    disableLogger: true,

    // Run automatically without prompts during CI / Vercel builds.
    automaticVercelMonitors: false,
});
