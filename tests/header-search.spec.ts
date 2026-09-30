import { test, expect, type Page, type TestInfo } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { QA, withTheme } from "./fixtures";

/**
 * Header, Mega-Menü, Mobile-Navigation, Such-Dialog + Predictive Search, Cart-Öffner und Footer.
 * Sprachunabhängig über Rollen und data-testid. Deutsche Storefront unter /de.
 * Bewusst wenige Seitenaufrufe (3 pro Projekt) – der Dev-Store drosselt Headless-Traffic.
 */

// Only Chromium is installed (/opt/pw-browsers); the iPhone 13 descriptor would default to WebKit.
test.use({ browserName: "chromium" });

const SHOT_DIR = "qa-screenshots";
const HOME_DE = "/de";
const THEME_ASSET = /\/cdn\/shop\/t\/\d+\/assets\//;
const ANIMATION_SETTLE_MS = 450;

/** Collects console errors / uncaught exceptions that originate from theme assets. */
function trackThemeErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const url = message.location()?.url || "";
    if (THEME_ASSET.test(url)) errors.push(`console: ${message.text()} @ ${url}`);
  });
  page.on("pageerror", (error) => {
    if (THEME_ASSET.test(error.stack || "")) errors.push(`pageerror: ${error.message}`);
  });
  return errors;
}

async function shot(page: Page, testInfo: TestInfo, name: string, fullPage = false) {
  if (!fs.existsSync(SHOT_DIR)) fs.mkdirSync(SHOT_DIR, { recursive: true });
  await page.screenshot({ path: path.join(SHOT_DIR, `${testInfo.project.name}-${name}.png`), fullPage });
}

const isMobile = (testInfo: TestInfo) => testInfo.project.name === "mobile";

async function openStorefront(page: Page, url: string) {
  const response = await page.goto(withTheme(url));
  const status = response?.status() ?? 0;
  const challenged = response?.headers()["cf-mitigated"] === "challenge" || [403, 429, 503].includes(status);
  test.skip(challenged, `Storefront verlangt eine Bot-Prüfung (HTTP ${status}) – QA später wiederholen`);
  expect(response?.ok(), `HTTP ${status}`).toBe(true);
}

/** Finds a search term that returns products: the first word of a product title from the shop. */
async function findSearchTerm(page: Page): Promise<string | null> {
  const response = await page.request.get("/products.json?limit=5");
  if (!response.ok()) return null;
  const data = await response.json().catch(() => null);
  const title: string | undefined = data?.products?.find((product: { title?: string }) => product.title)?.title;
  if (!title) return null;
  const word = title.split(/\s+/).find((part) => part.length >= 3);
  return word || title;
}

test.describe("Header & Footer", () => {
  test("Landmarks, Mega-Menü, Mobile-Navigation, Such-Dialog, Warenkorb, Footer", async ({ page }, testInfo) => {
    const errors = trackThemeErrors(page);
    await openStorefront(page, HOME_DE);

    await test.step("Landmarks genau einmal, keine H1 im Header, kein Overflow, Touch-Ziele", async () => {
      await expect(page.getByRole("banner")).toHaveCount(1);
      await expect(page.getByRole("contentinfo")).toHaveCount(1);
      await expect(page.locator("header h1")).toHaveCount(0);
      await expect(page.locator("[data-testid='header-cart']")).toBeVisible();
      await expect(page.locator("[data-testid='header-search']")).toBeVisible();

      const visibleNavs = await page
        .locator("header nav")
        .evaluateAll((navs) => navs.filter((nav) => (nav as HTMLElement).offsetParent !== null).length);
      expect(visibleNavs, "sichtbare Navigation im Header").toBe(isMobile(testInfo) ? 0 : 1);

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, "horizontaler Overflow in px").toBeLessThanOrEqual(0);

      const targets = page.locator(
        "[data-testid='header-cart'], [data-testid='header-search'], [data-testid='header-menu-toggle']"
      );
      for (const target of await targets.all()) {
        if (!(await target.isVisible())) continue;
        const box = await target.boundingBox();
        expect(box?.height ?? 0, "Touch-Ziel Höhe").toBeGreaterThanOrEqual(43.5);
        expect(box?.width ?? 0, "Touch-Ziel Breite").toBeGreaterThanOrEqual(43.5);
      }
      await shot(page, testInfo, "header-top");
    });

    if (!isMobile(testInfo)) {
      await test.step("Desktop-Zeile passt bei allen Laptop-Breiten", async () => {
        for (const width of [1440, 1400, 1366, 1280, 1200, 1024, 990]) {
          await page.setViewportSize({ width, height: 900 });
          const layout = await page.evaluate(() => {
            const nav = document.querySelector(".site-header__nav .site-nav__list")?.getBoundingClientRect();
            const actions = document.querySelector(".site-header__actions")?.getBoundingClientRect();
            const logo = document.querySelector(".site-header__logo")?.getBoundingClientRect();
            return {
              navRight: nav?.right ?? 0,
              navLeft: nav?.left ?? 0,
              actionsLeft: actions?.left ?? 0,
              logoRight: logo?.right ?? 0,
              overflow: document.documentElement.scrollWidth - window.innerWidth,
            };
          });
          expect(layout.navRight, `Nav ragt bei ${width}px in die Aktionen`).toBeLessThanOrEqual(layout.actionsLeft + 1);
          expect(layout.navLeft, `Nav überlappt das Logo bei ${width}px`).toBeGreaterThanOrEqual(layout.logoRight - 1);
          expect(layout.overflow, `Overflow bei ${width}px`).toBeLessThanOrEqual(0);
          if (width === 1200 || width === 990) await shot(page, testInfo, `header-top-${width}`);
        }
        await page.setViewportSize({ width: 1440, height: 900 });
      });

      await test.step("Mega-Menü per Tastatur: Enter öffnet, Escape schließt, Fokus zurück", async () => {
        const trigger = page.locator("[data-testid='mega-trigger']").first();
        if ((await trigger.count()) === 0) {
          testInfo.annotations.push({ type: "skip-step", description: "Menü ohne Unterpunkte" });
          return;
        }
        const panel = page.locator(`[id="${await trigger.getAttribute("aria-controls")}"]`);
        await expect(panel).toBeHidden();

        await trigger.focus();
        await page.keyboard.press("Enter");
        await expect(trigger).toHaveAttribute("aria-expanded", "true");
        await expect(panel).toBeVisible();
        await expect(panel.getByRole("link").first()).toBeVisible();
        await page.waitForTimeout(ANIMATION_SETTLE_MS);
        await shot(page, testInfo, "header-mega");

        await page.keyboard.press("Tab");
        expect(await panel.evaluate((element) => element.contains(document.activeElement)), "Tab führt ins Panel").toBe(
          true
        );
        await page.keyboard.press("Escape");
        await expect(trigger).toHaveAttribute("aria-expanded", "false");
        await expect(panel).toBeHidden();
        await expect(trigger).toBeFocused();
        await expect(page.locator("header [role='menu'], header [role='menubar']")).toHaveCount(0);
      });
    } else {
      await test.step("Mobile Navigation öffnen und schließen", async () => {
        const burger = page.locator("[data-testid='header-menu-toggle']");
        const drawer = page.locator("#MenuDrawer");
        await expect(burger).toBeVisible();
        await burger.click();
        await expect(drawer).toHaveAttribute("open", "");
        await expect(drawer.getByRole("navigation")).toBeVisible();

        const firstAccordion = drawer.locator("details > summary").first();
        if (await firstAccordion.count()) {
          await firstAccordion.click();
          await expect(drawer.locator("details[open] .menu-drawer__sublist").first()).toBeVisible();
        }
        const tallEnough = await drawer
          .locator(".menu-drawer__link")
          .first()
          .evaluate((element) => element.getBoundingClientRect().height >= 44);
        expect(tallEnough, "Drawer-Links ≥ 44 px").toBe(true);
        await page.waitForTimeout(ANIMATION_SETTLE_MS);
        await shot(page, testInfo, "header-drawer");

        await page.keyboard.press("Escape");
        await expect(drawer).not.toHaveAttribute("open", "");
        await expect(burger).toBeFocused();

        await burger.click();
        await expect(drawer).toHaveAttribute("open", "");
        await drawer.locator("[data-dialog-close]").click();
        await expect(drawer).not.toHaveAttribute("open", "");
      });
    }

    await test.step("Such-Dialog: öffnen, Fokus im Feld, Escape schließt, Fokus zurück", async () => {
      const opener = page.locator("[data-testid='header-search']");
      const dialog = page.locator("#SearchDialog");
      await opener.click();
      await expect(dialog).toHaveAttribute("open", "");
      await expect(page.locator("[data-testid='search-input']")).toBeFocused();
      await page.waitForTimeout(ANIMATION_SETTLE_MS);
      await shot(page, testInfo, "search-empty");
      await page.keyboard.press("Escape");
      await expect(dialog).not.toHaveAttribute("open", "");
      await expect(opener).toBeFocused();
    });

    await test.step("Warenkorb-Icon öffnet den Drawer (#CartDrawer)", async () => {
      const cart = page.locator("[data-testid='header-cart']");
      if ((await cart.getAttribute("data-dialog-open")) !== "CartDrawer") {
        testInfo.annotations.push({ type: "skip-step", description: "Warenkorb-Typ ist „Seite“" });
        return;
      }
      await cart.click();
      const drawer = page.locator("#CartDrawer");
      await expect(drawer).toHaveAttribute("open", "");
      await page.keyboard.press("Escape");
      await expect(drawer).not.toHaveAttribute("open", "");
      await expect(cart).toBeFocused();
    });

    await test.step("Footer: Blöcke, Akkordeons mobil", async () => {
      const footer = page.getByRole("contentinfo");
      await footer.scrollIntoViewIfNeeded();
      await expect(footer).toBeVisible();
      if (isMobile(testInfo)) {
        const summary = footer.locator("details > summary").first();
        if (await summary.count()) {
          await summary.click();
          await expect(footer.locator("details[open] a").first()).toBeVisible();
        }
      } else {
        const links = footer.locator(".site-footer__list a").filter({ visible: true });
        if (await links.count()) await expect(links.first()).toBeVisible();
        await expect(footer.locator("details").filter({ visible: true })).toHaveCount(0);
      }
      if (!fs.existsSync(SHOT_DIR)) fs.mkdirSync(SHOT_DIR, { recursive: true });
      await footer.screenshot({ path: path.join(SHOT_DIR, `${testInfo.project.name}-footer.png`) });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });

    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("Predictive Search: Bild, Name, Preis, Pfeiltasten, Enter → Suchseite", async ({ page }, testInfo) => {
    const errors = trackThemeErrors(page);
    await openStorefront(page, HOME_DE);
    const term = await findSearchTerm(page);
    test.skip(!term, "Keine Produkte im Shop");

    const input = page.locator("[data-testid='search-input']");
    await page.locator("[data-testid='header-search']").click();
    await expect(page.locator("#SearchDialog")).toHaveAttribute("open", "");

    const suggest = page.waitForResponse((response) => response.url().includes("section_id=predictive-search"));
    await input.fill(term!);
    const response = await suggest;
    expect([200, 417, 429]).toContain(response.status());
    test.skip(response.status() !== 200, `Predictive Search antwortet ${response.status()}`);

    const product = page.locator("[data-testid='predictive-product']").first();
    await expect(product).toBeVisible();
    await expect(product.locator("img, [role='img']").first()).toBeVisible();
    await expect(product.locator("[data-testid='predictive-product-title']")).not.toBeEmpty();
    await expect(product.locator("[data-price]")).toBeVisible();
    await expect(page.locator("[data-predictive-status]")).not.toBeEmpty();
    await page
      .waitForFunction(() =>
        Array.from(document.querySelectorAll<HTMLImageElement>("[data-predictive-results] img")).every((img) => img.complete)
      )
      .catch(() => undefined);
    await shot(page, testInfo, "search-results");

    // Pfeiltasten: Eingabe → erster Treffer → zweiter → zurück bis zur Eingabe
    const links = page.locator("[data-predictive-link]");
    await input.press("ArrowDown");
    await expect(links.first()).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(links.first()).not.toBeFocused();
    await page.keyboard.press("ArrowUp");
    await expect(links.first()).toBeFocused();
    await page.keyboard.press("ArrowUp");
    await expect(input).toBeFocused();

    // Enter im Feld → Suchseite
    await Promise.all([page.waitForURL(/\/search\?/), input.press("Enter")]);
    const url = new URL(page.url());
    expect(url.pathname).toMatch(/\/search$/);
    expect(url.searchParams.get("q")).toBe(term);
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("Sticky-Header auf der Produktseite", async ({ page }, testInfo) => {
    test.skip(!QA.product.handle, "Kein Produkt gefunden");
    const errors = trackThemeErrors(page);
    await openStorefront(page, `${HOME_DE}/products/${QA.product.handle}`);
    await page.evaluate(() => window.scrollTo(0, 900));
    await page.waitForTimeout(400);
    const box = await page.getByRole("banner").boundingBox();
    if ((await page.locator("sticky-header").getAttribute("data-sticky")) === "true") {
      expect(Math.round(box?.y ?? -1), "Header klebt oben").toBe(0);
      await expect(page.locator("sticky-header")).toHaveClass(/is-scrolled/);
    }
    await shot(page, testInfo, "header-sticky");
    expect(errors, errors.join("\n")).toEqual([]);
  });
});
