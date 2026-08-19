import { NextResponse, type NextRequest } from "next/server";
import { PublicError, errorResponse } from "@/lib/api/errors";
import { clientKey, rateLimit } from "@/lib/api/rate-limit";
import type { VisitEventType } from "@/lib/services";
import { visitTracker } from "@/lib/services";

/**
 * Public, unauthenticated endpoint: public pages must be able to record views
 * and clicks without a session. Everything here exists to bound what an
 * anonymous caller can do.
 */

const EVENT_TYPES: readonly VisitEventType[] = ["page-view", "link-click", "share"];
const MAX_BODY_BYTES = 1_024;
const MAX_EVENTS_PER_MINUTE = 30;
const WINDOW_MS = 60_000;

/** Keep only the origin: full referrer URLs can carry tokens in query strings. */
function referrerOrigin(raw: string | null): string | undefined {
  if (!raw) return undefined;
  try {
    return new URL(raw).origin;
  } catch {
    return undefined;
  }
}

export async function POST(request: NextRequest) {
  try {
    const limit = rateLimit(
      `track:${clientKey(request.headers)}`,
      MAX_EVENTS_PER_MINUTE,
      WINDOW_MS,
    );
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
      );
    }

    if (!request.headers.get("content-type")?.includes("application/json")) {
      throw new PublicError("Content-Type must be application/json", 415);
    }

    const declared = Number(request.headers.get("content-length") ?? "0");
    if (declared > MAX_BODY_BYTES) {
      throw new PublicError("Payload too large", 413);
    }
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) {
      throw new PublicError("Payload too large", 413);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new PublicError("Body must be valid JSON");
    }
    if (typeof parsed !== "object" || parsed === null) {
      throw new PublicError("Body must be a JSON object");
    }
    const body = parsed as Record<string, unknown>;

    const type = body.type;
    if (typeof type !== "string" || !EVENT_TYPES.includes(type as VisitEventType)) {
      throw new PublicError("Invalid event type");
    }
    const pageSlug = body.pageSlug;
    if (typeof pageSlug !== "string" || pageSlug.length === 0) {
      throw new PublicError("Unknown page slug");
    }
    const linkId = typeof body.linkId === "string" ? body.linkId : undefined;
    // Slug existence, link existence and the link-click/linkId rule are all
    // enforced by the backend, which resolves the owner from the slug
    // reservation. Validating here would need an owner-scoped read that an
    // anonymous visitor cannot make.

    // Build the event explicitly: never spread caller input, so unknown
    // properties cannot be persisted and the timestamp stays server-owned.
    const event = await visitTracker.track({
      type: type as VisitEventType,
      pageSlug,
      linkId,
      referrer:
        referrerOrigin(typeof body.referrer === "string" ? body.referrer : null) ??
        referrerOrigin(request.headers.get("referer")),
    });
    return NextResponse.json({ ok: true, eventId: event.id }, { status: 201 });
  } catch (error) {
    return errorResponse(error, "Tracking failed");
  }
}
