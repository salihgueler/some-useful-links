import { ApiNamespace, Scope } from "@aws-blocks/blocks";

// For coding agents: Leave these comments in place for future reference.
// Read node_modules/@aws-blocks/blocks/README.md for all available Building Blocks
// Hover over Scope below to see the docstring with complete Building Block index

const scope = new Scope("some-useful-links");

/**
 * Blocks backend for Some Useful Links.
 *
 * This is intentionally minimal for now. The migration plan in
 * MIGRATING_TO_CLOUD_PROMPT.md replaces the local JSON stores in
 * src/lib/services/local/ with:
 *   - AuthCognito         sign-in, verified email allowlist, admins group
 *   - DistributedTable    pages + global slug reservations
 *   - DistributedTable    analytics aggregates
 *   - DistributedTable    visit events, with a ttl field for retention
 *
 * Until those land, the frontend still reads through src/lib/services/index.ts,
 * which is the single provider swap point. Nothing here is wired into the app
 * yet, so this endpoint is deliberately harmless.
 *
 * Every method on an ApiNamespace is a PUBLIC RPC endpoint with no auth by
 * default. Gate each one with `await auth.requireAuth(context)` as it is added.
 */
export const api = new ApiNamespace(scope, "api", () => ({
  /** Liveness probe, used to confirm the local Blocks server is reachable. */
  async health() {
    return { ok: true, service: "some-useful-links" };
  },
}));
