/**
 * Slugs that cannot be claimed by a collection, because a route already owns
 * them.
 *
 * Next.js resolves a static segment before a dynamic one, so a static route
 * shadows `/[slug]` and `/admin/[slug]` for the matching name. An owner who
 * claimed one of these would find that address serving the app's own page
 * instead of their collection -- silently, with no error anywhere.
 *
 * The list is derived from the routes under src/app, and is deliberately
 * enforced at creation and rename only. Existing collections are left alone: a
 * retroactive rule would break a live page to satisfy a lint, and the four
 * admin names below have been claimable since before this check existed.
 */

/** Top-level routes, which shadow the PUBLIC page at `/<slug>`. */
const ROOT_ROUTES = ["admin", "login", "app-api", "robots.txt", "icon.svg"] as const;

/** Children of /admin, which shadow the admin redirect at `/admin/<slug>`. */
const ADMIN_ROUTES = [
  "analytics",
  "appearance",
  "share",
  "start",
  "overview",
] as const;

export const RESERVED_SLUGS: readonly string[] = [...ROOT_ROUTES, ...ADMIN_ROUTES];

/** True when a slug would be shadowed by one of the app's own routes. */
export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.includes(slug.trim().toLowerCase());
}
