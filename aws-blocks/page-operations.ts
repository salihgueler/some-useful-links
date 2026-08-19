import { ApiError, isBlocksError, DistributedTableErrors } from "@aws-blocks/blocks";
import {
  SLUG_PARTITION,
  ownerPartition,
  pageKey,
  type createPagesTable,
} from "./pages-table";

/** Derived from the factory so the shape can never drift from the real table. */
type PagesTable = ReturnType<typeof createPagesTable>;

const notFound = (slug: string) =>
  new ApiError(`Page "${slug}" was not found`, 404, { name: "PageNotFound" });

/**
 * Owner-scoped page storage.
 *
 * Every method derives the partition from an ownerId the caller never supplies
 * directly -- it comes from the verified session. A slug belonging to another
 * owner therefore behaves exactly like a slug that does not exist, which is the
 * property that makes cross-owner reads and writes impossible rather than
 * merely discouraged.
 */
export function pageOperations(table: PagesTable) {
  async function reserveSlug(slug: string, ownerId: string) {
    try {
      await table.put(
        {
          pk: SLUG_PARTITION,
          sk: slug,
          slug,
          slugOwner: ownerId,
          updatedAt: new Date().toISOString(),
        },
        { ifNotExists: true },
      );
    } catch (error) {
      if (isBlocksError(error, DistributedTableErrors.ConditionalCheckFailed)) {
        throw new ApiError(`The slug "${slug}" is already taken`, 409, {
          name: "SlugTaken",
        });
      }
      throw error;
    }
  }

  /** Resolves a public slug to its owner, or undefined when unclaimed. */
  async function resolveSlugOwner(slug: string): Promise<string | undefined> {
    const reservation = await table.get({ pk: SLUG_PARTITION, sk: slug });
    return reservation?.slugOwner;
  }

  async function readOwnedPage(ownerId: string, slug: string) {
    const record = await table.get({
      pk: ownerPartition(ownerId),
      sk: pageKey(slug),
    });
    return record;
  }

  return {
    resolveSlugOwner,

    async listPages(ownerId: string) {
      const summaries: Array<{ slug: string; isDefault: boolean; page: string }> = [];
      for await (const record of table.query({
        where: { pk: { equals: ownerPartition(ownerId) }, sk: { beginsWith: "PAGE#" } },
      })) {
        if (record.page) {
          summaries.push({
            slug: record.slug,
            isDefault: record.isDefault ?? false,
            page: record.page,
          });
        }
      }
      return summaries;
    },

    async getPage(ownerId: string, slug: string) {
      const record = await readOwnedPage(ownerId, slug);
      return record?.page;
    },

    /** Public read: resolve the reservation, then fetch from the owner's partition. */
    async getPublicPage(slug: string) {
      const ownerId = await resolveSlugOwner(slug);
      if (!ownerId) return undefined;
      const record = await readOwnedPage(ownerId, slug);
      return record?.page;
    },

    async createPage(ownerId: string, slug: string, page: string, isDefault: boolean) {
      await reserveSlug(slug, ownerId);
      try {
        await table.put({
          pk: ownerPartition(ownerId),
          sk: pageKey(slug),
          slug,
          page,
          isDefault,
          updatedAt: new Date().toISOString(),
        });
      } catch (error) {
        // Release only a reservation this owner just acquired, so a failure
        // here cannot strand the slug or delete someone else's claim.
        const reservation = await table.get({ pk: SLUG_PARTITION, sk: slug });
        if (reservation?.slugOwner === ownerId) {
          await table.delete({ pk: SLUG_PARTITION, sk: slug });
        }
        throw error;
      }
    },

    async updatePage(ownerId: string, slug: string, page: string) {
      const existing = await readOwnedPage(ownerId, slug);
      if (!existing) throw notFound(slug);
      await table.put({
        ...existing,
        page,
        updatedAt: new Date().toISOString(),
      });
    },

    async deletePage(ownerId: string, slug: string) {
      const existing = await readOwnedPage(ownerId, slug);
      if (!existing) throw notFound(slug);
      if (existing.isDefault) {
        throw new ApiError("The default page cannot be deleted", 400, {
          name: "DefaultPageProtected",
        });
      }
      await table.delete({ pk: ownerPartition(ownerId), sk: pageKey(slug) });
      const reservation = await table.get({ pk: SLUG_PARTITION, sk: slug });
      if (reservation?.slugOwner === ownerId) {
        await table.delete({ pk: SLUG_PARTITION, sk: slug });
      }
      return true;
    },
  };
}
