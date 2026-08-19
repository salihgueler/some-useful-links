import { cache } from "react";
import { cookies } from "next/headers";

/**
 * Server-side session lookup.
 *
 * Blocks uses a backend-for-frontend session: the browser holds an opaque
 * HMAC-signed cookie and the Cognito tokens never leave the server. The Next
 * server therefore cannot decode the cookie itself -- it asks the Blocks API
 * who the caller is, forwarding the cookie.
 *
 * That call also re-runs the email allowlist inside `api.me()`, so a session
 * belonging to an address that is no longer eligible fails here too.
 */

export interface Session {
  email: string;
  userSub: string;
}

/**
 * JSON-RPC endpoint of the Blocks API.
 *
 * Set BLOCKS_RPC_URL explicitly in any deployed environment. It is a distinct
 * variable from the BLOCKS_API_URL that Hosting injects, because the RPC path
 * differs between the local dev server and a CloudFront-fronted deployment and
 * guessing between them silently breaks authentication.
 */
function endpoint(): string {
  const configured = process.env.BLOCKS_RPC_URL;
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") {
    throw new Error("BLOCKS_RPC_URL must be set in production");
  }
  // Local dev: the Blocks server fronts Next and serves the API on 3000.
  return "http://127.0.0.1:3000/aws-blocks/api";
}

/** Cached per request, so multiple layouts do not each make the call. */
export const getSession = cache(async (): Promise<Session | null> => {
  const jar = await cookies();
  const all = jar.getAll();
  if (all.length === 0) return null;

  const cookieHeader = all.map((c) => `${c.name}=${c.value}`).join("; ");

  try {
    const response = await fetch(endpoint(), {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: cookieHeader },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "api.me",
        params: [],
        id: 1,
      }),
      cache: "no-store",
    });
    if (!response.ok) return null;

    const payload: unknown = await response.json();
    if (typeof payload !== "object" || payload === null) return null;
    const result = (payload as { result?: { email?: unknown; userSub?: unknown } }).result;
    if (typeof result?.email !== "string" || typeof result.userSub !== "string") {
      return null;
    }
    return { email: result.email, userSub: result.userSub };
  } catch {
    // Backend unreachable is treated as "not signed in": callers gate on a
    // positive session, so this fails closed.
    return null;
  }
});
