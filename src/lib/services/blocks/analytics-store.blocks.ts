import { serverRpc } from "@/lib/auth/server-rpc";
import type {
  AnalyticsAggregation,
  AnalyticsPoint,
  AnalyticsQuery,
  AnalyticsStore,
  AnalyticsSummary,
} from "@/lib/services/interfaces/analytics-store.interface";
import type { VisitMetrics } from "@/lib/services/interfaces/visit-tracker.interface";
import type { PageConfiguration } from "@/lib/config/links.types";

/**
 * Blocks-backed AnalyticsStore. Every call is owner-scoped.
 *
 * Two sources are combined deliberately:
 *  - the timeline comes from the daily aggregates table, which survives the
 *    90-day TTL on raw events;
 *  - top links and referrers come from visit events, which is the only place
 *    per-link and per-referrer detail exists.
 *
 * Link LABELS come from the page itself, read through the public path, because
 * the aggregates store only IDs.
 */

function bucket(date: string, aggregation: AnalyticsAggregation): string {
  if (aggregation === "day") return date;
  if (aggregation === "month") return date.slice(0, 7);
  const value = new Date(`${date}T00:00:00Z`);
  const weekday = value.getUTCDay() || 7;
  value.setUTCDate(value.getUTCDate() - weekday + 1);
  return value.toISOString().slice(0, 10);
}

function aggregate(
  points: AnalyticsPoint[],
  aggregation: AnalyticsAggregation,
): AnalyticsPoint[] {
  if (aggregation === "day") return points;
  const buckets = new Map<string, AnalyticsPoint>();
  for (const point of points) {
    const date = bucket(point.date, aggregation);
    const current =
      buckets.get(date) ?? { date, views: 0, clicks: 0, shares: 0 };
    current.views += point.views;
    current.clicks += point.clicks;
    current.shares += point.shares;
    buckets.set(date, current);
  }
  return [...buckets.values()];
}

const sum = (points: AnalyticsPoint[], key: "views" | "clicks" | "shares") =>
  points.reduce((total, point) => total + point[key], 0);

export class BlocksAnalyticsStore implements AnalyticsStore {
  private async defaultSlug(): Promise<string | undefined> {
    const { pages } = await serverRpc<{
      pages: Array<{ slug: string; isDefault: boolean }>;
    }>("listPages", [], { authenticated: true });
    return (pages.find((page) => page.isDefault) ?? pages[0])?.slug;
  }

  async query(input: AnalyticsQuery = {}): Promise<AnalyticsSummary> {
    const pageSlug = input.pageSlug ?? (await this.defaultSlug());
    const empty: AnalyticsSummary = {
      range: { startDate: "", endDate: "" },
      totals: { views: 0, clicks: 0, clickRate: 0, shares: 0 },
      trends: { views: 0, clicks: 0, clickRate: 0, shares: 0 },
      timeline: [],
      topLinks: [],
      referrers: [],
    };
    if (!pageSlug) return empty;

    const [{ points }, metrics] = await Promise.all([
      serverRpc<{ points: AnalyticsPoint[] }>(
        "queryAnalytics",
        [pageSlug, input.startDate, input.endDate],
        { authenticated: true },
      ),
      serverRpc<VisitMetrics>(
        "visitMetrics",
        [pageSlug, input.startDate, input.endDate],
        { authenticated: true },
      ),
    ]);

    const ordered = [...points].sort((a, b) => a.date.localeCompare(b.date));
    const views = sum(ordered, "views") + metrics.pageViews;
    const allClicks = sum(ordered, "clicks") + metrics.clicks;
    const shares = sum(ordered, "shares") + metrics.shares;

    // Labels live on the page, not in the aggregates.
    const { page: raw } = await serverRpc<{ page: string | null }>(
      "getPublicPage",
      [pageSlug],
    );
    const links = raw ? (JSON.parse(raw) as PageConfiguration).links : [];
    const labelOf = (id: string) =>
      links.find((link) => link.id === id)?.label ?? id;

    const selected = input.linkId
      ? metrics.perLink.filter((row) => row.linkId === input.linkId)
      : metrics.perLink;
    const clicks = input.linkId
      ? selected.reduce((total, row) => total + row.clicks, 0)
      : allClicks;

    const referrerTotal = metrics.topReferrers.reduce(
      (total, row) => total + row.visits,
      0,
    );

    return {
      range: {
        startDate: input.startDate ?? ordered[0]?.date ?? "",
        endDate: input.endDate ?? ordered.at(-1)?.date ?? "",
      },
      totals: {
        views,
        clicks,
        clickRate: views === 0 ? 0 : (clicks / views) * 100,
        shares,
      },
      // Period-over-period comparison needs a second query over the preceding
      // window; until that exists, reporting zero is honest rather than
      // inventing a movement.
      trends: { views: 0, clicks: 0, clickRate: 0, shares: 0 },
      timeline: aggregate(ordered, input.aggregation ?? "day"),
      topLinks: selected
        .map((row) => ({
          id: row.linkId,
          label: labelOf(row.linkId),
          clicks: row.clicks,
          rate: allClicks === 0 ? 0 : (row.clicks / allClicks) * 100,
        }))
        .sort((a, b) => b.clicks - a.clicks),
      referrers: metrics.topReferrers.map((row) => ({
        source: row.referrer,
        visits: row.visits,
        percentage:
          referrerTotal === 0
            ? 0
            : Math.round((row.visits / referrerTotal) * 100),
      })),
    };
  }

  async upsertDailySnapshot(
    pageSlug: string,
    point: AnalyticsPoint,
  ): Promise<void> {
    await serverRpc("upsertDailySnapshot", [pageSlug, point], {
      authenticated: true,
    });
  }

  /**
   * There is no per-owner seed in the cloud path, so this CLEARS the caller's
   * aggregates rather than restoring sample data. Named for the interface it
   * implements; the behaviour difference is deliberate and owner-bounded.
   */
  async resetFromSeed(): Promise<void> {
    const { pages } = await serverRpc<{ pages: Array<{ slug: string }> }>(
      "listPages",
      [],
      { authenticated: true },
    );
    for (const page of pages) {
      await serverRpc("resetAnalytics", [page.slug], { authenticated: true });
    }
  }
}
