import type { MetadataRoute } from "next";

/**
 * Collection pages are meant to be shared, so they stay crawlable. Everything
 * that is private or has no meaning to a crawler is excluded rather than
 * blanket-disallowing the site.
 *
 * This is a crawler hint, not access control -- /admin and the owner APIs are
 * enforced server-side by requireOwnerPage/requireOwnerApi.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/admin/", "/login", "/api/"],
      },
    ],
  };
}
