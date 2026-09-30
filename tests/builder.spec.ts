import { test, expect, Page } from "@playwright/test";
import * as fs from "fs";
import { DEMO, collectThemeErrors, withTheme } from "./fixtures";

/**
 * Board Builder (/pages/skateboard-builder): kompletter Ablauf, Persistenz, Kompatibilitätshinweise,
 * Fehlerpfade. Sprachunabhängig über data-Attribute.
 */

const STORAGE_KEY = "skateshop:builder:v1";

async function openBuilder(page: Page) {
  const response = await page.goto(withTheme(DEMO.builderPath), { waitUntil: "domcontentloaded" });
  test.skip(!response || response.status() === 404, "Builder-Seite fehlt (Seed nicht gelaufen)");
  const challenged = response?.status() === 429 || (await page.locator("text=/verified before you can proceed|Verifying your connection/i").count()) > 0;
  test.skip(challenged, "Bot-Prüfung des Stores (429/Challenge) – später erneut ausführen");
  await expect(page.locator("board-builder")).toBeVisible();
  await expect(page.locator("[data-bb-list]")).toHaveAttribute("aria-busy", "false", { timeout: 20_000 });
}

/** Set per test in beforeEach: whether the store answered a builder data request with 429 (rate limit). */
let dataThrottled = false;

async function selectFirst(page: Page, preferFit = false) {
  const cards = page.locator(".bb-card__select:not([disabled])");
  const loadError = page.locator("[data-bb-status] [data-bb-retry]");
  await expect(cards.first().or(loadError)).toBeVisible();
  if (await loadError.isVisible()) {
    // Same policy as the page-load challenge: a throttled store is not a theme defect; any other load error fails.
    test.skip(dataThrottled, "Store drosselt die Builder-Daten (HTTP 429) – später erneut ausführen");
    throw new Error("Builder-Daten konnten nicht geladen werden (kein 429)");
  }
  if (preferFit) {
    const fitting = page.locator(".bb-card:has(.bb-fit--ok) .bb-card__select:not([disabled])");
    if (await fitting.count()) return fitting.first().click();
  }
  await cards.first().click();
}

async function next(page: Page) {
  await page.locator("[data-bb-next]").click();
  await expect(page.locator("[data-bb-list]")).toHaveAttribute("aria-busy", "false", { timeout: 20_000 });
}

async function clearCart(page: Page) {
  await page.evaluate(async () => {
    const root = JSON.parse(document.getElementById("theme-config")?.textContent || "{}").routes?.root || "/";
    await fetch(`${root.replace(/\/?$/, "/")}cart/clear.js`, { method: "POST" });
  });
}

test.describe("Board Builder", () => {
  test.beforeEach(async ({ page }) => {
    dataThrottled = false;
    page.on("response", (response) => {
      if (response.status() === 429 && response.url().includes("view=builder-data")) dataThrottled = true;
    });
    await page.addInitScript((key) => {
      try {
        if (window !== window.top) return;
        if (!sessionStorage.getItem("bb-test-init")) {
          localStorage.removeItem(key);
          sessionStorage.setItem("bb-test-init", "1");
        }
      } catch {
        /* sandboxed frame */
      }
    }, STORAGE_KEY);
  });

  test("lädt Schritte, Vorschau und Deck-Auswahl ohne Theme-Fehler", async ({ page }, testInfo) => {
    const errors = collectThemeErrors(page);
    await openBuilder(page);
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("[data-bb-stepper] [data-bb-goto]")).toHaveCount(7);
    await expect(page.locator("[data-bb-stepper] [aria-current='step']")).toHaveAttribute("data-bb-goto", "deck");
    expect(await page.locator(".bb-card").count()).toBeGreaterThan(0);
    await expect(page.locator("board-preview svg.bb-preview__plan")).toBeVisible();
    fs.mkdirSync("qa-screenshots", { recursive: true });
    await page.screenshot({ path: `qa-screenshots/${testInfo.project.name}-builder-deck.png`, fullPage: true });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("kompletter Build inkl. Kompatibilität, Riser-Hinweis und Warenkorb", async ({ page }, testInfo) => {
    const errors = collectThemeErrors(page);
    await openBuilder(page);
    await clearCart(page);

    // 1 Deck: ein Deck mit 8.25"-Variante wählen
    const deckPill = page.locator('.bb-card:has-text("Sunset") .bb-pill', { hasText: '8.25' }).first();
    if (await deckPill.count()) await deckPill.click();
    else await selectFirst(page);
    await expect(page.locator(".bb-card.is-selected")).toHaveCount(1);
    await expect(page.locator(".bb-preview__plan [data-el='deck-base']")).not.toHaveClass(/is-empty/);

    // 2 Trucks: Empfehlungshinweis mit Spanne
    await next(page);
    await expect(page.locator("[data-bb-stepper] [aria-current='step']")).toHaveAttribute("data-bb-goto", "trucks");
    await expect(page.locator(".bb-hint--info")).toContainText('"');
    await page.locator("[data-bb-only-fit]").click();
    await selectFirst(page, true);

    // 3 Wheels: 58 mm → Riser-Hinweis + Extra
    await next(page);
    const wheel58 = page.locator(".bb-pill", { hasText: "58" }).first();
    if (await wheel58.count()) {
      await wheel58.click();
      await expect(page.locator("[data-bb-riser-open]")).toBeVisible();
      await page.locator("[data-bb-riser-open]").click();
      await page.locator("[data-bb-riser-pick]").first().click();
      await expect(page.locator("[data-bb-remove-riser]")).toBeVisible();
    } else {
      await selectFirst(page);
    }

    for (const _ of ["bearings", "griptape", "hardware"]) {
      await next(page);
      await selectFirst(page, true);
    }
    await page.locator("[data-bb-next]").click();

    // Summary
    const summary = page.locator("[data-bb-summary]");
    await expect(summary).toBeVisible();
    const rows = summary.locator(".bb-sum__row:not(.is-missing)");
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThanOrEqual(6);
    await page.screenshot({ path: `qa-screenshots/${testInfo.project.name}-builder-summary.png`, fullPage: true });

    // Reload behält die Auswahl
    await page.reload();
    await expect(page.locator("[data-bb-summary]")).toBeVisible({ timeout: 20_000 });
    await expect(page.locator(".bb-sum__row:not(.is-missing)")).toHaveCount(rowCount, { timeout: 20_000 });

    // In den Warenkorb
    await page.locator("[data-bb-add]").click();
    await expect(page.locator("#CartDrawer[open]")).toBeVisible({ timeout: 20_000 });
    const lines = await page.evaluate(async () => {
      const root = JSON.parse(document.getElementById("theme-config")?.textContent || "{}").routes?.root || "/";
      const cart = await (await fetch(`${root.replace(/\/?$/, "/")}cart.js`)).json();
      return cart.items.map((item: { properties: Record<string, string> }) => item.properties);
    });
    const buildIds = new Set(lines.map((properties: Record<string, string>) => properties._build_id));
    expect(lines.length).toBe(rowCount);
    expect(buildIds.size).toBe(1);
    expect([...buildIds][0]).toMatch(/^b-[a-z0-9]{6,24}$/);
    await clearCart(page);
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("gespeichertes Teil erscheint nach Ladefehler und „Erneut versuchen“ wieder als gewählt", async ({ page }) => {
    await openBuilder(page);
    await selectFirst(page, true);
    await next(page);
    await selectFirst(page, true);
    await expect(page.locator(".bb-card.is-selected")).toHaveCount(1);

    // Reload while the trucks collection fails: the stored truck must survive and come back after a retry.
    const trucksData = /\/collections\/builder-trucks\?[^#]*view=builder-data/;
    await page.route(trucksData, (route) => route.fulfill({ status: 500, body: "" }));
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-bb-status] [data-bb-retry]")).toBeVisible({ timeout: 20_000 });
    await expect
      .poll(() =>
        page.evaluate(() => {
          const builder = document.querySelector("board-builder") as (HTMLElement & { restoring?: boolean; data?: Map<string, unknown> }) | null;
          return Boolean(builder && builder.restoring === false && builder.data?.has("deck"));
        })
      )
      .toBe(true);
    await page.unroute(trucksData);

    const retry = page.locator("[data-bb-status] [data-bb-retry]");
    await retry.click();
    await expect(page.locator("[data-bb-list]")).toHaveAttribute("aria-busy", "false", { timeout: 20_000 });
    // Only a retry that itself got throttled is a skip; any other remaining error fails below.
    if (await retry.isVisible()) test.skip(dataThrottled, "Store drosselt die Builder-Daten (HTTP 429) – später erneut ausführen");
    await expect(page.locator(".bb-card.is-selected")).toHaveCount(1);
    await expect(page.locator(".bb-legend__row.is-done")).toHaveCount(2);
  });

  test("manipulierter Speicher führt zu sauberem Start", async ({ page }) => {
    await page.addInitScript((key) => {
      try {
        if (window !== window.top) return;
        localStorage.setItem(key, JSON.stringify({ v: 1, saved: Date.now(), step: "wheels", sel: { deck: { p: "1", v: 2, h: "<img src=x onerror=alert(1)>" } } }));
      } catch {
        /* sandboxed frame */
      }
    }, STORAGE_KEY);
    const errors = collectThemeErrors(page);
    await openBuilder(page);
    await expect(page.locator("[data-bb-stepper] [aria-current='step']")).toHaveAttribute("data-bb-goto", "deck");
    await expect(page.locator(".bb-legend__row.is-done")).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test("422 beim Hinzufügen zeigt Fehler und baut Teil-Zeilen zurück", async ({ page }) => {
    await openBuilder(page);
    for (let index = 0; index < 6; index += 1) {
      await selectFirst(page, true);
      if (index < 5) await next(page);
    }
    await page.locator("[data-bb-next]").click();
    let rollbackCalled = false;
    await page.route(/\/cart\/add\.js/, (route) => route.fulfill({ status: 422, contentType: "application/json", body: JSON.stringify({ status: 422, message: "Cart Error", description: "Test: nicht genug Bestand" }) }));
    await page.route(/\/cart\/update\.js/, (route) => {
      rollbackCalled = true;
      return route.continue();
    });
    await page.locator("[data-bb-add]").click();
    await expect(page.locator(".bb-sum__status .form-message--error")).toContainText("Test: nicht genug Bestand");
    expect(rollbackCalled).toBe(false); // nichts angelegt → kein Rückbau nötig
    await expect(page.locator("#CartDrawer[open]")).toHaveCount(0);
  });

  test("422 nach teilweise angelegten Zeilen: Rückbau entfernt alle Zeilen des Builds", async ({ page }) => {
    await openBuilder(page);
    await clearCart(page);
    for (let index = 0; index < 6; index += 1) {
      await selectFirst(page, true);
      if (index < 5) await next(page);
    }
    await page.locator("[data-bb-next]").click();

    // Simulates a partial success: the first part really lands in the cart, then the request answers 422.
    let buildId = "";
    await page.route(/\/cart\/add\.js/, async (route) => {
      const body = JSON.parse(route.request().postData() || "{}");
      buildId = body.items?.[0]?.properties?._build_id || "";
      await route.fetch({ postData: JSON.stringify({ items: body.items.slice(0, 1) }) });
      await route.fulfill({ status: 422, contentType: "application/json", body: JSON.stringify({ status: 422, message: "Cart Error", description: "Test: Teilfehler" }) });
    });
    const rollback = page.waitForRequest((request) => /\/cart\/update\.js/.test(request.url()) && request.method() === "POST");
    await page.locator("[data-bb-add]").click();

    await expect(page.locator(".bb-sum__status .form-message--error")).toContainText("Test: Teilfehler");
    await rollback;
    expect(buildId).not.toBe("");
    await expect
      .poll(() =>
        page.evaluate(async (id) => {
          const root = JSON.parse(document.getElementById("theme-config")?.textContent || "{}").routes?.root || "/";
          const cart = await (await fetch(`${root.replace(/\/?$/, "/")}cart.js`)).json();
          return cart.items.filter((item: { properties?: Record<string, string> }) => item.properties?._build_id === id).length;
        }, buildId)
      )
      .toBe(0);
    await expect(page.locator("#CartDrawer[open]")).toHaveCount(0);
  });

  test("ausverkaufte Teile werden vor dem Hinzufügen erkannt", async ({ page }) => {
    await openBuilder(page);
    for (let index = 0; index < 6; index += 1) {
      await selectFirst(page, true);
      if (index < 5) await next(page);
    }
    await page.locator("[data-bb-next]").click();
    await page.route(/\/products\/[^/?]+\.js/, async (route) => {
      const response = await route.fetch();
      const data = await response.json();
      data.variants = data.variants.map((variant: { available: boolean }) => ({ ...variant, available: false }));
      await route.fulfill({ response, json: data });
    });
    let addCalled = false;
    await page.route(/\/cart\/add\.js/, (route) => {
      addCalled = true;
      return route.abort();
    });
    await page.locator("[data-bb-add]").click();
    await expect(page.locator(".bb-sum__status .form-message--error")).toBeVisible();
    expect(addCalled).toBe(false);
  });

  test("mobil: Vorschau oben, Sticky-Leiste mit Total sichtbar", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "nur mobil");
    await openBuilder(page);
    await selectFirst(page);
    await expect(page.locator("[data-bb-bar]")).toBeInViewport();
    await expect(page.locator("[data-bb-total]")).not.toHaveText("");
    const previewBox = await page.locator("board-preview").boundingBox();
    const listBox = await page.locator("[data-bb-list]").boundingBox();
    expect(previewBox!.y).toBeLessThan(listBox!.y);
    await page.screenshot({ path: `qa-screenshots/${testInfo.project.name}-builder-mobile.png`, fullPage: false });
  });
});
