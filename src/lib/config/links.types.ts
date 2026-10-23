export type ButtonStyle = "raised" | "flat" | "outline";

export interface LinkIcon {
  emoji: string;
  backgroundColor?: string;
}

export interface LinkEntry {
  id: string;
  label: string;
  caption?: string;
  url: string;
  icon: LinkIcon;
  enabled?: boolean;
  order?: number;
}

export interface LinkMeta {
  title: string;
  subtitle: string;
  url: string;
  avatar?: string;
  /** Small label under the header. Empty or absent hides it entirely. */
  badge?: string;
  /** Conference logo as a raster data URL; replaces the built-in logo mark. */
  logo?: string;
  /** Share-card label beside the QR code. */
  shareCaption?: string;
  /** Share-card line under the caption; defaults to the live link count. */
  shareNote?: string;
}

export interface PageAppearance {
  primaryColor: string;
  headerColor: string;
  backgroundColor: string;
  accentColor: string;
  logoColor: string;
  /**
   * Foreground for headings and body on the public page.
   *
   * Optional so that page records written before themes existed stay valid:
   * every read falls back to the default ink. Without this a dark preset paints
   * near-black text on a near-black surface -- the Kiro palette measured
   * 1.14:1 against its own background before this field existed.
   */
  inkColor?: string;
  /** Background of the badge under the header. */
  badgeColor?: string;
  buttonStyle: ButtonStyle;
}

export interface PageConfiguration {
  slug: string;
  meta: LinkMeta;
  appearance: PageAppearance;
  links: LinkEntry[];
}

export interface LinkConfiguration {
  $schema?: string;
  defaultSlug: string;
  pages: PageConfiguration[];
}

export interface PageSummary {
  slug: string;
  title: string;
  url: string;
  linkCount: number;
}
