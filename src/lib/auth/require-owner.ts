import { redirect } from "next/navigation";
import { PublicError } from "@/lib/api/errors";
import { getSession, type Session } from "@/lib/auth/session";

/**
 * Authorization for admin surfaces.
 *
 * Enforcement lives here, in server components and route handlers, rather than
 * in middleware. Middleware can only cheaply inspect a cookie; it cannot tell a
 * valid session from a forged or expired one without calling the backend. These
 * helpers verify against the Blocks API, which also re-runs the email
 * allowlist, so they are authoritative.
 *
 * SCOPE: this is authentication only. Every signed-in eligible user currently
 * sees the same shared collection, because the stores are still the local JSON
 * mocks. Per-owner isolation arrives with the DistributedTable migration; until
 * then "owner" means "any eligible signed-in user".
 */

/** For server components: redirects to /login when there is no valid session. */
export async function requireOwnerPage(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

/** For route handlers: throws a 401 that errorResponse() renders as JSON. */
export async function requireOwnerApi(): Promise<Session> {
  const session = await getSession();
  if (!session) throw new PublicError("Authentication required", 401);
  return session;
}
