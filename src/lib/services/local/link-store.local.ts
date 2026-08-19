import { readFile, writeFile } from "node:fs/promises";
import { PublicError } from "@/lib/api/errors";
import { join } from "node:path";
import type {
  LinkConfiguration,
  LinkEntry,
  PageConfiguration,
  PageSummary,
} from "@/lib/config/links.types";
import type {
  LinkStore,
  LinkStoreSnapshot,
} from "@/lib/services/interfaces/link-store.interface";

const configPath = join(process.cwd(), "src/lib/config/links.json");
const slugPattern = /^[a-z0-9-]{2,48}$/;
const colorPattern = /^#[0-9a-f]{6}$/i;
let pendingWrite = Promise.resolve();

function clonePage(page: PageConfiguration): PageConfiguration {
  return structuredClone(page);
}

function assertPage(page: PageConfiguration): void {
  if (!slugPattern.test(page.slug)) throw new PublicError("Invalid page slug");
  if (!page.meta.title.trim()) throw new PublicError("Page title is required");
  if (page.meta.subtitle.length > 80) throw new PublicError("Subtitle is too long");
  if (page.links.length < 1 || page.links.length > 20) {
    throw new PublicError("A page must have between 1 and 20 links");
  }
  const ids = page.links.map((link) => link.id);
  if (new Set(ids).size !== ids.length) {
    throw new PublicError("Link IDs must be unique within a page");
  }
  const colors = [
    page.appearance.primaryColor,
    page.appearance.headerColor,
    page.appearance.backgroundColor,
    page.appearance.accentColor,
    page.appearance.logoColor,
  ];
  if (colors.some((color) => !colorPattern.test(color))) {
    throw new PublicError("Appearance colors must be six-digit hex values");
  }
  new URL(page.meta.url);
  for (const link of page.links) new URL(link.url);
}

export class LocalLinkStore implements LinkStore {
  private async writeConfiguration(config: LinkConfiguration): Promise<void> {
    pendingWrite = pendingWrite.then(() =>
      writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8"),
    );
    await pendingWrite;
  }

  async getConfiguration(): Promise<LinkConfiguration> {
    const raw = await readFile(configPath, "utf8");
    return JSON.parse(raw) as LinkConfiguration;
  }

  async getPages(): Promise<PageSummary[]> {
    const config = await this.getConfiguration();
    return config.pages.map((page) => ({
      slug: page.slug,
      title: page.meta.title,
      url: page.meta.url,
      linkCount: page.links.length,
    }));
  }

  async getPage(slug: string): Promise<PageConfiguration | null> {
    const config = await this.getConfiguration();
    const page = config.pages.find((candidate) => candidate.slug === slug);
    return page ? clonePage(page) : null;
  }

  async getDefaultPage(): Promise<PageConfiguration> {
    const config = await this.getConfiguration();
    const page = config.pages.find(
      (candidate) => candidate.slug === config.defaultSlug,
    );
    if (!page) throw new Error("The configured default page does not exist");
    return clonePage(page);
  }

  async getEnabledLinks(slug?: string): Promise<LinkStoreSnapshot> {
    const page = slug ? await this.getPage(slug) : await this.getDefaultPage();
    if (!page) throw new PublicError(`Page "${slug}" was not found`, 404);
    const links = page.links
      .map((link, arrayIndex) => ({ link, arrayIndex }))
      .filter(({ link }) => link.enabled !== false)
      .sort(
        (a, b) =>
          (a.link.order ?? a.arrayIndex) - (b.link.order ?? b.arrayIndex),
      )
      .map(({ link }) => link);

    return { ...page, links };
  }

  async getLinkById(pageSlug: string, id: string): Promise<LinkEntry | null> {
    const page = await this.getPage(pageSlug);
    return page?.links.find((link) => link.id === id) ?? null;
  }

  async createPage(page: PageConfiguration): Promise<PageConfiguration> {
    assertPage(page);
    const config = await this.getConfiguration();
    if (config.pages.some((candidate) => candidate.slug === page.slug)) {
      throw new PublicError(`Page "${page.slug}" already exists`);
    }
    config.pages.push(clonePage(page));
    await this.writeConfiguration(config);
    return clonePage(page);
  }

  async updatePage(
    slug: string,
    page: PageConfiguration,
  ): Promise<PageConfiguration> {
    if (slug !== page.slug) throw new PublicError("A page slug cannot be changed");
    assertPage(page);
    const config = await this.getConfiguration();
    const index = config.pages.findIndex((candidate) => candidate.slug === slug);
    if (index < 0) throw new PublicError(`Page "${slug}" was not found`, 404);
    config.pages[index] = clonePage(page);
    await this.writeConfiguration(config);
    return clonePage(page);
  }

  async deletePage(slug: string): Promise<boolean> {
    const config = await this.getConfiguration();
    if (config.defaultSlug === slug) {
      throw new PublicError("The default page cannot be deleted");
    }
    const nextPages = config.pages.filter((page) => page.slug !== slug);
    if (nextPages.length === config.pages.length) return false;
    config.pages = nextPages;
    await this.writeConfiguration(config);
    return true;
  }
}
