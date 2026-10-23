import { serverRpc } from "@/lib/auth/server-rpc";
import type {
  AppStatsDay,
  AppStatsQuery,
  AppStatsStore,
} from "@/lib/services/interfaces/app-stats.interface";

/**
 * Blocks-backed AppStatsStore.
 *
 * Reads the pre-aggregated nightly rollup, so this is one query against one
 * DynamoDB partition regardless of how many owners exist. The cross-owner scan
 * that produced it ran on a schedule; nothing here touches another owner's
 * data directly.
 *
 * The session cookie is forwarded because the backend decides authorization:
 * it compares the caller's Cognito sub against the configured operator and
 * rejects with a not-found error for anyone else.
 */
export class BlocksAppStatsStore implements AppStatsStore {
  async query(input: AppStatsQuery = {}): Promise<{ days: AppStatsDay[] }> {
    const result = await serverRpc<{ days?: unknown }>(
      "appStats",
      [input.startDate ?? null, input.endDate ?? null],
      { authenticated: true },
    );
    return { days: Array.isArray(result?.days) ? (result.days as AppStatsDay[]) : [] };
  }
}
