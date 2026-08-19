import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CreateFirstCollection } from "@/components/admin/CreateFirstCollection";
import { LogoMark } from "@/components/layout/LogoMark";
import { requireOwnerPage } from "@/lib/auth/require-owner";
import { linkStore } from "@/lib/services";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Create your first collection",
  robots: { index: false, follow: false },
};

/**
 * First-run surface. Every owner starts with no collections, so there is no
 * "home" page to send them to; this is where /admin lands until they have one.
 */
export default async function AdminStartPage() {
  const session = await requireOwnerPage();
  const pages = await linkStore.getPages();
  if (pages.length > 0) redirect(`/admin/${pages[0].slug}/links`);

  return (
    <main className="status-page">
      <section className="status-card motion-safe:animate-fade-up">
        <LogoMark size="large" />
        <p className="status-eyebrow">{session.email}</p>
        <h1>Create your first collection</h1>
        <p className="status-description">
          Pick a public address for it. Slugs are shared across everyone, so
          yours has to be unused.
        </p>
        <CreateFirstCollection />
      </section>
    </main>
  );
}
