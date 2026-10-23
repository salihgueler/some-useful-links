import { DistributedTable, Scope } from "@aws-blocks/blocks";
import { z } from "zod";
import { ownerPartition } from "./pages-table";

/**
 * Daily analytics aggregates, one record per owner + page + day.
 *
 *   pk = "USER#<ownerId>"          sk = "A#<pageSlug>#<YYYY-MM-DD>"
 *
 * The composite sort key means one query answers "this owner's rows for this
 * page between two dates" -- owner isolation, page filter and date range in a
 * single key condition, with no secondary index and no scan. Reset and query
 * are therefore both owner-bounded by construction.
 */

const analyticsSchema = z.object({
  pk: z.string(),
  sk: z.string(),
  pageSlug: z.string(),
  /** YYYY-MM-DD */
  date: z.string(),
  views: z.number().int().nonnegative(),
  clicks: z.number().int().nonnegative(),
  shares: z.number().int().nonnegative(),
});

export type AnalyticsRecord = z.infer<typeof analyticsSchema>;

export interface AnalyticsPoint {
  date: string;
  views: number;
  clicks: number;
  shares: number;
}

const rowKey = (pageSlug: string, date: string) => `A#${pageSlug}#${date}`;

export function createAnalyticsTable(scope: Scope) {
  return new DistributedTable(scope, "analytics", {
    schema: analyticsSchema,
    key: { partitionKey: "pk", sortKey: "sk" },
  });
}

type AnalyticsTable = ReturnType<typeof createAnalyticsTable>;

export function analyticsOperations(table: AnalyticsTable) {
  return {
    /** Insert or replace one day's aggregate for one of this owner's pages. */
    async upsertDaily(ownerId: string, pageSlug: string, point: AnalyticsPoint) {
      await table.put({
        pk: ownerPartition(ownerId),
        sk: rowKey(pageSlug, point.date),
        pageSlug,
        date: point.date,
        views: point.views,
        clicks: point.clicks,
        shares: point.shares,
      });
    },

    /**
     * Rows for one page within an inclusive date range. An open range is
     * expressed with lexicographic bounds on the date portion, which is safe
     * because the dates are zero-padded ISO.
     */
    async range(
      ownerId: string,
      pageSlug: string,
      startDate = "0000-00-00",
      endDate = "9999-99-99",
    ): Promise<AnalyticsPoint[]> {
      const points: AnalyticsPoint[] = [];
      for await (const row of table.query({
        where: {
          pk: { equals: ownerPartition(ownerId) },
          sk: { between: [rowKey(pageSlug, startDate), rowKey(pageSlug, endDate)] },
        },
      })) {
        points.push({
          date: row.date,
          views: row.views,
          clicks: row.clicks,
          shares: row.shares,
        });
      }
      return points;
    },

    /**
     * Moves every row for one page onto a new slug.
     *
     * The slug is part of the sort key, so this cannot be an in-place update:
     * each row is rewritten under the new key and the old one deleted. Bounded
     * by one row per day of recorded history.
     */
    async rename(ownerId: string, fromSlug: string, toSlug: string) {
      if (fromSlug === toSlug) return 0;
      const points = await this.range(ownerId, fromSlug);
      for (const point of points) {
        await this.upsertDaily(ownerId, toSlug, point);
        await table.delete({
          pk: ownerPartition(ownerId),
          sk: rowKey(fromSlug, point.date),
        });
      }
      return points.length;
    },

    /** Deletes every analytics row this owner holds for one page. */
    async reset(ownerId: string, pageSlug: string) {
      let deleted = 0;
      for (const point of await this.range(ownerId, pageSlug)) {
        await table.delete({
          pk: ownerPartition(ownerId),
          sk: rowKey(pageSlug, point.date),
        });
        deleted += 1;
      }
      return deleted;
    },
  };
}
