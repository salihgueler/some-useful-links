import Link from "next/link";
import { LogoMark } from "@/components/layout/LogoMark";
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
 *
 * It no longer borrows .status-card, which is the shell the 404 and error
 * screens use: sharing it is what made the front door look like a failure
 * state. There is no eyebrow above the heading either -- the logo already says
 * the product name, and repeating it as a kicker is a pattern impeccable's
 * craft floor bans outright.
 */
export default async function HomePage() {
  const session = await getSession();

  return (
    <main className="landing">
      <div className="landing-inner motion-safe:animate-fade-up">
        <LogoMark size="large" />

        <h1>
          Good finds, <mark>one useful page</mark>
        </h1>
        <p className="landing-lede">
          Build a small, shareable page of links worth keeping. Each collection
          gets its own public address that anyone can open.
        </p>

        <div className="landing-cta">
          <Link className="landing-action" href={session ? "/admin" : "/login"}>
            {session ? "Go to your collections" : "Sign in"}
          </Link>
        </div>

        <dl className="landing-facts">
          <div>
            <dt>Your own address</dt>
            <dd>
              Every collection lives at its own public URL, and you can change
              that address later.
            </dd>
          </div>
          <div>
            <dt>Themed to fit</dt>
            <dd>
              Default, Kiro and AWS presets, a palette pulled from an image, and
              your own logo.
            </dd>
          </div>
          <div>
            <dt>Readable by anyone</dt>
            <dd>
              Anyone with an email address can sign up. The pages you publish
              need no account at all.
            </dd>
          </div>
        </dl>
      </div>
    </main>
  );
}
