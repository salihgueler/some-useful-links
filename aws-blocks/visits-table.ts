import { DistributedTable, Scope } from "@aws-blocks/blocks";
import { z } from "zod";
import { ownerPartition } from "./pages-table";

/**
 * Raw visit events.
 *
 *   pk = "USER#<ownerId>"   sk = "V#<pageSlug>#<ISO timestamp>#<id>"
 *
 * Writes arrive from UNAUTHENTICATED public visitors, so the owner cannot come
 * from a session -- it is resolved from the page's slug reservation before the
 * write. That is what keeps events filed under the right owner while the
 * endpoint stays open, and it means an event for an unclaimed slug is rejected
 * rather than orphaned.
 *
 * expiresAt drives DynamoDB TTL and is Unix epoch SECONDS, not milliseconds:
 * passing Date.now() directly would set expiry roughly 50,000 years out and
 * retention would silently never happen.
 */

const EVENT_TYPES = ["page-view", "link-click", "share"] as const;
const RETENTION_DAYS = 90;

const visitSchema = z.object({
  pk: z.string(),
  sk: z.string(),
  pageSlug: z.string(),
  type: z.enum(EVENT_TYPES),
  linkId: z.string().optional(),
  /** Referring origin only, never a full URL. */
  referrer: z.string().optional(),
  timestamp: z.string(),
  /** Unix epoch SECONDS. */
  expiresAt: z.number().int().positive(),
});

export type VisitRecord = z.infer<typeof visitSchema>;
export type VisitEventType = (typeof EVENT_TYPES)[number];

export interface VisitMetrics {
  pageViews: number;
  clicks: number;
  shares: number;
  clickThroughRate: number;
  perLink: Array<{ linkId: string; clicks: number }>;
  topReferrers: Array<{ referrer: string; visits: number }>;
}

const eventKey = (pageSlug: string, timestamp: string, id: string) =>
  `V#${pageSlug}#${timestamp}#${id}`;

export function createVisitsTable(scope: Scope) {
  return new DistributedTable(scope, "visits", {
    schema: visitSchema,
    key: { partitionKey: "pk", sortKey: "sk" },
    ttl: "expiresAt",
  });
}

type VisitsTable = ReturnType<typeof createVisitsTable>;

export function visitOperations(table: VisitsTable) {
  async function read(ownerId: string, pageSlug: string, from: string, to: string) {
    const rows: VisitRecord[] = [];
    for await (const row of table.query({
      where: {
        pk: { equals: ownerPartition(ownerId) },
        sk: { between: [eventKey(pageSlug, from, ""), eventKey(pageSlug, to, "~")] },
      },
    })) {
      rows.push(row);
    }
    return rows;
  }

  return {
    /** ownerId comes from the slug reservation, not from the caller. */
    async track(
      ownerId: string,
      pageSlug: string,
      event: { type: VisitEventType; linkId?: string; referrer?: string },
    ) {
      const now = new Date();
      const id = crypto.randomUUID();
      const timestamp = now.toISOString();
      await table.put({
        pk: ownerPartition(ownerId),
        sk: eventKey(pageSlug, timestamp, id),
        pageSlug,
        type: event.type,
        linkId: event.linkId,
        referrer: event.referrer,
        timestamp,
        expiresAt:
          Math.floor(now.getTime() / 1000) + RETENTION_DAYS * 24 * 60 * 60,
      });
      return { id, timestamp };
    },

    async metrics(
      ownerId: string,
      pageSlug: string,
      startDate = "0000",
      endDate = "9999",
    ): Promise<VisitMetrics> {
      const rows = await read(ownerId, pageSlug, startDate, endDate);
      const pageViews = rows.filter((r) => r.type === "page-view").length;
      const clicks = rows.filter((r) => r.type === "link-click");
      const perLink = new Map<string, number>();
      const referrers = new Map<string, number>();
      for (const row of rows) {
        if (row.type === "link-click" && row.linkId) {
          perLink.set(row.linkId, (perLink.get(row.linkId) ?? 0) + 1);
        }
        if (row.type === "page-view") {
          const key = row.referrer || "Direct";
          referrers.set(key, (referrers.get(key) ?? 0) + 1);
        }
      }
      return {
        pageViews,
        clicks: clicks.length,
        shares: rows.filter((r) => r.type === "share").length,
        clickThroughRate: pageViews === 0 ? 0 : (clicks.length / pageViews) * 100,
        perLink: [...perLink].map(([linkId, count]) => ({ linkId, clicks: count })),
        topReferrers: [...referrers]
          .map(([referrer, visits]) => ({ referrer, visits }))
          .sort((a, b) => b.visits - a.visits),
      };
    },

    /** Clears one page's events for this owner only. */
    async clear(ownerId: string, pageSlug: string) {
      const rows = await read(ownerId, pageSlug, "0000", "9999");
      for (const row of rows) {
        await table.delete({ pk: row.pk, sk: row.sk });
      }
      return rows.length;
    },
  };
}
