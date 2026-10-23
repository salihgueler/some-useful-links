import { NextResponse } from "next/server";
import { RpcError } from "@/lib/auth/server-rpc";

/**
 * An error whose message was authored for the caller and is safe to return.
 *
 * Anything that is NOT a PublicError is treated as internal: its message may
 * contain filesystem paths or driver detail, so it is logged server-side and
 * replaced with a generic string in the response.
 */
export class PublicError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "PublicError";
    this.status = status;
  }
}

/**
 * Builds a JSON error response without leaking internal failure detail.
 *
 * @param error the caught value
 * @param fallback generic message used when the error is not a PublicError
 */
export function errorResponse(error: unknown, fallback: string) {
  if (error instanceof PublicError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  // A 4xx from our own Blocks backend is a client-facing verdict authored by us
  // (slug taken, not found, not eligible), so it keeps its status and message.
  // 5xx stays internal.
  if (error instanceof RpcError && error.code >= 400 && error.code < 500) {
    return NextResponse.json({ error: error.message }, { status: error.code });
  }
  console.error(`${fallback}:`, error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}
