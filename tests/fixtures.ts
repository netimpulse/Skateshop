import * as fs from "fs";
import * as path from "path";

/**
 * Test-Fixtures fuer den Visual-QA-Workflow.
 *
 * Produkt- und Collection-Handles werden ZUR LAUFZEIT vom global-setup
 * automatisch aus dem aktuell verbundenen Shop ermittelt (via /products.json
 * und /collections.json) und in playwright/.auth/discovered.json abgelegt.
 *
 * Diese Datei liest discovered.json beim Modul-Load. Falls die Datei
 * (noch) nicht existiert, kommen sichere Defaults zum Einsatz:
 *   - product:    Fallback auf /collections/all (zeigt alle Produkte)
 *   - collection: "all" (Shopify-Default, existiert immer)
 *
 * Was du pro Shop noch setzen musst:
 *   - themeId in shopify.theme.toml und ggf. hier (via ENV SHOPIFY_TEST_THEME_ID
 *     oder direkter Ersatz von __THEME_ID__)
 *   - STORE_DOMAIN in playwright.config.ts und tests/global-setup.ts
 */

const discoveredPath = path.resolve("playwright/.auth/discovered.json");

type Discovered = {
  productHandle?: string | null;
  collectionHandle?: string | null;
  firstVariantId?: number | null;
};

const discovered: Discovered = (() => {
  try {
    if (fs.existsSync(discoveredPath)) {
      return JSON.parse(fs.readFileSync(discoveredPath, "utf-8"));
    }
  } catch {
    /* ignore */
  }
  return {};
})();

export const QA = {
  /** Test-Theme-ID (UNPUBLISHED). Pro Shop einmalig setzen. */
  themeId: process.env.SHOPIFY_TEST_THEME_ID || "164173611123",

  /** Erstes Produkt aus dem Shop, automatisch ermittelt. */
  product: {
    handle: discovered.productHandle || "",
  },

  /** Erste Collection aus dem Shop, automatisch ermittelt. Default "all". */
  collection: {
    handle: discovered.collectionHandle || "all",
  },

  /** Erste Variant-ID des ersten Produkts, fuer Cart-Tests. */
  firstVariantId: discovered.firstVariantId || null,

  /** Mapping: Template-Typ -> Pfad. */
  paths: {
    home: "/",
    qaBlock: "/",
    product: discovered.productHandle
      ? `/products/${discovered.productHandle}`
      : "/collections/all",
    collection: `/collections/${discovered.collectionHandle || "all"}`,
    cart: "/cart",
    search: "/search?q=test",
    notFound: "/this-page-does-not-exist",
  },
};

export function withTheme(p: string): string {
  const sep = p.includes("?") ? "&" : "?";
  return `${p}${sep}preview_theme_id=${QA.themeId}`;
}

/**
 * Konsolen-/Netzwerkmeldungen der Shopify-Plattform (Preview-Bar, shop.app, Analytics, Login-with-Shop),
 * die nicht vom Theme stammen und in Tests ignoriert werden.
 */
const PLATFORM_NOISE = [
  /shop\.app/i,
  /login_with_shop/i,
  /\/api\/collect/i,
  /monorail/i,
  /web-pixels/i,
  /ShopifySans/i,
  /frame-ancestors/i,
  /status of 403/i,
  /status of 404 \(Not Found\)$/i,
  /preview_bar|previewBar|admin-bar/i,
  /Failed to load resource: net::ERR_/i,
  // Store throttling (Cloudflare/Shopify rate limit) – the theme handles it (e.g. builder retry button), not a theme error.
  /status of 429 \(Too Many Requests\)/i,
];

export function isPlatformNoise(message: string): boolean {
  return PLATFORM_NOISE.some((pattern) => pattern.test(message));
}

/** Sammelt Konsolenfehler und Page-Errors, die vom Theme stammen. */
export function collectThemeErrors(page: import("@playwright/test").Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" && !isPlatformNoise(message.text())) errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

/** Demo-Daten aus scripts/demo-data (Tag skate-demo) – Handles für gezielte Tests. */
export const DEMO = {
  builderPath: "/pages/skateboard-builder",
  deckWithThreeWidths: "nine-ply-co-sunset-stripe-deck",
  wheelWith58mm: "rolltype-cruiser-soft-wheels",
  soldOutVariant: { handle: "nine-ply-co-checker-classic-deck", title: '7.75"' },
  lowStockHandle: "gritfield-curb-wax",
  collections: ["decks", "trucks", "wheels", "bearings", "griptape", "hardware", "risers", "completes", "accessories"],
};
