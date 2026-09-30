import { test, expect, type Page, type Locator } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { withTheme } from "./fixtures";

/**
 * Collection pages (Agent C): header, storefront filters via AJAX, chips, CLEAR ALL, history, sorting,
 * mobile filter drawer, pagination, no-JS fallback and the collection overview.
 *
 * Default target: /collections/decks (seeded). Override with QA_COLLECTION_PATH=/collections/<handle>.
 * Tests skip themselves when the collection is missing (404), when Search & Discovery provides no filters,
 * or when the store answers with a bot challenge.
 */
const COLLECTION = process.env.QA_COLLECTION_PATH || "/collections/decks";
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

type Opened = { status: number; errors: string[]; challenged: boolean };

async function open(page: Page, target = COLLECTION): Promise<Opened> {
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

async function shot(page: Page, name: string, projectName: string) {
  await prepareScreenshot(page);
  if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, `collection-${name}-${projectName}.png`), fullPage: true });
}

/** Ids of the product cards currently in the grid plus the count text – changes whenever the result set changes. */
async function resultSignature(page: Page) {
  return page.evaluate(() => {
    const ids = Array.from(document.querySelectorAll("[data-testid=facets-results] [data-product-card]")).map(
      (card) => (card as HTMLElement).dataset.productId
    );
    const count = document.querySelector("[data-testid=facets-count]")?.textContent?.trim() ?? "";
    return `${count}|${ids.join(",")}`;
  });
}

const countOf = (text: string | null | undefined) => Number((text ?? "").replace(/[^\d]/g, "")) || 0;

/**
 * Picks an enabled, unchecked filter checkbox in `scope`, preferring one that narrows the result set,
 * and makes sure its <details> groups are open. Returns the checkbox and the value's product count.
 */
async function pickFilterValue(page: Page, scope: Locator) {
  const total = countOf(await page.getByTestId("facets-count").textContent());
  const candidates = scope.locator('input[type="checkbox"]:not([disabled]):not(:checked)');
  const amount = await candidates.count();
  let chosen = -1;
  let chosenCount = 0;
  for (let i = 0; i < amount; i++) {
    const id = await candidates.nth(i).getAttribute("id");
    const valueCount = countOf(await scope.locator(`label[for="${id}"] .facet__count`).textContent().catch(() => ""));
    if (chosen === -1) {
      chosen = i;
      chosenCount = valueCount;
    }
    if (valueCount > 0 && valueCount < total) {
      chosen = i;
      chosenCount = valueCount;
      break;
    }
  }
  if (chosen === -1) return null;
  const checkbox = candidates.nth(chosen);
  await checkbox.evaluate((input) => {
    let details = input.closest("details");
    while (details) {
      details.open = true;
      details = details.parentElement?.closest("details") ?? null;
    }
  });
  return { checkbox, id: (await checkbox.getAttribute("id")) as string, valueCount: chosenCount, total };
}

test.describe("Collection – Kopf und Grid", () => {
  test("rendert H1, Produktanzahl, Grid bzw. Leerzustand ohne Fehler", async ({ page }, testInfo) => {
    const { status, errors, challenged } = await open(page);
    test.skip(challenged, "Bot-Prüfung des Shops aktiv");
    test.skip(status === 404, `${COLLECTION} existiert nicht (Seed fehlt)`);
    expect(status).toBeLessThan(400);

    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.getByTestId("collection-header")).toBeVisible();
    await expect(page.getByTestId("facets-count")).toBeVisible();

    const cards = page.locator("[data-testid=product-grid] [data-product-card]");
    if ((await cards.count()) > 0) {
      await expect(cards.first()).toBeVisible();
    } else {
      await expect(page.getByTestId("collection-empty")).toBeVisible();
    }

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, "horizontaler Overflow").toBeLessThanOrEqual(1);

    await page.waitForLoadState("load");
    await shot(page, "page", testInfo.project.name);
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("Übersicht /collections zeigt Kacheln mit H1", async ({ page }, testInfo) => {
    const { status, errors, challenged } = await open(page, "/collections");
    test.skip(challenged, "Bot-Prüfung des Shops aktiv");
    expect(status).toBeLessThan(400);
    await expect(page.locator("h1")).toHaveCount(1);
    const tiles = page.locator("[data-testid=collection-list] a");
    expect(await tiles.count()).toBeGreaterThan(0);
    await page.waitForLoadState("load");
    await shot(page, "list", testInfo.project.name);
    expect(errors, errors.join("\n")).toEqual([]);
  });
});

test.describe("Collection – Filter per AJAX (Desktop)", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Sidebar-Flow nur Desktop; mobil siehe Drawer-Test");
  });

  test("Filter, Chip, CLEAR ALL und Back-Button ohne Full-Reload", async ({ page }, testInfo) => {
    const { status, errors, challenged } = await open(page);
    test.skip(challenged, "Bot-Prüfung des Shops aktiv");
    test.skip(status === 404, `${COLLECTION} existiert nicht (Seed fehlt)`);
    const sidebar = page.getByTestId("facets-sidebar");
    test.skip((await sidebar.count()) === 0, "Keine Filter vorhanden (Search & Discovery)");

    await page.waitForLoadState("load");
    await page.evaluate(() => ((window as unknown as { __facetsMarker: string }).__facetsMarker = "kept"));
    const initialUrl = page.url();
    const before = await resultSignature(page);

    const picked = await pickFilterValue(page, sidebar);
    test.skip(!picked, "Kein auswählbarer Filterwert");
    const { checkbox, id, valueCount, total } = picked!;

    // Keyboard: focus the checkbox and toggle it with Space – focus must survive the re-render.
    await checkbox.focus();
    await page.keyboard.press("Space");
    await expect(page).toHaveURL(/filter\./);
    await expect(page.getByTestId("facet-chip")).toHaveCount(1);
    await expect(page.locator(`#${id}`)).toBeChecked();
    expect(await page.evaluate(() => document.activeElement?.id)).toBe(id);

    const after = await resultSignature(page);
    if (valueCount > 0 && valueCount < total) {
      expect(after).not.toBe(before);
      expect(countOf(await page.getByTestId("facets-count").textContent())).toBe(valueCount);
    }
    expect(await page.evaluate(() => (window as unknown as { __facetsMarker?: string }).__facetsMarker)).toBe("kept");
    await shot(page, "filtered", testInfo.project.name);

    // CLEAR ALL removes every filter.
    await page.getByTestId("facets-clear-all").click();
    await expect(page).not.toHaveURL(/filter\./);
    await expect(page.getByTestId("facet-chip")).toHaveCount(0);
    expect(await resultSignature(page)).toBe(before);

    // Back restores the filtered state, Back again the initial one – still without reload.
    await page.goBack();
    await expect(page).toHaveURL(/filter\./);
    await expect(page.getByTestId("facet-chip")).toHaveCount(1);
    await expect(page.locator(`#${id}`)).toBeChecked();
    await page.goBack();
    await expect(page).toHaveURL(initialUrl);
    await expect(page.getByTestId("facet-chip")).toHaveCount(0);
    expect(await page.evaluate(() => (window as unknown as { __facetsMarker?: string }).__facetsMarker)).toBe("kept");

    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("Sortierung ändert URL ohne Full-Reload", async ({ page }) => {
    const { status, challenged } = await open(page);
    test.skip(challenged, "Bot-Prüfung des Shops aktiv");
    test.skip(status === 404, `${COLLECTION} existiert nicht (Seed fehlt)`);
    const sort = page.getByTestId("facets-sort");
    test.skip((await sort.count()) === 0, "Sortierung deaktiviert");

    await page.waitForLoadState("load");
    await page.evaluate(() => ((window as unknown as { __facetsMarker: string }).__facetsMarker = "kept"));
    const values = await sort.locator("option").evaluateAll((options) => options.map((o) => (o as HTMLOptionElement).value));
    const current = await sort.inputValue();
    const next = values.find((value) => value !== current && /price-ascending|title-ascending/.test(value)) ?? values.find((v) => v !== current);
    test.skip(!next, "Nur eine Sortieroption");

    await sort.selectOption(next!);
    await expect(page).toHaveURL(new RegExp(`sort_by=${next}`));
    await expect(page.getByTestId("facets-sort")).toHaveValue(next!);
    expect(await page.evaluate(() => (window as unknown as { __facetsMarker?: string }).__facetsMarker)).toBe("kept");

    if (next === "price-ascending") {
      const prices = await page
        .locator("[data-testid=product-grid] [data-product-card] .price__current")
        .evaluateAll((nodes) => nodes.map((node) => Number((node.textContent ?? "").replace(/[^\d]/g, ""))));
      const sorted = [...prices].sort((a, b) => a - b);
      expect(prices).toEqual(sorted);
    }
  });

  test("Preisfilter wird verzögert angewendet, Fokus bleibt im Feld", async ({ page }) => {
    const { status, challenged } = await open(page);
    test.skip(challenged, "Bot-Prüfung des Shops aktiv");
    test.skip(status === 404, `${COLLECTION} existiert nicht (Seed fehlt)`);
    const sidebar = page.getByTestId("facets-sidebar");
    const priceMax = sidebar.locator("input[data-facets-price]").nth(1);
    test.skip((await priceMax.count()) === 0, "Kein Preisfilter vorhanden");

    await page.waitForLoadState("load");
    await page.evaluate(() => ((window as unknown as { __facetsMarker: string }).__facetsMarker = "kept"));
    await priceMax.evaluate((input) => {
      const details = input.closest("details");
      if (details) details.open = true;
    });
    const id = (await priceMax.getAttribute("id")) as string;
    const ceiling = Number(await priceMax.getAttribute("placeholder")) || 100;
    const value = String(Math.max(1, Math.floor(ceiling / 2)));

    await priceMax.click();
    await page.keyboard.type(value, { delay: 60 });
    await expect(page).toHaveURL(new RegExp(`filter\\.v\\.price\\.lte=${value}`));
    await expect(page.getByTestId("facet-chip")).toHaveCount(1);
    await expect(page.locator(`#${id}`)).toHaveValue(value);
    expect(await page.evaluate(() => document.activeElement?.id)).toBe(id);
    expect(await page.evaluate(() => (window as unknown as { __facetsMarker?: string }).__facetsMarker)).toBe("kept");
  });

  test("Pagination lädt Seite 2 ohne Full-Reload", async ({ page }) => {
    const { status, challenged } = await open(page);
    test.skip(challenged, "Bot-Prüfung des Shops aktiv");
    test.skip(status === 404, `${COLLECTION} existiert nicht (Seed fehlt)`);
    const pagination = page.getByTestId("pagination");
    test.skip((await pagination.count()) === 0, "Nur eine Seite");

    await page.waitForLoadState("load");
    await page.evaluate(() => ((window as unknown as { __facetsMarker: string }).__facetsMarker = "kept"));
    await pagination.locator('a[rel="next"]').click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page.getByTestId("pagination").locator('[aria-current="page"]')).toContainText("2");
    await expect(page.getByTestId("facets-count")).toBeFocused();
    expect(await page.evaluate(() => (window as unknown as { __facetsMarker?: string }).__facetsMarker)).toBe("kept");
  });
});

test.describe("Collection – Filter-Drawer (Mobil)", () => {
  test("Drawer öffnet, filtert, schließt mit Escape und gibt Fokus zurück", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "Drawer nur mobil");
    const { status, errors, challenged } = await open(page);
    test.skip(challenged, "Bot-Prüfung des Shops aktiv");
    test.skip(status === 404, `${COLLECTION} existiert nicht (Seed fehlt)`);
    const trigger = page.getByTestId("facets-open");
    test.skip((await trigger.count()) === 0, "Keine Filter vorhanden (Search & Discovery)");

    await page.waitForLoadState("load");
    await expect(page.getByTestId("facets-sidebar")).toBeHidden();
    const drawer = page.getByTestId("facets-drawer");

    // Open and close with Escape – focus returns to the trigger.
    await trigger.click();
    await expect(drawer).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
    await expect(trigger).toBeFocused();

    // Open again, pick a value inside the drawer, drawer stays open, apply closes it.
    await trigger.click();
    await expect(drawer).toBeVisible();
    await page.evaluate(() => ((window as unknown as { __facetsMarker: string }).__facetsMarker = "kept"));
    const picked = await pickFilterValue(page, drawer);
    test.skip(!picked, "Kein auswählbarer Filterwert");
    await drawer.locator(`label[for="${picked!.id}"]`).click();
    await expect(page).toHaveURL(/filter\./);
    await expect(drawer).toBeVisible();
    await expect(drawer.locator(`#${picked!.id}`)).toBeChecked();
    await shot(page, "drawer", testInfo.project.name);

    await page.getByTestId("facets-drawer-apply").click();
    await expect(drawer).toBeHidden();
    await expect(page.getByTestId("facet-chip")).toHaveCount(1);
    await expect(trigger).toBeFocused();
    expect(await page.evaluate(() => (window as unknown as { __facetsMarker?: string }).__facetsMarker)).toBe("kept");

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, "horizontaler Overflow").toBeLessThanOrEqual(1);
    expect(errors, errors.join("\n")).toEqual([]);
  });
});

test.describe("Collection – ohne JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("Filterformular funktioniert als GET-Formular", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Einmal genügt");
    const { status, challenged } = await open(page);
    test.skip(challenged, "Bot-Prüfung des Shops aktiv");
    test.skip(status === 404, `${COLLECTION} existiert nicht (Seed fehlt)`);
    const sidebar = page.getByTestId("facets-sidebar");
    test.skip((await sidebar.count()) === 0, "Keine Filter vorhanden (Search & Discovery)");

    const submit = sidebar.locator('button[type="submit"]');
    await expect(submit).toBeVisible();
    const checkbox = sidebar.locator('details[open] > fieldset input[type="checkbox"]:not([disabled])').first();
    test.skip((await checkbox.count()) === 0, "Keine offene Filtergruppe mit Werten");
    const id = await checkbox.getAttribute("id");
    await sidebar.locator(`label[for="${id}"]`).click();
    await Promise.all([page.waitForURL(/filter\./), submit.click()]);
    await expect(page.getByTestId("facet-chip").first()).toBeVisible();
  });
});
