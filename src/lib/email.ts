import { Resend } from "resend";

const FROM_ADDRESS = "Pin Drop <noreply@pindropgame.com>";
const APP_URL = "https://pindropgame.com";

// Lazy resend client. If RESEND_API_KEY isn't set we log a warning and
// no-op rather than crashing the route — keeps password reset shipping
// safely behind the env var without blocking other paths.
let _resend: Resend | null = null;
function getResend(): Resend | null {
    if (_resend) return _resend;
    const key = process.env.RESEND_API_KEY;
    if (!key) return null;
    _resend = new Resend(key);
    return _resend;
}

export function isEmailConfigured(): boolean {
    return !!process.env.RESEND_API_KEY;
}

interface SendResult {
    ok: boolean;
    skipped?: boolean;
    error?: string;
}

/**
 * Send a password reset email with a one-time token link. Returns
 * `{ ok: true }` on success, `{ ok: false, skipped: true }` when the
 * provider isn't configured (so callers can still respond generically
 * to the user without revealing whether email was wired up).
 */
export async function sendPasswordResetEmail(opts: {
    to: string;
    username: string;
    resetToken: string;
}): Promise<SendResult> {
    const client = getResend();
    if (!client) {
        console.warn("[email] RESEND_API_KEY not set — password reset email skipped");
        return { ok: false, skipped: true };
    }

    const resetUrl = `${APP_URL}/reset?token=${encodeURIComponent(opts.resetToken)}`;
    const subject = "Reset your Pin Drop password";

    const html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; background: #1A1525; color: #fff; padding: 32px 24px; border-radius: 16px;">
            <h1 style="color: #FFE048; font-weight: 900; font-size: 28px; margin: 0 0 16px; letter-spacing: 0.02em; text-transform: uppercase;">Pin Drop</h1>
            <p style="font-size: 16px; line-height: 1.5; margin: 0 0 16px;">Hi <strong>${escapeHtml(opts.username)}</strong>,</p>
            <p style="font-size: 16px; line-height: 1.5; margin: 0 0 24px;">Someone (hopefully you) requested a password reset for your Pin Drop account. Click the button below to set a new password. The link expires in 15 minutes.</p>
            <p style="margin: 32px 0;">
                <a href="${resetUrl}" style="display: inline-block; background: #FFE048; color: #1A0633; padding: 14px 28px; border-radius: 12px; font-weight: 900; text-decoration: none; letter-spacing: 0.08em; text-transform: uppercase; font-size: 14px;">Reset password</a>
            </p>
            <p style="font-size: 13px; line-height: 1.5; color: rgba(255,255,255,0.55); margin: 24px 0 0;">If you didn't request this, ignore this email — your password won't change. The link will expire on its own.</p>
            <p style="font-size: 12px; color: rgba(255,255,255,0.4); margin: 24px 0 0; word-break: break-all;">If the button doesn't work, copy this link into your browser:<br>${resetUrl}</p>
        </div>
    `;

    const text = [
        `Hi ${opts.username},`,
        ``,
        `Someone requested a password reset for your Pin Drop account.`,
        `Open this link to set a new password (expires in 15 minutes):`,
        ``,
        resetUrl,
        ``,
        `If you didn't request this, ignore this email — your password won't change.`,
    ].join("\n");

    try {
        const result = await client.emails.send({
            from: FROM_ADDRESS,
            to: opts.to,
            subject,
            html,
            text,
        });
        if (result.error) {
            console.error("[email] Resend send error:", result.error);
            return { ok: false, error: String(result.error) };
        }
        return { ok: true };
    } catch (e) {
        console.error("[email] Resend exception:", e);
        return { ok: false, error: e instanceof Error ? e.message : "send failed" };
    }
}

function escapeHtml(s: string): string {
    return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
