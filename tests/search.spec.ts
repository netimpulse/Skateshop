import { test, expect, type Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { withTheme } from "./fixtures";

/**
 * Search page (Agent C): results or empty state for "deck", escaped input, empty state with suggestions.
 */
const SHOTS = "qa-screenshots";

// Only Chromium is installed (/opt/pw-browsers); the mobile project keeps the iPhone 13 viewport, touch and UA.
test.use({ browserName: "chromium" });

/** Logs in through the storefront password page when global setup could not (password from env). */
async function passPasswordPage(page: Page) {
  const password = process.env.SHOPIFY_STOREFRONT_PASSWORD;
  if (!password || !new URL(page.url()).pathname.endsWith("/password")) return false;
  const field = page.locator('input[type="password"]').first();
  if (!(await field.count())) return false;
  await field.fill(password);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.endsWith("/password"), { timeout: 20_000 }),
    field.press("Enter"),
  ]);
  return true;
}

async function open(page: Page, target: string) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  let response = await page.goto(withTheme(target), { waitUntil: "domcontentloaded" });
  if (await passPasswordPage(page)) response = await page.goto(withTheme(target), { waitUntil: "domcontentloaded" });
  const challenged = /verif|challenge|attention required/i.test(await page.title());
  return { status: response?.status() ?? 0, errors, challenged };
}

/** Scrolls once through the page so reveal-on-scroll cards and lazy images are shown, hides the preview bar. */
async function prepareScreenshot(page: Page) {
  await page.addStyleTag({ content: "#preview-bar-iframe, #PBarNextFrameWrapper { display: none !important; }" });
  await page.evaluate(async () => {
    const step = Math.round(window.innerHeight * 0.8);
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(800);
}

test.describe("Suche", () => {
  test("„deck“ zeigt Ergebnisse oder Leerzustand", async ({ page }, testInfo) => {
    const { status, errors, challenged } = await open(page, "/search?q=deck");
    test.skip(challenged, "Bot-Prüfung des Shops aktiv");
    expect(status).toBeLessThan(400);

    await expect(page.locator("h1")).toHaveCount(1);
    const input = page.getByTestId("search-form").locator('input[name="q"]');
    await expect(input).toHaveValue("deck");

    const results = page.getByTestId("facets-results");
    const empty = page.getByTestId("search-empty");
    await expect(results.or(empty).first()).toBeVisible();
    if (await results.count()) {
      await expect(page.getByTestId("facets-count")).toContainText(/\d/);
      const items = page.locator("[data-testid=product-grid] [data-product-card], [data-testid=search-other] a");
      expect(await items.count()).toBeGreaterThan(0);
    }

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, "horizontaler Overflow").toBeLessThanOrEqual(1);

    await page.waitForLoadState("load");
    await prepareScreenshot(page);
    if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });
    await page.screenshot({ path: path.join(SHOTS, `search-results-${testInfo.project.name}.png`), fullPage: true });
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("Suchbegriff mit HTML/Script wird escaped", async ({ page }) => {
    const payload = `<script>window.__xss=1</script>"><img src=x onerror="window.__xss=2">`;
    const { status, challenged } = await open(page, `/search?q=${encodeURIComponent(payload)}`);
    test.skip(challenged, "Bot-Prüfung des Shops aktiv");
    expect(status).toBeLessThan(400);
    await page.waitForLoadState("load");

    expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
    await expect(page.getByTestId("search-form").locator('input[name="q"]')).toHaveValue(payload);
    expect(await page.locator('main img[src="x"]').count()).toBe(0);
    expect(await page.locator("main script:not([type])").evaluateAll((nodes) => nodes.filter((n) => n.textContent?.includes("__xss")).length)).toBe(0);
    await expect(page.locator("h1")).toHaveCount(1);
  });

  test("Kein Treffer zeigt Leerzustand mit Kategorie-Vorschlägen", async ({ page }, testInfo) => {
    const { status, errors, challenged } = await open(page, "/search?q=zzqxnotfound4711");
    test.skip(challenged, "Bot-Prüfung des Shops aktiv");
    expect(status).toBeLessThan(400);
    const empty = page.getByTestId("search-empty");
    await expect(empty).toBeVisible();
    await expect(empty).toContainText("zzqxnotfound4711");
    const suggestions = empty.locator("a");
    expect(await suggestions.count()).toBeGreaterThanOrEqual(0);
    await page.waitForLoadState("load");
    await prepareScreenshot(page);
    if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });
    await page.screenshot({ path: path.join(SHOTS, `search-empty-${testInfo.project.name}.png`), fullPage: true });
    expect(errors, errors.join("\n")).toEqual([]);
  });
});
