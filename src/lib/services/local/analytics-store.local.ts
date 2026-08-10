import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type {
  AnalyticsDataFile,
  AnalyticsPoint,
  AnalyticsQuery,
  AnalyticsStore,
  AnalyticsSummary,
  PageAnalyticsData,
} from "@/lib/services/interfaces/analytics-store.interface";

const dataPath = join(
  process.cwd(),
  "src/lib/services/local/data/analytics.json",
);
const seedPath = join(
  process.cwd(),
  "src/lib/services/local/data/seed-data.json",
);

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const emptyPageData: PageAnalyticsData = {
  daily: [],
  links: [],
  referrers: [],
  trends: { views: 0, clicks: 0, clickRate: 0, shares: 0 },
};

function assertDate(value: string | undefined, name: string): void {
  if (value && !isoDatePattern.test(value)) {
    throw new Error(`${name} must use YYYY-MM-DD format`);
  }
}

function sum(points: AnalyticsPoint[], key: "views" | "clicks" | "shares") {
  return points.reduce((total, point) => total + point[key], 0);
}

function percentageRows<T extends { visits: number }>(rows: T[]) {
  const total = rows.reduce((result, row) => result + row.visits, 0);
  return rows.map((row) => ({
    ...row,
    percentage: total === 0 ? 0 : Math.round((row.visits / total) * 100),
  }));
}

function bucketDate(date: string, aggregation: "day" | "week" | "month") {
  if (aggregation === "day") return date;
  if (aggregation === "month") return date.slice(0, 7);

  const value = new Date(`${date}T00:00:00Z`);
  const day = value.getUTCDay() || 7;
  value.setUTCDate(value.getUTCDate() - day + 1);
  return value.toISOString().slice(0, 10);
}

function aggregatePoints(
  points: AnalyticsPoint[],
  aggregation: "day" | "week" | "month",
) {
  if (aggregation === "day") return points;

  const buckets = new Map<string, AnalyticsPoint>();
  for (const point of points) {
    const date = bucketDate(point.date, aggregation);
    const current = buckets.get(date) ?? { date, views: 0, clicks: 0, shares: 0 };
    current.views += point.views;
    current.clicks += point.clicks;
    current.shares += point.shares;
    buckets.set(date, current);
  }
  return [...buckets.values()];
}

export class LocalAnalyticsStore implements AnalyticsStore {
  private async readData(): Promise<AnalyticsDataFile> {
    try {
      return JSON.parse(await readFile(dataPath, "utf8")) as AnalyticsDataFile;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "ENOENT") throw error;
      await this.resetFromSeed();
      return JSON.parse(await readFile(dataPath, "utf8")) as AnalyticsDataFile;
    }
  }

  async query(input: AnalyticsQuery = {}): Promise<AnalyticsSummary> {
    assertDate(input.startDate, "startDate");
    assertDate(input.endDate, "endDate");

    const data = await this.readData();
    const pageData = data.pages[input.pageSlug ?? "home"] ?? emptyPageData;
    const allDates = pageData.daily.map((point) => point.date);
    const startDate = input.startDate ?? allDates[0] ?? "";
    const endDate = input.endDate ?? allDates.at(-1) ?? "";
    const filtered = pageData.daily.filter(
      (point) => point.date >= startDate && point.date <= endDate,
    );

    const views = sum(filtered, "views");
    const allClicks = sum(filtered, "clicks");
    const selectedLink = input.linkId
      ? pageData.links.find((link) => link.id === input.linkId)
      : undefined;
    const clicks = selectedLink?.clicks ?? allClicks;
    const shares = sum(filtered, "shares");
    const topLinks = pageData.links
      .filter((link) => !input.linkId || link.id === input.linkId)
      .toSorted((a, b) => b.clicks - a.clicks)
      .map((link) => ({
        ...link,
        rate:
          link.rate ?? (allClicks === 0 ? 0 : (link.clicks / allClicks) * 100),
      }));

    return {
      range: { startDate, endDate },
      totals: {
        views,
        clicks,
        clickRate: views === 0 ? 0 : (clicks / views) * 100,
        shares,
      },
      trends: pageData.trends,
      timeline: aggregatePoints(filtered, input.aggregation ?? "day"),
      topLinks,
      referrers: percentageRows(pageData.referrers),
    };
  }

  async upsertDailySnapshot(
    pageSlug: string,
    point: AnalyticsPoint,
  ): Promise<void> {
    assertDate(point.date, "point.date");
    const data = await this.readData();
    const pageData = data.pages[pageSlug] ?? structuredClone(emptyPageData);
    const index = pageData.daily.findIndex((item) => item.date === point.date);
    if (index >= 0) pageData.daily[index] = point;
    else pageData.daily.push(point);
    pageData.daily.sort((a, b) => a.date.localeCompare(b.date));
    data.pages[pageSlug] = pageData;
    await mkdir(dirname(dataPath), { recursive: true });
    await writeFile(dataPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  }

  async resetFromSeed(): Promise<void> {
    await mkdir(dirname(dataPath), { recursive: true });
    await copyFile(seedPath, dataPath);
  }
}
