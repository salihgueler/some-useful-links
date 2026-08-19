import { NextResponse } from "next/server";

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
  console.error(`${fallback}:`, error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}
