import { test, expect, type Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { withTheme } from "./fixtures";

/**
 * Homepage (Bereich "home"): skate-hero, category-grid, featured-products (2×), builder-promo,
 * brand-marquee, editorial-grid, newsletter, community-grid.
 *
 * Sprachunabhängig über Rollen, data-testid und Attribute. Wenig Seitenaufrufe pro Projekt,
 * weil der Dev-Store bei zu viel Headless-Traffic eine Cloudflare-Prüfung zeigt – dann wird übersprungen.
 */

// The "mobile" project emulates iPhone 13 – run it in Chromium (WebKit is not installed in this environment).
test.use({ browserName: "chromium" });

const HOME = withTheme("/de");

const HOME_SECTIONS = [
  "home-hero",
  "home-category-grid",
  "home-featured-products",
  "home-builder-promo",
  "home-brand-marquee",
  "home-editorial-grid",
  "home-newsletter",
  "home-community-grid",
];

/**
 * Console noise that does not come from the theme (Shopify analytics, preview bar, Shop login, bot protection).
 * Same patterns as PLATFORM_NOISE in tests/fixtures.ts of the integration branch.
 */
const IGNORED =
  /web-pixels|monorail|trekkie|shopifycloud|shop\.app|login_with_shop|\/api\/collect|ShopifySans|frame-ancestors|perf-kit|preview_bar|previewBar|admin-bar|privacy-banner|captcha|challenge|cloudflare|favicon|status of 403|net::ERR_/i;

async function openHome(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = `${message.text()} ${message.location().url || ""}`;
    if (!IGNORED.test(text)) errors.push(text);
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));

  let response = await page.goto(HOME, { waitUntil: "domcontentloaded" });

  // Storefront password page (global setup could not log in): log in here, then load the homepage again.
  const passwordField = page.locator("input[type='password']");
  if (new URL(page.url()).pathname.includes("/password") || (await passwordField.count()) > 0) {
    const password = process.env.SHOPIFY_STOREFRONT_PASSWORD;
    test.skip(!password, "Storefront ist passwortgeschützt, SHOPIFY_STOREFRONT_PASSWORD fehlt.");
    await passwordField.first().fill(password as string);
    await Promise.all([
      page.waitForLoadState("domcontentloaded"),
      page.locator("form button[type='submit'], form input[type='submit']").first().click(),
    ]);
    response = await page.goto(HOME, { waitUntil: "domcontentloaded" });
  }

  const challenged =
    response?.status() === 429 ||
    (await page.getByText(/connection needs to be verified|just a moment/i).count()) > 0;
  test.skip(challenged, "Storefront zeigt eine Cloudflare-Prüfung (Rate-Limit) – Lauf später wiederholen.");
  expect(response?.ok(), `HTTP-Status ${response?.status()}`).toBe(true);
  await page.waitForLoadState("load");
  return errors;
}

test.describe("Homepage", () => {
  test("Struktur: alle Sections, genau eine H1, Hero-Bild eager, Newsletter-Label, kein Overflow, keine Fehler", async ({ page }, testInfo) => {
    const errors = await openHome(page);

    // Alle Home-Sections vorhanden und sichtbar (featured-products zweimal: Featured Boards + Best Sellers).
    for (const id of HOME_SECTIONS) {
      const sections = page.getByTestId(id);
      await expect(sections.first(), `${id} fehlt`).toBeVisible();
    }
    expect(await page.getByTestId("home-featured-products").count()).toBe(2);

    // Genau eine H1 – und zwar im Hero.
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.getByTestId("home-hero").locator("h1")).toHaveCount(1);
    const h1Text = (await page.locator("h1").innerText()).replace(/\s+/g, " ").trim();
    expect(h1Text.length).toBeGreaterThan(0);

    // Hero-Bild ist das LCP-Bild: eager + fetchpriority high (Placeholder ohne <img> → Prüfung entfällt).
    const heroImage = page.getByTestId("home-hero").locator("img").first();
    if ((await heroImage.count()) > 0) {
      await expect(heroImage).toHaveAttribute("loading", "eager");
      await expect(heroImage).toHaveAttribute("fetchpriority", "high");
      await expect(heroImage).toHaveAttribute("srcset", /\d+w/);
    }
    // Alle übrigen Bilder der Startseite laden lazy.
    const eagerOutsideHero = await page.evaluate(
      () =>
        Array.from(document.querySelectorAll("main img[loading='eager']")).filter(
          (img) => !img.closest("[data-testid='home-hero']")
        ).length
    );
    expect(eagerOutsideHero).toBe(0);

    // Newsletter: E-Mail-Feld mit sichtbarem Label, Tag "newsletter", Absende-Button.
    const form = page.getByTestId("newsletter-form");
    await expect(form).toBeVisible();
    const email = form.locator("input[type='email']");
    await expect(email).toHaveAttribute("name", "contact[email]");
    const labelText = await email.evaluate((input) =>
      Array.from((input as HTMLInputElement).labels || [])
        .map((label) => label.textContent?.trim())
        .join(" ")
    );
    expect(labelText.length, "E-Mail-Feld ohne Label").toBeGreaterThan(0);
    await expect(form.locator("input[name='contact[tags]']")).toHaveValue("newsletter");
    await expect(form.getByRole("button")).toBeVisible();

    // Slider-Track ist fokussierbar und benannt.
    const track = page.getByTestId("featured-slider-track");
    if ((await track.count()) > 0) {
      await expect(track).toHaveAttribute("tabindex", "0");
      await expect(track).toHaveAttribute("role", "region");
      await expect(track).toHaveAttribute("aria-label", /\S/);
    }

    // Marquee: zweite Spur ist aria-hidden, ihre Links sind nicht fokussierbar.
    const clone = page.locator(".brand-marquee__list--clone");
    if ((await clone.count()) > 0) {
      await expect(clone).toHaveAttribute("aria-hidden", "true");
      const focusableInClone = await clone.locator("a:not([tabindex='-1'])").count();
      expect(focusableInClone).toBe(0);
    }

    // Einmal durchscrollen (Lazy-Bilder, Reveal), dann Screenshot und Overflow-Prüfung.
    await page.evaluate(async () => {
      for (let y = 0; y < document.documentElement.scrollHeight; y += 600) {
        window.scrollTo(0, y);
        await new Promise((resolve) => setTimeout(resolve, 60));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(800);

    if (testInfo.project.name === "mobile") {
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, "horizontaler Overflow auf Mobilgeräten").toBeLessThanOrEqual(0);
    }

    const dir = "qa-screenshots";
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    await page.screenshot({ path: path.join(dir, `home-${testInfo.project.name}.png`), fullPage: true });

    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("Interaktion: Slider per Button und Tastatur, Marquee pausierbar", async ({ page }, testInfo) => {
    await openHome(page);

    // ---- Slider (Best Sellers)
    const slider = page.locator("scroll-slider").filter({ has: page.getByTestId("featured-slider-track") }).first();
    const track = page.getByTestId("featured-slider-track").first();
    test.skip((await track.count()) === 0, "Kein Produkt-Slider auf der Startseite");
    await track.scrollIntoViewIfNeeded();
    const scrollable = await track.evaluate((element) => element.scrollWidth > element.clientWidth + 4);
    test.skip(!scrollable, "Slider hat zu wenige Produkte zum Scrollen");

    const scrollLeft = () => track.evaluate((element) => element.scrollLeft);
    const next = slider.locator("[data-slider-next]");
    const prev = slider.locator("[data-slider-prev]");
    await expect(prev).toBeDisabled();
    await next.click();
    await expect.poll(scrollLeft, { message: "Weiter-Button scrollt nicht" }).toBeGreaterThan(0);
    await expect(prev).toBeEnabled();
    await prev.click();
    await expect.poll(scrollLeft, { message: "Zurück-Button scrollt nicht" }).toBeLessThanOrEqual(2);

    // Tastatur: fokussierter Track scrollt mit Pfeiltasten (nur Desktop – die Touch-Emulation scrollt nicht per Taste).
    await track.focus();
    await expect(track).toBeFocused();
    if (testInfo.project.name === "desktop") {
      for (let i = 0; i < 6; i += 1) await page.keyboard.press("ArrowRight");
      await expect.poll(scrollLeft, { message: "Track scrollt nicht per Tastatur" }).toBeGreaterThan(0);
    }

    // ---- Marquee
    const strip = page.getByTestId("brand-marquee");
    const toggle = page.getByTestId("brand-marquee-toggle");
    test.skip((await toggle.count()) === 0, "Kein Marken-Laufband mit Pause-Button");
    await toggle.scrollIntoViewIfNeeded();
    const trackState = () =>
      strip.locator(".brand-marquee__track").evaluate((element) => getComputedStyle(element).animationPlayState);

    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await expect(toggle).toHaveAttribute("aria-label", /\S/);
    await page.mouse.move(0, 0);
    await expect.poll(trackState).toBe("running");

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await expect(strip).toHaveClass(/is-paused/);
    await page.mouse.move(0, 0);
    await page.locator("body").focus();
    await expect.poll(trackState).toBe("paused");

    await toggle.press("Enter");
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await expect(strip).not.toHaveClass(/is-paused/);
  });
});

test.describe("Homepage – reduzierte Bewegung", () => {
  test("Marquee steht still und bricht um, keine Endlos-Animationen", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Einmal pro Lauf genügt");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openHome(page);

    const strip = page.getByTestId("brand-marquee");
    test.skip((await strip.count()) === 0, "Kein Marken-Laufband");
    await expect(page.getByTestId("brand-marquee-toggle")).toBeHidden();
    await expect(page.locator(".brand-marquee__list--clone")).toBeHidden();
    const animationName = await strip
      .locator(".brand-marquee__track")
      .evaluate((element) => getComputedStyle(element).animationName);
    expect(animationName).toBe("none");

    const infinite = await page.evaluate(() =>
      document
        .getAnimations()
        .filter((animation) => {
          const timing = animation.effect?.getComputedTiming();
          return timing?.iterations === Infinity && animation.playState === "running";
        })
        .map((animation) => (animation as CSSAnimation).animationName || "unknown")
    );
    expect(infinite, `laufende Endlos-Animationen: ${infinite.join(", ")}`).toEqual([]);
  });
});
