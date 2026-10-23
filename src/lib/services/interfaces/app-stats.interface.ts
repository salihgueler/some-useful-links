/**
 * App-wide statistics, for the single operator account.
 *
 * Distinct from AnalyticsStore in both scope and audience: that one answers
 * "how is this collection doing" for whoever owns it, this one answers "how is
 * the product doing" for the one account allowed to ask. Keeping them apart
 * means no owner-facing code path can accidentally reach across owners.
 *
 * Authorization lives in the backend, not here. Every method rejects with a
 * not-found error for any caller that is not the operator, so a UI that forgets
 * to gate itself still cannot read data.
 */

/** One day of product-wide numbers. */
export interface AppStatsDay {
  /** YYYY-MM-DD this row describes. */
  date: string;

  // Activity on this date, summed across every owner.
  views: number;
  clicks: number;
  shares: number;

  /** Owners with any recorded activity on this date. */
  activeOwners: number;
  /** Collections with any recorded activity on this date. */
  activePages: number;

  // Totals as of the night this row was written -- a growth curve, not that
  // day's activity.
  totalOwners: number;
  totalPages: number;

  /** ISO timestamp of the rollup run that produced this row. */
  generatedAt: string;
}

export interface AppStatsQuery {
  startDate?: string;
  endDate?: string;
}

/**
 * Reads the nightly product-wide rollup.
 *
 * Expected errors: rejects with a not-found error when the caller is not the
 * operator account, and for unavailable storage.
 *
 * @example
 * const { days } = await appStatsStore.query({ startDate: "2026-08-01" });
 */
export interface AppStatsStore {
  /** Daily rollups within an inclusive date range, oldest first. */
  query(input?: AppStatsQuery): Promise<{ days: AppStatsDay[] }>;
}
