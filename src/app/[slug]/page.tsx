import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicLinkPage } from "@/components/links/PublicLinkPage";
import { linkStore } from "@/lib/services";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = await linkStore.getPage(slug);
  if (!page) return {};
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
  const page = await linkStore.getPage(slug);
  if (!page) notFound();
  const visiblePage = await linkStore.getEnabledLinks(slug);
  return <PublicLinkPage page={visiblePage} />;
}
