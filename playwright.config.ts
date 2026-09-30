import { defineConfig, devices } from "@playwright/test";

/**
 * Visual-QA Konfiguration (Template).
 *
 * baseURL muss pro Shop angepasst werden. Schritt 0.5 des
 * shopify-visual-qa Skills detektiert den Platzhalter und stoppt
 * den Workflow, bis der echte Wert gesetzt ist.
 */
export default defineConfig({
  testDir: "./tests",
  testIgnore: ["**/global-setup.ts", "**/fixtures.ts", "**/unit/**"],
  timeout: 30_000,
  retries: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  globalSetup: "./tests/global-setup.ts",
  use: {
    baseURL: "https://dev-store-4ogqgshg.myshopify.com",
    storageState: "playwright/.auth/storefront.json",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "mobile",  use: { ...devices["iPhone 13"] } },
  ],
});
