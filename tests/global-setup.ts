import { chromium, FullConfig } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

/**
 * Globaler Setup-Schritt vor allen Playwright-Tests.
 *
 * 1) Loggt sich falls noetig durch den Storefront-Passwortschutz
 * 2) Ermittelt automatisch das erste Produkt und die erste Collection
 *    aus dem Shop via /products.json und /collections.json
 * 3) Speichert die Werte in playwright/.auth/discovered.json,
 *    von wo tests/fixtures.ts sie zur Laufzeit liest
 * 4) Persistiert die Storefront-Session als storageState
 *
 * STORE_DOMAIN muss pro Shop angepasst werden — sonst stoppt Schritt 0.5
 * des shopify-visual-qa Skills.
 */
export default async function globalSetup(_config: FullConfig) {
  const STORE_BASE = "https://__STORE_DOMAIN__.myshopify.com";
  const password = process.env.SHOPIFY_STOREFRONT_PASSWORD;

  const authDir = path.resolve("playwright/.auth");
  if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  // 1) Storefront-Passwort-Login (falls Passwort gesetzt UND aktiv)
  if (password) {
    try {
      await page.goto(`${STORE_BASE}/password`, { waitUntil: "networkidle" });
      const hasPasswordForm = await page.locator('input[type="password"]').count() > 0;
      if (hasPasswordForm) {
        await page.locator('input[type="password"]').first().fill(password);
        await page.locator('form button[type="submit"]').first().click();
        await page.waitForURL((url) => !url.pathname.startsWith("/password"), { timeout: 15_000 });
      }
    } catch (e) {
      console.warn("Storefront-Login uebersprungen:", (e as Error).message);
    }
  }

  // 2) Auto-Discovery: erstes Produkt und erste Collection
  const discovered: {
    productHandle: string | null;
    collectionHandle: string | null;
    firstVariantId: number | null;
  } = {
    productHandle: null,
    collectionHandle: null,
    firstVariantId: null,
  };

  try {
    const res = await page.request.get(`${STORE_BASE}/products.json?limit=1`);
    if (res.ok()) {
      const data = await res.json();
      const first = data.products?.[0];
      if (first) {
        discovered.productHandle = first.handle;
        discovered.firstVariantId = first.variants?.[0]?.id ?? null;
      }
    }
  } catch (e) {
    console.warn("Produkt-Discovery uebersprungen:", (e as Error).message);
  }

  try {
    const res = await page.request.get(`${STORE_BASE}/collections.json?limit=1`);
    if (res.ok()) {
      const data = await res.json();
      const first = data.collections?.[0];
      if (first) {
        discovered.collectionHandle = first.handle;
      }
    }
  } catch (e) {
    console.warn("Collection-Discovery uebersprungen:", (e as Error).message);
  }

  fs.writeFileSync(
    path.join(authDir, "discovered.json"),
    JSON.stringify(discovered, null, 2)
  );
  console.log("Discovered fixtures:", JSON.stringify(discovered));

  // 3) Storage State persistieren
  await context.storageState({ path: path.join(authDir, "storefront.json") });
  await browser.close();
}
