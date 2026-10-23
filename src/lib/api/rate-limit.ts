/**
 * Fixed-window rate limiting for public endpoints.
 *
 * Scope and limits: counters live in this process only, so a multi-instance
 * deployment enforces the limit per instance rather than globally. That is
 * acceptable as a first barrier for a single-instance deployment, but the
 * durable fix belongs in the datastore (a conditional counter write) once the
 * Blocks migration lands. It is a speed bump, not a guarantee.
 */

interface Window {
  count: number;
  resetAt: number;
}

const windows = new Map<string, Window>();

/** Cap the map so rotating keys cannot themselves exhaust memory. */
const MAX_TRACKED_KEYS = 20_000;

function sweep(now: number) {
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the window resets. */
  retryAfter: number;
}

export function rateLimit(key: string, max: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const existing = windows.get(key);

  if (!existing || existing.resetAt <= now) {
    if (windows.size >= MAX_TRACKED_KEYS) sweep(now);
    // Still full after sweeping: fail closed rather than grow without bound.
    if (windows.size >= MAX_TRACKED_KEYS) return { allowed: false, retryAfter: 60 };
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfter: 0 };
  }

  existing.count += 1;
  if (existing.count > max) {
    return { allowed: false, retryAfter: Math.ceil((existing.resetAt - now) / 1000) };
  }
  return { allowed: true, retryAfter: 0 };
}

/**
 * Best-effort client key. `x-forwarded-for` is only trustworthy behind a proxy
 * that overwrites it (CloudFront does); treat it as spoofable otherwise.
 */
export function clientKey(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first && first.length <= 45 ? first : "unknown";
}
