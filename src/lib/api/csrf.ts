import type { NextRequest } from "next/server";
import { PublicError } from "@/lib/api/errors";

/**
 * Origin checking for state-changing requests.
 *
 * The Blocks session cookie is already `SameSite=Lax`, which stops a browser
 * attaching it to a cross-site POST -- so this is defence in depth, not the only
 * barrier. It is still worth having: `SameSite` is a browser-side promise, it
 * relaxes to `None` if `crossDomain` is ever enabled on the auth block, and an
 * explicit server-side check fails closed regardless.
 *
 * Behind a proxy, the app's own origin is NOT what the browser saw: CloudFront
 * terminates TLS and forwards to an internal host, so comparing against the
 * request URL would reject every legitimate request. ALLOWED_ORIGINS is the
 * authoritative list in a deployed environment; the forwarded headers and the
 * request origin are only the local-development fallback.
 */

function forwardedOrigin(request: NextRequest): string | null {
  const host = request.headers.get("x-forwarded-host");
  if (!host) return null;
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

function expectedOrigins(request: NextRequest): Set<string> {
  const configured = process.env.ALLOWED_ORIGINS?.split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (configured && configured.length > 0) return new Set(configured);

  const origins = new Set<string>([request.nextUrl.origin]);
  const forwarded = forwardedOrigin(request);
  if (forwarded) origins.add(forwarded);

  // Behind CloudFront the SSR Lambda may see the public host only in `host`,
  // while nextUrl.origin reflects the internal invoke URL. Accept it too, since
  // an attacker able to forge Host already controls the request path entirely.
  const host = request.headers.get("host");
  if (host) {
    const proto = request.headers.get("x-forwarded-proto") ?? "https";
    origins.add(`${proto}://${host}`);
  }
  return origins;
}

/** Origin of a Referer header, used only when Origin is absent. */
function refererOrigin(value: string | null): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

/**
 * Throws unless the request came from an allowed origin.
 *
 * Browsers always send Origin on a cross-origin or non-GET fetch, so a missing
 * one is rejected rather than trusted. That intentionally blocks a bare `curl`
 * without an Origin header: a non-browser caller has to state where it is from.
 */
export function assertSameOrigin(request: NextRequest): void {
  const claimed =
    request.headers.get("origin") ??
    refererOrigin(request.headers.get("referer"));

  if (!claimed) {
    throw new PublicError("Missing Origin header", 403);
  }
  if (!expectedOrigins(request).has(claimed)) {
    throw new PublicError("Cross-origin request refused", 403);
  }
}

/**
 * Rejects a body content type that an HTML form could produce.
 *
 * A form can send urlencoded, multipart or text/plain cross-site without a
 * preflight; it cannot send application/json. Requiring JSON removes the
 * simple-request path entirely.
 */
export function assertJsonBody(request: NextRequest): void {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    throw new PublicError("Content-Type must be application/json", 415);
  }
}
