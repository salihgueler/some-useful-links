import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AnalyticsDashboard } from "@/components/analytics/AnalyticsDashboard";
import { analyticsStore, linkStore, visitTracker } from "@/lib/services";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Analytics",
  description: "Page-scoped performance analytics.",
};

export default async function AnalyticsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [data, page, countries] = await Promise.all([
    analyticsStore.query({ pageSlug: slug, aggregation: "day" }),
    linkStore.getPage(slug),
    visitTracker.getCountries({ pageSlug: slug }),
  ]);
  if (!page) notFound();
  const visiblePage = await linkStore.getEnabledLinks(slug);

  return (
    <AnalyticsDashboard
      initialData={{ ...data, countries }}
      pageSlug={slug}
      meta={visiblePage.meta}
      links={visiblePage.links}
    />
  );
}
