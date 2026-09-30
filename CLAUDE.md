# CLAUDE.md – Shopify Theme

> Diese Datei wird bei jeder Claude-Code-Session automatisch geladen.
> Sie ist das Gedächtnis des Projekts: Architektur, Konventionen und vor allem
> der Abhängigkeits-Log, damit Claude beim Bauen eines Teils weiß, was später
> daran hängt.

---

## ⚠️ MEMORY-PFLEGE – IMMER BEFOLGEN

Diese Regel hat hohe Priorität. Befolge sie bei JEDER Code-Änderung.

**Nach jedem implementierten oder geänderten Feature gilt:**

1. Prüfe, ob das Feature mit anderen Theme-Teilen zusammenhängt
   (Kundenkonto, Metafields, Header, Cart, Checkout, Routes, globale JS/CSS).
2. Falls ja: trage es SOFORT unter `## Architektur & Abhängigkeiten` ein –
   bevor du die Aufgabe als erledigt meldest.
3. Aktualisiere bestehende Einträge, wenn sich eine Abhängigkeit ändert.
   Lösche nichts, was noch im Code aktiv ist.
4. Pro Eintrag dokumentierst du AUSFÜHRLICH:
   - **Feature** – Name
   - **Dateien** – betroffene Sections/Snippets/Assets (mit Pfad)
   - **Hängt an** – Objekte, Metafields, Routes, globale Funktionen
   - **Wird genutzt von** – welche anderen Teile darauf zugreifen (müssen)
   - **Offen / To-do** – noch fehlende Anbindungen oder Risiken
   - **Stand** – Datum der letzten Änderung
5. Wenn etwas eine spätere Anbindung erfordert, die noch nicht existiert,
   notiere sie unter `## Offene Abhängigkeiten (To-do)`, damit sie nicht
   vergessen wird.

Bei Unsicherheit, ob etwas eingetragen werden soll: lieber eintragen.

---

## Projekt-Überblick

- **Plattform:** Shopify (Online Store 2.0 / Liquid)
- **Theme-Basis:** Custom-Theme „Kerbside“ auf Basis Shopify Skeleton (OS 2.0, JSON-Templates, Section Groups)
- **Zweck / Shop:** Skateboard-Onlineshop (Decks, Trucks, Wheels, Bearings, Griptape, Hardware, Completes) mit Board-Builder unter `/pages/skateboard-builder`. Storefront DE (Standard) + EN.
- **Design:** „Clean White + light Retro“ – Weiß, Anthrazit, ein Signal-Akzent, Mono-Labels, Sticker-Badges (Details: Abschnitt Konventionen).

## Konventionen

- CSS wird pro Section gescoped (keine globalen Klassen-Kollisionen).
- Keine Inline-Styles.
- Snippets für wiederverwendbare Bausteine, Sections für Seitenblöcke.
- Kundengebundene Daten laufen über `customer.metafields` (Namespace unten notieren).
- Keine `style="…"`-Attribute (auch nicht in SVG): Werte aus Settings über `{% style %}` mit `#shopify-section-{{ section.id }}`
  bzw. `snippets/section-style.liquid`; Farben in SVG über Klassen oder `fill="#hex"`, nie `fill="var(--x)"`.
- Farben nur über Farbschemata (`color_scheme`-Setting → Klasse `color-scheme-N` + `scheme`) und die Akzent-Variablen `--color-accent-1…5`.
- CSS: `assets/theme.css` (Reset, Tokens-Nutzung, Utilities, Buttons, Formulare, Badges), Feature-CSS als `section-*.css` /
  `component-*.css`, geladen in der jeweiligen Section. `component-product-card.css` lädt global im Layout.
- JS: Vanilla ES-Module über die Import-Map in `layout/theme.liquid` (`@theme/<name>`); jedes `assets/*.js` muss dort stehen.
  Routen nie hartcodieren – `routes` aus `@theme/utils` (liest `#theme-config`).
- Texte: Storefront-Strings in `locales/de.default.json` + `locales/en.json` (identische Keys, `npm run validate` prüft);
  Schema-Labels als deutscher Klartext. Liquid-Falle: `'key' | t` immer erst `assign`en, bevor weitere Filter folgen.
- Prüfen vor jedem Commit: `npm run validate` und `shopify theme check` (0 Errors). Test-Theme: „Skateshop QA“ (164173611123),
  niemals auf „QA Preview“ (live) pushen.

---

## Architektur & Abhängigkeiten

> Der zentrale Abhängigkeits-Log. Hier trägt Claude laufend ein,
> welches Feature mit welchem zusammenhängt (siehe Memory-Pflege-Regel oben).

### Fundament: Settings, Tokens, Layout
- **Dateien:** `config/settings_schema.json`, `config/settings_data.json` (6 Farbschemata), `snippets/css-variables.liquid`,
  `layout/theme.liquid`, `layout/password.liquid`, `assets/theme.css`, `snippets/meta-tags.liquid`, `snippets/section-style.liquid`,
  `snippets/section-heading.liquid`, `snippets/icon.liquid`, `snippets/graphic.liquid`, `snippets/image.liquid`,
  `snippets/placeholder-skate.liquid`, `snippets/breadcrumbs.liquid`, `blocks/group.liquid`, `blocks/text.liquid`
- **Hängt an:** Theme-Settings (Fonts `archivo_n8`/`archivo_n4`/`ibm_plex_mono_n5`, Akzente, `color_schemes`), `routes.*`,
  `shop.money_format`, Import-Map (`@theme/*`), `#theme-config` (Routes, Money-Format, Strings, cartType)
- **Wird genutzt von:** allen Sections/Snippets (CSS-Variablen, Scheme-Klassen, Utilities), allen JS-Modulen (`@theme/utils`)
- **Offen / To-do:** –
- **Stand:** 2026-09-30

### Globale JS-Basis und Cart-Kern
- **Dateien:** `assets/utils.js` (Config, Money, Events, Fetch, Storage), `assets/theme.js` (Dialoge, `disclosure-nav`,
  `sticky-header`, `scroll-slider`, `marquee-strip`, `parallax-media`, Reveal), `assets/cart.js` (`addItems`, `changeLine`,
  `updateLines`, `getCart`, `<product-form>`), `assets/cart-drawer.js`, `sections/cart-drawer.liquid`, `sections/cart-count.liquid`,
  `snippets/cart-count.liquid`
- **Hängt an:** Ajax Cart API (`routes.cart_add_url` usw. + `.js`), Section Rendering (`cart-drawer`, `cart-count`, `[data-cart-section]`),
  Event `cart:updated` / `cart:error` / `variant:changed` auf `document`, Dialog-Trigger `[data-dialog-open="<id>"]`
- **Wird genutzt von:** Header (Cart-Count, Drawer-Öffner `#CartDrawer`), Produktkarte (Quick Add), PDP, Cart-Seite, Board-Builder
- **Offen / To-do:** –
- **Stand:** 2026-09-30

### Produktkarte
- **Dateien:** `snippets/product-card.liquid`, `snippets/product-badge.liquid`, `snippets/price.liquid`, `snippets/quick-add.liquid`,
  `snippets/swatch.liquid`, `assets/component-product-card.css`
- **Hängt an:** Settings `card_*`, `badge_tag_*`, `new_badge_days`; Tags (new/bestseller/limited), `compare_at_price`,
  Option „Farbe/Color“ (Shopify-Swatches oder Namens-Fallback), `custom.builder_category` (Placeholder-Art), `<product-form>`
- **Wird genutzt von:** Homepage (featured-products), Collection, Suche, PDP (Related, Recently Viewed via `product.card`)
- **Offen / To-do:** –
- **Stand:** 2026-09-30

### Wishlist / Favoriten (Vorlage – NICHT umgesetzt)
> Beispiel-Eintrag aus der Projektvorlage. Im Code existiert keine Wishlist (Stand 2026-09-30); nicht Teil des Theme-Auftrags.

- **Dateien:**
  - `snippets/wishlist-button.liquid` (Button auf der Produkt-Detailseite)
  - <!-- ggf. assets/wishlist.js, snippets/wishlist-counter.liquid -->
- **Hängt an:**
  - `customer` object (nur eingeloggte Kunden)
  - Metafield: `customer.metafields.custom.wishlist` <!-- Namespace/Key prüfen/ergänzen -->
- **Wird genutzt von:**
  - **Header** → Wishlist-Counter liest dasselbe Metafield
  - **Account-Seite** → zeigt gespeicherte Favoriten an
- **Offen / To-do:**
  - Header-Counter noch anbinden
  - Verhalten für nicht-eingeloggte Besucher klären (Login-Prompt vs. lokal)
- **Stand:** <!-- Datum -->

<!--
VORLAGE für neue Einträge – kopieren und ausfüllen:

### <Feature-Name>
- **Dateien:** <Pfade>
- **Hängt an:** <Objekte / Metafields / Routes / globale Funktionen>
- **Wird genutzt von:** <welche anderen Teile darauf zugreifen>
- **Offen / To-do:** <fehlende Anbindungen, Risiken>
- **Stand:** <Datum>
-->

---

## Offene Abhängigkeiten (To-do)

> Geplante Verbindungen, die noch nicht im Code existieren.
> Claude trägt hier ein, was später noch verdrahtet werden muss.

- [ ] (Nur falls Wishlist beauftragt wird) Header: Wishlist-Counter an `customer.metafields.custom.wishlist` anbinden

---

## Metafields & Namespaces (Referenz)

| Namespace.Key | Typ | Verwendung |
|---|---|---|
| `custom.wishlist` | list / json | Gespeicherte Favoriten pro Kunde |
| <!-- weitere --> | | |
