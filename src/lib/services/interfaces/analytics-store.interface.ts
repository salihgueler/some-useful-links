export type AnalyticsAggregation = "day" | "week" | "month";

export interface AnalyticsQuery {
  pageSlug?: string;
  startDate?: string;
  endDate?: string;
  linkId?: string;
  aggregation?: AnalyticsAggregation;
}

export interface AnalyticsPoint {
  date: string;
  views: number;
  clicks: number;
  shares: number;
}

export interface LinkAnalytics {
  id: string;
  label: string;
  clicks: number;
  rate: number;
}

export interface ReferrerAnalytics {
  source: string;
  visits: number;
  percentage: number;
}

export interface AnalyticsSummary {
  range: { startDate: string; endDate: string };
  totals: {
    views: number;
    clicks: number;
    clickRate: number;
    shares: number;
  };
  trends: {
    views: number;
    clicks: number;
    clickRate: number;
    shares: number;
  };
  timeline: AnalyticsPoint[];
  topLinks: LinkAnalytics[];
  referrers: ReferrerAnalytics[];
}

export interface PageAnalyticsData {
  daily: AnalyticsPoint[];
  links: Array<{ id: string; label: string; clicks: number; rate?: number }>;
  referrers: Array<{ source: string; visits: number }>;
  trends: AnalyticsSummary["trends"];
}

export interface AnalyticsDataFile {
  pages: Record<string, PageAnalyticsData>;
}

/**
 * Reads and writes aggregate analytics independently of the storage provider.
 *
 * Expected errors: methods reject for malformed ISO dates, unsupported
 * aggregation values, unavailable storage, or invalid persisted data.
 *
 * @example
 * const report = await analyticsStore.query({ aggregation: "day" });
 */
export interface AnalyticsStore {
  /** Returns analytics filtered by date range and optional link ID. */
  query(input?: AnalyticsQuery): Promise<AnalyticsSummary>;

  /** Adds or replaces one daily aggregate snapshot for a page slug. */
  upsertDailySnapshot(
    pageSlug: string,
    point: AnalyticsPoint,
  ): Promise<void>;

  /** Replaces local analytics with the provider's development seed data. */
  resetFromSeed(): Promise<void>;
}
