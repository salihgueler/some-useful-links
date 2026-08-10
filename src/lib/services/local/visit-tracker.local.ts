import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import type {
  TrackVisitInput,
  VisitEvent,
  VisitMetrics,
  VisitMetricsQuery,
  VisitTracker,
} from "@/lib/services/interfaces/visit-tracker.interface";

const visitsPath = join(
  process.cwd(),
  "src/lib/services/local/data/visits.json",
);

// Serializing writes prevents overlapping local API requests from losing data.
let pendingWrite = Promise.resolve();

export class LocalVisitTracker implements VisitTracker {
  private async readEvents(): Promise<VisitEvent[]> {
    try {
      return JSON.parse(await readFile(visitsPath, "utf8")) as VisitEvent[];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      return [];
    }
  }

  async track(input: TrackVisitInput): Promise<VisitEvent> {
    if (!input.pageSlug) {
      throw new Error("pageSlug is required for tracking events");
    }
    if (input.type === "link-click" && !input.linkId) {
      throw new Error("linkId is required for link-click events");
    }

    const event: VisitEvent = {
      ...input,
      id: randomUUID(),
      timestamp: input.timestamp ?? new Date().toISOString(),
    };

    pendingWrite = pendingWrite.then(async () => {
      const events = await this.readEvents();
      events.push(event);
      await mkdir(dirname(visitsPath), { recursive: true });
      await writeFile(visitsPath, `${JSON.stringify(events, null, 2)}\n`, "utf8");
    });
    await pendingWrite;
    return event;
  }

  async getMetrics(input: VisitMetricsQuery = {}): Promise<VisitMetrics> {
    const events = (await this.readEvents()).filter((event) => {
      const date = event.timestamp.slice(0, 10);
      return (
        (!input.pageSlug || event.pageSlug === input.pageSlug) &&
        (!input.startDate || date >= input.startDate) &&
        (!input.endDate || date <= input.endDate)
      );
    });
    const pageViews = events.filter((event) => event.type === "page-view").length;
    const clicks = events.filter((event) => event.type === "link-click");
    const shares = events.filter((event) => event.type === "share").length;

    const perLink = new Map<string, number>();
    const referrers = new Map<string, number>();
    for (const event of events) {
      if (event.type === "link-click" && event.linkId) {
        perLink.set(event.linkId, (perLink.get(event.linkId) ?? 0) + 1);
      }
      if (event.type === "page-view") {
        const referrer = event.referrer || "Direct";
        referrers.set(referrer, (referrers.get(referrer) ?? 0) + 1);
      }
    }

    return {
      pageViews,
      clicks: clicks.length,
      shares,
      clickThroughRate:
        pageViews === 0 ? 0 : (clicks.length / pageViews) * 100,
      perLink: [...perLink].map(([linkId, count]) => ({
        linkId,
        clicks: count,
      })),
      topReferrers: [...referrers]
        .map(([referrer, visits]) => ({ referrer, visits }))
        .toSorted((a, b) => b.visits - a.visits),
    };
  }

  async clear(): Promise<void> {
    await mkdir(dirname(visitsPath), { recursive: true });
    await writeFile(visitsPath, "[]\n", "utf8");
  }
}
