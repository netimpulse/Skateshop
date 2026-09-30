import { test, expect, type Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { withTheme } from "./fixtures";

/**
 * Cart drawer + cart page (Bereich F).
 * Test data is created through the Ajax Cart API: two variants from one collection become a custom board build
 * (_build_id/_build_part/_build_pos, added in reverse order to prove the sorting) plus one regular line with a
 * visible and a hidden property. Assertions are language-independent (data-testid, roles, attributes).
 *
 * The dev store rate-limits headless API traffic (HTTP 429 for Playwright's request context), so the Ajax calls
 * run as same-origin `fetch` inside the loaded storefront page – exactly like the theme's own JS – with the routes
 * read from #theme-config. Variant lookup is cached per worker to keep the request count low.
 */

// The "mobile" project uses the iPhone 13 descriptor (WebKit by default); only Chromium is installed, so the
// same viewport/touch emulation runs in Chromium.
test.use({ browserName: "chromium" });

const SHOTS = "qa-screenshots";
const COLLECTION_CANDIDATES = ["builder-decks", "decks", "all"];

type Variant = { id: number; title: string };
type StoreRoutes = { root: string; cart: string; cartAdd: string };
type StoreResponse = { ok: boolean; status: number; data: any; text: string };

let variantCache: Variant[] | null = null;

async function storeRoutes(page: Page): Promise<StoreRoutes> {
  const routes = await page.evaluate(() => {
    const raw = document.getElementById("theme-config")?.textContent;
    return raw ? JSON.parse(raw).routes : null;
  });
  const root = routes?.root || "/";
  return {
    root: root.endsWith("/") ? root : `${root}/`,
    cart: routes?.cart || "/cart",
    cartAdd: routes?.cartAdd || "/cart/add",
  };
}

/** Same-origin fetch from inside the storefront page. */
async function storeFetch(page: Page, url: string, body?: unknown): Promise<StoreResponse> {
  return page.evaluate(
    async ({ url, body }) => {
      const response = await fetch(url, {
        method: body === undefined ? "GET" : "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const text = await response.text();
      let data = null;
      try {
        data = JSON.parse(text);
      } catch {
        /* not JSON */
      }
      return { ok: response.ok, status: response.status, data, text: text.slice(0, 300) };
    },
    { url, body }
  );
}

/** Clears the cart of the current context (only possible once a storefront page is loaded). */
async function clearCart(page: Page) {
  if (!/^https?:/.test(page.url())) return; // nothing loaded yet – a fresh context starts with an empty cart
  const routes = await storeRoutes(page).catch(() => null);
  if (!routes) return;
  const response = await storeFetch(page, `${routes.cart}/clear.js`, {}).catch(() => null);
  if (response && !response.ok) console.warn(`cart/clear.js: HTTP ${response.status}`);
}

/** Logs in through the storefront password page when the global setup could not store a session. */
async function unlockStorefront(page: Page) {
  if (!new URL(page.url()).pathname.endsWith("/password")) return false;
  const password = process.env.SHOPIFY_STOREFRONT_PASSWORD;
  test.skip(!password, "Storefront ist passwortgeschützt und SHOPIFY_STOREFRONT_PASSWORD fehlt");
  await page.locator('input[type="password"]').first().fill(password as string);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.endsWith("/password")),
    page.locator('form [type="submit"]').first().click(),
  ]);
  return true;
}

/** Navigates to a storefront path (preview theme) and empties the cart before the test starts. */
async function openStore(page: Page, pathname: string) {
  let response = await page.goto(withTheme(pathname));
  if (await unlockStorefront(page)) response = await page.goto(withTheme(pathname));
  expect(response?.ok(), `GET ${pathname}: HTTP ${response?.status()}`).toBe(true);
  await clearCart(page);
  return response;
}

async function getCart(page: Page) {
  const routes = await storeRoutes(page);
  return (await storeFetch(page, `${routes.cart}.js`)).data;
}

/** Available variants of different products from the first collection that has at least two. */
async function findVariants(page: Page, count: number): Promise<Variant[]> {
  if (variantCache && variantCache.length >= 2) return variantCache;
  const routes = await storeRoutes(page);
  for (const handle of COLLECTION_CANDIDATES) {
    const response = await storeFetch(page, `${routes.root}collections/${handle}/products.json?limit=30`);
    if (!response.ok) continue;
    const variants: Variant[] = [];
    for (const product of response.data?.products ?? []) {
      const variant = product.variants?.find((item: { available?: boolean }) => item.available);
      if (variant) variants.push({ id: variant.id, title: product.title });
      if (variants.length >= count) break;
    }
    if (variants.length >= 2) {
      variantCache = variants;
      return variants;
    }
  }
  return [];
}

const buildId = () => `b-${Date.now().toString(36)}qa${Math.random().toString(36).slice(2, 6)}`;

/** Adds a two-part build (trucks before deck) and one regular line, then reloads so the markup reflects it. */
async function seedCart(page: Page) {
  const variants = await findVariants(page, 3);
  test.skip(variants.length < 2, "Keine zwei verfügbaren Produkte in einer Collection gefunden");
  const [deck, trucks, extra = variants[0]] = variants;
  const id = buildId();
  const routes = await storeRoutes(page);
  const response = await storeFetch(page, `${routes.cartAdd}.js`, {
    items: [
      { id: extra.id, quantity: 1, properties: { Gravur: "<b>KERB</b>", _hidden_note: "qa-secret-value" } },
      { id: trucks.id, quantity: 1, properties: { _build_id: id, _build_part: "trucks", _build_pos: "2" } },
      { id: deck.id, quantity: 1, properties: { _build_id: id, _build_part: "deck", _build_pos: "1" } },
    ],
  });
  expect(response.ok, `cart/add.js: HTTP ${response.status} ${response.text}`).toBe(true);
  await page.reload();
  return { buildId: id, deck, trucks, extra };
}

/** Opens the drawer through a [data-dialog-open="CartDrawer"] trigger (header, or an injected test button). */
async function openDrawer(page: Page) {
  let opener = page.locator('[data-dialog-open="CartDrawer"]:visible').first();
  if ((await opener.count()) === 0) {
    await page.evaluate(() => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "Open cart";
      button.dataset.dialogOpen = "CartDrawer";
      button.dataset.testid = "qa-open-cart";
      button.style.cssText = "position:fixed;left:8px;bottom:8px;z-index:9999;padding:8px";
      document.body.append(button);
    });
    opener = page.getByTestId("qa-open-cart");
  }
  await opener.click();
  const drawer = page.getByTestId("cart-drawer");
  await expect(drawer).toBeVisible();
  return { opener, drawer };
}

function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error" && /cart|dialog|customElements/i.test(message.text())) errors.push(message.text());
  });
  return errors;
}

async function shot(page: Page, name: string, projectName: string, fullPage = false) {
  if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, `cart-${name}-${projectName}.png`), fullPage, animations: "disabled" });
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    const dialog = document.getElementById("CartDrawer") as HTMLDialogElement | null;
    return {
      page: doc.scrollWidth - doc.clientWidth,
      drawer: dialog?.open ? dialog.scrollWidth - dialog.clientWidth : 0,
    };
  });
  expect(overflow.page, "page overflows horizontally").toBeLessThanOrEqual(1);
  expect(overflow.drawer, "drawer overflows horizontally").toBeLessThanOrEqual(1);
}

const cartResponse = (page: Page, endpoint: "change" | "update") =>
  page.waitForResponse((response) => response.url().includes(`/cart/${endpoint}`) && response.ok());

test.describe("Cart drawer & cart page", () => {
  test.afterEach(async ({ page }) => {
    await clearCart(page);
  });

  test("Drawer gruppiert den Build (ohne Stepper, sortiert, ohne _-Properties); Escape schließt, Fokus zurück", async ({
    page,
  }, testInfo) => {
    const errors = trackErrors(page);
    await openStore(page, "/");
    const seeded = await seedCart(page);
    const { opener, drawer } = await openDrawer(page);

    const group = drawer.getByTestId("cart-build");
    await expect(group).toHaveCount(1);
    await expect(group.getByTestId("cart-build-label")).toHaveText(/CUSTOM BOARD BUILD/i);
    const parts = group.getByTestId("cart-build-part");
    await expect(parts).toHaveCount(2);
    await expect(parts.nth(0)).toHaveAttribute("data-build-part", "deck");
    await expect(parts.nth(1)).toHaveAttribute("data-build-part", "trucks");
    await expect(group.locator("[data-quantity-input], [data-quantity-step]")).toHaveCount(0);
    // Every part shows a media box (product image or placeholder) – never an empty/collapsed slot.
    const partMedia = await parts.first().locator(".media").boundingBox();
    expect(partMedia?.height ?? 0).toBeGreaterThan(30);
    await expect(group.getByTestId("cart-build-remove")).toBeVisible();
    await expect(group.getByTestId("cart-build-edit")).toHaveAttribute("href", /skateboard-builder|\/pages\//);

    const line = drawer.getByTestId("cart-line");
    await expect(line).toHaveCount(1);
    await expect(line.getByTestId("cart-quantity")).toHaveValue("1");
    // Visible property is escaped text; hidden (_) properties and the build id never reach the markup.
    await expect(line.locator(".cart-item__properties")).toContainText("<b>KERB</b>");
    await expect(line.locator(".cart-item__properties b")).toHaveCount(0);
    const html = await drawer.innerHTML();
    expect(html).not.toContain("qa-secret-value");
    expect(html).not.toContain("_build_");
    expect(html).not.toContain(seeded.buildId);

    await expectNoHorizontalOverflow(page);
    await shot(page, "drawer-build", testInfo.project.name);

    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
    await expect(opener).toBeFocused();
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("Drawer: Menge ändern, Build entfernen, Fokus bleibt sinnvoll", async ({ page }) => {
    const errors = trackErrors(page);
    await openStore(page, "/");
    await seedCart(page);
    const { drawer } = await openDrawer(page);

    const change = cartResponse(page, "change");
    await drawer.getByTestId("cart-line").locator('[data-quantity-step="1"]').click();
    await change;
    await expect(drawer.getByTestId("cart-line").getByTestId("cart-quantity")).toHaveValue("2");
    await expect(drawer.getByTestId("cart-line").locator('[data-focus-id="plus"]')).toBeFocused();

    const input = drawer.getByTestId("cart-line").getByTestId("cart-quantity");
    const typed = cartResponse(page, "change");
    await input.fill("3");
    await input.press("Enter");
    await typed;
    await expect(drawer.getByTestId("cart-line").getByTestId("cart-quantity")).toHaveValue("3");

    const update = cartResponse(page, "update");
    await drawer.getByTestId("cart-build-remove").click();
    await update;
    await expect(drawer.getByTestId("cart-build")).toHaveCount(0);
    await expect(drawer.getByTestId("cart-line")).toHaveCount(1);
    await expect(page.locator("#CartDrawerTitle")).toBeFocused();
    await expect(drawer.getByTestId("cart-drawer-count")).toContainText("3");

    const cart = await getCart(page);
    expect(cart.item_count).toBe(3);
    expect(cart.items.some((item: { properties?: Record<string, string> }) => item.properties?._build_id)).toBe(false);

    const removal = cartResponse(page, "change");
    await drawer.getByTestId("cart-remove").click();
    await removal;
    await expect(drawer.getByTestId("cart-empty")).toBeVisible();
    await expect(page.locator("#CartDrawerTitle")).toBeFocused();
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("Drawer zeigt Fehler aus cart:error und setzt die Menge zurück", async ({ page }) => {
    await openStore(page, "/");
    await seedCart(page);
    const { drawer } = await openDrawer(page);
    await page.route("**/cart/change*", (route) =>
      route.fulfill({
        status: 422,
        contentType: "application/json",
        body: JSON.stringify({ status: 422, message: "Cart Error", description: "QA: nur 1 Stück verfügbar" }),
      })
    );
    await drawer.getByTestId("cart-line").locator('[data-quantity-step="1"]').click();
    const alert = drawer.locator("[data-cart-error]");
    await expect(alert).toContainText("QA: nur 1 Stück verfügbar");
    await expect(alert).toHaveAttribute("role", "alert");
    await expect(drawer.getByTestId("cart-line").getByTestId("cart-quantity")).toHaveValue("1");
    await page.unroute("**/cart/change*");
  });

  test("Cart-Seite: Gruppe, Menge ändern, Build entfernen", async ({ page }, testInfo) => {
    const errors = trackErrors(page);
    await openStore(page, "/cart");
    await seedCart(page);
    await expect(page.locator("h1")).toHaveCount(1);

    const main = page.locator("[data-cart-section]");
    const group = main.getByTestId("cart-build");
    await expect(group).toHaveCount(1);
    await expect(group.getByTestId("cart-build-part")).toHaveCount(2);
    await expect(group.getByTestId("cart-build-part").first()).toHaveAttribute("data-build-part", "deck");
    await expect(group.locator("[data-quantity-input]")).toHaveCount(0);
    await expect(main.getByTestId("cart-checkout")).toBeVisible();
    expect(await main.innerHTML()).not.toContain("qa-secret-value");

    await expectNoHorizontalOverflow(page);
    await shot(page, "page-build", testInfo.project.name, true);

    const change = cartResponse(page, "change");
    await main.getByTestId("cart-line").locator('[data-quantity-step="1"]').click();
    await change;
    await expect(main.getByTestId("cart-line").getByTestId("cart-quantity")).toHaveValue("2");
    // Mutations from the cart page never open the drawer.
    await expect(page.getByTestId("cart-drawer")).toBeHidden();

    const update = cartResponse(page, "update");
    await main.getByTestId("cart-build-remove").click();
    await update;
    await expect(main.getByTestId("cart-build")).toHaveCount(0);
    await expect(main.getByTestId("cart-line")).toHaveCount(1);
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("Leerzustand auf Cart-Seite (de) und im Drawer", async ({ page }, testInfo) => {
    await openStore(page, "/de/cart");
    const empty = page.locator("[data-cart-section]").getByTestId("cart-empty");
    await expect(empty).toBeVisible();
    await expect(empty.getByRole("link")).toHaveCount(2);
    await expect(page.locator("h1")).toHaveCount(1);
    await expectNoHorizontalOverflow(page);
    await shot(page, "page-empty", testInfo.project.name);

    const { drawer } = await openDrawer(page);
    await expect(drawer.getByTestId("cart-empty")).toBeVisible();
    await expect(drawer.getByTestId("cart-empty").getByRole("link")).toHaveCount(2);
    await shot(page, "drawer-empty", testInfo.project.name);
  });
});
