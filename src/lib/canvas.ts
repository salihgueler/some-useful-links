import QRCode from "qrcode";
import type { PageConfiguration } from "@/lib/config/links.types";
import { readableInk, softInk } from "@/lib/color";

const SCALE = 1;

/** The card is authored in this coordinate space and scaled to the target. */
const DESIGN_WIDTH = 1200;
const DESIGN_HEIGHT = 630;

export interface CardSize {
  id: string;
  label: string;
  width: number;
  height: number;
}

export const CARD_SIZES: readonly CardSize[] = [
  { id: "social", label: "Social · 1200 × 630", width: 1200, height: 630 },
  { id: "social-2x", label: "Social 2× · 2400 × 1260", width: 2400, height: 1260 },
  { id: "full-hd", label: "Full HD · 1920 × 1080", width: 1920, height: 1080 },
];

/** Defaults for the two lines beside the QR code when a page sets neither. */
export const DEFAULT_SHARE_CAPTION = "SCAN TO OPEN";
export function defaultShareNote(page: PageConfiguration): string {
  const live = page.links.filter((link) => link.enabled !== false).length;
  return `${live} link${live === 1 ? "" : "s"} worth keeping`;
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}

/**
 * Built-in mark, drawn in the page's own logo colour with features in an ink
 * derived from it, so the face stays visible on a dark or a light logo colour.
 */
function drawLogoMark(
  context: CanvasRenderingContext2D,
  logoColor: string,
  ink: string,
) {
  roundedRect(context, 70, 59, 66, 66, 20);
  context.fillStyle = logoColor;
  context.fill();
  context.fillStyle = ink;
  context.beginPath();
  context.arc(95, 84, 3.5, 0, Math.PI * 2);
  context.arc(112, 84, 3.5, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = ink;
  context.lineWidth = 4;
  context.lineCap = "round";
  context.beginPath();
  context.arc(103.5, 88, 14, 0.25 * Math.PI, 0.75 * Math.PI);
  context.stroke();
}

/** Owner-supplied logo, contained in the same 66px box as the built-in mark. */
async function drawOwnerLogo(context: CanvasRenderingContext2D, dataUrl: string) {
  const image = new Image();
  image.src = dataUrl;
  await image.decode();
  const scale = Math.min(96 / image.width, 66 / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  context.drawImage(image, 70, 59 + (66 - height) / 2, width, height);
}

/** Splits a title across at most two lines, balancing them by length. */
function headlineLines(title: string) {
  const words = title.split(/\s+/);
  const lines = ["", ""];
  for (const word of words) {
    const target = lines[0].length < 18 ? 0 : 1;
    lines[target] = `${lines[target]} ${word}`.trim();
  }
  return lines.filter(Boolean).slice(0, 2);
}

function wrapText(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
) {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const candidate = `${line} ${word}`.trim();
    if (context.measureText(candidate).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 2);
}

export async function generateSocialCard(
  canvas: HTMLCanvasElement,
  page: PageConfiguration,
  size: CardSize = CARD_SIZES[0],
) {
  const { meta, appearance } = page;
  canvas.width = size.width * SCALE;
  canvas.height = size.height * SCALE;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is not supported in this browser");

  // Everything below is drawn in the 1200x630 design space; the transform maps
  // it onto the requested pixel size, so each option renders natively crisp
  // rather than being an upscaled copy of one bitmap.
  const scale = size.width / DESIGN_WIDTH;
  const offsetY = (size.height - DESIGN_HEIGHT * scale) / 2;

  // Two panels, two surfaces, so each needs its own foreground -- the same rule
  // the public page follows. Hard-coded ink made the card unreadable on any
  // theme whose header was dark.
  const panel = appearance.headerColor;
  const sidePanel = appearance.logoColor;
  const panelInk = readableInk(panel);
  const panelInkSoft = softInk(panel, panelInk);
  const sideInk = readableInk(sidePanel);
  const sideInkSoft = softInk(sidePanel, sideInk);

  await document.fonts.ready;
  context.setTransform(1, 0, 0, 1, 0, 0);
  const splitX = 840 * scale;
  context.fillStyle = panel;
  context.fillRect(0, 0, splitX, size.height);
  context.fillStyle = sidePanel;
  context.fillRect(splitX, 0, size.width - splitX, size.height);

  // Content is centred vertically, so a taller aspect gains margin rather than
  // stretching the layout.
  context.setTransform(scale, 0, 0, scale, 0, offsetY);

  if (meta.logo) {
    await drawOwnerLogo(context, meta.logo);
  } else {
    drawLogoMark(context, appearance.logoColor, readableInk(appearance.logoColor));
  }

  const titleLines = headlineLines(meta.title);
  context.fillStyle = panelInk;
  context.font = '800 68px "Manrope", system-ui, sans-serif';
  titleLines.forEach((line, index) => {
    context.fillText(line, 70, 246 + index * 79);
  });

  context.fillStyle = panelInkSoft;
  context.font = '400 23px "Manrope", system-ui, sans-serif';
  wrapText(context, meta.subtitle, 650).forEach((line, index) => {
    context.fillText(line, 70, 419 + index * 32);
  });
  roundedRect(context, 70, 469, 213, 19, 10);
  context.fillStyle = appearance.accentColor;
  context.fill();

  const qrDataUrl = await QRCode.toDataURL(meta.url, {
    width: 202,
    margin: 1,
    color: { dark: "#2A2738", light: "#FFFFFF" },
    errorCorrectionLevel: "M",
  });
  const qrImage = new Image();
  qrImage.src = qrDataUrl;
  await qrImage.decode();

  context.shadowColor = "rgba(42, 39, 56, .12)";
  context.shadowBlur = 24;
  context.shadowOffsetY = 12;
  roundedRect(context, 904, 121, 260, 261, 24);
  // The QR panel stays white: a code has to keep its own quiet-zone contrast
  // regardless of the theme, or scanners start failing.
  context.fillStyle = "#FFFFFF";
  context.fill();
  context.shadowColor = "transparent";
  context.drawImage(qrImage, 933, 150, 202, 202);

  const caption = (meta.shareCaption ?? DEFAULT_SHARE_CAPTION).trim();
  if (caption) {
    context.fillStyle = sideInk;
    context.font = '800 15px "Manrope", system-ui, sans-serif';
    context.fillText(caption, 943, 431);
  }

  // Defaults to a counted claim rather than an invented one; this line read
  // "Five fresh rabbit holes" on every card regardless of content.
  const note = (meta.shareNote ?? defaultShareNote(page)).trim();
  if (note) {
    context.fillStyle = sideInkSoft;
    context.font = '400 14px "Manrope", system-ui, sans-serif';
    context.fillText(note, 943, 467);
  }

  context.fillStyle = panelInk;
  context.font = '600 16px "Manrope", system-ui, sans-serif';
  const publicUrl = new URL(meta.url);
  const displayUrl = `${publicUrl.host}${publicUrl.pathname.replace(/\/$/, "")}`;
  context.fillText(displayUrl, 70, 585);

  // The page's own badge wording, not a fixed "CURATED · UPDATED WEEKLY".
  const badge = (meta.badge ?? "Curated with care").trim();
  if (badge) {
    context.fillStyle = sideInkSoft;
    context.font = '600 14px "Manrope", system-ui, sans-serif';
    context.fillText(badge, 943, 582);
  }
}
