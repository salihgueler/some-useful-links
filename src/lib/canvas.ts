import QRCode from "qrcode";
import type { PageConfiguration } from "@/lib/config/links.types";

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

function drawLogo(context: CanvasRenderingContext2D) {
  roundedRect(context, 70, 59, 66, 66, 20);
  context.fillStyle = "#FFFFFF";
  context.fill();
  context.fillStyle = "#2A2738";
  context.beginPath();
  context.arc(95, 84, 3.5, 0, Math.PI * 2);
  context.arc(112, 84, 3.5, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = "#2A2738";
  context.lineWidth = 4;
  context.lineCap = "round";
  context.beginPath();
  context.arc(103.5, 88, 14, 0.25 * Math.PI, 0.75 * Math.PI);
  context.stroke();
}

function headlineLines(title: string) {
  if (title === "Some Useful Links") return ["Good finds,", "one useful page."];
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

  await document.fonts.ready;
  context.fillStyle = appearance.headerColor;
  context.fillRect(0, 0, 840, 630);
  context.fillStyle = appearance.logoColor;
  context.fillRect(840, 0, 360, 630);

  drawLogo(context);
  context.fillStyle = "#2A2738";
  context.font = '800 21px "Manrope", system-ui, sans-serif';
  context.fillText("SOME USEFUL LINKS", 156, 99);

  const titleLines = headlineLines(meta.title);
  context.font = '800 68px "Manrope", system-ui, sans-serif';
  titleLines.forEach((line, index) => {
    context.fillText(line, 70, 246 + index * 79);
  });

  context.fillStyle = "#6C6878";
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
  context.fillStyle = "#FFFFFF";
  context.fill();
  context.shadowColor = "transparent";
  context.drawImage(qrImage, 933, 150, 202, 202);

  context.fillStyle = "#2A2738";
  context.font = '800 15px "Manrope", system-ui, sans-serif';
  context.fillText("SCAN FOR GOOD FINDS", 943, 431);
  context.fillStyle = "#4B706C";
  context.font = '400 14px "Manrope", system-ui, sans-serif';
  context.fillText("One tap. Five fresh rabbit holes.", 931, 467);

  context.fillStyle = "#2A2738";
  context.font = '600 16px "Manrope", system-ui, sans-serif';
  const publicUrl = new URL(meta.url);
  const displayUrl = `${publicUrl.host}${publicUrl.pathname.replace(/\/$/, "")}`;
  context.fillText(displayUrl, 70, 585);
  context.fillStyle = "#3B625D";
  context.font = '600 14px "Manrope", system-ui, sans-serif';
  context.fillText("CURATED · UPDATED WEEKLY", 942, 582);

  context.fillStyle = "#FF8C62";
  context.font = '700 31px "Manrope", system-ui, sans-serif';
  context.fillText("✦", 762, 108);
  context.fillStyle = "#FDEDBF";
  roundedRect(context, 776, 557, 15, 15, 4);
  context.fill();
  context.fillStyle = "#FFC09D";
  roundedRect(context, 801, 529, 22, 22, 6);
  context.fill();
}
