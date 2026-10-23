import { distance, luminance, mix, parseHex, toHex, type Rgb } from "@/lib/color";
import type { PageAppearance } from "@/lib/config/links.types";

/**
 * Palette extraction from an image, and logo downscaling.
 *
 * Browser-only: both read pixels through a canvas, so this module must only be
 * imported by client components.
 *
 * The quantiser is median cut -- deterministic, dependency-free, and no model
 * involved. It repeatedly splits the pixel cloud along whichever channel has the
 * widest spread, which keeps distinct hues apart instead of averaging an image
 * down to mud the way a naive mean does.
 */

/** Sampling size. Small on purpose: palette needs distribution, not detail. */
const SAMPLE_EDGE = 72;

/**
 * Decodes a chosen file into pixels.
 *
 * Uses createImageBitmap rather than an <img> with a blob: URL. The page's CSP
 * is `img-src 'self' data:`, and a blob: URL satisfies neither -- loading one
 * into an <img> is blocked by the policy, which surfaced as "that file could not
 * be read as an image" for every file. createImageBitmap decodes the Blob
 * directly and never performs an img-src fetch, so it needs no CSP change.
 */
async function decodeImage(file: File): Promise<ImageBitmap> {
  try {
    // from-image so a photo carrying EXIF rotation is not sampled sideways.
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("That file could not be decoded as an image");
  }
}

function context2d(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("This browser did not provide a 2D canvas");
  return { canvas, context };
}

function samplePixels(image: ImageBitmap): Rgb[] {
  const scale = Math.min(SAMPLE_EDGE / image.width, SAMPLE_EDGE / image.height, 1);
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const { context } = context2d(width, height);
  context.drawImage(image, 0, 0, width, height);
  const { data } = context.getImageData(0, 0, width, height);

  const pixels: Rgb[] = [];
  for (let i = 0; i < data.length; i += 4) {
    // Skip near-transparent pixels: a logo's padding is not part of its palette.
    if (data[i + 3] < 128) continue;
    pixels.push({ r: data[i], g: data[i + 1], b: data[i + 2] });
  }
  return pixels;
}

function widestChannel(bucket: Rgb[]): keyof Rgb {
  const spread = (pick: keyof Rgb) => {
    let min = 255;
    let max = 0;
    for (const pixel of bucket) {
      min = Math.min(min, pixel[pick]);
      max = Math.max(max, pixel[pick]);
    }
    return max - min;
  };
  const ranges: Array<[keyof Rgb, number]> = [
    ["r", spread("r")],
    ["g", spread("g")],
    ["b", spread("b")],
  ];
  ranges.sort((a, b) => b[1] - a[1]);
  return ranges[0][0];
}

function averageOf(bucket: Rgb[]): Rgb {
  const total = bucket.reduce(
    (acc, pixel) => ({ r: acc.r + pixel.r, g: acc.g + pixel.g, b: acc.b + pixel.b }),
    { r: 0, g: 0, b: 0 },
  );
  return {
    r: total.r / bucket.length,
    g: total.g / bucket.length,
    b: total.b / bucket.length,
  };
}

/** Median cut: split the widest-spread channel until `count` buckets exist. */
function medianCut(pixels: Rgb[], count: number): Rgb[] {
  let buckets: Rgb[][] = [pixels];
  while (buckets.length < count) {
    // Always split the largest bucket, so a dominant colour is subdivided
    // before a niche one and the result tracks the image's real distribution.
    buckets.sort((a, b) => b.length - a.length);
    const target = buckets.shift();
    if (!target || target.length < 2) {
      if (target) buckets.push(target);
      break;
    }
    const channel = widestChannel(target);
    const sorted = [...target].sort((a, b) => a[channel] - b[channel]);
    const middle = Math.floor(sorted.length / 2);
    buckets.push(sorted.slice(0, middle), sorted.slice(middle));
  }
  return buckets
    .filter((bucket) => bucket.length > 0)
    .sort((a, b) => b.length - a.length)
    .map(averageOf);
}

/** HSL saturation, 0..1. Kept for reference; see vividness for ranking. */
export function saturation(hex: string): number {
  const { r, g, b } = parseHex(hex);
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  if (max === min) return 0;
  const l = (max + min) / 2;
  return l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min);
}

/**
 * How colourful a swatch reads, 0..1.
 *
 * HSL saturation is the wrong ranking for "which colour is this image's brand":
 * it divides by lightness, so a near-black navy scores higher than a clearly
 * visible olive. Measured on one real image, #110D3D (luminance 0.007) scored
 * 0.649 while the olive that dominated the picture scored 0.356 -- so the two
 * near-blacks won and every visible colour was discarded.
 *
 * Raw chroma is lightness-independent, and the mid-lightness weight discounts
 * swatches so dark or so pale that their hue cannot be perceived anyway.
 */
export function vividness(hex: string): number {
  const { r, g, b } = parseHex(hex);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const chroma = (max - min) / 255;
  const lightness = (max + min) / 2 / 255;
  return chroma * (1 - Math.abs(2 * lightness - 1));
}

/** Dominant colours of an image, most common first, duplicates removed. */
export async function extractPalette(file: File, count = 6): Promise<string[]> {
  const image = await decodeImage(file);
  const pixels = samplePixels(image);
  image.close();
  if (pixels.length === 0) {
    throw new Error("That image had no opaque pixels to read");
  }
  // A flat image (few distinct colours) yields buckets of identical pixels, so
  // the raw cut can repeat a value. Collapse them rather than showing the same
  // swatch several times.
  const seen = new Set<string>();
  for (const hex of medianCut(pixels, count).map(toHex)) {
    seen.add(hex.toUpperCase());
  }
  return [...seen];
}

type PaletteColors = Pick<
  PageAppearance,
  | "primaryColor"
  | "headerColor"
  | "backgroundColor"
  | "accentColor"
  | "logoColor"
  | "badgeColor"
>;

/**
 * Maps extracted colours onto the page's colour roles.
 *
 * Two rules make the result actually look like the picture:
 *
 * 1. Roles are filled by VIVIDNESS, not HSL saturation, so the colour a viewer
 *    would name as the image's own lands in a visible role.
 * 2. Light or dark is taken from the image, weighted toward its most common
 *    colours. Forcing a near-white background made every dark picture produce
 *    the same pale grey page, which is the reason extracted palettes did not
 *    resemble their source.
 *
 * Surfaces are still derived rather than used raw -- a photo's dominant colour
 * is usually a mid-tone that makes a poor page background -- but they are
 * derived FROM the brand colour, so they carry its hue instead of going grey.
 */
export function paletteToColors(palette: string[]): PaletteColors {
  if (palette.length === 0) throw new Error("An empty palette cannot be mapped");

  const byVivid = [...palette].sort((a, b) => vividness(b) - vividness(a));
  const brand = byVivid[0];

  // An accent adjacent to the brand reads as a mistake, so require real
  // separation and only fall back to the next swatch if nothing qualifies.
  const accent =
    byVivid.slice(1).find((hex) => distance(hex, brand) > 60) ??
    byVivid[1] ??
    mix(brand, "#FFFFFF", 0.4);

  // Weighted toward the first entries, which median cut returns most-common
  // first, so a picture that is mostly dark yields a dark page.
  const weights = palette.slice(0, 3);
  const weighted =
    weights.reduce((sum, hex, index) => sum + luminance(hex) * (3 - index), 0) /
    weights.reduce((sum, _hex, index) => sum + (3 - index), 0);
  const dark = weighted < 0.2;

  const background = dark
    ? mix(brand, "#000000", 0.84)
    : mix(brand, "#FFFFFF", 0.93);
  const header = dark
    ? mix(brand, "#000000", 0.66)
    : mix(brand, "#FFFFFF", 0.74);

  // Primary carries buttons with white text, so it must be dark enough to hold
  // them; a pale brand is darkened rather than rejected.
  const primary = luminance(brand) > 0.3 ? mix(brand, "#000000", 0.45) : brand;

  return {
    primaryColor: primary.toUpperCase(),
    headerColor: header.toUpperCase(),
    backgroundColor: background.toUpperCase(),
    accentColor: accent.toUpperCase(),
    logoColor: brand.toUpperCase(),
    badgeColor: (dark
      ? mix(accent, "#000000", 0.3)
      : mix(accent, "#FFFFFF", 0.45)
    ).toUpperCase(),
  };
}

/**
 * Reads a logo into a downscaled PNG data URL.
 *
 * Downscaling is what makes inline storage viable: the value lives on the page
 * record, so it is bounded here rather than hoping the owner supplies something
 * small. Aspect ratio is preserved and transparency survives as PNG.
 */
export async function readLogoDataUrl(
  file: File,
  maxWidth = 320,
  maxHeight = 128,
): Promise<string> {
  const image = await decodeImage(file);
  const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const { canvas, context } = context2d(width, height);
  context.drawImage(image, 0, 0, width, height);
  image.close();
  return canvas.toDataURL("image/png");
}
