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
  /**
   * Hosts the Next.js Image optimizer is allowed to fetch from. Must
   * stay in sync with AVATAR_HOST_ALLOWLIST in src/app/api/profiles/route.ts
   * — that allowlist gates what *gets stored* in user profiles; this
   * config gates what the optimizer is *allowed to render*. Mismatch
   * either way → broken avatars.
   *
   * Blob storage is the primary path now (uploads go to
   * <storeId>.public.blob.vercel-storage.com); the rest cover NFT
   * avatars (OpenSea / seadn), Google auth avatars, Imgur, IPFS, etc.
   */
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.public.blob.vercel-storage.com' },
      { protocol: 'https', hostname: '**.vercel-storage.com' },
      { protocol: 'https', hostname: 'pindropgame.com' },
      { protocol: 'https', hostname: '**.pindropgame.com' },
      { protocol: 'https', hostname: 'vibematch.app' },
      { protocol: 'https', hostname: '**.vibematch.app' },
      { protocol: 'https', hostname: 'opensea.io' },
      { protocol: 'https', hostname: 'i.seadn.io' },
      { protocol: 'https', hostname: 'raw.githubusercontent.com' },
      { protocol: 'https', hostname: '**.googleusercontent.com' },
      { protocol: 'https', hostname: '**.imgur.com' },
      { protocol: 'https', hostname: 'imgur.com' },
      { protocol: 'https', hostname: 'ipfs.io' },
    ],
  },
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
