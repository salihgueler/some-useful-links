import { chromium } from "playwright-core";

const baseUrl = process.env.BASE_URL ?? "http://localhost:3000";
const executablePath =
  process.env.PLAYWRIGHT_CHROME_PATH ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: ["--no-sandbox"],
});

const errors = [];
const context = await browser.newContext({
  viewport: { width: 390, height: 932 },
  deviceScaleFactor: 1,
});
const page = await context.newPage();
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});
page.on("pageerror", (error) => errors.push(error.message));

await page.goto(`${baseUrl}/reinvent2026`, { waitUntil: "networkidle" });
await page.screenshot({ path: "/tmp/some-useful-links-reinvent.png" });
const publicMetrics = await page.evaluate(() => ({
  width: document.documentElement.scrollWidth,
  links: document.querySelectorAll(".link-row").length,
  title: document.querySelector("h1")?.textContent,
}));
await page.getByRole("button", { name: "Share this page" }).last().click();
await page.locator("canvas.ready").waitFor({ timeout: 10000 });
await page.getByRole("button", { name: "Close share dialog" }).click();

await page.setViewportSize({ width: 1440, height: 1024 });
await page.goto(`${baseUrl}/admin/reinvent2026/links`, {
  waitUntil: "networkidle",
});
await page.screenshot({
  path: "/tmp/some-useful-links-admin-links.png",
  fullPage: true,
});
const linksMetrics = await page.evaluate(() => ({
  width: document.documentElement.scrollWidth,
  rows: document.querySelectorAll(".editable-link").length,
  tabs: document.querySelectorAll(".admin-tabs a").length,
  pages: document.querySelectorAll(".page-switcher option").length,
}));

await page.goto(`${baseUrl}/admin/reinvent2026/appearance`, {
  waitUntil: "networkidle",
});
await page.screenshot({
  path: "/tmp/some-useful-links-admin-appearance.png",
  fullPage: true,
});
const appearanceMetrics = await page.evaluate(() => ({
  colors: document.querySelectorAll('.color-control input[type="color"]').length,
  preview: document.querySelectorAll(".appearance-phone").length,
}));

await page.goto(`${baseUrl}/admin/reinvent2026/share`, {
  waitUntil: "networkidle",
});
await page.locator("canvas.ready").waitFor({ timeout: 10000 });
await page.screenshot({
  path: "/tmp/some-useful-links-admin-share.png",
  fullPage: true,
});

await page.goto(`${baseUrl}/admin/reinvent2026/analytics`, {
  waitUntil: "networkidle",
});
await page.screenshot({
  path: "/tmp/some-useful-links-admin-analytics.png",
  fullPage: true,
});
const analyticsMetrics = await page.evaluate(() => ({
  kpis: document.querySelectorAll(".kpi-panel").length,
  chart: document.querySelectorAll(".recharts-wrapper").length,
}));

const temporarySlug = "visual-check-page";
let createStatus = 0;
let publicStatus = 0;
let deleteStatus = 0;
try {
  const createResponse = await fetch(`${baseUrl}/api/pages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      slug: temporarySlug,
      title: "Visual Check Page",
    }),
  });
  createStatus = createResponse.status;
  publicStatus = (await fetch(`${baseUrl}/${temporarySlug}`)).status;
  deleteStatus = (
    await fetch(`${baseUrl}/api/pages/${temporarySlug}`, { method: "DELETE" })
  ).status;
} finally {
  if (deleteStatus !== 200) {
    await fetch(`${baseUrl}/api/pages/${temporarySlug}`, { method: "DELETE" });
  }
}

await browser.close();

const result = {
  publicMetrics,
  linksMetrics,
  appearanceMetrics,
  analyticsMetrics,
  createStatus,
  publicStatus,
  deleteStatus,
  errors,
};
console.log(JSON.stringify(result, null, 2));

if (
  publicMetrics.width > 390 ||
  publicMetrics.links !== 5 ||
  publicMetrics.title !== "re:Invent 2026 Field Guide" ||
  linksMetrics.width > 1440 ||
  linksMetrics.rows !== 5 ||
  linksMetrics.tabs !== 4 ||
  linksMetrics.pages !== 2 ||
  appearanceMetrics.colors !== 5 ||
  appearanceMetrics.preview !== 1 ||
  analyticsMetrics.kpis !== 4 ||
  analyticsMetrics.chart !== 1 ||
  createStatus !== 201 ||
  publicStatus !== 200 ||
  deleteStatus !== 200 ||
  errors.length > 0
) {
  process.exit(1);
}
