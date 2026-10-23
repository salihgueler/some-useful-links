import { DistributedTable, Scope } from "@aws-blocks/blocks";
import { z } from "zod";
import { ownerPartition } from "./pages-table";

/**
 * Country of origin for visits, stored at DAY granularity.
 *
 *   pk = "USER#<ownerId>"   sk = "C#<pageSlug>#<YYYY-MM-DD>#<id>"
 *
 * Deliberately a separate table from visits rather than a field on the visit
 * event. A visit row carries a full ISO timestamp and a linkId; adding a country
 * to it would create the combination "the single German visitor who clicked X at
 * 14:32", which on a low-traffic personal page can identify a real person to an
 * owner who knows who they shared the link with. Here the coarsest useful unit
 * is the day, nothing links a row back to a visit event, and no IP address is
 * received or stored at any point -- CloudFront resolves the country at the edge
 * and only the two-letter code reaches this code.
 *
 * One row per visit rather than a counter: DistributedTable exposes get/put/
 * delete/query with no atomic increment, so a counter would be a
 * read-modify-write and two visits landing together would silently lose one.
 * Distinct keys cannot race, and counting happens at read time.
 *
 * expiresAt drives DynamoDB TTL and is Unix epoch SECONDS.
 */

const RETENTION_DAYS = 400;

/** ISO 3166-1 alpha-2, or ZZ when CloudFront could not determine one. */
const COUNTRY = /^[A-Z]{2}$/;

const countrySchema = z.object({
  pk: z.string(),
  sk: z.string(),
  pageSlug: z.string(),
  /** YYYY-MM-DD. No time component, by design. */
  date: z.string(),
  country: z.string().regex(COUNTRY),
  /** Unix epoch SECONDS. */
  expiresAt: z.number().int().positive(),
});

export type CountryRecord = z.infer<typeof countrySchema>;

export interface CountryCount {
  country: string;
  visits: number;
}

const rowKey = (pageSlug: string, date: string, id: string) =>
  `C#${pageSlug}#${date}#${id}`;

const idFromKey = (sk: string) => sk.slice(sk.lastIndexOf("#") + 1);

/** Anything CloudFront could not resolve becomes ZZ rather than being dropped. */
export function normalizeCountry(raw: string | null | undefined): string {
  const value = (raw ?? "").trim().toUpperCase();
  return COUNTRY.test(value) ? value : "ZZ";
}

export function createCountriesTable(scope: Scope) {
  return new DistributedTable(scope, "countries", {
    schema: countrySchema,
    key: { partitionKey: "pk", sortKey: "sk" },
    ttl: "expiresAt",
  });
}

type CountriesTable = ReturnType<typeof createCountriesTable>;

export function countryOperations(table: CountriesTable) {
  async function read(ownerId: string, pageSlug: string, from: string, to: string) {
    const rows: CountryRecord[] = [];
    for await (const row of table.query({
      where: {
        pk: { equals: ownerPartition(ownerId) },
        // Dates are zero-padded ISO, so lexicographic bounds are chronological.
        sk: { between: [rowKey(pageSlug, from, ""), rowKey(pageSlug, to, "~")] },
      },
    })) {
      rows.push(row);
    }
    return rows;
  }

  return {
    /** ownerId comes from the slug reservation, never from the caller. */
    async record(ownerId: string, pageSlug: string, country: string) {
      const now = new Date();
      const date = now.toISOString().slice(0, 10);
      const id = crypto.randomUUID();
      await table.put({
        pk: ownerPartition(ownerId),
        sk: rowKey(pageSlug, date, id),
        pageSlug,
        date,
        country: normalizeCountry(country),
        expiresAt:
          Math.floor(now.getTime() / 1000) + RETENTION_DAYS * 24 * 60 * 60,
      });
    },

    /** Visit counts per country, most visits first. */
    async counts(
      ownerId: string,
      pageSlug: string,
      startDate = "0000-00-00",
      endDate = "9999-99-99",
    ): Promise<CountryCount[]> {
      const totals = new Map<string, number>();
      for (const row of await read(ownerId, pageSlug, startDate, endDate)) {
        totals.set(row.country, (totals.get(row.country) ?? 0) + 1);
      }
      return [...totals]
        .map(([country, visits]) => ({ country, visits }))
        .sort((a, b) => b.visits - a.visits || a.country.localeCompare(b.country));
    },

    /** Moves one page's rows onto a new slug; the slug is in the sort key. */
    async rename(ownerId: string, fromSlug: string, toSlug: string) {
      if (fromSlug === toSlug) return 0;
      const rows = await read(ownerId, fromSlug, "0000-00-00", "9999-99-99");
      for (const row of rows) {
        await table.put({
          ...row,
          sk: rowKey(toSlug, row.date, idFromKey(row.sk)),
          pageSlug: toSlug,
        });
        await table.delete({ pk: row.pk, sk: row.sk });
      }
      return rows.length;
    },

    /** Clears one page's rows for this owner only. */
    async clear(ownerId: string, pageSlug: string) {
      const rows = await read(ownerId, pageSlug, "0000-00-00", "9999-99-99");
      for (const row of rows) {
        await table.delete({ pk: row.pk, sk: row.sk });
      }
      return rows.length;
    },
  };
}
