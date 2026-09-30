---
name: shopify-visual-qa
description: Geschlossener Visual-QA-Workflow für Shopify-Themes via Shopify CLI + Playwright. Verwende diesen Skill bei jeder Erstellung, Änderung oder Fehlerbehebung an Sections, Blocks, Snippets, Templates oder Storefront-CSS/JS — egal ob für Page-Blocks, Produktseiten, Cart, Collections, Header, Footer oder andere Storefront-Bereiche. Der Skill pickt automatisch die richtige Test-URL anhand der geänderten Datei und funktioniert mit Claude Code Web's PR-Flow, weil das Test-Theme via Shopify CLI direkt aus der Arbeits-Branch heraus aktualisiert wird. Trigger automatisch bei .liquid-Dateien, Schemas, Sections, Blocks, Snippets, Storefront-UI, oder wenn der Nutzer Begriffe wie "Block bauen", "Produktseite anpassen", "Cart umbauen", "Header ändern", "QA-Schleife", "Visual Test" nutzt.
---

# Shopify Visual QA Workflow (v5 — Homepage als Default-Test-Target)

## Architektur

Im Dev-Store gibt es zwei Themes mit zwei Aufgaben:

| Theme | Rolle | Genutzt für |
|---|---|---|
| GitHub-synced Main-Theme | UNPUBLISHED oder MAIN | „Spiegel" von main, nicht für Tests |
| Test/QA-Theme (separat) | UNPUBLISHED, CLI-pushbar | Ziel aller Playwright-Tests. Wird via Shopify CLI aus der jeweils aktuellen Arbeits-Branch gepusht. |

Die konkreten Theme-IDs stehen in `shopify.theme.toml` (development-Environment) und `tests/fixtures.ts` (themeId). Dieser Aufbau entkoppelt den Test von Git-Branches: Selbst wenn Claude Code Web zwingend PRs erzeugt, kann der QA-Loop laufen, weil das Test-Theme den Stand der Arbeits-Branch widerspiegelt.

## Wichtig: KEIN dediziertes QA-Template

Frühere Skill-Versionen verlangten eine eigene Page `/pages/qa-block-test` mit Template `qa-block-test` im Shop. **Das ist nicht mehr nötig.** Der Default-Test-Pfad ist jetzt die **Homepage `/`**, und Claude baut den neuen Block bei Bedarf temporär in das jeweilige Ziel-Template ein.

Vorteile:
- Realistischer Kontext: der Block wird neben Header/Footer und anderen Sections gerendert
- Keine Page-Verwaltung im Admin
- Erkennt „Works in isolation, breaks in real context"-Probleme
- Weniger Boilerplate im Repo

## 0 — Umgebungs-Check (einmal pro Session)

```bash
node -v && npm -v && git --version
shopify version
npx playwright --version
echo "Theme-Token: $([ -n "$SHOPIFY_CLI_THEME_TOKEN" ] && echo gesetzt || echo NEIN)"
echo "Storefront-PW: $([ -n "$SHOPIFY_STOREFRONT_PASSWORD" ] && echo gesetzt || echo NEIN)"
```

`SHOPIFY_CLI_THEME_TOKEN` ist Pflicht. `SHOPIFY_STOREFRONT_PASSWORD` ist optional — bei Live-Stores ohne Passwortschutz wird der Login automatisch geskippt.

Wenn eine Pflicht-Variable fehlt: stoppe, frag den Nutzer einmal in der Session. Niemals in eine committete Datei schreiben.

Wenn Tools fehlen: `npm install`, `npx playwright install chromium`.


## 0.5 — Repo-Config-Check (einmalig beim ersten Auftrag pro Repo)

Frisch aus dem Template geklonte Files enthalten Platzhalter, die pro Shop einmal ersetzt werden müssen. Produkt- und Collection-Handles **brauchst du nicht** zu setzen — die ermittelt der `tests/global-setup.ts` automatisch beim ersten Testlauf via `/products.json` und `/collections.json` und legt sie in `playwright/.auth/discovered.json` ab.

Was du wirklich setzen musst sind nur **zwei** Werte: die Store-Domain und die Test-Theme-ID.

```bash
grep -rn "__THEME_ID__\|__STORE_DOMAIN__\|__PROD_THEME_ID__" \
  shopify.theme.toml playwright.config.ts tests/fixtures.ts tests/global-setup.ts 2>/dev/null
```

Falls Platzhalter gefunden werden: **stoppe den Workflow** und gehe wie folgt vor.

### Schritt A — Werte ermitteln

Wenn Shopify-MCP verfügbar ist:
1. `get-shop-info` → Store-Domain (z. B. `fashion-o4ccall8.myshopify.com`)
2. `themes()` query → Test-Theme finden:
   - Bevorzugt ein UNPUBLISHED Theme mit Name "Test", "QA Preview" oder "Sandbox"
   - Sonst das erste UNPUBLISHED Theme
   - Wenn keins existiert: vorschlagen, eines via `themeDuplicate` zu erzeugen

Wenn Shopify-MCP nicht verfügbar ist: nach den zwei Werten fragen.

### Schritt B — In die Files setzen

| Datei | Platzhalter → Wert |
|---|---|
| `shopify.theme.toml` | `__STORE_DOMAIN__` → Store-Handle (ohne `.myshopify.com`); `__THEME_ID__` → Test-Theme-ID |
| `tests/fixtures.ts` | `__THEME_ID__` → Test-Theme-ID |
| `playwright.config.ts` | `__STORE_DOMAIN__` → Store-Handle |
| `tests/global-setup.ts` | `__STORE_DOMAIN__` → Store-Handle |

Produkt- und Collection-Handles **nicht** hardcoden — sie werden zur Laufzeit automatisch aus dem aktuell verbundenen Shop ermittelt.

### Schritt C — Verifizieren

- Keine `__...__`-Platzhalter mehr in den vier Files
- Store-Domain ist überall identisch
- Falls Shopify-MCP verfügbar: `get-shop-info` bestätigt Übereinstimmung mit dem hardcoded Wert

Erst dann mit Schritt 1 weitermachen. Beim ersten Test-Lauf legt global-setup.ts dann `discovered.json` an mit dem ersten Produkt/Collection aus dem Shop — ab da nutzt der Workflow diese Werte automatisch.


## 1 — Test-Ziel-URL bestimmen

Bevor du den Code schreibst, entscheide klar, **gegen welche URL** der Block getestet wird. Logik in dieser Reihenfolge prüfen:

### 1.1 Hat der Nutzer ein konkretes Ziel-Template genannt?

Beispiele aus User-Prompts:
- „Bau das auf die Produktseite" → `QA.paths.product`
- „Pack das in den Cart" → `QA.paths.cart`
- „Footer-Anpassung" → `QA.paths.home` (Footer ist überall sichtbar, Homepage reicht)
- „Header" → `QA.paths.home`
- „Für die Kontaktseite" → existierende Kontakt-Page-URL falls vorhanden

### 1.2 Folgt das Ziel-Template aus dem Datei-Pfad?

| Geänderte Datei | Default Test-URL |
|---|---|
| `sections/product-*.liquid`, `templates/product.json`, `snippets/product-*.liquid` | `QA.paths.product` |
| `sections/cart-*.liquid`, `templates/cart.json` | `QA.paths.cart` |
| `sections/collection-*.liquid`, `templates/collection.json` | `QA.paths.collection` |
| `sections/search.liquid`, `templates/search.json` | `QA.paths.search` |
| `sections/404.liquid` | `QA.paths.notFound` |
| `sections/header*.liquid`, `sections/footer*.liquid`, `layout/theme.liquid` | `QA.paths.home` |
| Sonstige Sections/Blocks ohne klare Zugehörigkeit | **`QA.paths.home` als Default** |

### 1.3 Wenn die Ziel-Page nicht existiert

Falls der Nutzer eine Page nennt, die nicht existiert (z. B. „testen auf Service-Page" aber `/pages/services` ist nicht im Shop): **fallback auf `QA.paths.home`** und im Status klar dem Nutzer kommunizieren:

```
Die Page /pages/services existiert noch nicht im Shop. Test gegen
Homepage als Fallback. Falls du willst, dass die Service-Page existiert,
sag Bescheid — dann lege ich sie via Shopify-MCP (oder im Admin) an,
bevor wir testen.
```

### 1.4 Kein dediziertes QA-Template mehr erzeugen

Niemals eine neue `qa-*.json`-Template-Datei anlegen. Niemals eine neue Page im Shop-Admin für QA-Zwecke vorschlagen, es sei denn der Nutzer fragt explizit danach.

## 2 — Workflow pro Aufgabe

### 2.1 Komponente implementieren

**Schema, Block-Wrapper, Editor-Safe-JS, Mobile-first CSS** — Standard-Regeln aus `shopify-liquid` Skill:

- `default`-Werte für jede Setting
- `presets` falls hinzufügbar
- `{{ block.shopify_attributes }}` auf Block-Wrappern
- `shopify:section:load`, `shopify:section:unload`, `shopify:block:select` Events handeln
- Kein horizontaler Scroll bei Viewports ≥ 320px
- `prefers-reduced-motion` Block in jeder CSS-Datei mit Animations
- `color_scheme` Setting Pflicht

### 2.2 Block ins Ziel-Template einbauen (temporär)

**Nur wenn** der Block auf der Ziel-Page sichtbar sein muss, um ihn zu testen. Das ist für Page-Templates und Index-Template typisch. Bei Produkt/Cart/Collection ist es oft nicht nötig, weil die Sections schon dort eingebaut sind.

Beispiel für Homepage-Test (Section-Eintrag in `templates/index.json` ergänzen):

```json
{
  "sections": {
    "qa_new_block": {
      "type": "your-section-handle",
      "settings": { /* realistische Dummy-Werte */ }
    },
    ... bestehende Sections ...
  },
  "order": ["qa_new_block", ... bestehender order ...]
}
```

**Realistische Dummy-Werte:** echte Headlines wie „Wir bauen Möbel, die bleiben", echte Button-Labels. Keine Lorem-Ipsums, keine „Test Test"-Strings.

**Hinweis im PR:** Diesen temporären Eintrag im PR markieren oder vor dem Merge entfernen, falls er nicht in main soll. Im Test-Theme bleibt der Eintrag stehen — das ist okay, Test-Theme ist Sandbox.

### 2.3 Block-spezifischen Playwright-Test schreiben

`tests/blocks/<component-handle>.spec.ts` anlegen oder updaten. Importiere `fixtures`:

```ts
import { test, expect } from "@playwright/test";
import { QA, withTheme } from "../fixtures";

test.describe("<component-handle>", () => {
  test("…", async ({ page }) => {
    await page.goto(withTheme(QA.paths.home)); // oder die richtige Ziel-URL aus Schritt 1
    // Assertions
  });
});
```

Testpattern nach Komponente:

| Komponente | Was getestet wird |
|---|---|
| Slider | next/prev, Slide-Wechsel, Loop |
| Accordion | open/close pro Item, `aria-expanded` |
| Tabs | Panel-Wechsel, nur eins sichtbar |
| Video | Player initialisiert, Controls vorhanden |
| Button mit Link | href stimmt mit Schema-Setting |
| Form | Felder fillable, Submit erreichbar (nicht echt absenden) |
| Variant-Switcher | Klick auf Variante ändert Preis/SKU |
| Add-to-Cart | Klick ergibt `cart.added`-Toast oder Cart-Drawer |

Generika aus `tests/_base.spec.ts` nicht duplizieren — die laufen ohnehin.

### 2.4 Cart-Tests speziell

Cart braucht einen Vorzustand: ein Produkt muss drin sein. Im Test selbst:

```ts
test.beforeEach(async ({ page, context }) => {
  await context.request.post(withTheme("/cart/add.js"), {
    headers: { "Content-Type": "application/json" },
    data: { items: [{ id: <VARIANT_ID>, quantity: 1 }] },
  });
});
```

Variant-ID aus `tests/fixtures.ts` ziehen, falls dort definiert.

### 2.5 Push zum Test-Theme + Tests

```bash
shopify theme check
shopify theme push -e development --nodelete
npx playwright test
```

`--nodelete` schützt vor versehentlichen Löschungen, wenn die Branch unvollständig ist.

### 2.6 Korrekturschleife

Bei rotem Test:
- Screenshots aus `qa-screenshots/` ansehen
- HTML-Report unter `playwright-report/index.html`
- Konsole + DOM des fehlschlagenden Elements

Maximal **drei** Iterationen. Danach Stopp + Statusbericht.

Niemals mit roten Tests committen.

### 2.7 Git-Commit und Push

```bash
git add .
git commit -m "<type>: <komponente> - <kurzbeschreibung>"
git push
```

Claude Code Web öffnet einen PR. Das ist gewollt — der Nutzer reviewt und mergt.

Commit-Typen: `feat`, `fix`, `refactor`, `chore`, `style`, `perf`.

## 3 — Production-Push (nur auf explizite Anforderung)

Wie zuvor. Production-Push passiert nie automatisch.

`ignore`-Liste in `shopify.theme.toml` muss QA-Pfade ausschließen.

## 4 — Sicherheitsregeln

- `SHOPIFY_CLI_THEME_TOKEN` und `SHOPIFY_STOREFRONT_PASSWORD` niemals in committete Files, Commit-Messages, Logs
- Wenn fehlt: in Session beim Nutzer erfragen
- `playwright/.auth/` ist gitignored
- Test-Fixtures aus `tests/fixtures.ts` nicht ohne Grund löschen oder umbenennen

## 5 — Schnellreferenz

| Situation | Aktion |
|---|---|
| Neuer Block ohne klares Ziel-Template | 2.1, 2.2 (in `templates/index.json`), 2.3 mit `QA.paths.home`, 2.5–2.7 |
| Section für die Homepage | 2.1, 2.2, 2.3 mit `QA.paths.home`, 2.5–2.7 |
| Product-Page-Anpassung | 2.1, 2.3 mit `QA.paths.product`, 2.5–2.7 |
| Cart-Anpassung | 2.1, 2.3 + 2.4 beforeEach mit `QA.paths.cart`, 2.5–2.7 |
| Collection-Anpassung | 2.1, 2.3 mit `QA.paths.collection`, 2.5–2.7 |
| Header/Footer/Layout-Änderung | 2.1, 2.3 mit `QA.paths.home`, 2.5–2.7 |
| Search/404 | 2.1, 2.3 mit `QA.paths.search`/`notFound`, 2.5–2.7 |
| Ziel-Page existiert nicht | Fallback `QA.paths.home`, Nutzer informieren |
| Production-Deploy | 3, nur auf Anforderung |
| ENV-Variable fehlt | 0, Nutzer fragen |

## 6 — Was sich von früheren Versionen geändert hat

- **Kein dediziertes QA-Template mehr.** `templates/page.qa-block-test.json` muss nicht mehr existieren. Tests laufen direkt gegen die Homepage oder das jeweilige Ziel-Template
- **Default-Test-URL ist Homepage `/`**, nicht mehr `/pages/qa-block-test`
- **Block-Einbau geschieht im Ziel-Template** (z. B. `templates/index.json`), nicht in einem QA-Template
- **`SHOPIFY_STOREFRONT_PASSWORD` ist optional** — global-setup macht Auto-Skip bei Live-Stores ohne Passwortschutz
- **Fallback-Strategie** für nicht existierende Ziel-Pages explizit dokumentiert
