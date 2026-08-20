import type { PageAppearance } from "@/lib/config/links.types";

/**
 * Pre-defined themes.
 *
 * A preset only supplies SURFACE colours. Foregrounds are derived per surface at
 * render time (see lib/color.ts), because a single ink value cannot serve both
 * the header band and the body: the AWS palette puts a dark navy header above a
 * white page, so one value would fail on one of them.
 *
 * Applying a preset writes plain colour values onto the page, so an owner can
 * still adjust any single colour afterwards without being locked to a theme.
 */

export interface ThemePreset {
  id: string;
  name: string;
  description: string;
  colors: Pick<
    PageAppearance,
    | "primaryColor"
    | "headerColor"
    | "backgroundColor"
    | "accentColor"
    | "logoColor"
    | "badgeColor"
  >;
}

export const THEME_PRESETS: readonly ThemePreset[] = [
  {
    id: "default",
    name: "Default",
    description: "The original lilac and mint palette.",
    colors: {
      primaryColor: "#5C4FB3",
      headerColor: "#EFEDFF",
      backgroundColor: "#F8F7FC",
      accentColor: "#FFB891",
      logoColor: "#BFECE6",
      badgeColor: "#FFD9C3",
    },
  },
  {
    id: "kiro",
    name: "Kiro",
    description: "Dark, purple-forward. Suits a dim room or a projector.",
    colors: {
      primaryColor: "#7138CC",
      headerColor: "#19161D",
      backgroundColor: "#211D25",
      accentColor: "#B080FF",
      logoColor: "#80FFB5",
      badgeColor: "#7138CC",
    },
  },
  {
    id: "aws",
    name: "AWS",
    description: "Squid ink navy with Amazon orange, on white.",
    colors: {
      primaryColor: "#232F3E",
      headerColor: "#2A3648",
      backgroundColor: "#FFFFFF",
      accentColor: "#FF9900",
      logoColor: "#FF9900",
      badgeColor: "#232F3E",
    },
  },
];

export function findPreset(id: string): ThemePreset | undefined {
  return THEME_PRESETS.find((preset) => preset.id === id);
}

/**
 * Whether a page's colours currently match a preset exactly, so the editor can
 * show which one is active without storing a theme name on the record.
 */
export function activePresetId(appearance: PageAppearance): string | null {
  const match = THEME_PRESETS.find((preset) =>
    Object.entries(preset.colors).every(
      ([key, value]) =>
        (appearance[key as keyof PageAppearance] ?? "").toString().toLowerCase() ===
        value.toLowerCase(),
    ),
  );
  return match?.id ?? null;
}
