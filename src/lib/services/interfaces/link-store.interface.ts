import type {
  LinkConfiguration,
  LinkEntry,
  PageConfiguration,
  PageSummary,
} from "@/lib/config/links.types";

export interface LinkStoreSnapshot extends PageConfiguration {
  links: LinkEntry[];
}

/**
 * Provides page-scoped configuration access independently of persistence.
 *
 * Expected errors: write methods reject invalid or duplicate slugs, invalid
 * page data, unavailable storage, and attempts to delete the default page.
 *
 * @example
 * const page = await linkStore.getPage("reinvent2026");
 */
export interface LinkStore {
  /** Returns the complete multi-page configuration. */
  getConfiguration(): Promise<LinkConfiguration>;

  /** Returns lightweight metadata for every configured page. */
  getPages(): Promise<PageSummary[]>;

  /** Returns a page by slug, or null when it does not exist. */
  getPage(slug: string): Promise<PageConfiguration | null>;

  /** Returns the configured default page. */
  getDefaultPage(): Promise<PageConfiguration>;

  /** Returns a page with disabled links removed and display order applied. */
  getEnabledLinks(slug?: string): Promise<LinkStoreSnapshot>;

  /** Returns a page-scoped link by ID, or null when it does not exist. */
  getLinkById(pageSlug: string, id: string): Promise<LinkEntry | null>;

  /** Creates and persists a new page with a unique slug. */
  createPage(page: PageConfiguration): Promise<PageConfiguration>;

  /** Replaces one existing page while preserving its route slug. */
  updatePage(
    slug: string,
    page: PageConfiguration,
  ): Promise<PageConfiguration>;

  /** Deletes a non-default page and returns whether one was removed. */
  deletePage(slug: string): Promise<boolean>;
}
