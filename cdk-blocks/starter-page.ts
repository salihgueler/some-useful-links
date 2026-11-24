/**
 * Starter collection for a brand-new owner.
 *
 * The slug is DERIVED FROM THE OWNER, not random, which is what makes seeding
 * idempotent: running it twice computes the same slug, finds the reservation
 * already held by this owner, and does nothing. A random slug would create a
 * second collection on every call and quietly consume global slugs.
 *
 * Shape matches links.schema.json, the single source of truth enforced by
 * validatePageInput() on the API routes.
 */

export const STARTER_TITLE = "My useful links";

/** Stable, collision-resistant enough, and readable: userSub is a UUID. */
export function starterSlug(userSub: string): string {
  const compact = userSub.replace(/[^a-z0-9]/gi, "").toLowerCase();
  return `links-${compact.slice(0, 10)}`;
}

export function starterPage(slug: string, publicOrigin = "https://someusefullinks.com") {
  return {
    slug,
    meta: {
      title: STARTER_TITLE,
      subtitle: "A fresh collection of useful links.",
      url: `${publicOrigin}/${slug}`,
      avatar: "/avatar.svg",
    },
    appearance: {
      primaryColor: "#5C4FB3",
      headerColor: "#EFEDFF",
      backgroundColor: "#F8F7FC",
      accentColor: "#FFB891",
      logoColor: "#BFECE6",
      buttonStyle: "raised" as const,
    },
    links: [
      {
        id: "first-link",
        label: "My first useful link",
        caption: "Edit or replace this starter link",
        url: "https://example.com",
        icon: { emoji: "L", backgroundColor: "#DDD7FF" },
        enabled: true,
        order: 0,
      },
    ],
  };
}
