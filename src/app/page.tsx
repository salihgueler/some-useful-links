import Link from "next/link";
import { LogoMark } from "@/components/layout/LogoMark";
import { ALLOWED_EMAIL_DOMAINS } from "@blocks/eligibility";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * Landing page.
 *
 * "/" deliberately does NOT serve a collection. Every collection belongs to an
 * owner and lives at /:slug, so rendering one at the root would make whichever
 * owner claimed a reserved slug the face of the whole site. It would also make
 * the root URL depend on seed data existing -- before this page, "/" returned
 * 500 on a fresh deployment because no owner held the "home" slug.
 */
export default async function HomePage() {
  const session = await getSession();

  return (
    <main className="status-page">
      <section className="status-card motion-safe:animate-fade-up">
        <LogoMark size="large" />
        <p className="status-eyebrow">Some Useful Links</p>
        <h1>Good finds, one useful page</h1>
        <p className="status-description">
          Build a small, shareable page of links worth keeping. Each collection
          gets its own public address that anyone can open.
        </p>
        <div className="status-actions">
          {session ? (
            <Link className="status-action" href="/admin">
              Go to your collections
            </Link>
          ) : (
            <Link className="status-action" href="/login">
              Sign in
            </Link>
          )}
        </div>
        <p className="status-reference">
          Accounts are limited to {ALLOWED_EMAIL_DOMAINS.join(", ")}. Collection
          pages themselves stay readable by anyone.
        </p>
      </section>
    </main>
  );
}
