import { serverRpc } from "@/lib/auth/server-rpc";
import type {
  CountryCount,
  TrackVisitInput,
  VisitEvent,
  VisitMetrics,
  VisitMetricsQuery,
  VisitTracker,
} from "@/lib/services/interfaces/visit-tracker.interface";

/**
 * Blocks-backed VisitTracker.
 *
 * The read/write split matters here more than anywhere else:
 *  - track() is ANONYMOUS. Public pages record their own views, so no session is
 *    forwarded. The backend resolves the owner from the slug reservation and
 *    rejects an unclaimed slug, so an event can never be filed under nobody.
 *  - getMetrics() and clear() are OWNER-SCOPED and forward the session, so an
 *    owner only ever sees or clears their own events.
 */

const EMPTY: VisitMetrics = {
  pageViews: 0,
  clicks: 0,
  shares: 0,
  clickThroughRate: 0,
  perLink: [],
  topReferrers: [],
};

async function ownedSlugs(): Promise<string[]> {
  const { pages } = await serverRpc<{ pages: Array<{ slug: string }> }>(
    "listPages",
    [],
    { authenticated: true },
  );
  return pages.map((page) => page.slug);
}

function merge(into: VisitMetrics, add: VisitMetrics): VisitMetrics {
  const perLink = new Map(into.perLink.map((row) => [row.linkId, row.clicks]));
  for (const row of add.perLink) {
    perLink.set(row.linkId, (perLink.get(row.linkId) ?? 0) + row.clicks);
  }
  const referrers = new Map(
    into.topReferrers.map((row) => [row.referrer, row.visits]),
  );
  for (const row of add.topReferrers) {
    referrers.set(row.referrer, (referrers.get(row.referrer) ?? 0) + row.visits);
  }
  const pageViews = into.pageViews + add.pageViews;
  const clicks = into.clicks + add.clicks;
  return {
    pageViews,
    clicks,
    shares: into.shares + add.shares,
    clickThroughRate: pageViews === 0 ? 0 : (clicks / pageViews) * 100,
    perLink: [...perLink].map(([linkId, count]) => ({ linkId, clicks: count })),
    topReferrers: [...referrers]
      .map(([referrer, visits]) => ({ referrer, visits }))
      .sort((a, b) => b.visits - a.visits),
  };
}

export class BlocksVisitTracker implements VisitTracker {
  /** Anonymous: the backend owns the timestamp and the referrer reduction. */
  async track(input: TrackVisitInput): Promise<VisitEvent> {
    const { eventId } = await serverRpc<{ ok: boolean; eventId: string }>(
      "track",
      [
        input.pageSlug,
        input.type,
        input.linkId ?? null,
        input.referrer ?? null,
        input.country ?? null,
      ],
    );
    return {
      ...input,
      id: eventId,
      // The authoritative timestamp is the one the backend stored; this copy is
      // only for the response body, which no caller persists.
      timestamp: new Date().toISOString(),
    };
  }

  async getMetrics(input: VisitMetricsQuery = {}): Promise<VisitMetrics> {
    const slugs = input.pageSlug ? [input.pageSlug] : await ownedSlugs();
    let total = EMPTY;
    for (const slug of slugs) {
      const metrics = await serverRpc<VisitMetrics>(
        "visitMetrics",
        [slug, input.startDate, input.endDate],
        { authenticated: true },
      );
      total = merge(total, metrics);
    }
    return total;
  }

  async getCountries(input: VisitMetricsQuery = {}): Promise<CountryCount[]> {
    const slugs = input.pageSlug ? [input.pageSlug] : await ownedSlugs();
    const totals = new Map<string, number>();
    for (const slug of slugs) {
      const { countries } = await serverRpc<{ countries: CountryCount[] }>(
        "queryCountries",
        [slug, input.startDate, input.endDate],
        { authenticated: true },
      );
      for (const row of countries) {
        totals.set(row.country, (totals.get(row.country) ?? 0) + row.visits);
      }
    }
    return [...totals]
      .map(([country, visits]) => ({ country, visits }))
      .sort((a, b) => b.visits - a.visits || a.country.localeCompare(b.country));
  }

  /** Clears every event across this owner's pages, and only theirs. */
  async clear(): Promise<void> {
    for (const slug of await ownedSlugs()) {
      await serverRpc("clearVisits", [slug], { authenticated: true });
    }
  }
}
