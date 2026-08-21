export type VisitEventType = "page-view" | "link-click" | "share";

export interface TrackVisitInput {
  type: VisitEventType;
  pageSlug: string;
  linkId?: string;
  /**
   * Referring origin only, never a full URL: query strings can carry tokens.
   * There is deliberately no timestamp field -- the store owns it, so a caller
   * cannot backdate or forward-date an event. The user agent is not recorded:
   * no metric consumes it, and it is a fingerprinting surface.
   */
  referrer?: string;
  /**
   * ISO 3166-1 alpha-2, resolved by the CDN at the edge. "ZZ" when unknown.
   * Stored day-granular and apart from the event; see countries-table.ts.
   */
  country?: string;
}

export interface VisitEvent extends TrackVisitInput {
  id: string;
  timestamp: string;
}

export interface VisitMetricsQuery {
  pageSlug?: string;
  startDate?: string;
  endDate?: string;
}

export interface CountryCount {
  country: string;
  visits: number;
}

export interface VisitMetrics {
  pageViews: number;
  clicks: number;
  shares: number;
  clickThroughRate: number;
  perLink: Array<{ linkId: string; clicks: number }>;
  topReferrers: Array<{ referrer: string; visits: number }>;
}

/**
 * Captures raw visitor activity and derives lightweight real-time metrics.
 *
 * Expected errors: track rejects when a click omits linkId or persistence is
 * unavailable; getMetrics rejects for malformed date filters.
 *
 * @example
 * await visitTracker.track({
 *   type: "link-click",
 *   pageSlug: "home",
 *   linkId: "reading-list"
 * });
 */
export interface VisitTracker {
  /** Persists one page view, link click, or share event and returns its record. */
  track(input: TrackVisitInput): Promise<VisitEvent>;

  /** Returns totals, CTR, per-link counts, and top referrers for a date range. */
  getMetrics(input?: VisitMetricsQuery): Promise<VisitMetrics>;

  /** Visit counts per country for a date range, most visits first. */
  getCountries(input?: VisitMetricsQuery): Promise<CountryCount[]>;

  /** Removes all locally persisted raw events. */
  clear(): Promise<void>;
}
