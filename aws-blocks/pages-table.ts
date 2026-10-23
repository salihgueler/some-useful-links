import { DistributedTable } from "@aws-blocks/blocks";
import { z } from "zod";
import { Scope } from "@aws-blocks/blocks";

/**
 * Single table holding two record kinds, distinguished by partition key.
 *
 *   pk = "USER#<ownerId>"   sk = "PAGE#<slug>"   an owner's page
 *   pk = "SLUG"             sk = "<slug>"        global slug reservation
 *
 * Public pages resolve by slug alone (there is no user namespace in "/:slug"),
 * so slugs must be globally unique. The reservation record is what enforces
 * that: it is written with ifNotExists, so two owners racing for the same slug
 * cannot both win.
 *
 * The page itself is stored as a JSON string rather than as modelled columns.
 * links.schema.json is already the single source of truth for that shape and is
 * enforced at the API boundary by validatePageInput(); re-declaring every field
 * here in Zod would create a second definition free to drift from the first.
 * Nothing queries inside the page body, so there is no cost to opacity.
 */

const recordSchema = z.object({
  pk: z.string(),
  sk: z.string(),
  /** Denormalised for reservation lookups and owner listings. */
  slug: z.string(),
  /** Reservation records only: which owner holds this slug. */
  slugOwner: z.string().optional(),
  /** Page records only: serialized PageConfiguration. */
  page: z.string().optional(),
  /** Page records only: the owner's default collection. */
  isDefault: z.boolean().optional(),
  updatedAt: z.string(),
});

export type PageRecord = z.infer<typeof recordSchema>;

export const SLUG_PARTITION = "SLUG";
export const ownerPartition = (ownerId: string) => `USER#${ownerId}`;
export const pageKey = (slug: string) => `PAGE#${slug}`;

export function createPagesTable(scope: Scope) {
  return new DistributedTable(scope, "pages", {
    schema: recordSchema,
    key: { partitionKey: "pk", sortKey: "sk" },
  });
}
