import { test, expect, type Page, type TestInfo } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { withTheme } from "./fixtures";

/**
 * Produktdetailseite (Bereich D): Galerie, Variantenwechsel, Specs, JSON-LD, Add to Cart, Recently Viewed, Mobile.
 * Produkte werden dynamisch über die UI gefunden (erste Karten in /collections/decks, sonst /collections/all).
 * Sprachunabhängig über data-testid / Rollen; deutsche Storefront unter /de.
 */

// Only Chromium is installed in /opt/pw-browsers; the "mobile" project (iPhone 13) keeps its viewport, UA and touch emulation.
test.use({ browserName: "chromium" });

const LOCALE = "/de";
const SCREENSHOTS = "qa-screenshots";
const IGNORED_CONSOLE = /(web-pixels|monorail|shopify-perf|trekkie|Content Security Policy|favicon|preview_bar|analytics|captcha|cloudflare)/i;


let cachedUrls: string[] | null = null;

type VariantData = { id: number; options: string[]; available: boolean; price: number };

/** Opens a storefront URL; logs in through the storefront password page if needed, skips on rate-limit challenges. */
async function open(page: Page, url: string, waitUntil: "load" | "domcontentloaded" = "load") {
  let response = await page.goto(withTheme(url), { waitUntil });
  if (new URL(page.url()).pathname.endsWith("/password") && process.env.SHOPIFY_STOREFRONT_PASSWORD) {
    const field = page.locator('input[type="password"]').first();
    if (await field.count()) {
      await field.fill(process.env.SHOPIFY_STOREFRONT_PASSWORD);
      await Promise.all([page.waitForLoadState("domcontentloaded"), page.locator('form button[type="submit"]').first().click()]);
      response = await page.goto(withTheme(url), { waitUntil });
    }
  }
  const status = response?.status() ?? 0;
  const challenged = status === 429 || status === 503 || /just a moment/i.test(await page.title());
  test.skip(challenged, `Store drosselt gerade / nicht erreichbar (HTTP ${status}) – später erneut ausführen`);
  return response;
}

async function gotoOk(page: Page, url: string) {
  const response = await open(page, url);
  expect(response?.ok(), `HTTP ${response?.status()} für ${url}`).toBe(true);
  return response;
}

/** Up to `limit` product paths from the first product cards of /collections/decks (fallback: /collections/all). */
async function findProductUrls(page: Page, limit = 2): Promise<string[]> {
  if (cachedUrls) return cachedUrls.slice(0, limit);
  for (const handle of ["decks", "all"]) {
    const response = await open(page, `${LOCALE}/collections/${handle}`, "domcontentloaded");
    if (!response?.ok()) continue;
    const hrefs = await page
      .locator("main [data-product-card] a[href*='/products/'], main a[href*='/products/']")
      .evaluateAll((links) => links.map((link) => new URL((link as HTMLAnchorElement).href).pathname));
    const unique = Array.from(new Set(hrefs.filter((href) => /\/products\/[a-z0-9-]+$/.test(href))));
    if (unique.length) {
      cachedUrls = unique.slice(0, 4).map((href) => (href.startsWith(`${LOCALE}/`) ? href : `${LOCALE}${href}`));
      return cachedUrls.slice(0, limit);
    }
  }
  return [];
}

function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" && !IGNORED_CONSOLE.test(message.text())) errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

async function screenshot(page: Page, testInfo: TestInfo, name: string) {
  if (!fs.existsSync(SCREENSHOTS)) fs.mkdirSync(SCREENSHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SCREENSHOTS, `product-${testInfo.project.name}-${name}.png`), fullPage: true });
}

test.describe("Produktdetailseite", () => {
  test("Galerie, H1, strukturierte Daten und Lightbox", async ({ page }, testInfo) => {
    const [url] = await findProductUrls(page, 1);
    test.skip(!url, "Keine Produkte im Shop");
    const errors = collectErrors(page);
    await gotoOk(page, url);

    const gallery = page.getByTestId("product-gallery");
    await expect(gallery).toBeVisible();
    await expect(gallery.locator("img, .placeholder-skate").first()).toBeVisible();
    await expect(page.locator("h1")).toHaveCount(1);

    const types = await page.evaluate(() =>
      Array.from(document.querySelectorAll('script[type="application/ld+json"]')).flatMap((script) => {
        try {
          const data = JSON.parse(script.textContent || "");
          return (Array.isArray(data) ? data : [data]).map((item) => String(item["@type"]));
        } catch {
          return ["INVALID"];
        }
      })
    );
    expect(types, "JSON-LD muss gültig sein").not.toContain("INVALID");
    expect(types.filter((type) => type === "Product" || type === "ProductGroup"), "genau ein Product-JSON-LD").toHaveLength(1);
    expect(types).toContain("BreadcrumbList");

    // First gallery image is the LCP candidate.
    const firstImage = gallery.locator("[data-gallery-slide] img").first();
    if (await firstImage.count()) {
      await expect(firstImage).toHaveAttribute("loading", "eager");
      await expect(firstImage).toHaveAttribute("fetchpriority", "high");
    }

    const zoom = gallery.locator("[data-lightbox-open]").first();
    if (await zoom.count()) {
      await zoom.click();
      const dialog = gallery.locator("dialog[data-lightbox]");
      await expect(dialog).toHaveAttribute("open", "");
      await expect(dialog.locator("img").first()).toBeVisible();
      await page.waitForTimeout(500); // let the fade-in finish before the screenshot
      if (!fs.existsSync(SCREENSHOTS)) fs.mkdirSync(SCREENSHOTS, { recursive: true });
      await page.screenshot({ path: path.join(SCREENSHOTS, `product-${testInfo.project.name}-lightbox.png`) });
      await page.keyboard.press("Escape");
      await expect(dialog).not.toHaveAttribute("open", "");
      await expect(zoom).toBeFocused();
    }

    await screenshot(page, testInfo, "overview");
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("Variantenwechsel ändert ID, URL und Preis", async ({ page }, testInfo) => {
    const urls = await findProductUrls(page, 4);
    test.skip(!urls.length, "Keine Produkte im Shop");

    let found = false;
    for (const url of urls) {
      await gotoOk(page, url);
      if ((await page.getByTestId("variant-picker").count()) > 0) {
        found = true;
        break;
      }
    }
    test.skip(!found, "Kein Produkt mit mehreren Varianten gefunden");

    const picker = page.getByTestId("variant-picker");
    const variants: VariantData[] = JSON.parse((await picker.locator("[data-variant-json]").textContent()) || "[]");
    const currentId = Number(await page.locator("[data-variant-id]").first().inputValue());
    const current = variants.find((variant) => variant.id === currentId) ?? variants[0];
    const others = variants.filter((variant) => variant.id !== current.id);
    const target = others.find((variant) => variant.available && variant.price !== current.price) ?? others.find((variant) => variant.available) ?? others[0];
    test.skip(!target, "Nur eine Variante");

    const currentPrice = async () =>
      ((await page.getByTestId("product-price").locator(".price__current").textContent()) || "").replace(/\s+/g, " ").trim();
    const priceBefore = await currentPrice();

    // Select every option value of the target variant by clicking its label.
    for (const [index, value] of target.options.entries()) {
      const inputId = await picker.evaluate(
        (element, { index, value }) => {
          const inputs = Array.from(element.querySelectorAll(`fieldset[data-option-index="${index}"] input[type="radio"]`)) as HTMLInputElement[];
          const match = inputs.find((input) => input.value === value);
          return match && !match.checked ? match.id : null;
        },
        { index, value }
      );
      if (inputId) await picker.locator(`label[for="${inputId}"]`).click();
    }

    await expect(page.locator("[data-variant-id]").first()).toHaveValue(String(target.id));
    await expect.poll(() => new URL(page.url()).searchParams.get("variant")).toBe(String(target.id));
    if (target.price !== current.price) {
      await expect.poll(currentPrice).not.toBe(priceBefore);
    } else {
      await expect.poll(currentPrice).toBe(priceBefore);
    }
    // Both amounts contain the same digits as the variant price in cents (format independent).
    await expect.poll(async () => (await currentPrice()).replace(/\D/g, "")).toBe(String(target.price));
    const addButton = page.getByTestId("product-add");
    if (target.available) await expect(addButton).toBeEnabled();
    else await expect(addButton).toBeDisabled();

    await screenshot(page, testInfo, "variant");
  });

  test("Specs-Tabelle bei Decks", async ({ page }) => {
    const [url] = await findProductUrls(page, 1);
    test.skip(!url, "Keine Produkte im Shop");
    await gotoOk(page, url);
    const kind = await page.locator("[data-product-section]").first().getAttribute("data-product-kind");
    test.skip(kind !== "deck", `Erstes Produkt ist kein Deck (${kind})`);

    const specs = page.getByTestId("product-specs");
    await expect(specs).toBeVisible();
    await expect(specs.locator("table")).toBeVisible();
    expect(await specs.locator("tr:not([hidden])").count()).toBeGreaterThan(0);
    const width = specs.locator('[data-spec="deck_width"]');
    if (await width.count()) await expect(width).toHaveText(/^\d+(\.\d+)?"$/);

    // Related products (same page load): visible only with cards, hidden when Shopify returns no recommendations.
    const related = page.getByTestId("related-products");
    if (await related.count()) {
      const recommendations = page
        .waitForResponse((res) => new URL(res.url()).pathname.includes("/recommendations/products"), { timeout: 15_000 })
        .catch(() => null);
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      const response = await recommendations;
      expect(response?.ok() ?? true, "Recommendations-Request fehlgeschlagen").toBe(true);
      await page.waitForTimeout(500);
      const visible = await related.isVisible();
      const cards = await related.locator("[data-product-card]").count();
      expect(visible, `Related sichtbar=${visible}, Karten=${cards}`).toBe(cards > 0);
    }
  });

  test("In den Warenkorb öffnet den Drawer bzw. erhöht den Zähler", async ({ page }) => {
    const [url] = await findProductUrls(page, 1);
    test.skip(!url, "Keine Produkte im Shop");
    await gotoOk(page, url);
    const addButton = page.getByTestId("product-add");
    test.skip((await addButton.count()) === 0 || (await addButton.isDisabled()), "Produkt nicht verfügbar");

    const countText = async () => ((await page.locator("[data-cart-count]").first().textContent().catch(() => "0")) || "0").replace(/\D/g, "");
    const before = Number((await countText()) || 0);

    const [response] = await Promise.all([
      page.waitForResponse((res) => /\/cart\/add(\.js)?/.test(new URL(res.url()).pathname) && res.request().method() === "POST"),
      addButton.click(),
    ]);
    expect(response.ok(), `cart/add: HTTP ${response.status()}`).toBe(true);

    await expect
      .poll(async () => {
        const drawerOpen = await page.locator("#CartDrawer").evaluate((dialog) => (dialog as HTMLDialogElement).open).catch(() => false);
        const after = Number((await countText()) || 0);
        return drawerOpen || after > before;
      })
      .toBe(true);
  });

  test("Recently Viewed erscheint nach dem zweiten Produktbesuch", async ({ page }, testInfo) => {
    const urls = await findProductUrls(page, 2);
    test.skip(urls.length < 2, "Weniger als zwei Produkte im Shop");
    const [first, second] = urls;
    const errors = collectErrors(page);

    await gotoOk(page, first);
    await gotoOk(page, second);

    const section = page.getByTestId("recently-viewed");
    test.skip((await section.count()) === 0, "Section Recently Viewed nicht im Template");
    await expect(section).toBeVisible();
    const firstHandle = first.split("/products/")[1];
    await expect(section.locator(`[data-product-card] a[href*="/products/${firstHandle}"]`).first()).toBeAttached();
    await expect(section.locator("[data-product-card]")).toHaveCount(1);
    if (testInfo.project.name === "desktop") {
      const card = await section.locator("[data-product-card]").first().boundingBox();
      const viewport = page.viewportSize();
      expect(card && viewport ? card.width / viewport.width : 1, "Karte max. ca. eine Spalte breit").toBeLessThan(0.4);
    }

    if (!fs.existsSync(SCREENSHOTS)) fs.mkdirSync(SCREENSHOTS, { recursive: true });
    await section.scrollIntoViewIfNeeded();
    await section.screenshot({ path: path.join(SCREENSHOTS, `product-${testInfo.project.name}-recently-viewed.png`) });

    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("skateshop:recently-viewed:v1") || "[]"));
    expect(stored.slice(0, 2)).toEqual([second.split("/products/")[1], firstHandle]);
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("Mobil: kein horizontaler Overflow", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "Nur im Mobile-Projekt");
    const [url] = await findProductUrls(page, 1);
    test.skip(!url, "Keine Produkte im Shop");
    await gotoOk(page, url);
    await page.waitForTimeout(500);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, "horizontaler Overflow in px").toBeLessThanOrEqual(1);

    // Mobile gallery: counter + dots are visible when there is more than one image.
    const dots = page.locator("[data-gallery-dot]");
    if ((await dots.count()) > 1) {
      await expect(page.locator("[data-gallery-current]")).toBeVisible();
      await dots.nth(1).click();
      await expect(dots.nth(1)).toHaveAttribute("aria-current", "true");
      // The counter follows the real scroll position of the track.
      await expect(page.locator("[data-gallery-current]")).toHaveText("02");
      await page.evaluate(() => window.scrollTo(0, 0));
    }
    await screenshot(page, testInfo, "mobile");
  });
});
