/**
 * Colour maths for themes and palette extraction.
 *
 * All of it is deterministic and dependency-free: no colour library, no model.
 * The public page needs to stay readable on surfaces the owner chooses, and a
 * theme only supplies surface colours -- so the foregrounds are DERIVED here
 * rather than stored, which is what keeps a dark preset from painting dark ink
 * on a dark background.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export function parseHex(hex: string): Rgb {
  const raw = hex.trim().replace(/^#/, "");
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) {
    throw new Error(`Not a hex colour: ${hex}`);
  }
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

export function toHex({ r, g, b }: Rgb): string {
  const part = (v: number) =>
    Math.round(clamp(v, 0, 255)).toString(16).padStart(2, "0");
  return `#${part(r)}${part(g)}${part(b)}`;
}

/** WCAG relative luminance. */
export function luminance(hex: string): number {
  const { r, g, b } = parseHex(hex);
  const channel = (raw: number) => {
    const v = raw / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast ratio, 1..21. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Linear blend; `amount` 0 returns `from`, 1 returns `to`. */
export function mix(from: string, to: string, amount: number): string {
  const a = parseHex(from);
  const b = parseHex(to);
  const t = clamp(amount, 0, 1);
  return toHex({
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  });
}

/**
 * A foreground that is readable on `surface` and still carries its hue.
 *
 * Deliberately not plain black or white: the craft floor calls for secondary
 * text tinted from the surface hue rather than grey, so this walks the surface
 * toward its extreme until it clears the WCAG body threshold, and only falls
 * back to pure black/white if the hue itself cannot get there.
 */
export function readableInk(surface: string, target = 4.5): string {
  const goingDark = luminance(surface) > 0.42;
  const extreme = goingDark ? "#000000" : "#ffffff";
  for (let amount = 0.72; amount <= 0.98; amount += 0.04) {
    const candidate = mix(surface, extreme, amount);
    if (contrastRatio(candidate, surface) >= target) return candidate;
  }
  return extreme;
}

/**
 * Secondary text: the ink pulled back toward its own surface.
 *
 * Never grey — it keeps the surface hue, and stops at a ratio that still clears
 * the body threshold so subtitles do not quietly become decoration.
 */
export function softInk(surface: string, ink: string, target = 4.5): string {
  for (let amount = 0.34; amount >= 0; amount -= 0.04) {
    const candidate = mix(ink, surface, amount);
    if (contrastRatio(candidate, surface) >= target) return candidate;
  }
  return ink;
}

/** A hairline that reads as an edge on either a light or a dark surface. */
export function borderOn(surface: string): string {
  return mix(surface, luminance(surface) > 0.42 ? "#000000" : "#ffffff", 0.12);
}

/** A raised panel that sits just off its surface, in the surface's own hue. */
export function surfaceOn(surface: string): string {
  return mix(surface, luminance(surface) > 0.42 ? "#ffffff" : "#ffffff", 0.06);
}
