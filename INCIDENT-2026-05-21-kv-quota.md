# Incident: Upstash KV quota exhausted — login failures

**Date:** 2026-05-21
**Duration:** ~unknown (detected during user-reported login failures; resolved within minutes of detection)
**Severity:** Major — all login attempts returned 500, all KV-write endpoints failed, leaderboards 500'd. Read endpoints with graceful fallbacks (e.g. `/api/players-vibing`) silently returned empty data.

## What broke

Every login attempt returned `HTTP 500 {"error":"Failed to login"}`. `/api/scores` GET also returned 500. KV-touching endpoints across the app were either erroring or silently returning empty data.

## Root cause

The Upstash Redis instance was on the **Free plan** (500K commands per month). Organic traffic pushed the account to the 500K/500K monthly ceiling. Once exhausted, Upstash rejects all new commands with:

```
ERR max requests limit exceeded. Limit: 500000, Usage: 500000
```

The first thing the login route does is `kv.incr` for the IP+username rate-limit counter. That call threw, the route caught it generically, and returned a 500 with no useful body. Every other KV-touching endpoint failed the same way at its first command.

Read endpoints that wrap KV calls in a try/catch returning a default value (like `/api/players-vibing` returning `{count: 0, avatars: []}` on error) appeared healthy — the marquee showed "0 PLAYERS VIBING" but didn't 500.

## Detection

User report. No alerting was wired for KV quota approaching limit. The Upstash dashboard shows usage trending but we weren't checking it.

## Fix

1. Upgraded the Upstash database from Free to **Fixed 250MB ($10/month, unlimited commands at 10K req/sec)** via the Upstash console. Plan change takes effect instantly; no redeploy, no env var change, no code change required.
2. Login + all KV endpoints recovered within seconds of the plan upgrade.
3. Deployed a caching pass (commit `ee25e0e`) to reduce future burn:
   - 30s in-memory cache for session jti validity (cuts ~1 KV op from every authenticated request)
   - 30s in-memory cache for user profile lookups, with invalidation on profile writes
   - 60s TTL + `Cache-Control: s-maxage=60` on the anonymous-variant `/api/scores` GET, so Vercel's edge serves repeat requests without invoking the function

## What we learned

- **The free tier's "500K commands" cap is monthly, not daily.** Easy to misread. With even modest traffic, this cap goes from "comfortable" to "exhausted" in days.
- **Generic try/catch around the route logic hides the real error.** The login route returns `"Failed to login"` for any thrown error. Surfacing the underlying Upstash quota message in dev/logs would have made diagnosis instant. (Sentry was capturing them but we didn't check.)
- **Read-with-fallback endpoints can mask outages.** `/api/players-vibing` reporting `{count: 0}` instead of erroring meant the marquee silently broke without raising any alarm.

## Prevention

- **Quota alerts:** Set up an alert (Upstash dashboard supports email alerts on % of quota) at 80% of any future plan's ceiling.
- **Synthetic monitor:** A simple Cron-triggered probe that POSTs to `/api/auth/login` with garbage credentials and asserts a 401 response. Anything 5xx → page on-call.
- **Sentry triage habit:** When users report "everyone is getting X," check Sentry first. The error rate spike would have been visible immediately.

## Cost going forward

- Fixed 250MB plan: **$10/month** flat. Unlimited commands at 10K/sec throughput. 250MB storage (current usage is a fraction of this).
- Caching pass should cut monthly command volume 30-50% — the plan upgrade gives unlimited headroom regardless, but lower volume means later upgrades come slower.
- Next plan tier is **Pro** (~$280/mo, needed only if sustained throughput exceeds 10K req/sec — not a near-term concern).
