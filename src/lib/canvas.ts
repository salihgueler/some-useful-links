import QRCode from "qrcode";
import type { PageConfiguration } from "@/lib/config/links.types";
import { readableInk, softInk } from "@/lib/color";

const SCALE = 1;

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
) {
  const { meta, appearance } = page;
  canvas.width = 1200 * SCALE;
  canvas.height = 630 * SCALE;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is not supported in this browser");

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
  context.fillStyle = panel;
  context.fillRect(0, 0, 840, 630);
  context.fillStyle = sidePanel;
  context.fillRect(840, 0, 360, 630);

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

  context.fillStyle = sideInk;
  context.font = '800 15px "Manrope", system-ui, sans-serif';
  context.fillText("SCAN TO OPEN", 943, 431);

  // Counted, not invented: this said "Five fresh rabbit holes" on every card.
  const live = page.links.filter((link) => link.enabled !== false).length;
  context.fillStyle = sideInkSoft;
  context.font = '400 14px "Manrope", system-ui, sans-serif';
  context.fillText(`${live} link${live === 1 ? "" : "s"} worth keeping`, 943, 467);

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
