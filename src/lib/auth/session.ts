import { cache } from "react";
import { serverRpc } from "@/lib/auth/server-rpc";

/**
 * Server-side session lookup.
 *
 * Blocks uses a backend-for-frontend session: the browser holds an opaque
 * HMAC-signed cookie and Cognito tokens never leave the server. The Next server
 * cannot decode that cookie, so it forwards it and asks the Blocks API who the
 * caller is. That call also re-runs the email allowlist, so a session belonging
 * to an address that is no longer eligible fails here too.
 */

export interface Session {
  email: string;
  userSub: string;
}

/** Cached per request, so multiple layouts do not each make the call. */
export const getSession = cache(async (): Promise<Session | null> => {
  try {
    const result = await serverRpc<{ email?: unknown; userSub?: unknown }>(
      "me",
      [],
      { authenticated: true },
    );
    if (typeof result?.email !== "string" || typeof result.userSub !== "string") {
      return null;
    }
    return { email: result.email, userSub: result.userSub };
  } catch {
    // No cookie, an invalid session, or an unreachable backend all read as
    // "not signed in": callers gate on a positive session, so this fails closed.
    return null;
  }
});
