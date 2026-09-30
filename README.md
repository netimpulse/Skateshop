# Shopify Theme Template

Template-Repo fuer neue Shopify-Themes mit integriertem Visual-QA-Workflow
(Shopify CLI + Playwright). Ein Repo = ein Theme = ein Shop.

## Was hier drin ist

- `package.json` – Dependencies & npm-Scripts
- `playwright.config.ts` – Test-Runner Konfiguration mit hardcoded Preview-URL
- `tests/_base.spec.ts` – Generische Visual-Tests, die fuer jeden Block laufen
- `templates/page.qa-block-test.json` – QA-Page Inhalt (wird von Claude pro Block ueberschrieben)
- `shopify.theme.toml` – Shopify CLI Config mit Dev-/Prod-Environments
- `.gitignore`, `.env.example` – Standard-Boilerplate
- `ignore`-Block in `shopify.theme.toml` – verhindert, dass QA-Dateien beim Production-Push landen

Skeleton-Theme-Dateien (sections, snippets, layout, assets) werden ueber den
`/neuer-shop` Skill oder per Hand ergaenzt.

## Erstes Setup eines neuen Repos

1. Repo aus diesem Template anlegen (GitHub: "Use this template")
2. Skeleton-Theme reinkopieren bzw. mergen
3. Dependencies installieren:
   ```bash
   npm install
   npx playwright install chromium
   ```
4. Shopify CLI authentifizieren (Token aus Theme Access App):
   ```bash
   export SHOPIFY_CLI_THEME_TOKEN=shptka_xxx
   ```
5. Erstes Push als unpublished Theme:
   ```bash
   npm run theme:push:dev
   ```
   Theme-ID aus der CLI-Ausgabe merken.
6. Theme-ID einsetzen in:
   - `shopify.theme.toml` -> `theme = "..."`
   - `playwright.config.ts` -> `preview_theme_id=...` (Platzhalter `__THEME_ID__` ersetzen)

## Im Dev-Store einmalig pro Theme

Damit Playwright eine echte URL ansprechen kann, muss die QA-Page existieren:

1. Online Store -> Pages -> "QA Block Test" anlegen
2. Theme-Template auf `qa-block-test` setzen (rechte Seitenleiste)
3. Page veroeffentlichen

## QA-Workflow pro Block

```bash
# 1) Code-Aenderung commiten
# 2) Theme pushen (aktualisiert das Dev-Theme im Store)
shopify theme push -e development

# 3) Komplett-Check
npm run qa:full
```

`qa:full` laeuft `theme check` + Playwright Tests.

## Production-Push

In `shopify.theme.toml` den Production-Block ausfuellen, dann:

```bash
shopify theme push -e production
```

Der `ignore`-Block sorgt dafuer, dass weder QA-Templates noch Tests ins
Production-Theme uebertragen werden.
