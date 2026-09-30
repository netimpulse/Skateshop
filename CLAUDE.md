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
  Text auf Akzentflächen (Badges, Zähler, Fit-Labels) immer mit `--color-accent-N-label` (Weiß oder Ink, was stärker kontrastiert),
  nie mit festem `#fff` – Händler können die Akzente frei wählen.
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
- **Details:**
  - `css-variables.liquid` berechnet `--color-accent-1…5-label` per `color_contrast` gegen Weiß und die Textfarbe des ersten
    Schemas (Ink). Nutzer: `.badge--new/sale/bestseller/limited` (theme.css), `.bb-fit--*` (board-builder.css),
    Filter-Zähler (component-facets.css).
  - `section-heading.liquid` mappt die zulässigen url-Defaults `/collections` → `routes.collections_url` und
    `/collections/all` → `routes.all_products_collection_url` (sprachbewusst). Andere relative Links bleiben unverändert.
  - Kontrast der Schemata (WCAG AA): scheme-2 Link `#B8391B`, scheme-4 Text gedämpft `#FFFFFF` (vorher < 4.5:1).
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

### Header-Gruppe: Ankündigungsleiste, Header, Mega-Menü, Mobile-Navigation
- **Dateien:** `sections/header-group.json` (announcement-bar + header), `sections/announcement-bar.liquid`, `sections/header.liquid`,
  `snippets/header-mega-menu.liquid`, `snippets/header-drawer.liquid`, `snippets/header-search.liquid` (Such-Dialog, siehe unten),
  `assets/section-header.css` (lädt auch die Ankündigungsleiste)
- **Hängt an:**
  - Menü: Section-Setting `menu` (Group-Wert `skate-main-menu`), Fallback in Liquid `linklists['skate-main-menu']` → `linklists['main-menu']`.
    Punkte mit Unterpunkten → Mega-Menü (Spalten aus Unterpunkten; Unterpunkte ohne eigene Kinder bilden eine Spalte „Kategorien“).
  - Blocks `mega_promo` (Setting `menu_item` = Titel des Hauptmenüpunkts, Vergleich getrimmt/klein) → Kachel im Panel.
  - Setting `highlight_item` (Default „Konfigurator“) = Menüpunkt-Titel mit Akzent-Quadrat (Desktop + Drawer).
  - `theme.js`: `<sticky-header data-sticky>` (setzt `--header-height`, Klasse `is-scrolled`), `<disclosure-nav data-hover>`
    (Buttons `aria-expanded`/`aria-controls`, Panels `hidden`, Items `[data-disclosure-item]`), Dialog-Öffner `[data-dialog-open]`.
    Hover öffnet ein Panel „vorläufig“ (`openedByHover`); ein Klick danach lässt es offen statt es zu schließen.
    Fokus-Rückgabe nach Dialogen: Öffner, falls sichtbar → zugehöriges `<details>`-Summary → `[data-focus-key]` → `#MainContent`.
  - Sticky: `{% style %}` setzt `position: sticky` auf `#shopify-section-<header-id>` (Wrapper, sonst wirkt sticky nicht).
  - Globale Settings: `logo`, `logo_width`, `cart_type` (bei `drawer` → `data-dialog-open="CartDrawer"`), `predictive_search_enabled`,
    `social_*` (Drawer-Fuß über `social-links`), `shop.customer_accounts_enabled` (Konto-Link nur dann, `routes.account_url`).
  - `snippets/cart-count.liquid` (Zähler; Update per Section Rendering `cart-count` in cart.js über `[data-cart-count]`).
  - CTA: Settings `cta_label`/`cta_link` (Group-Wert `shopify://pages/skateboard-builder`, Fallback `pages['skateboard-builder'].url`).
  - Icons nur aus `snippets/icon.liquid` (die Asset-SVGs `icon-account.svg`/`icon-cart.svg` wurden gelöscht).
  - Locales: `header.*`, genutzt außerdem `accessibility.open_menu|close_menu|close`, `general.search|account|log_in`, `cart.title`.
- **Wird genutzt von:** jeder Seite (Header-Gruppe im Layout); `#CartDrawer` (sections/cart-drawer.liquid, Agent F) wird vom
  Warenkorb-Icon geöffnet; `#MenuDrawer` und `#SearchDialog` sind feste IDs (nur einmal pro Seite, Header-Section also nur einmal verwenden).
  Tests: `tests/header-search.spec.ts` (data-testid `header-menu-toggle`, `header-search`, `header-cart`, `header-account`,
  `mega-trigger`, `mega-panel`, `menu-drawer`).
- **Offen / To-do:**
  - Keine H1 im Header (Startseiten-H1 liegt im Hero) – Sections mit Seiten-H1 müssen das selbst sicherstellen.
  - (erledigt) Mega-Menü öffnet im Theme-Editor bei Auswahl eines `mega_promo`-Blocks (`shopify:block:select` in theme.js).
  - Platzbudget der Desktop-Zeile (getestet 990–1440 px mit 8 Menüpunkten, Shopname „Dev Store“): Aktions-Labels
    (Suche/Konto/Warenkorb) und 14-px-Nav erst ab 1400 px, CTA ab 1200 px, darunter Icons + versteckte Labels.
    Mehr als ~8 Hauptpunkte oder ein sehr langer Textlogo-Name können die Zeile zwischen 990 und 1200 px sprengen.
  - Ankündigungsleiste: Meldungen nebeneinander erst ab 1200 px; darunter je nach Setting nur die erste Meldung
    oder ein horizontal scrollbarer Streifen (kein Autoplay).
- **Stand:** 2026-09-30

### Predictive Search (Such-Dialog)
- **Dateien:** `snippets/header-search.liquid` (`<dialog id="SearchDialog">` mit Formular und `<predictive-search>`),
  `sections/predictive-search.liquid` (Ergebnis-HTML, nur per Section Rendering), `assets/predictive-search.js` (`@theme/predictive-search`),
  `assets/component-predictive-search.css`
- **Hängt an:**
  - `routes.predictiveSearch` / `routes.search` aus `@theme/utils` (`#theme-config`), `debounce`, `interpolate`, `parseHTML`.
  - Request: `routes.predictive_search_url?q=…&resources[type]=product,collection,query,page&resources[limit]=6&resources[limit_scope]=each&section_id=predictive-search`
    (`Accept: text/html`); übernommen wird nur `[data-predictive-content]` (DOMParser), `data-result-count` für die aria-live-Statusmeldung.
  - Liquid-Objekt `predictive_search` (products/collections/pages/queries), Snippets `price` und `placeholder-skate`
    (Art aus `product.metafields.custom.builder_category`), Produktbild `featured_media` (alt="" im Link, Titel folgt als Text).
  - Theme-Settings `predictive_search_enabled` (aus → nur normales GET-Formular, Modul wird nicht geladen),
    `predictive_search_show_price`, `predictive_search_show_vendor`; Kategorie = `product.type`.
  - Header-Setting `popular_searches` (kommagetrennt) → Chips im leeren Dialog.
  - Fehler 417/429/Netzwerk → Hinweis + Link zur Suchseite (`options[prefix]=last`). Enter im Feld → Suchseite.
  - Locales: `search.predictive.*`; genutzt außerdem `search.placeholder`, `search.submit` (Agent C).
- **Wird genutzt von:** Header (Such-Icon `data-dialog-open="SearchDialog"`, ohne JS normaler Link zur Suchseite). Das Element
  `<predictive-search>` ist wiederverwendbar (erwartet `input[name="q"]`, `[data-predictive-results]`, `[data-predictive-status]`,
  optional `[data-predictive-empty]`, `[data-predictive-clear]`, `[data-predictive-spinner]`, `[data-predictive-config]`);
  außerhalb eines Dialogs leert Escape die Ergebnisse.
- **Offen / To-do:** Query-Vorschläge liefert Shopify nur für manche Shop-Sprachen (Englisch); Such-Ergebnisseite selbst gehört zu Agent C.
- **Stand:** 2026-09-30

### Footer-Gruppe
- **Dateien:** `sections/footer-group.json`, `sections/footer.liquid`, `snippets/social-links.liquid`, `assets/section-footer.css`
  (enthält auch die Basis-Styles von `social-links`)
- **Hängt an:**
  - Blocks `brand` (Logo `settings.logo`/Shopname, Richtext, `.tri-stripe`), `links` (Überschrift + `link_list`; Group-Werte
    `skate-footer-shop`, `skate-footer-help`, `skate-footer-about`; ohne Menü wird der Block nur im Editor als Hinweis gezeigt),
    `text` (Überschrift + Richtext), `social` (globale Settings `social_instagram|tiktok|youtube|facebook|pinterest|x`).
  - Untere Leiste: `shop.policies`, `shop.enabled_payment_types` + `payment_type_svg_tag`, `{% form 'localization' %}`
    (`country_code`/`locale_code`, nur bei > 1 Land bzw. > 1 veröffentlichter Sprache; Submit-Button statt Auto-Submit).
  - Großer Schriftzug (Setting `show_wordmark`/`wordmark_text`): Schriftgröße per `{% style %}` aus der Zeichenzahl und `settings.page_width`.
  - Mobile Linklisten als `<details>`-Akkordeons (die Desktop-Liste ist eine zweite, per CSS ausgeblendete Kopie derselben Links).
  - Locales: `footer.*`, `accessibility.social_links`.
- **Wird genutzt von:** jeder Seite (Footer-Gruppe im Layout); `social-links` zusätzlich im Mobile-Menü (Header-Drawer).
- **Offen / To-do:** Ohne gepflegte Social-URLs rendert der Social-Block nichts (Editor zeigt Hinweis). Seed-Menüs `skate-footer-*` müssen existieren.
- **Stand:** 2026-09-30

### Homepage-Sections (Bereich „home“)
- **Feature:** Startseite mit 9 Sections in `templates/index.json`: Hero, Shop by Category, Featured Boards (horizontal),
  Builder-Promo, Marken-Laufband, Editorial, Best Sellers (Slider), Newsletter, Community. Dazu die generischen
  Inhalts-Sections `rich-text` und `image-with-text` für beliebige Seiten.
- **Dateien:**
  - `sections/skate-hero.liquid` + `assets/section-skate-hero.css` (einzige H1 der Startseite, `limit: 1`; Blocks `stat` max. 3)
  - `sections/category-grid.liquid` + `assets/section-category-grid.css` (Blocks `category`, max. 6)
  - `sections/featured-products.liquid` + `assets/section-featured-products.css` (Layouts grid | slider | horizontal; 3 Presets)
  - `sections/builder-promo.liquid` + `assets/section-builder-promo.css` (Blocks `step`, max. 6; eingebaute Teile-Zeichnung als SVG)
  - `sections/brand-marquee.liquid` + `assets/section-brand-marquee.css` (Quelle `shop.vendors` oder Blocks `brand`)
  - `sections/editorial-grid.liquid` + `assets/section-editorial-grid.css` (Blocks `story`, Größe groß/klein)
  - `sections/newsletter.liquid` + `assets/section-newsletter.css`
  - `sections/community-grid.liquid` + `assets/section-community-grid.css` (Blocks `image`, max. 12, kein Fremdskript)
  - `sections/rich-text.liquid`, `sections/image-with-text.liquid` + gemeinsam `assets/section-rich-text.css`
  - `templates/index.json`, `tests/home.spec.ts`
- **Hängt an:**
  - Snippets `section-style` (Padding), `section-heading` (Rubrik-Nummer/Eyebrow/H2/Link), `product-card` (Layout `horizontal`
    für Featured Boards), `placeholder-skate` (jede fehlende Grafik), `graphic` (`stamp` im Hero), `image`, `icon`
  - Custom Elements aus `assets/theme.js`: `<scroll-slider>` (`[data-slider-track]`, `[data-slider-prev]`, `[data-slider-next]`),
    `<marquee-strip>` (`[data-marquee-toggle]`, setzt `.is-paused` + `aria-pressed`, Labels aus `#theme-config.strings.pause/play`),
    `<parallax-media>` (`--parallax-offset`, `data-strength`), Reveal über `.reveal` + `data-reveal-index`, Hero-Text-Reveal per CSS
    nur mit `html.js-reveal` (Theme-Setting „animations_reveal“)
  - Farbschemata (`color_scheme` je Section; Akzent je Scheme = `--color-button`), `--color-surface`, `--header-height`
    (von `sticky-header` gesetzt), `--announcement-height`, Settings `animations_hover` (`html.no-hover-effects`)
  - Collections per Handle: `decks`, `trucks`, `wheels`, `bearings`, `completes`, `featured-boards`, `bestsellers`
    (Artikelanzahl über `collection.products_count`); Pages `skateboard-builder` (Fallback-Link Hero/Promo über
    `pages['skateboard-builder'].url`), `groessenberatung`; Blog `news`; `shop.vendors` + `url_for_vendor` (Marquee)
  - `{% form 'customer' %}` mit `contact[tags]=newsletter` (Shopify-Kundenliste, Marketing-Zustimmung); Datenschutz-Link über
    Setting `show_privacy_link` → `shop.privacy_policy.url` (Label `sections.newsletter.privacy_link`), nicht als fester Pfad im Richtext
  - Newsletter und Builder-Promo geben H2 + `aria-labelledby` nur aus, wenn eine Überschrift gesetzt ist
  - Section-Bilder als Shop-Files `shopify://shop_images/skate-demo-*.png` (Seed, `.werkbank-tmp/fixtures/seed.json` → `sectionImages`)
  - Locales: Namespace `sections.*` (`category_grid`, `community`, `featured`, `marquee`, `newsletter`) sowie
    `accessibility.previous_slide/next_slide/pause_animation`
- **Wird genutzt von:**
  - Startseite (`templates/index.json`); `rich-text`/`image-with-text` und `featured-products` sind per Preset in allen
    Templates hinzufügbar (nicht in Header/Footer-Gruppen; `newsletter` auch im Footer)
  - Builder-Seite ist Ziel der Hero-/Promo-CTAs (`/pages/skateboard-builder`)
- **Offen / To-do:**
  - Community-Profil-Link in `index.json` ist ein Platzhalter (`https://www.instagram.com/`) – echtes Profil eintragen
  - Journal-Links zeigen auf den Blog `news` (Demo-Inhalte eines anderen Projekts) – eigenes Journal anlegen
  - `featured-products` blendet sich im Shop aus, wenn die Kollektion leer ist (im Editor Platzhalterkarten)
  - Hero-Höhe = `100svh − --header-height − --announcement-height − 2.5rem`; `--announcement-height` setzt theme.js per
    ResizeObserver auf `.announcement-bar` (Klassenname nicht ändern)
  - Stempel (`graphic` stamp) dreht im Hero bewusst nicht (`animation: none`), keine dauerhafte Animation
- **Stand:** 2026-09-30

<!-- Fragment Agent C (Collection, Filter, Übersicht, Suche) – Stand 2026-09-30 -->

### Collection-Seiten: Kopf, Produktraster, SEO-Text
- **Dateien:** `templates/collection.json` (Reihenfolge `header` → `main` → `seo`), `sections/collection-header.liquid`,
  `sections/collection.liquid`, `sections/collection-seo.liquid`, `assets/section-collection.css`
- **Hängt an:**
  - `collection.title` (einzige H1), `collection.description` (kurzer SEO-Text im Kopf), `collection.all_products_count` (Kopf),
    `collection.products_count` (gefilterte Anzahl in der Toolbar), `collection.sort_options` / `sort_by` / `default_sort_by`
  - Metafields (Collection): `custom.banner` (file_reference Bild → Banner; Fallback `collection.image`, dann Section-Bild),
    `custom.seo_text` (rich_text_field, `| metafield_tag`, Fallback Section-Richtext), `custom.hidden_filters` (siehe Filter)
  - Snippets aus dem Fundament: `breadcrumbs`, `image`, `product-card` (Karten im Grid), `placeholder-skate`, `section-style`, `icon`
  - `{% paginate collection.products by section.settings.products_per_page %}` (12–48, Standard 24)
- **Wird genutzt von:** allen Kategorie-URLs `/collections/<handle>` (decks, trucks, wheels, bearings, griptape, hardware, completes …);
  Header-/Footer-Menüs und Kategorie-Kacheln verlinken hierher; Breadcrumbs der PDP verlinken auf die Collection
- **Offen / To-do:** Banner-Metafeld und SEO-Text pro Collection pflegen (Seed setzt sie für decks/trucks/wheels). Alternate-Template
  `collection.builder-data.liquid` (Builder, Orchestrator) ist davon unabhängig und darf nicht als Storefront-Template gewählt werden.
- **Stand:** 2026-09-30

### Storefront-Filter, Sortierung, Chips, Pagination (AJAX)
- **Dateien:** `snippets/facet-layout.liquid` (gemeinsames Layout Collection + Suche, alle `[data-facets-part]`-Container),
  `snippets/filter-sidebar.liquid` (GET-Formular; zweimal gerendert: `desktop` Sidebar, `drawer` Mobil-Drawer),
  `snippets/facet-value.liquid` (Checkbox-Zeile inkl. Swatch/Bild), `snippets/filter-chips.liquid` (aktive Filter + CLEAR ALL),
  `snippets/pagination.liquid` (nummeriert, `aria-label`), `assets/facets.js` (`<facet-filters>`, Import-Map `@theme/facets`),
  `assets/component-facets.css`
- **Hängt an:**
  - `collection.filters` / `search.filters` aus der App **Search & Discovery** (ohne angelegte Filter keine Sidebar);
    Formularfelder nur aus `filter.param_name` + `value.value`, Preis `filter.min_value.param_name` / `max_value.param_name`
    (= `filter.v.price.gte/lte`), Links nur `value.url_to_remove`, `filter.url_to_remove`, `paginate.parts[].url`
  - Collection-Metafeld `custom.hidden_filters` (list.single_line_text_field, Werte = `filter.param_name`, z. B.
    `filter.p.m.custom.concave`) blendet Filter pro Kategorie aus (nur Sidebar/Drawer, aktive Chips bleiben entfernbar)
  - `@theme/utils`: `fetchSection` (Section Rendering `?section_id=<data-section-id>`, ohne JSON-Accept), `announce` (`#live-region`),
    `debounce`, `isSameOrigin`, `prefersReducedMotion`; `@theme/theme`: Dialog-Trigger `[data-dialog-open]` / `[data-dialog-close]`
    (Filter-Drawer `#FilterDrawer-<section.id>`, Fokus-Rückgabe an den Auslöser)
  - Globales CSS/Utilities aus `theme.css` (`.drawer--left`, `.grid`, `.select`, `.field__input`, `.button`, `.reveal`)
  - Vertrag der Container-Namen zwischen Liquid und JS: `sidebar`, `drawer`, `active-count`, `count`, `sort`, `chips`, `results`,
    `pagination`, `drawer-count` – bei Änderungen beide Seiten anpassen
- **Wird genutzt von:** `sections/collection.liquid`, `sections/search.liquid`; Produktkarten im Grid (`product-card`, Quick Add über
  `<product-form>` aus `cart.js` funktioniert auch nach dem AJAX-Tausch); Tests `tests/collection.spec.ts`, `tests/search.spec.ts`
- **Verhalten:** Checkbox/Sortierung sofort, Preis 650 ms debounced, Enter = Submit abgefangen; URL aus FormData (leere Werte raus),
  `history.pushState`, `popstate` rendert neu (Cache 16 URLs); Fokus bleibt auf dem auslösenden Feld (gleiche ID), sonst Ergebniszahl
  bzw. Drawer-Schließen-Button; Ergebniszahl per `announce()`; `aria-busy` + Akzent-Ladebalken; bei Fehler normale Navigation.
  Ohne JS: normales GET-Formular (Submit-Buttons nur bei `.no-js` sichtbar, Sidebar mobil inline statt Drawer).
- **Empfohlene Filter in Search & Discovery (vom Händler anzulegen):**
  - Decks: Marke (Vendor), Preis, Breite (Varianten-Option „Breite“ bzw. `custom.deck_width`), Länge (`custom.deck_length`),
    Farbe (Option „Farbe“, Darstellung Swatch), Concave (`custom.concave`), Verfügbarkeit
  - Trucks: Marke, Preis, Breite (Option „Breite“ bzw. `custom.truck_width`), Höhe (`custom.truck_height`), Farbe
  - Wheels: Marke, Preis, Durchmesser (`custom.wheel_size`), Härte (`custom.wheel_hardness`), Farbe
  - Bearings: Marke, Preis, Rating (`custom.bearing_rating`)
  - Kategoriefremde Filter blendet Shopify automatisch aus, wenn sie keine Werte haben; gezielt per `custom.hidden_filters`.
- **Offen / To-do:** Filter in S&D anlegen (sonst nur Standard Verfügbarkeit/Preis); Variant-Metafeld-Filter (Breite als Variante)
  im Dev-Store verifizieren, Fallback Optionsfilter `filter.v.option.breite`.
- **Stand:** 2026-09-30

### Kategorie-Übersicht (list-collections)
- **Dateien:** `templates/list-collections.json`, `sections/collections.liquid`, `assets/section-collection.css`
- **Hängt an:** globales `collections` (max. 50 ohne Paginate), `collection.featured_image` bzw. `placeholder-skate` (Art aus dem Handle:
  decks/trucks/wheels/bearings/griptape/hardware/risers/completes), `collection.all_products_count`, `routes.collections_url` (Breadcrumbs)
- **Wird genutzt von:** `/collections`; Leerzustand der Collection-Seite verlinkt hierher
- **Offen / To-do:** Builder-Collections (`builder-*`) und `frontpage, all` sind per Setting ausgeblendet – neue interne Collections dort ergänzen.
- **Stand:** 2026-09-30

### Suchseite
- **Dateien:** `templates/search.json`, `sections/search.liquid` (+ Snippets/JS/CSS aus „Storefront-Filter“)
- **Hängt an:** `search.terms` (überall `| escape`, im Formular und in `search.results.for_html`/`search.no_results_html`),
  `search.results` (paginate 12–48; Produkte → Grid mit `product-card`, Seiten/Artikel → Liste), `search.filters`, `search.sort_options`,
  `routes.search_url`, Hidden-Felder `q` + `options[prefix]=last` in allen Filterformularen
- **Wird genutzt von:** Header-Suche/Predictive Search (Agent H) leitet per Enter hierher; Breadcrumb „Suche“
- **Offen / To-do:** `search.predictive.*` gehört Agent H. Leerzustand-Vorschläge: Setting `suggestions` (Standard in `templates/search.json`: decks, trucks, wheels, bearings, griptape, hardware, completes; leer = automatisch aus `collections`).
- **Stand:** 2026-09-30

### Produktdetailseite (PDP)
- **Dateien:**
  - `sections/product.liquid` (Galerie links, Info-Spalte rechts, sticky; Blocks: `breadcrumbs`, `vendor`, `title` (einzige H1),
    `price`, `rating`, `variant_picker`, `quantity`, `buy_buttons`, `delivery`, `description`, `specs`, `builder_cta`, `text`, `@app`)
  - `snippets/product-gallery.liquid` (Scroll-Snap-Slider mobil mit Zähler/Dots; Desktop „thumbnails“ | „grid“ | „stack“; `<dialog>`-Lightbox)
  - `snippets/variant-picker.liquid` (Swatches für Farbe/Color/Colour, eckige Pills sonst; Varianten-JSON `[data-variant-json]`
    inkl. `quantity_rule` {min, increment, max} je Variante)
  - `snippets/product-specs.liquid` (Tech-Tabelle), `snippets/delivery-status.liquid` (Lieferstatus)
  - Helfer: `snippets/product-kind.liquid` (Kategorie → kind / Spec-Keys / Builder-Teil), `snippets/product-spec-value.liquid`
    (ein Spec-Wert formatiert), `snippets/product-stock-state.liquid` (in_stock | low:n | backorder | sold_out | unavailable)
  - `assets/product.js` (`@theme/product`: `<variant-picker>`, `<product-gallery>`, `<product-quantity>`, `<product-recommendations>`)
  - `assets/section-product.css` (PDP, Galerie, Picker, Specs, Akkordeon, Related/Recently)
  - `templates/product.json` (Reihenfolge: product → product-details → related-products → recently-viewed)
- **Hängt an:**
  - `product.options_with_values`, `product.variants`, `product.selected_or_first_available_variant`, `variant.featured_media`,
    `variant.inventory_management/-quantity`, `variant.quantity_rule`, `product.vendor | url_for_vendor`
  - Metafields: `custom.builder_category` (Fallback `product.type`), Spec-Keys `custom.deck_width`, `deck_length`, `wheelbase`,
    `concave`, `deck_shape`, `truck_width`, `truck_height`, `wheel_size`, `wheel_hardness`, `bearing_rating`, `grip_style`,
    `hardware_length`, `riser_height` – Auflösung: Varianten-Metafield → numerischer Optionswert (Breite/Width/Größe/Size,
    Länge/Length, Durchmesser/Diameter; Plausibilitätsgrenzen wie Builder) → Produkt-Metafield. `reviews.rating` + `reviews.rating_count` (optional).
  - `<product-form>` + `addItems` aus `assets/cart.js` (Formular `ProductForm-<section.id>`, hidden `[data-variant-id]`,
    Menge über `form=`-Attribut, Fehler in `[data-form-error]`), Drawer `#CartDrawer` via `cart:updated`
  - Mengenfeld `product-quantity [data-quantity-input]`: `updateQuantity()` in `product.js` setzt min/step/max bei jedem
    Variantenwechsel aus `quantity_rule` und rundet den Wert auf ein gültiges Vielfaches
  - Ohne JS: `<noscript>`-Select `name="id"` im Produktformular NACH dem hidden `id`-Input (letzter Wert gewinnt),
    `.no-js .product-picker__option` ausgeblendet; Locale `products.product.variant`
  - `formatMoney`, `emit/on`, `EVENTS.variantChanged`, `fetchSection`, `routes.productRecommendations` aus `@theme/utils`;
    `openDialog` aus `@theme/theme` (Lightbox, Fokus-Rückgabe)
  - Foundation-Snippets `price`, `breadcrumbs` (BreadcrumbList-JSON-LD), `swatch`, `icon`, `placeholder-skate`, `section-style`
  - Seite `pages['skateboard-builder']` (Builder-CTA, nur für kind deck/trucks/wheels/bearings/griptape/hardware/riser)
  - Einziges Product-JSON-LD kommt aus `snippets/meta-tags.liquid` – PDP-Dateien geben KEIN eigenes aus.
- **Wird genutzt von:**
  - Event `variant:changed` `{sectionId, variant}` (variant = Eintrag aus dem Varianten-JSON oder `null`): intern von
    `<product-gallery>`; frei für Apps/Erweiterungen (z. B. spätere Sticky-Add-Bar)
  - Board-Builder/`board-builder-data.js` nutzt dieselbe Spec-Auflösung (Plan 2a) – Formate/Keys synchron halten
  - `data-recently-viewed-track="<handle>"` auf der Section → Tracking in `assets/recently-viewed.js`
- **Offen / To-do:**
  - Builder-CTA verlinkt nur auf die Builder-Seite (ohne Vorauswahl). Falls der Builder später `?part=<kind>&variant=<id>`
    auswerten soll, hier Parameter ergänzen.
  - Zahlenwerte aus `number_decimal` erscheinen wie gespeichert (z. B. `8.0"`); Brüche (7/8") nur, wenn als Text gepflegt.
  - Model-3D-Medien werden nur als Vorschaubild gezeigt (kein `model-viewer`).
- **Stand:** 2026-09-30

### Produktdetails (Akkordeon)
- **Dateien:** `sections/product-details.liquid` (Blocks `details`, `features`, `size_guide`, `shipping`, `custom`; natives `<details>`),
  Styles in `assets/section-product.css`
- **Hängt an:** `product.description`, Metafield `custom.features` (list.single_line_text_field, Fallback Richtext),
  Seite `pages['groessenberatung']` (Default der Größenberatung), `shop.shipping_policy` (Fallback Versand), Theme-Editor-Event
  `shopify:block:select` (öffnet Panel, in `product.js`)
- **Wird genutzt von:** `templates/product.json`
- **Offen / To-do:** –
- **Stand:** 2026-09-30

### Passende Produkte (Related)
- **Dateien:** `sections/related-products.liquid`, `<product-recommendations>` in `assets/product.js`
- **Hängt an:** `routes.productRecommendations` + `product_id`, `limit`, `intent=related`, `section_id` (aus `data-section-id`),
  Liquid-Objekt `recommendations`, Snippet `product-card`, `<scroll-slider>` (theme.js) im Slider-Layout
- **Wird genutzt von:** `templates/product.json`
- **Offen / To-do:** Ohne Treffer bleibt die Section `hidden` (neue Shops/Produkte ohne Kaufhistorie zeigen oft nichts).
- **Stand:** 2026-09-30

### Zuletzt angesehen (Recently Viewed)
- **Dateien:** `sections/recently-viewed.liquid`, `assets/recently-viewed.js` (`@theme/recently-viewed`),
  `templates/product.card.liquid` (Alternate-Template `?view=card`, `{% layout none %}`, rendert `product-card` ohne Quick Add)
- **Hängt an:** localStorage `skateshop:recently-viewed:v1` (Array von Handles, Regex `^[a-z0-9][a-z0-9-]{0,99}$`, max. 12,
  neuestes zuerst), `route('products/<handle>')` + `?view=card` (per `fetchText` OHNE Accept-JSON-Header, sonst liefert
  Shopify Produkt-JSON), DOMParser – übernommen wird nur `[data-product-card]`; 404 entfernt den Handle.
  Tracking: jedes Element `[data-recently-viewed-track]` (gesetzt von `sections/product.liquid`, das `recently-viewed.js` immer lädt).
- **Wird genutzt von:** `templates/product.json`; Section ist auch auf anderen Seiten einsetzbar (zeigt dann alle gespeicherten Handles).
- **Offen / To-do:** `product.card` ist im Admin als Produkt-Template wählbar – nicht zuweisen (Hinweis in docs/theme-setup.md).
- **Stand:** 2026-09-30

<!-- Metafield-Tabelle (Ergänzungen, falls noch nicht vorhanden): -->
<!-- | `custom.features` | list.single_line_text_field | PDP Akkordeon „Features“ | -->
<!-- | `reviews.rating` / `reviews.rating_count` | rating / number_integer | PDP-Bewertung (optional, z. B. Review-App) | -->
<!-- | `custom.builder_category` + Spec-Keys (deck_width …) | siehe Plan 2e | PDP-Specs, Builder | -->

### Inhaltsseiten: Standardseite (page)
- **Dateien:** `sections/page.liquid`, `templates/page.json`, `assets/section-content.css`
- **Hängt an:** `page` (title, content), Snippets `breadcrumbs`, `section-style`, `image`; Theme-Blocks `blocks/group.liquid` +
  `blocks/text.liquid` (`@theme`) und `@app`; Utilities `.page-width--narrow`, `.rte`, `.eyebrow`
- **Wird genutzt von:** Seiten Versand (`versand`), Rückgabe (`rueckgabe`), Über uns (`skate-ueber-uns`), Größenberatung
  (`groessenberatung`) über `page.json`; als Intro-/H1-Section in `page.brands.json` und `page.contact.json`; Footer-Menüs verlinken diese Seiten
- **Offen / To-do:** Setting „Einleitung“ gilt pro Template (nicht pro Seite) – für seitenbezogene Einleitungen „Ersten Absatz hervorheben“ nutzen
- **Stand:** 2026-09-30

### Brands-Seite (A–Z-Register + Featured Brands)
- **Dateien:** `sections/brands-list.liquid`, `templates/page.brands.json` (page + brands-list), `assets/section-brands.css`
- **Hängt an:** `shop.vendors` (sortiert mit `sort_natural`), Filter `url_for_vendor` (→ `/collections/vendors?q=…`), Section-Setting
  `exclude_vendors` (im Template: interne Hersteller des Dev-Stores „Dev store, NetImpulse, QA Fixtures, Theme Studio“), Blocks `brand`
  (Name, Logo, Kurztext, Link; ohne Logo Monogramm-Kachel), Seed-Seite `brands` mit Template-Suffix `brands`; Demo-Marken aus
  `scripts/demo-data/data/brands.mjs` (Nine Ply Co., Axlemoor, Rolltype, Swiftbore als Featured-Blocks)
- **Wird genutzt von:** Header-Navigation „Brands“ (Menü `skate-main-menu` → `/pages/brands`), Footer; Tests `tests/pages.spec.ts`
- **Darstellung:** Setting `layout` = `list` (Buchstabengruppen fließen in `columns_desktop` Spalten wie ein Register) oder `grid`
  (eine Zeile pro Buchstabe, Marken als Kacheln, `columns_desktop` Kacheln pro Reihe). A–Z-Navigation: leere Buchstaben als
  `<a role="link" aria-disabled="true">` ohne `href`; Anker `Brands-<section.id>-<a…z|other>`.
- **Offen / To-do:** Produktanzahl pro Marke bewusst weggelassen (nur per Katalog-Iteration ermittelbar). Featured-Block-Namen müssen exakt dem
  Vendor entsprechen, sonst zeigt der Link eine leere Vendor-Collection. Neue Test-Hersteller im Dev-Store ggf. in `exclude_vendors` ergänzen.
- **Stand:** 2026-09-30

### Kontaktformular
- **Dateien:** `sections/contact-form.liquid`, `templates/page.contact.json` (page + contact-form), `assets/section-content.css`
- **Hängt an:** `{% form 'contact' %}` (Felder `contact[name]`, `contact[email]`, `contact[phone]`, `contact[body]`), `form.errors`,
  `form.posted_successfully?`, `customer` (Vorbelegung Name/E-Mail), Snippets `section-heading`, `icon`; Seed-Seite `skate-contact`
  (Suffix `contact`). Die Seite `contact` im Dev-Store gehört einem anderen Projekt – nicht anfassen.
- **Wird genutzt von:** Footer-Menü „Kontakt“, 404-Links (optional über Menü-Setting)
- **Offen / To-do:** Shopify kann beim Absenden eine Captcha-Seite zeigen; Tests senden das Formular nie ab (nur Browser-Validierung).
- **Stand:** 2026-09-30

### Blog & Artikel (Magazin-Layout)
- **Dateien:** `sections/blog.liquid`, `sections/article.liquid`, `templates/blog.json`, `templates/article.json`, `assets/section-content.css`
- **Hängt an:** `blog` (title, all_tags, articles, comments_enabled?, moderated?, previous_article/next_article), `current_tags`,
  `article` (image, excerpt, content, tags, author, comments), `paginate` (eigene Pagination-Markup im Blog, `default_pagination` bei
  Kommentaren), `article | structured_data` (Article-JSON-LD), Snippets `breadcrumbs`, `image` (Placeholder `placeholder-skate` generic), `icon`;
  Tag-URLs als `{{ blog.url }}/tagged/{{ tag | handle }}`
- **Wird genutzt von:** Homepage-Editorial (verlinkt ggf. Blog/Artikel), Footer „Journal“; Tests `tests/pages.spec.ts`
- **Hinweis:** Das `image`-Snippet rendert mit `url:` ein `<a class="media">`; `.media` hat in theme.css kein `display:block` →
  im Blog per `.content-card__media > .media { display: block }` gelöst (global in theme.css wäre sauberer).
- **Offen / To-do:** Pagination-Markup ist lokal im Blog – sobald `snippets/pagination.liquid` (Bereich Collection) gemergt ist, kann der Blog
  darauf umgestellt werden (gleiche Optik prüfen).
- **Stand:** 2026-09-30

### 404-Seite
- **Dateien:** `sections/404.liquid`, `templates/404.json`, `assets/section-content.css`
- **Hängt an:** `routes.search_url` (Suchformular `q` + `options[prefix]=last`), `routes.root_url`, `routes.all_products_collection_url`,
  Settings `builder_page` (Seite `skateboard-builder`) und `collection` (`decks`) bzw. optional `menu` (link_list); Locale-Keys `search.placeholder`,
  `search.submit`, `general.home`
- **Wird genutzt von:** alle ungültigen URLs
- **Offen / To-do:** –
- **Stand:** 2026-09-30

### Passwortseite
- **Dateien:** `sections/password.liquid`, `templates/password.json` (Layout `password`), `assets/section-content.css`
- **Hängt an:** `layout/password.liquid` (unverändert), `settings.logo`/`settings.logo_width`, `shop.password_message`,
  `{% form 'customer' %}` mit `contact[tags]=newsletter`, `{% form 'storefront_password' %}` (hinter `<details>`, bei Fehler geöffnet)
- **Wird genutzt von:** Storefront-Passwortschutz; `tests/global-setup.ts` (Login per `input[type="password"]` + erster
  `form button[type="submit"]`) – heute gegen das Live-Theme, da `/password` ohne `preview_theme_id` aufgerufen wird
- **Offen / To-do:** – (erledigt: `tests/global-setup.ts` öffnet das geschlossene `<details>` über
  `details:has(input[type="password"]):not([open]) > summary` und sendet `form:has(input[type="password"])` ab – funktioniert
  mit diesem Theme und mit dem Live-Theme)
- **Stand:** 2026-09-30

### Cart-Drawer, Cart-Seite & Build-Gruppierung
- **Dateien:**
  - `sections/cart-drawer.liquid` (statische Section, im Layout per `{% section 'cart-drawer' %}`, ID `cart-drawer`; `<cart-drawer>` + `<dialog id="CartDrawer" class="drawer" data-backdrop-close>`)
  - `sections/cart.liquid` + `templates/cart.json` (Cart-Seite, `data-cart-section data-section-id`, H1, Liste + sticky Summary, No-JS-Fallback)
  - `snippets/cart-items.liquid` (Liste, Build-Erkennung), `cart-build-group.liquid` (Rahmen „CUSTOM BOARD BUILD“), `cart-build-part.liquid` (Teil-Zeile ohne Stepper), `cart-line-item.liquid` (normale Zeile mit Stepper), `cart-summary.liquid`, `cart-empty.liquid`, `cart-shipping.liquid` (Versandkosten-frei-Fortschritt, `<progress>`), `cart-money.liquid` (money / money_with_currency), `cart-variant.liquid`
  - `assets/cart-drawer.js` (`@theme/cart-drawer`: `<cart-items>`, `<cart-drawer>`), `assets/component-cart.css`
  - `tests/cart.spec.ts`
- **Hängt an:**
  - `@theme/cart` (eingefroren): `changeLine`, `updateLines`, `shouldOpenDrawer`, `CART_DRAWER_SECTION`, `sectionsToRender` (liest `[data-cart-section][data-section-id]`); `@theme/theme`: `openDialog/closeDialog`; `@theme/utils`: `on/emit`, `EVENTS`, `fetchJSON`, `fetchSection`, `parseHTML`, `sectionIdOf`, `announce`, `debounce`, `routes.cartUpdate`, `strings.cartError`
  - Events: `cart:updated` (`detail.sections[<id>]` → `[data-cart-content]` wird ersetzt; fehlt die Section, wird sie per Section Rendering nachgeladen), `cart:error` (nur eigene `source`)
  - Line-Item-Properties aus dem Builder: `_build_id` (`^b-[a-z0-9]{6,24}$`, sonst normale Zeile), `_build_part` (deck|trucks|wheels|bearings|griptape|hardware|riser), `_build_pos` ("1"–"7", unbekannt → ans Ende). `_`-Properties werden nie ausgegeben.
    Sichtbare Properties werden escaped; als Link nur `https://…/uploads/…` (Datei-Uploads), sonst Text.
  - Theme-Settings: `cart_type` (über `shouldOpenDrawer`), `cart_show_note` (Notiz → `cart/update.js` `{note}`), `cart_free_shipping_threshold` (ganze Beträge; Vergleich mit `cart.total_price`), `currency_code_enabled`
  - Snippets aus dem Fundament: `image`, `icon` (minus, plus, trash, wrench, lock, truck, chevron-down, arrow-right, close), `placeholder-skate` (kind = `_build_part` bzw. `custom.builder_category`)
  - Metafield (lesend): `product.metafields.custom.builder_category` (Placeholder-Art normaler Zeilen)
  - Locales: `cart.*` (neu: `cart.build.*`, `cart.parts.*`, `cart.empty.*`, `cart.line.*`, `cart.shipping.*`, `cart.summary.*`, `cart.table.*`; genutzt: `cart.title/checkout/remove/update/count`, `general.continue_shopping`, `accessibility.close`)
- **Wird genutzt von:**
  - **Builder** (`board-builder-summary.js`) → legt die `_build_*`-Zeilen an; Drawer öffnet über `cart:updated` + `shouldOpenDrawer(source)`; „Build bearbeiten“ verlinkt auf die Builder-Seite (Section-Setting `builder_url`, Default `/pages/skateboard-builder` inkl. Locale-Präfix)
  - **Header** → Warenkorb-Icon mit `data-dialog-open="CartDrawer"` (bei `cart_type = drawer`), Zähler über `cart-count` (Orchestrator)
  - **PDP / Quick Add** (`<product-form>` in cart.js) → Add öffnet den Drawer; ohne `<cart-drawer>` Weiterleitung zur Cart-Seite
  - Drawer-Mutationen senden `source: 'cart-drawer'`, Cart-Seite `source: 'main-cart'` (öffnen den Drawer nie)
- **Offen / To-do:**
  - (erledigt) Header-Warenkorb-Link setzt bei `settings.cart_type == 'drawer'` `data-dialog-open="CartDrawer"` (`sections/header.liquid`); href `routes.cart_url` bleibt als No-JS-Fallback.
  - Versandkosten-Schwelle wird nicht in Fremdwährungen umgerechnet (Markets) – Vergleich in Shopwährung.
  - `content_for_additional_checkout_buttons` (Setting der Cart-Seite) wird nach Ajax-Updates nicht neu initialisiert.
  - Kein automatischer Refresh des Drawers bei Änderungen in einem anderen Tab / bfcache.
  - Visuelle QA wegen Cloudflare-Rate-Limit ggf. nachholen (siehe Abschlussmeldung).
- **Stand:** 2026-09-30

### Board Builder (Skateboard-Konfigurator)
- **Dateien:** `sections/board-builder.liquid` (Schritt-Blocks, Settings, JSON-Config inkl. Strings), `snippets/board-preview.liquid`,
  `templates/page.skateboard-builder.json`, `templates/collection.builder-data.liquid` (JSON-Endpunkt `?view=builder-data`),
  `assets/board-builder.js` (Controller `<board-builder>`), `assets/board-builder-list.js` (Karten, Filter-Chips, Hinweise),
  `assets/board-builder-summary.js` (Summary, Riser-Extra, Add-to-Cart + Rückbau), `assets/board-builder-preview.js`
  (`<board-preview>`), reine Module `assets/board-builder-data.js` / `-state.js` / `-rules.js`, `assets/board-builder.css`,
  `tests/unit/board-builder-*.test.mjs`, `tests/builder.spec.ts`
- **Hängt an:** Collections `builder-decks`, `builder-trucks`, `builder-wheels`, `builder-bearings`, `builder-griptape`,
  `builder-hardware`, `builder-risers` (per Block/Setting wählbar); Produkt-/Varianten-Metafields `custom.*` (Maße, Specs,
  `preview_layer`, `preview_color`, `builder_category`), Optionsnamen Breite/Durchmesser/Länge/Farbe; `localStorage`
  `skateshop:builder:v1`; `@theme/cart` (`addItems`, `getCart`, `updateLines`), `routes.*`; Page-Handle `skateboard-builder`.
- **Wird genutzt von:** Cart-Drawer und Cart-Seite (Gruppierung über `_build_id`/`_build_part`/`_build_pos`, Label
  „CUSTOM BOARD BUILD“), Header-CTA und Homepage-Promo (Links auf `/pages/skateboard-builder`), PDP-Block „Builder-CTA“
  (Deep-Link `?deck=<handle>`).
- **Wichtig:** Fetches auf `?view=builder-data` ohne `Accept: application/json` – sonst liefert Shopify das native
  Collection-JSON statt des Alternate-Templates. Varianten liefern `preview.layer`/`layerRatio` (Varianten-Metafield
  `custom.preview_layer`); die Vorschau nimmt zuerst den Varianten-Layer, dann den Produkt-Layer.
  Wiederherstellung aus `localStorage`: `rehydrate()` läuft nach JEDEM erfolgreichen Laden einer Collection (`ensureData`),
  auch nach „Erneut versuchen“ oder Schrittwechsel; Teile werden nur bei eindeutigem Ergebnis (Produkt/Variante weg oder
  ausverkauft) entfernt und nie, wenn im aktuellen Besuch schon neu gewählt wurde. Bei Ladefehlern bleibt die Auswahl. Vor dem Hinzufügen prüft die Summary sequenziell die Verfügbarkeit
  (`/products/<handle>.js`); ausverkaufte Zeilen bekommen `.is-unavailable`. Bei Fehlern nach Teil-Add baut `rollback()`
  alle Zeilen mit derselben `_build_id` zurück (Quelle `builder:silent` → Drawer bleibt zu).
  E2E (`tests/builder.spec.ts`): HTTP 429 auf `?view=builder-data` = Store-Drosselung → Test wird übersprungen, andere
  Ladefehler lassen den Test fehlschlagen. Der „Erneut versuchen“-Button liegt in `[data-bb-status]` (nicht in der Liste
  `[data-bb-list]`). `collectThemeErrors` (`tests/fixtures.ts`) wertet „status of 429“-Konsolenmeldungen als Plattform-Rauschen. Kompatibilitätsregeln nur in `board-builder-rules.js` ändern
  (+ Locale `builder.rules.*`). Regel-Toleranz/Riser-Schwelle zusätzlich als Section-Settings.
- **Offen / To-do:** Search-&-Discovery-Filter für die Collection-Seiten legt der Händler an (Builder filtert clientseitig und
  braucht sie nicht).
- **Stand:** 2026-09-30

### Demo-Daten / Seed (Bereich S, Schritt 12)
- **Dateien:**
  - `scripts/demo-data/seed.mjs` (Orchestrierung, `--dry-run`, `--only=defs,images,files,products,collections,pages,menus,report`, `--report=<pfad>`)
  - `scripts/demo-data/cleanup.mjs` (löscht nur Seed-Daten; Definitionen nur mit `--definitions`)
  - Schritte: `defs.mjs`, `images.mjs`, `files.mjs`, `products.mjs`, `collections.mjs`, `pages.mjs`, `menus.mjs`, `report.mjs`
  - Daten: `data/definitions.mjs` (Plan 2e + `hidden_filters`), `data/brands.mjs`, `data/catalog.mjs` (33 Produkte), `data/content.mjs` (Collections, Seiten, Menüs)
  - Bilder: `lib/svg.mjs` (Primitive + Teile-Zeichnungen), `lib/scenes.mjs` (Produkt-/Section-Motive); Ausgabe `scripts/demo-data/.out/images/` (gitignored)
  - API-Helfer: `lib/admin.mjs` (`gql`, `stagedUpload`, `findProductByHandle`, `publishToOnlineStore`, `listDemoFiles`, `waitForFiles`)
  - Fixture-Ausgabe: `.werkbank-tmp/fixtures/seed.json` (von `report`)
- **Hängt an:**
  - Admin API 2025-07, Env `SHOPIFY_STORE_URL`/`SHOPIFY_ADMIN_TOKEN`, Node 22 mit `NODE_USE_ENV_PROXY=1`, Playwright-Chromium (`/opt/pw-browsers`)
  - Metafield-Definitionen `custom.*` (Produkt, Variante, Collection; Storefront PUBLIC_READ, Beschreibung mit Marker `[skate-demo]`)
  - Marker: Produkte Tag `skate-demo`; Collections/Seiten Metafield `skate_demo.seeded=true` (ohne Definition); Menüs Handle `skate-*`
    (Cleanup löscht nur die exakten Handles aus `MENUS` in `data/content.mjs`); Files `skate-demo-*`
  - Smart-Collection-Regeln: `product_type` (Deck, Trucks, Wheels, Bearings, Griptape, Hardware, Riser Pads, Complete, Zubehör) bzw. Tags, immer UND Tag `skate-demo`
- **Wird genutzt von:**
  - **Builder** (`collection.builder-data`, board-builder-*.js): Collections `builder-decks … builder-risers`, Metafields `custom.builder_category`, Variant-Maße, `custom.preview_layer` (transparentes PNG 2000×520, quer, Nose links, nur Decks), `custom.preview_color` (Decks, Trucks, Wheels, Griptape, Hardware-Varianten)
  - **Header/Footer**: Menüs `skate-main-menu`, `skate-footer-shop`, `skate-footer-help`, `skate-footer-about`
  - **Homepage** (`templates/index.json`): Section-Bilder als `shopify://shop_images/skate-demo-*.png` (hero, cat-*, editorial-*, community-1…6, builder-promo); Collections `featured-boards`, `bestsellers`
  - **Collection-Header**: `custom.seo_text` (alle Kategorie-Collections), `custom.banner` (decks, trucks, wheels)
  - **PDP**: `custom.features`, Specs-Metafields; **Cart-Tests**: Variante mit Bestand 0 (Checker Classic Deck 7.75") und Bestand 1 (Curb Wax)
  - **Seiten-Templates**: `page.skateboard-builder`, `page.brands`, `page.contact` (Suffixe gesetzt)
  - **Playwright-Fixtures** (`tests/fixtures.ts`): Handles/IDs aus `.werkbank-tmp/fixtures/seed.json`
- **Offen / To-do:**
  - Seiten `contact` und `ueber-uns` gehören im geteilten Dev-Store einem anderen Projekt → Demo-Seiten heißen `skate-contact` (Template `contact`) und `skate-ueber-uns`; Menüs verlinken diese. Die fremde `contact`-Seite hat ebenfalls Suffix `contact`.
  - Search-&-Discovery-Filter manuell anlegen (keine API), siehe docs/theme-setup.md
  - Geänderte Bilder werden nicht erneut hochgeladen (gleicher Dateiname) → vorher Dateien löschen bzw. `cleanup.mjs`
  - Storefront ist passwortgeschützt (`.js`/`.json`-Endpunkte → 302 /password ohne Passwort)
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

- [ ] Search & Discovery: Filter laut `docs/theme-setup.md` Abschnitt 6 anlegen (Breite, Länge, Concave, Achsbreite, Höhe,
      Durchmesser, Härte, Rating, Farbe als Swatch) – derzeit nur Verfügbarkeit + Preis aktiv. Nur in der App möglich.
- [ ] Pro Kategorie `custom.hidden_filters` befüllen, falls ein S&D-Filter dort nicht passt (Definition legt der Seed an).
- [ ] Social-URLs in den Theme-Einstellungen pflegen (Footer-/Drawer-Social-Block ist sonst leer).
- [ ] Community-Profil-Link in `templates/index.json` (Platzhalter instagram.com) und Journal-Blog (derzeit `news`) ersetzen.
- [ ] Produkt-Bewertungen: Rating-Block der PDP zeigt nur etwas, wenn `reviews.rating` (z. B. über eine Review-App) gesetzt ist.
- [ ] Alternate-Templates `product.card` und `collection.builder-data` niemals Produkten/Collections im Admin zuweisen.
- [ ] Versandkosten-frei-Schwelle im Cart wird nicht in Fremdwährungen umgerechnet (Markets mit mehreren Währungen).
- [ ] (Nur falls Wishlist beauftragt wird) Header: Wishlist-Counter an `customer.metafields.custom.wishlist` anbinden

---

## Metafields & Namespaces (Referenz)

Vollständige Beschreibung: `docs/theme-setup.md` Abschnitt 2. Definitionen legt `scripts/demo-data/defs.mjs` an.

| Namespace.Key | Typ | Owner | Verwendung |
|---|---|---|---|
| `custom.builder_category` | single_line_text (Auswahl) | Produkt | Builder-Kategorie, PDP-Specs-Auswahl, Placeholder-Art |
| `custom.deck_width` | number_decimal (Zoll) | Produkt + Variante | Filter, Builder-Regel Achsbreite, Vorschau, PDP-Specs |
| `custom.deck_length` | number_decimal (Zoll) | Produkt + Variante | Filter, Vorschau, PDP-Specs |
| `custom.wheelbase` | number_decimal (Zoll) | Produkt + Variante | Vorschau, PDP-Specs |
| `custom.concave` | single_line_text (Low/Medium/High) | Produkt | Filter, Builder, PDP-Specs |
| `custom.deck_shape` | single_line_text (Auswahl) | Produkt | PDP-Specs |
| `custom.truck_width` | number_decimal (Zoll) | Produkt + Variante | Filter, Builder-Regel, Vorschau |
| `custom.truck_height` | single_line_text (Low/Mid/High) | Produkt | Filter, Builder-Regel Wheelbite, Vorschau |
| `custom.wheel_size` | number_integer (mm) | Produkt + Variante | Filter, Builder-Regel Riser, Vorschau |
| `custom.wheel_hardness` | single_line_text | Produkt | Filter, Builder, PDP-Specs |
| `custom.bearing_rating` | single_line_text (Auswahl) | Produkt | Filter, Builder, PDP-Specs |
| `custom.grip_style` | single_line_text (Standard/Color/Pattern) | Produkt | Builder-Filter, Vorschau-Muster |
| `custom.hardware_length` | number_decimal (Zoll) | Produkt + Variante | Builder-Regel mit Risern, PDP-Specs |
| `custom.riser_height` | number_decimal (Zoll) | Produkt | Vorschau, PDP-Specs |
| `custom.preview_layer` | file_reference (Bild) | Produkt + Variante | Builder-Vorschau (Deck-Druck, Querformat) |
| `custom.preview_color` | color | Produkt + Variante | Builder-Vorschau (Achsen, Rollen, Grip, Schrauben) |
| `custom.features` | list.single_line_text | Produkt | PDP „Features“ |
| `custom.seo_text` | rich_text | Collection | SEO-Text unter dem Raster |
| `custom.banner` | file_reference (Bild) | Collection | Collection-Banner |
| `custom.hidden_filters` | list.single_line_text | Collection | Filter per `param_name` ausblenden |
| `reviews.rating` | rating | Produkt | PDP-Rating (optional, App) |
| `skate_demo.seeded` | boolean (ohne Definition) | Collection, Seite | Marker für `scripts/demo-data/cleanup.mjs` |
| `custom.wishlist` | – | Kunde | Vorlage, nicht umgesetzt |
