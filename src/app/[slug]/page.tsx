import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicLinkPage } from "@/components/links/PublicLinkPage";
import { linkStore } from "@/lib/services";

/** Public lookup that yields null instead of throwing for a missing slug. */
async function publicPage(slug: string) {
  try {
    return await linkStore.getEnabledLinks(slug);
  } catch {
    return null;
  }
}

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  // Public read: getEnabledLinks resolves the slug reservation without a
  // session. Using the owner-scoped getPage here would make a public page
  // depend on who is viewing it.
  const page = await publicPage(slug);
  if (!page) {
    // This request will render not-found.tsx; give it a matching title and keep
    // missing collections out of search indexes.
    return { title: "Page not found", robots: { index: false, follow: false } };
  }
  return {
    title: page.meta.title,
    description: page.meta.subtitle,
    alternates: { canonical: page.meta.url },
    openGraph: {
      title: page.meta.title,
      description: page.meta.subtitle,
      url: page.meta.url,
    },
  };
}

export default async function SlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const visiblePage = await publicPage(slug);
  if (!visiblePage) notFound();
  return <PublicLinkPage page={visiblePage} />;
}
