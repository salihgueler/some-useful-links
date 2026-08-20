import { luminance, mix, parseHex, toHex, type Rgb } from "@/lib/color";
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

/** HSL saturation, 0..1. Used to tell a brand colour from a neutral. */
export function saturation(hex: string): number {
  const { r, g, b } = parseHex(hex);
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  if (max === min) return 0;
  const l = (max + min) / 2;
  return l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min);
}

/** Dominant colours of an image, most common first. */
export async function extractPalette(file: File, count = 6): Promise<string[]> {
  const image = await decodeImage(file);
  const pixels = samplePixels(image);
  image.close();
  if (pixels.length === 0) {
    throw new Error("That image had no opaque pixels to read");
  }
  return medianCut(pixels, count).map(toHex).map((hex) => hex.toUpperCase());
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
 * Surfaces are DERIVED rather than used raw: a photograph's most common colour
 * is usually a mid-tone that makes a terrible page background. So the lightest
 * sample is pushed toward white for the background and tinted with the brand
 * colour for the header band, which keeps the image's character without
 * flattening the page's contrast.
 */
export function paletteToColors(palette: string[]): PaletteColors {
  if (palette.length === 0) throw new Error("An empty palette cannot be mapped");

  const byChroma = [...palette].sort((a, b) => saturation(b) - saturation(a));
  const byLight = [...palette].sort((a, b) => luminance(b) - luminance(a));

  const brand = byChroma[0];
  const accent = byChroma.find((hex) => hex !== brand) ?? brand;
  const lightest = byLight[0];

  // Primary carries text and buttons, so it has to be dark enough to hold white
  // text; a pale brand colour gets darkened rather than rejected.
  const primary = luminance(brand) > 0.32 ? mix(brand, "#000000", 0.42) : brand;
  const background = mix(lightest, "#FFFFFF", 0.86);

  return {
    primaryColor: primary.toUpperCase(),
    headerColor: mix(background, brand, 0.16).toUpperCase(),
    backgroundColor: background.toUpperCase(),
    accentColor: accent.toUpperCase(),
    logoColor: mix(accent, "#FFFFFF", 0.35).toUpperCase(),
    badgeColor: mix(accent, "#FFFFFF", 0.55).toUpperCase(),
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
