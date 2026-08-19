import type {
  LinkConfiguration,
  LinkEntry,
  PageConfiguration,
  PageSummary,
} from "@/lib/config/links.types";
import { RpcError, serverRpc } from "@/lib/auth/server-rpc";
import type {
  LinkStore,
  LinkStoreSnapshot,
} from "@/lib/services/interfaces/link-store.interface";

/**
 * Blocks-backed LinkStore.
 *
 * The interface is unchanged, but each method now resolves to one of two
 * different backend surfaces, and the split is the whole point:
 *
 *  - getEnabledLinks / getLinkById are PUBLIC. They call getPublicPage, which
 *    resolves the slug reservation to whichever owner holds it. A visitor with
 *    no session, or one signed in as somebody else, sees the same result.
 *  - everything else is OWNER-SCOPED and forwards the session cookie, so the
 *    backend derives ownerId from the verified session. A slug held by another
 *    owner reads as absent.
 *
 * Pages cross the wire as JSON strings; see aws-blocks/pages-table.ts for why
 * the body is stored opaquely.
 */

const parsePage = (raw: string): PageConfiguration =>
  JSON.parse(raw) as PageConfiguration;

/** Applies display order and drops disabled links, matching the local store. */
function visibleLinks(page: PageConfiguration): LinkStoreSnapshot {
  const links = page.links
    .map((link, arrayIndex) => ({ link, arrayIndex }))
    .filter(({ link }) => link.enabled !== false)
    .sort(
      (a, b) => (a.link.order ?? a.arrayIndex) - (b.link.order ?? b.arrayIndex),
    )
    .map(({ link }) => link);
  return { ...page, links };
}

export class BlocksLinkStore implements LinkStore {
  private async ownedPages(): Promise<
    Array<{ slug: string; isDefault: boolean; page: string }>
  > {
    const { pages } = await serverRpc<{
      pages: Array<{ slug: string; isDefault: boolean; page: string }>;
    }>("listPages", [], { authenticated: true });
    return pages;
  }

  async getConfiguration(): Promise<LinkConfiguration> {
    const pages = await this.ownedPages();
    const parsed = pages.map((record) => parsePage(record.page));
    const defaultSlug =
      pages.find((record) => record.isDefault)?.slug ?? parsed[0]?.slug ?? "";
    return { defaultSlug, pages: parsed };
  }

  async getPages(): Promise<PageSummary[]> {
    const pages = await this.ownedPages();
    return pages.map((record) => {
      const page = parsePage(record.page);
      return {
        slug: page.slug,
        title: page.meta.title,
        url: page.meta.url,
        linkCount: page.links.length,
      };
    });
  }

  /** Owner-scoped: used by the admin surfaces. */
  async getPage(slug: string): Promise<PageConfiguration | null> {
    const { page } = await serverRpc<{ page: string | null }>(
      "getPage",
      [slug],
      { authenticated: true },
    );
    return page ? parsePage(page) : null;
  }

  async getDefaultPage(): Promise<PageConfiguration> {
    const pages = await this.ownedPages();
    const record = pages.find((candidate) => candidate.isDefault) ?? pages[0];
    if (!record) throw new Error("This account has no collections yet");
    return parsePage(record.page);
  }

  /**
   * PUBLIC: no session is sent, so anyone resolves the same page.
   *
   * A slug is required. There is no root collection: every collection belongs
   * to an owner and lives at /:slug, and "/" is a landing page. Silently
   * falling back to a reserved slug here is what made "/" depend on whoever
   * claimed it.
   */
  async getEnabledLinks(slug?: string): Promise<LinkStoreSnapshot> {
    if (!slug) {
      throw new Error("A page slug is required: there is no root collection");
    }
    const { page } = await serverRpc<{ page: string | null }>("getPublicPage", [
      slug,
    ]);
    if (!page) throw new Error(`Page "${slug}" was not found`);
    return visibleLinks(parsePage(page));
  }

  /** PUBLIC: used to validate tracking payloads. */
  async getLinkById(pageSlug: string, id: string): Promise<LinkEntry | null> {
    const { page } = await serverRpc<{ page: string | null }>("getPublicPage", [
      pageSlug,
    ]);
    if (!page) return null;
    return parsePage(page).links.find((link) => link.id === id) ?? null;
  }

  async createPage(page: PageConfiguration): Promise<PageConfiguration> {
    const existing = await this.ownedPages();
    await serverRpc(
      "createPage",
      [page.slug, JSON.stringify(page), existing.length === 0],
      { authenticated: true },
    );
    return page;
  }

  async updatePage(
    slug: string,
    page: PageConfiguration,
  ): Promise<PageConfiguration> {
    if (slug !== page.slug) throw new Error("A page slug cannot be changed");
    await serverRpc("updatePage", [slug, JSON.stringify(page)], {
      authenticated: true,
    });
    return page;
  }

  async deletePage(slug: string): Promise<boolean> {
    try {
      const { deleted } = await serverRpc<{ deleted: boolean }>(
        "deletePage",
        [slug],
        { authenticated: true },
      );
      return deleted;
    } catch (error) {
      // A slug this owner does not hold is reported as absent, not as an error,
      // to match the local store's contract.
      if (error instanceof RpcError && error.rpcName === "PageNotFound") {
        return false;
      }
      throw error;
    }
  }
}
