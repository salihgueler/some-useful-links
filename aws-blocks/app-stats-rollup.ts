import type { createAnalyticsTable } from "./analytics-table";
import type { createVisitsTable } from "./visits-table";
import type { createPagesTable } from "./pages-table";
import { SLUG_PARTITION } from "./pages-table";
import type { AppStatsDay } from "./app-stats-table";

/**
 * Builds the product-wide daily rollup that the operator dashboard reads.
 *
 * This is the one place in the app that reads across owner partitions, and it
 * is allowed to because it runs on a schedule rather than on a request. The
 * project rule is "no global scan for a user-visible operation" -- a nightly
 * job is not a user-visible operation, and moving the scan here is precisely
 * what keeps it off the read path. The dashboard itself then reads one
 * partition with one query.
 *
 * ACTIVITY COMES FROM TWO TABLES, and it has to:
 *
 *   - `visits` holds one row per real event and is the ONLY source written in
 *     production -- `track` writes visits and countries, nothing else.
 *   - `analytics` holds pre-aggregated days but has no writer in the deployed
 *     app; `upsertDailySnapshot` exists as an RPC method with no caller, so in
 *     the cloud that table only ever contains seeded rows.
 *
 * Reading only `analytics` is what made the first version of this job write
 * nothing at all. Summing both mirrors exactly what the per-collection
 * dashboard does (`views = analytics points + visitMetrics`), so the operator
 * totals cannot drift from the numbers an owner sees for their own page.
 *
 * Note the retention asymmetry: `visits` rows expire after 90 days, but the
 * rows this job writes never do. History therefore accumulates permanently
 * here even though its source is transient.
 */

type AnalyticsTable = ReturnType<typeof createAnalyticsTable>;
type VisitsTable = ReturnType<typeof createVisitsTable>;
type PagesTable = ReturnType<typeof createPagesTable>;

/**
 * How many trailing days of activity to recompute on each run.
 *
 * The scan cost is the same whatever the window, so this only bounds writes.
 * 35 days covers a month-long view plus slack for a missed night, and every
 * activity figure is rewritten from source each time, so a late or duplicated
 * run self-heals instead of drifting.
 */
const ROLLUP_WINDOW_DAYS = 35;

const isoDate = (value: Date) => value.toISOString().slice(0, 10);

/** Inclusive lower bound of the recompute window. */
function windowStart(now: Date): string {
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - (ROLLUP_WINDOW_DAYS - 1));
  return isoDate(start);
}

interface DayAccumulator {
  views: number;
  clicks: number;
  shares: number;
  owners: Set<string>;
  pages: Set<string>;
}

const emptyDay = (): DayAccumulator => ({
  views: 0,
  clicks: 0,
  shares: 0,
  owners: new Set(),
  pages: new Set(),
});

function dayFor(byDate: Map<string, DayAccumulator>, date: string): DayAccumulator {
  let day = byDate.get(date);
  if (!day) {
    day = emptyDay();
    byDate.set(date, day);
  }
  return day;
}

/**
 * Aggregates raw visit events into per-date totals.
 *
 * Owners and collections are counted as distinct sets rather than summed, so a
 * busy owner does not inflate the participant count. The owner id itself is
 * only ever used as a set member and never written out.
 */
async function aggregateVisits(
  visitsTable: VisitsTable,
  byDate: Map<string, DayAccumulator>,
  from: string,
) {
  for await (const row of visitsTable.scan()) {
    // Full ISO timestamp; the date half is what buckets the event.
    const date = row.timestamp.slice(0, 10);
    if (date < from) continue;

    const day = dayFor(byDate, date);
    if (row.type === "page-view") day.views += 1;
    else if (row.type === "link-click") day.clicks += 1;
    else if (row.type === "share") day.shares += 1;

    day.owners.add(row.pk);
    day.pages.add(`${row.pk}/${row.pageSlug}`);
  }
}

/** Folds in any pre-aggregated days, matching the per-collection dashboard. */
async function aggregateAggregates(
  analyticsTable: AnalyticsTable,
  byDate: Map<string, DayAccumulator>,
  from: string,
) {
  for await (const row of analyticsTable.scan()) {
    if (row.date < from) continue;

    const day = dayFor(byDate, row.date);
    day.views += row.views;
    day.clicks += row.clicks;
    day.shares += row.shares;
    day.owners.add(row.pk);
    day.pages.add(`${row.pk}/${row.pageSlug}`);
  }
}

/** Current totals across the whole app, as of this run. */
async function countTotals(pagesTable: PagesTable) {
  const owners = new Set<string>();
  let totalPages = 0;

  for await (const row of pagesTable.scan()) {
    // Skip the global slug reservations -- they are not collections.
    if (row.pk === SLUG_PARTITION) continue;
    owners.add(row.pk);
    totalPages += 1;
  }

  return { totalOwners: owners.size, totalPages };
}

/**
 * Totals already recorded for earlier dates, so they are not overwritten.
 *
 * `totalOwners`/`totalPages` are a point-in-time snapshot, not a property of
 * the date. Stamping this run's totals onto all 35 rewritten days would make
 * the growth chart a flat line for the first 35 days of its life -- every row
 * would carry today's figure. So only the run's own date gets fresh totals and
 * every earlier date keeps whatever it recorded at the time.
 */
type PriorTotals = Map<string, { totalOwners: number; totalPages: number }>;

export async function buildAppStats(
  analyticsTable: AnalyticsTable,
  visitsTable: VisitsTable,
  pagesTable: PagesTable,
  priorTotals: PriorTotals,
  now = new Date(),
): Promise<AppStatsDay[]> {
  const from = windowStart(now);
  const today = isoDate(now);
  const generatedAt = now.toISOString();

  const byDate = new Map<string, DayAccumulator>();

  // Sequential rather than parallel: both walk whole tables, and there is no
  // deadline here worth the extra concurrent read pressure.
  await aggregateVisits(visitsTable, byDate, from);
  await aggregateAggregates(analyticsTable, byDate, from);
  const totals = await countTotals(pagesTable);

  // Today always gets a row, even with no activity at all. Without this a
  // brand-new or quiet install writes nothing and the dashboard shows its
  // empty state indefinitely, which reads as broken rather than as quiet.
  dayFor(byDate, today);

  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, day]) => {
      const carried = priorTotals.get(date);
      const snapshot =
        date === today || !carried
          ? totals
          : { totalOwners: carried.totalOwners, totalPages: carried.totalPages };

      return {
        date,
        views: day.views,
        clicks: day.clicks,
        shares: day.shares,
        activeOwners: day.owners.size,
        activePages: day.pages.size,
        totalOwners: snapshot.totalOwners,
        totalPages: snapshot.totalPages,
        generatedAt,
      };
    });
}
