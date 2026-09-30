import { test, expect, type Page, type Response } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { withTheme } from "./fixtures";

/**
 * Content pages (area E): brands, contact, 404, blog/article, password.
 * Language-independent: roles, data-testid and structure only. German storefront via /de.
 * Each page is loaded once per test to keep storefront traffic low.
 * Seed pages: /pages/brands (template brands), /pages/skate-contact (template contact).
 */

const LOCALE = process.env.QA_LOCALE ?? "/de";
const SHOTS = "qa-screenshots";

async function open(page: Page, route: string): Promise<Response | null> {
  const response = await page.goto(withTheme(`${LOCALE}${route}`), { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("load");
  const challenge = await page
    .locator("text=/verify you are human|connection needs to be verified|Just a moment/i")
    .count();
  test.skip(challenge > 0 || response?.status() === 429, "Store zeigt Cloudflare-Prüfung / 429 – später erneut");
  return response;
}

function collectErrors(page: Page, ignore: RegExp[] = []): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (ignore.some((pattern) => pattern.test(text))) return;
    errors.push(`console: ${text}`);
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

async function expectOneH1(page: Page) {
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.locator("h1").first()).toBeVisible();
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, `horizontal overflow ${overflow}px`).toBeLessThanOrEqual(1);
}

async function shot(page: Page, project: string, name: string) {
  if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, `pages-${project}-${name}.png`), fullPage: true });
}

test.describe("Inhaltsseiten", () => {
  test("Brands: A–Z-Navigation und Links zu Vendor-Collections", async ({ page }, info) => {
    const errors = collectErrors(page);
    let response = await open(page, "/pages/brands");
    test.skip(response?.status() === 404, "Seite /pages/brands fehlt (Seed)");
    if ((await page.getByTestId("brands-list").count()) === 0) {
      response = await open(page, "/pages/brands?view=brands");
    }
    expect(response?.ok(), `HTTP ${response?.status()}`).toBe(true);

    const list = page.getByTestId("brands-list");
    await expect(list).toBeVisible();
    await expectOneH1(page);

    const nav = page.getByTestId("brands-az");
    await expect(nav).toBeVisible();
    const letters = nav.locator("a");
    const enabled = nav.locator("a[href]");
    const disabled = nav.locator('a[aria-disabled="true"]');
    await expect(letters).toHaveCount(27);
    expect(await enabled.count()).toBeGreaterThan(0);
    expect((await enabled.count()) + (await disabled.count())).toBe(27);
    for (const letter of await disabled.all()) {
      expect(await letter.getAttribute("href")).toBeNull();
    }

    // Every enabled letter jumps to an existing group.
    const hrefs = await enabled.evaluateAll((links) => links.map((link) => link.getAttribute("href") || ""));
    for (const href of hrefs) {
      expect(href.startsWith("#")).toBe(true);
      await expect(page.locator(`[id="${href.slice(1)}"]`)).toHaveCount(1);
    }

    const vendorLinks = list.locator('[data-testid="brands-group"] a[href*="/collections/vendors"]');
    expect(await vendorLinks.count()).toBeGreaterThan(0);

    await enabled.first().click();
    await expect(page).toHaveURL(new RegExp(`${hrefs[0]}$`));
    await expect(page.locator(`[id="${hrefs[0].slice(1)}"]`)).toBeInViewport();

    await expectNoHorizontalOverflow(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    await shot(page, info.project.name, "brands");
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("Kontakt: Labels, Pflichtfelder und Browser-Validierung", async ({ page }, info) => {
    const errors = collectErrors(page);
    let response = await open(page, "/pages/skate-contact");
    test.skip(response?.status() === 404, "Seite /pages/skate-contact fehlt (Seed)");
    if ((await page.getByTestId("contact-form").count()) === 0) {
      response = await open(page, "/pages/skate-contact?view=contact");
    }
    expect(response?.ok(), `HTTP ${response?.status()}`).toBe(true);
    await expectOneH1(page);

    const form = page.getByTestId("contact-form");
    await expect(form).toBeVisible();

    // Every visible field has an id and exactly one non-empty label.
    const fields = form.locator('input:not([type="hidden"]), textarea');
    expect(await fields.count()).toBeGreaterThanOrEqual(3);
    for (const field of await fields.all()) {
      const id = await field.getAttribute("id");
      expect(id, "field without id").toBeTruthy();
      const label = form.locator(`label[for="${id}"]`);
      await expect(label).toHaveCount(1);
      expect((await label.innerText()).trim().length).toBeGreaterThan(0);
    }

    // Name, email and message are required; phone is optional.
    await expect(form.locator('input[name="contact[name]"][required]')).toHaveCount(1);
    await expect(form.locator('input[type="email"][name="contact[email]"][required]')).toHaveCount(1);
    await expect(form.locator('textarea[name="contact[body]"][required]')).toHaveCount(1);
    const phone = form.locator('input[type="tel"]');
    if ((await phone.count()) > 0) expect(await phone.getAttribute("required")).toBeNull();

    await expectNoHorizontalOverflow(page);
    await shot(page, info.project.name, "contact");

    // Empty submit is blocked by the browser (no request is sent – the form is never really submitted).
    const before = page.url();
    await form.locator('button[type="submit"]').click();
    expect(await form.evaluate((element) => (element as HTMLFormElement).checkValidity())).toBe(false);
    expect(
      await form.locator('textarea[name="contact[body]"]').evaluate((element) => (element as HTMLTextAreaElement).validity.valueMissing)
    ).toBe(true);
    await expect(form.locator(":invalid").first()).toBeFocused();
    expect(page.url()).toBe(before);
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("404: H1, Suchfeld und Links", async ({ page }, info) => {
    const errors = collectErrors(page, [/status of 404/]);
    const response = await open(page, "/diese-seite-gibt-es-nicht");
    expect(response?.status()).toBe(404);
    await expectOneH1(page);

    const search = page.getByTestId("notfound-search");
    await expect(search).toBeVisible();
    expect(await search.getAttribute("action")).toContain("/search");
    const input = search.locator('input[name="q"]');
    await expect(input).toBeVisible();
    const inputId = await input.getAttribute("id");
    await expect(search.locator(`label[for="${inputId}"]`)).toHaveCount(1);
    expect(await page.locator("main nav a[href]").count()).toBeGreaterThan(0);

    await expectNoHorizontalOverflow(page);
    await shot(page, info.project.name, "404");
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("Blog und Artikel: H1, Raster, Artikel-Layout", async ({ page }, info) => {
    const errors = collectErrors(page);
    const response = await open(page, "/blogs/news");
    test.skip(response?.status() === 404, "Blog /blogs/news fehlt");
    expect(response?.ok(), `HTTP ${response?.status()}`).toBe(true);
    await expectOneH1(page);

    const grid = page.getByTestId("blog-grid");
    test.skip((await grid.count()) === 0, "Blog hat keine Beiträge");
    const cards = grid.locator("article");
    expect(await cards.count()).toBeGreaterThan(0);
    for (const card of await cards.all()) {
      await expect(card.locator("h2 a[href]")).toHaveCount(1);
      await expect(card.locator("img, .placeholder-skate")).not.toHaveCount(0);
    }
    await expectNoHorizontalOverflow(page);
    await shot(page, info.project.name, "blog");

    const articleHref = (await cards.first().locator("h2 a").getAttribute("href")) || "/";
    const articlePath = new URL(articleHref, "https://placeholder.invalid").pathname;
    await page.goto(withTheme(articlePath), { waitUntil: "load" });
    await expectOneH1(page);
    await expect(page.getByTestId("article-body")).toBeVisible();
    await expect(page.getByTestId("article-back")).toHaveAttribute("href", /\/blogs\/news$/);
    const hero = page.locator(".content-article__hero img");
    if ((await hero.count()) > 0) await expect(hero).toHaveAttribute("loading", "eager");
    const commentForm = page.locator('form textarea[name="comment[body]"]');
    if ((await commentForm.count()) > 0) {
      const id = await commentForm.getAttribute("id");
      await expect(page.locator(`label[for="${id}"]`)).toHaveCount(1);
    }
    await expectNoHorizontalOverflow(page);
    await shot(page, info.project.name, "article");
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("Passwortseite: Formulare mit Labels (ohne Login)", async ({ browser }, info) => {
    const use = info.project.use;
    const context = await browser.newContext({
      baseURL: use.baseURL,
      viewport: use.viewport,
      userAgent: use.userAgent,
      deviceScaleFactor: use.deviceScaleFactor,
      isMobile: use.isMobile,
      hasTouch: use.hasTouch,
      storageState: { cookies: [], origins: [] },
    });
    const page = await context.newPage();
    await open(page, "/password");
    const section = page.getByTestId("password-page");
    const rendered = (await section.count()) > 0;
    if (!rendered) await context.close();
    test.skip(!rendered, "Passwortseite nicht erreichbar (Passwortschutz aus oder Vorschau greift nicht)");

    await expectOneH1(page);
    const passwordInput = page.locator('input[type="password"][name="password"]');
    await expect(passwordInput).toHaveCount(1);
    await expect(page.locator(`label[for="${await passwordInput.getAttribute("id")}"]`)).toHaveCount(1);
    const newsletter = page.getByTestId("password-newsletter");
    if ((await newsletter.count()) > 0) {
      await expect(newsletter.locator('input[name="contact[tags]"]')).toHaveValue(/newsletter/);
      const email = newsletter.locator('input[type="email"]');
      await expect(page.locator(`label[for="${await email.getAttribute("id")}"]`)).toHaveCount(1);
    }
    await expectNoHorizontalOverflow(page);
    await shot(page, info.project.name, "password");
    await context.close();
  });
});
