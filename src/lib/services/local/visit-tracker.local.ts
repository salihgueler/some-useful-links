import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import type {
  CountryCount,
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

/** Retention cap for the local mock; the cloud store should use a TTL instead. */
const MAX_STORED_EVENTS = 50_000;

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

    // Built field by field rather than spreading input, so a caller cannot
    // persist unknown properties or choose its own timestamp.
    const event: VisitEvent = {
      id: randomUUID(),
      type: input.type,
      pageSlug: input.pageSlug,
      linkId: input.linkId,
      referrer: input.referrer,
      timestamp: new Date().toISOString(),
    };

    pendingWrite = pendingWrite.then(async () => {
      const events = await this.readEvents();
      events.push(event);
      // Bound the file: an append-only mock is otherwise unbounded growth.
      const retained =
        events.length > MAX_STORED_EVENTS
          ? events.slice(events.length - MAX_STORED_EVENTS)
          : events;
      await mkdir(dirname(visitsPath), { recursive: true });
      await writeFile(visitsPath, `${JSON.stringify(retained, null, 2)}\n`, "utf8");
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

  /**
   * The local store keeps country on the event itself, which the Blocks store
   * deliberately does not -- this file is a development reference and its JSON
   * never leaves the machine, so the day-granularity separation that protects
   * real visitors is not needed here.
   */
  async getCountries(input: VisitMetricsQuery = {}): Promise<CountryCount[]> {
    const events = await this.readEvents();
    const totals = new Map<string, number>();
    for (const event of events) {
      if (input.pageSlug && event.pageSlug !== input.pageSlug) continue;
      const day = event.timestamp.slice(0, 10);
      if (input.startDate && day < input.startDate) continue;
      if (input.endDate && day > input.endDate) continue;
      const code = event.country ?? "ZZ";
      totals.set(code, (totals.get(code) ?? 0) + 1);
    }
    return [...totals]
      .map(([country, visits]) => ({ country, visits }))
      .toSorted((a, b) => b.visits - a.visits || a.country.localeCompare(b.country));
  }

  async clear(): Promise<void> {
    await mkdir(dirname(visitsPath), { recursive: true });
    await writeFile(visitsPath, "[]\n", "utf8");
  }
}
