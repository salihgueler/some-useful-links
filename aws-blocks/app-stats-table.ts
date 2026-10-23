import { DistributedTable, Scope } from "@aws-blocks/blocks";
import { z } from "zod";

/**
 * Product-wide daily rollups, for the operator's own view of the whole app.
 *
 *   pk = "APP#STATS"              sk = "D#<YYYY-MM-DD>"
 *
 * A single fixed partition, deliberately. Every other table here is
 * owner-partitioned because owner isolation is the security model; this one is
 * the opposite by design -- it holds numbers ABOUT all owners and belongs to
 * none of them. Keeping it in its own table rather than as a magic partition of
 * `analytics` preserves the invariant that every analytics row belongs to an
 * owner, which is what makes owner isolation provable by inspection.
 *
 * Because there is one partition, a date range is one query and never a scan.
 * The scan happens once a night in the rollup job, off the request path -- see
 * app-stats-rollup.ts.
 *
 * Nothing here is per-visitor: these are counts of counts, aggregated from the
 * daily analytics aggregates, so the rollup cannot reintroduce anything the
 * tracking path deliberately declined to store.
 */

const appStatsSchema = z.object({
  pk: z.literal("APP#STATS"),
  sk: z.string(),
  /** YYYY-MM-DD this row describes. */
  date: z.string(),

  // Activity on this date, summed across every owner.
  views: z.number().int().nonnegative(),
  clicks: z.number().int().nonnegative(),
  shares: z.number().int().nonnegative(),

  /** Owners with any recorded activity on this date. */
  activeOwners: z.number().int().nonnegative(),
  /** Collections with any recorded activity on this date. */
  activePages: z.number().int().nonnegative(),

  // Totals as of the night this row was written, which gives a growth curve
  // for free. They describe the app at that moment, not that date's activity.
  totalOwners: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),

  /** ISO timestamp of the rollup run that produced this row. */
  generatedAt: z.string(),
});

export type AppStatsRecord = z.infer<typeof appStatsSchema>;

/** One day of app-wide numbers, without the storage keys. */
export type AppStatsDay = Omit<AppStatsRecord, "pk" | "sk">;

export const APP_STATS_PARTITION = "APP#STATS" as const;

const rowKey = (date: string) => `D#${date}`;

export function createAppStatsTable(scope: Scope) {
  return new DistributedTable(scope, "appStats", {
    schema: appStatsSchema,
    key: { partitionKey: "pk", sortKey: "sk" },
  });
}

type AppStatsTable = ReturnType<typeof createAppStatsTable>;

export function appStatsOperations(table: AppStatsTable) {
  return {
    /**
     * Writes one day's rollup, overwriting any previous value for that date.
     *
     * Overwrite rather than increment is what makes the nightly job safe to
     * retry: EventBridge delivers at-least-once, so a handler that added to a
     * counter would double-count on a redelivery.
     */
    async putDay(day: AppStatsDay) {
      await table.put({
        pk: APP_STATS_PARTITION,
        sk: rowKey(day.date),
        ...day,
      });
    },

    /**
     * Rows within an inclusive date range, oldest first.
     *
     * Safe as a lexicographic range because the dates are zero-padded ISO, the
     * same reasoning the analytics table relies on.
     */
    async range(
      startDate = "0000-00-00",
      endDate = "9999-99-99",
    ): Promise<AppStatsDay[]> {
      const days: AppStatsDay[] = [];
      for await (const row of table.query({
        where: {
          pk: { equals: APP_STATS_PARTITION },
          sk: { between: [rowKey(startDate), rowKey(endDate)] },
        },
      })) {
        const { pk: _pk, sk: _sk, ...day } = row;
        days.push(day);
      }
      return days;
    },
  };
}
