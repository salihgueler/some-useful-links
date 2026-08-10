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
}

export interface PageAppearance {
  primaryColor: string;
  headerColor: string;
  backgroundColor: string;
  accentColor: string;
  logoColor: string;
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
