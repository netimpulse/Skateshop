---
name: shopify-liquid
description: Comprehensive Shopify theme development and Liquid templating skill. Covers full theme architecture (Dawn OS 2.0 and custom themes), Liquid tags/filters/objects, section schemas, JSON templates, Sections Everywhere, Metafields & Metaobjects, Shopify Functions/Extensions, Markets & Multilanguage/Multicurrency, modern frontend (Tailwind, Vanilla CSS, responsive design, performance), and asset pipeline. Use this skill whenever the user mentions Shopify, Liquid, .liquid files, theme development, sections, snippets, Dawn, Online Store 2.0, Shopify CLI, storefront, checkout extensions, metafields, or any ecommerce theme work — even if they don't explicitly say "Shopify". Also trigger when the user wants to build product pages, collection pages, cart functionality, or any storefront UI component that could be part of a Shopify theme.
---

# Shopify Liquid & Modern Theme Development (v5 — Korrigiert nach offizieller Quellprüfung)

Du bist ein Experte für Shopify-Theme-Entwicklung und schreibst produktionsreifen Code. Jede Liquid-Datei, jedes Schema, jedes CSS und JavaScript ist vollständig, deploybar und in einer Section gekapselt (CSS/JS als separate Asset-Dateien, wenn sie nicht von Liquid-Settings abhängen). Du baust für Online Store 2.0 Architektur mit JSON-Templates, Sections Everywhere und gescopten Section-Schemas.

## ⚠️ CRITICAL — File-Writing Method (zuerst lesen!)

**NIEMALS Liquid-, JS- oder CSS-Dateien via Bash-Heredocs (`cat << EOF`, `cat << 'EOF'`, `echo`, `printf`) schreiben.** Bash macht History-Expansion auf `!`, was alle `!=` zu `\!=` und alle `!` (z. B. `if (!foo)`) zu `\!` korrumpiert. Folge: jedes `if x != blank` in Liquid wirft `Liquid syntax error: Unexpected character \ in "x \!= blank"`, und JS-Negationen werden Syntax-Errors. Die korrumpierten Dateien sehen in `cat` korrekt aus, brechen aber das gesamte Theme.

**Immer mit den dedizierten `Write` / `Edit` File-Tools schreiben.** Sie schreiben Bytes literal, ohne Shell-Interpretation. Bash strikt für: `git`, `ls`, `mv`, `cp`, `grep`, `sed -i` für Fixes, und Validation-Scripts.

Falls ein Heredoc unumgänglich ist, nach dem Schreiben validieren:

```bash
grep -rn '\\!' sections/ snippets/ assets/ templates/ layout/
```

Findet sich was, sofort fixen:

```bash
find sections snippets assets templates layout -type f \( -name '*.liquid' -o -name '*.js' -o -name '*.json' -o -name '*.css' \) -exec sed -i 's/\\!=/!=/g; s/\\!/!/g' {} +
```

Gleiche Falle bei Backticks (`` ` ``), unescapten `$`, und `"` in `"`-quoted Heredocs. Single-quoted Heredocs (`<< 'EOF'`) verhindern Variable-Expansion, aber **nicht** History-Expansion von `!` in interaktiver Bash. `set +H` ist in non-interactive Subshells unzuverlässig. Einfach keine Heredocs für Code.

### Mandatory post-write validation

Nach jedem Schreiben/Editieren einer Section, eines Snippets oder Templates, vor Commit/Push: beide ausführen:

1. JSON-Schema-Validation — jedes `{% schema %}`-Block parst als JSON, alle IDs matchen `^[a-z][a-z0-9_]*$`, Namen ≤ 25 Zeichen, keine doppelten Setting-IDs, kein `disabled_on`+`enabled_on` zusammen.
2. Liquid-Struktur-Sanity — balanced `{% %}` und `{{ }}`, jeder Opener (`if`, `unless`, `for`, `case`, `capture`, `form`, `paginate`, `tablerow`, `comment`, `raw`, `style`, `stylesheet`, `javascript`, `schema`) hat matching `end…`, keine stray `\!`, keine ungültige Filter-Syntax (Liquid hat **keinen Ternary-Operator** — `cond | if, a, b` ist invalid; nutze `{% liquid %}`-Block mit `assign`/`if`/`else`).

Ein fehlgeschlagener Theme-Push ist viel teurer als zwei Sekunden Validation.

## Reference Files

Dieser Skill verweist auf detaillierte Reference-Files (in der Original-Skill-Distribution mit ausgeliefert):

- **`references/coding-rules.md`** — File-Writing-Methode, Schema-JSON-Regeln, ID-Naming, Default-Werte pro Typ, CSS-Standards (BEM, scoped), Security, häufige Fehler.
- **`references/schema-reference.md`** — Komplette Liste aller Setting-Input-Typen mit JSON-Beispielen und Liquid-Usage.
- **`references/theme-architecture.md`** — OS 2.0 Dateistruktur, Layout-Files, JSON-Templates, Metafields/Metaobjects, Cart AJAX API, Section Rendering API, Performance-Patterns.
- **`references/check-theme.py`** — Pre-commit Validator.

Vor dem Schreiben relevante Reference-Datei(en) lesen. Für komplexe Tasks (komplette Section mit Schema, CSS, JS): alle drei.

## Core Principles

### 1. Code Quality & Architecture

Modular, wartbar, DRY. Jede Section ist self-contained: HTML, scoped CSS, JavaScript (wenn nötig), Schema — alles in einer `.liquid`-Datei (CSS/JS als separate Asset-Dateien wenn sie nicht von Liquid-Settings abhängen).

**Liquid fundamentals:**
- **`{% render %}` exklusiv — niemals `{% include %}`.** `include` ist offiziell deprecated (Quelle: shopify.dev). Variablen explizit übergeben: `{% render 'product-card', product: product, show_vendor: true %}`
- `{% liquid %}`-Blocks für multi-line Logic statt Tag-Soup
- `{%- -%}` Whitespace-Stripping nutzen
- Auf `blank` prüfen statt `empty` oder `== ""`
- `| default:` Filter für Fallback statt if/else-Ketten
- Keine tief verschachtelten `{% for %}`-Loops — max zwei Ebenen. Mit `| map` flatten oder in Snippets aufteilen
- Snippet-Parameter am Anfang der Snippet-Datei dokumentieren

**⚠️ CRITICAL: Keine Filter-Ketten (`|`) in Named Arguments eines anderen Filters.**

Liquid's Parser unterstützt **kein** Piping von Filtern innerhalb der Named-Argument-Liste eines Filters. Bricht silent oder wirft "Expected end_of_string but found comma".

```liquid
{%- comment -%} ❌ BROKEN — `| default:` und `| escape` in image_tag's named args {%- endcomment -%}
{{ image | image_url: width: 800 | image_tag: alt: image.alt | default: product.title | escape, class: 'my-class' }}

{%- comment -%} ✅ CORRECT — pre-compute mit assign, clean variable übergeben {%- endcomment -%}
{%- assign img_alt = image.alt | default: product.title | escape -%}
{{ image | image_url: width: 800 | image_tag: alt: img_alt, class: 'my-class' }}
```

Gilt für ALLE Filter mit Named Arguments: `image_tag`, `video_tag`, `placeholder_svg_tag`, `stylesheet_tag`, `script_tag`. Sobald ein Named-Arg-Wert einen Filter braucht, vorher `assign` nutzen.

**SVG-Placeholders mit `placeholder_svg_tag`:**

Der Filter existiert offiziell und gibt einen SVG-Tag aus, z. B. `{{ 'collection-1' | placeholder_svg_tag: 'my-class' }}`. Die genaue Liste der gültigen Placeholder-Namen variiert je nach Shopify-Version — vor Verwendung in der offiziellen Doku prüfen: https://shopify.dev/docs/api/liquid/filters/placeholder_svg_tag

**SVG-Inlining mit `inline_asset_content`:**

`{{ 'icon.svg' | inline_asset_content }}` ist ein **valider Shopify-Filter** (offiziell dokumentiert). Gibt den Content eines Assets inline aus (SVG, JS oder CSS). Asset muss < 15 KB sein. Quelle: https://shopify.dev/docs/api/liquid/filters/inline_asset_content

Alternative für mehr Kontrolle: `snippets/icon.liquid` mit `{% case name %}` und inline SVGs, gerendert via `{%- render 'icon', name: 'menu' -%}`. Beide Ansätze sind valid — der Filter ist bequemer für einzelne Assets, das Snippet flexibler für eine Icon-Library.

**`{% stylesheet %}` und `{% javascript %}` Tags sind AKTIV (nicht deprecated):**

Diese Liquid-Tags bündeln CSS/JS-Assets innerhalb von Section-, Block- und Snippet-Dateien. Seit **Mai 2025** auch in Snippets verfügbar (Quelle: https://shopify.dev/changelog/javascript-and-stylesheet-tags-in-snippets). Wichtige Einschränkung: **Liquid wird in `{% javascript %}` und `{% stylesheet %}` NICHT gerendert.** Liquid-Code in diesen Tags führt zu Syntax-Errors oder verhindert das Anwenden von Styles.

Alternative ist `<style>` (inline) oder `{{ 'file.css' | asset_url | stylesheet_tag }}` für externe Asset-Dateien. Beide Patterns sind valid — Wahl je nach Modulartiy-Bedarf.

Verwechsle nicht mit der `ScriptTag` Admin-API-Ressource (für Apps), die teilweise deprecated wird — das ist eine völlig andere Sache.

**⚠️ Header-Grid: Exakt 3 direkte Kinder, bewährtes max-width nicht ändern**

Ein CSS-Grid-Header mit 3 Spalten (`auto 1fr auto` oder `1fr auto 1fr`) muss IMMER exakt 3 direkte Kinder haben (`__left`, `__center`, `__right`). Bei `logo_center` werden Logo UND Navigation BEIDE innerhalb von `__center` platziert — niemals ein 4. Kind. Wenn der Header funktioniert, **NIEMALS** `max-width` oder `padding` ändern — bewährte Werte sind `max-width: 1600px` + `padding: 0 clamp(1rem, 3vw, 2rem)`.

**⚠️ Theme Store Review: Vollständige Lokalisierung (i18n) ist Pflicht**

- Alle Storefront-Texte über `{{ 'key.path' | t }}` — niemals hardcoded
- **AUCH:** `aria-label`, `title`, `alt`, `placeholder` Attribute, Button-Texte, Erfolgsmeldungen, Link-Texte, Mengen-Labels — ALLES über `| t`
- Alle Schema-Labels als `t:`-Keys (`"label": "t:sections.hero.label_heading"`) — niemals hardcoded
- **Preset-Block-Settings** (z. B. `"heading": "Details"`) müssen `t:`-Keys verwenden
- Basis-Sprache MUSS Englisch sein (`en.default.json`, `en.default.schema.json`)
- Weitere Sprachen optional (z. B. `de.json`, `de.schema.json`)
- Limits pro Locale-Datei: max **3400 Translations**, max **1000 Zeichen** pro Value (Quelle: https://shopify.dev/docs/storefronts/themes/architecture/locales)

**⚠️ Customer Account Templates — DEPRECATED**

Legacy Customer-Account-Templates (`templates/customers/account.json`, `login.json`, `register.json`, `reset_password.json`, `addresses.json`, `order.json`, `activate_account.json`) sind **offiziell deprecated** und werden für neue Themes **nicht mehr benötigt**.

Aus der offiziellen Doku: „Customer accounts now operate independently of themes." Neue Themes integrieren stattdessen die `<shopify-account>` Web-Component in den Theme-Header. Damit können Kunden ohne Verlassen der Storefront einloggen und zu Account-Pages navigieren — Styling-Kontrollen passen sich dem Theme an. Quelle: https://shopify.dev/docs/storefronts/themes/architecture/templates

Wenn du an einem Bestandstheme mit Legacy-Customer-Templates arbeitest, kannst du sie pflegen. Aber bei einem neuen Theme: gar nicht erst anlegen, sondern `<shopify-account>` im Header verwenden.

**⚠️ Theme Store Review: product.liquid Anforderungen**

- Block-basiert (title, price, variant_picker, quantity, buy_buttons, description, @app)
- `product.media` statt `product.images` — **Video + 3D-Modelle sind im Theme Store Pflicht.** Quelle: Theme Store Requirements
- Sold-out-Logik: Button disabled + Text ändern
- Varianten-JS: Preis-Update, URL-Update, Media-Switch
- Bei Add-to-Cart-Button: **`<button>` ist empfohlen** (richer content erlaubt: Icons, Spinner, etc.), aber Shopify's offizielle Beispiele zeigen auch `<input type="submit" value="Add to cart" />` — beide sind valid HTML und funktional gleich. Quelle: https://shopify.dev/docs/storefronts/themes/architecture/templates/product/overview
- `<label>` für alle Form-Inputs — in JEDER Section: product, cart, search, newsletter, footer
- Bei Mengen-Input: **`type="number"` ist empfohlen** für besseres Mobile-UX (Numpad). Shopify's offizielles Beispiel nutzt `<input type="text" name="quantity" min="1" value="1" />` — beide funktionieren, `type="number"` ist die bessere UX-Wahl.

**⚠️ CRITICAL: Product-Section MUSS nil-Product absichern**

Die Product-Section (`sections/product.liquid`) bekommt das Produkt-Objekt NICHT über ein Schema-Setting, sondern automatisch von der URL (`/products/slug`). Im Customizer ohne echtes Produkt ist `product` nil. Das `{% form 'product', product %}` Tag crashed wenn `product` nil ist: `"product form must be given a product"`.

**PFLICHT:** Alle Blocks die `product` oder `current_variant` verwenden MÜSSEN in `{% if has_product %}` gewrapped sein:

```liquid
{%- liquid
  assign has_product = false
  if product != blank and product.title != blank
    assign has_product = true
    assign current_variant = product.selected_or_first_available_variant
  endif
-%}

{%- when 'buy_buttons' -%}
  {%- if has_product -%}
    {%- form 'product', product, id: 'ProductForm' -%}
      ...
    {%- endform -%}
  {%- else -%}
    <button type="button" class="btn btn--primary" disabled>
      {{ 'products.product.add_to_cart' | t }}
    </button>
  {%- endif -%}
```

Betrifft: `buy_buttons` (form-Tag), `price` (render product-price), `variant_picker` (product.options_with_values), `description` (product.description), `share` (product.url), Medien-Galerie (product.media). Nur `quantity`, `custom_text` und `@app` brauchen keinen Product-Check.

**IMMER auch prüfen:** Alle Translation-Keys die in Sections verwendet werden (`{{ 'key' | t }}`) MÜSSEN in `locales/en.default.json` existieren. Fehlende Keys zeigen "Translation missing: en.key.path" im Frontend.

**⚠️ Bilder: IMMER über Shopify Image Pipeline**

- Niemals bare `<img>` Tags — immer `image_url | image_tag` mit `alt`, `loading`, `sizes`, `widths`
- `image_tag` Ausgabe NICHT in ein `<img>` wrappen (erzeugt verschachteltes `<img><img></img>`)
- SVG-Assets die nicht über `image_url` gehen: mindestens `alt`, `loading`, `width`, `height` setzen

**⚠️ Accessibility: Keine inline Event-Handler**

- Niemals `onchange="..."`, `onclick="..."` etc. in HTML-Attributen
- Stattdessen `addEventListener` in separater JS-Datei

**⚠️ CSS: `prefers-reduced-motion` in JEDER Datei mit Transitions/Animations**

Jede CSS-Datei mit `transition`, `animation`, `@keyframes` MUSS einen `@media (prefers-reduced-motion: reduce)` Block haben.

**⚠️ Keine widersprüchliche Farb-Architektur**

Section mit `color_scheme` Setting darf NICHT gleichzeitig `bg_color`/`text_color`/`accent_color` für denselben Zweck haben.

**⚠️ password.liquid braucht `<main id="MainContent">` und Skip-Link**

Gleiche Accessibility-Anforderungen wie theme.liquid.

**⚠️ Demo/Skeleton-Sections entfernen**

Sections aus dem Skeleton-Theme mit hardcoded Text/shopify.dev Links (z. B. `hello-world.liquid`) MÜSSEN entfernt werden.

**⚠️ Mindest-Anforderungen für jede Section**

- `color_scheme` Setting, `padding_top`/`padding_bottom` Range-Settings, mindestens ein Preset
- Cart: empfohlen `type="number"` + `<label>` auf Mengen-Inputs, Empty-State, AJAX-Update
- Search: `<label>` auf Such-Input, Empty-State bei keinen Ergebnissen

**⚠️ CRITICAL: Cart-Section — NIEMALS als rohes HTML-Table ohne CSS ausliefern**

Die Skeleton-Theme `cart.liquid` ist ein absolutes Minimum (`<table>` + `<input type="text">`) ohne jegliches Styling. Das MUSS immer durch eine vollständige Cart-Section ersetzt werden.

Pflicht-Elemente einer Cart-Section:

1. **Eigene CSS-Datei** (`section-cart.css`) — NIEMALS den Cart ohne dediziertes Stylesheet ausliefern
2. **Zwei-Spalten-Layout** (Desktop): Artikel-Liste links + Sticky Summary-Sidebar rechts (`grid-template-columns: 1fr 380px`)
3. **Jeder Artikel muss enthalten:** Produktbild (über `image_url | image_tag`), Titel als Link, Varianten-Info, Einzelpreis, Quantity-Stepper (+/- Buttons mit `<button type="button">`), Zeilensumme, Remove-Link
4. **Quantity-Input:** empfohlen `type="number"` (besseres Mobile-UX als `type="text"`), mit zugehörigem `<label>` (kann `visually-hidden` sein), `min="0"`, `name="updates[]"`
5. **Summary-Box:** Zwischensumme (`cart.total_price | money`), Rabatt-Anzeige (`cart.cart_level_discount_applications`), Steuer-/Versandhinweis, Checkout-Button (`name="checkout"`), Update-Button (`name="update"`)
6. **Empty-State:** Wenn `cart.item_count == 0` → Nachricht + "Weiter einkaufen"-Link zu `routes.all_products_collection_url`
7. **Optional:** Bestellnotiz (`<textarea name="note">{{ cart.note }}</textarea>`)
8. **Accessibility:** `<label>` für jeden Input, `aria-label` auf +/- Buttons mit Produktname
9. **`prefers-reduced-motion`** in CSS für alle Transitions

```liquid
{%- comment -%} Cart form MUSS method="post" und action="{{ routes.cart_url }}" haben {%- endcomment -%}
<form action="{{ routes.cart_url }}" method="post">
  {%- for item in cart.items -%}
    {%- comment -%} Quantity: empfohlen type="number" + name="updates[]" {%- endcomment -%}
    <input type="number" name="updates[]" value="{{ item.quantity }}" min="0">
    {%- comment -%} Remove: über item.url_to_remove {%- endcomment -%}
    <a href="{{ item.url_to_remove }}">{{ 'cart.remove' | t }}</a>
  {%- endfor -%}
  <button type="submit" name="checkout">{{ 'cart.checkout' | t }}</button>
</form>
```

**Locale-Keys die der Cart braucht** (MÜSSEN in `en.default.json` existieren):
`cart.title`, `cart.empty`, `cart.continue_shopping`, `cart.checkout`, `cart.update`, `cart.remove`, `cart.quantity`, `cart.subtotal`, `cart.taxes_and_shipping`, `cart.note`, `cart.note_placeholder`, `cart.decrease`, `cart.increase`, `cart.headings.product`, `cart.headings.quantity`, `cart.headings.total`

**⚠️ NIEMALS `sed` auf CSS/Liquid/JS-Dateien anwenden**

`sed` kann unbeabsichtigt strukturelle Elemente (schließende `}`, Leerzeilen) zerstören und das gesamte Theme-Styling brechen. Für JEDE Code-Änderung ausschließlich `Write`/`Edit` Tools verwenden.

**⚠️ CRITICAL: Snippets/Liquid-Dateien MÜSSEN vollständig sein — abgeschnittene Dateien crashen ALLES**

Wenn eine Liquid-Datei beim Schreiben abgeschnitten wird (fehlende `{% endif %}`, `{% endfor %}`, `</a>`, etc.), verursacht das einen fatalen Liquid-Error der die **GESAMTE Seite auf 404 fallen lässt** — ohne Fehlermeldung im Customizer. Besonders kritisch bei Snippets die im Header/Footer gerendert werden (z. B. `site-logo.liquid`), weil deren Fehler JEDE Seite killt.

**Nach JEDER Snippet/Section-Erstellung MUSS validiert werden:**

```bash
python3 -c "
import re
with open('snippets/DATEINAME.liquid') as f:
    c = f.read()
for tag in ['if','unless','for','case','capture','form','comment']:
    o = len(re.findall(r'{%-?\s*' + tag + r'[\s%]', c))
    cl = len(re.findall(r'{%-?\s*end' + tag + r'\s*-?%}', c))
    if o > cl: print(f'FEHLER: {tag} hat {o} opens aber nur {cl} closes')
print('OK' if not any(len(re.findall(r'{%-?\s*'+t+r'[\s%]',c)) > len(re.findall(r'{%-?\s*end'+t+r'\s*-?%}',c)) for t in ['if','unless','for','case','capture','form','comment']) else '')
"
```

**⚠️ CRITICAL: Keine doppelten `<meta>` und `<title>` Tags**

`theme.liquid` enthält bereits `<meta charset>`, `<meta viewport>` und `<title>`. Das `meta-tags.liquid` Snippet darf diese NICHT nochmal enthalten — nur OG/Twitter/canonical/structured-data Tags.

**⚠️ CRITICAL: CSS-Dateien MÜSSEN vollständig und syntaktisch korrekt sein**

Beim Erstellen von CSS-Dateien (besonders über Bash `cat > file.css << 'EOF'`) werden häufig **schließende Klammern `}` abgeschnitten**. Eine einzige fehlende `}` macht das **GESAMTE Stylesheet ungültig** — der Browser verwirft es komplett, und die Section wird als rohes, unstyled HTML gerendert.

**Nach JEDER CSS-Dateierstellung MUSS validiert werden:**

```bash
python3 -c "
import re, sys
with open('assets/section-name.css') as f:
    css = f.read()
opens = css.count('{')
closes = css.count('}')
if opens != closes:
    print(f'FEHLER: {opens} öffnende vs {closes} schließende Klammern')
    sys.exit(1)
print(f'OK: {opens} Blöcke korrekt geschlossen')
"
```

**NIEMALS CSS-Dateien über Bash-Heredocs erstellen** — immer `Write`/`Edit` Tools verwenden.

**⚠️ CRITICAL: Section Layout — Dawn-Ansatz (KEIN CSS-Grid auf `.shopify-section`)**

Shopify wraps jede Section in ein `<div class="shopify-section">`. **NIEMALS** ein CSS-Grid, Margins oder Padding auf `.shopify-section` setzen! Das erzeugt weiße Ränder um ALLE Sections.

Dawn-Ansatz:

1. `.shopify-section` ist ein **transparenter Wrapper** — nur `position: relative`, sonst nichts.
2. Sections die zentrierten Content brauchen nutzen einen **inneren `.page-width`-Wrapper**:
   ```css
   .page-width { max-width: var(--page-width, 120rem); margin: 0 auto; padding-left: var(--page-margin, 1.5rem); padding-right: var(--page-margin, 1.5rem); }
   ```
3. Full-bleed Sections (Hero, Header, Footer, Marquee, Countdown mit Hintergrundbild) nutzen **KEIN `.page-width`** — sie gehen edge-to-edge und regeln Inhaltsbreite per `max-width` auf inneren Elementen.
4. Hintergrundfarbe und Padding gehören auf das **Section-Root-Element** (z. B. `<section class="my-section">`), NICHT auf `.shopify-section`.

Falsch:

```css
.shopify-section { display: grid; grid-template-columns: margin content margin; }
```

Richtig:

```css
.shopify-section { position: relative; }
.my-section { padding: 3rem clamp(1rem, 3vw, 2rem); }
.my-section__inner { max-width: 1440px; margin: 0 auto; }
```

**⚠️ CRITICAL: CSS-Selektoren MÜSSEN exakt mit HTML-Klassen matchen**

Wenn eine Section `<section class="coll-grid">` rendert, MUSS das CSS `.coll-grid` targetieren — NICHT `.section-collection-grid`. Vor dem Commit IMMER prüfen: HTML-Root-Klasse = CSS-Root-Selektor.

**⚠️ CRITICAL: theme.liquid Pflicht-Elemente (Dawn-Standard)**

```liquid
<!doctype html>
<html class="no-js" lang="{{ request.locale.iso_code }}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>{{ page_title }}{%- unless page_title contains shop.name %} &ndash; {{ shop.name }}{% endunless -%}</title>
  {%- render 'meta-tags' -%}
  <script>document.documentElement.className = document.documentElement.className.replace('no-js', 'js');</script>
  {%- render 'css-variables' -%}
  {{ 'critical.css' | asset_url | stylesheet_tag: preload: true }}
  {{ content_for_header }}
</head>
<body class="template-{{ template.name }}">
  <a class="skip-to-content-link visually-hidden" href="#MainContent">
    {{ 'general.accessibility.skip_to_content' | t }}
  </a>
  {%- sections 'header-group' -%}
  <main id="MainContent" class="content-for-layout" role="main" tabindex="-1">
    {{ content_for_layout }}
  </main>
  {%- sections 'footer-group' -%}
</body>
</html>
```

Pflicht-Regeln:

- `<title>` mit `page_title` + Shop-Name
- `{{ content_for_header }}` — Shopify-Analytics, PFLICHT
- Skip-to-content-Link für Accessibility (4.5:1 Kontrast, WCAG AA)
- `body class="template-{{ template.name }}"` für template-spezifisches CSS
- KEINE doppelten CSS-Definitionen
- KEINE Sections direkt per `{% section 'name' %}` einbinden — Section Groups verwenden

**⚠️ CRITICAL: Section Groups — Header/Footer (Dawn-Standard)**

Section Groups (`sections/header-group.json`, `sections/footer-group.json`) steuern, welche Sections im Header/Footer des Customizers erscheinen.

1. **Section Group JSON — einfach halten:**
   ```json
   {
     "type": "header",
     "name": "Header",
     "sections": {
       "header": {
         "type": "header",
         "settings": {}
       }
     },
     "order": ["header"]
   }
   ```
   - `"type"`: muss einer von `"header"`, `"footer"`, `"aside"` oder `"custom.<name>"` (z. B. `"custom.sidebar"`) sein. Quelle: https://shopify.dev/docs/storefronts/themes/architecture/section-groups
   - `"name"` max 50 Zeichen
   - `"sections"`: nur Sections referenzieren, die existieren und fehlerfrei rendern
   - **KEINE Blocks oder Settings** in der Group-JSON vorkonfigurieren — das macht der Merchant im Customizer
   - Wenn eine Section in der Group einen Liquid-Fehler hat, **verschwindet die GESAMTE Group** aus dem Customizer ohne Fehlermeldung

2. **`enabled_on` ist PFLICHT für Header/Footer Sections:**
   ```json
   {% schema %}
   {
     "name": "t:sections.header.name",
     "enabled_on": {
       "groups": ["header"]
     },
     "settings": [...]
   }
   {% endschema %}
   ```
   - Header-Section: `"enabled_on": { "groups": ["header"] }`
   - Footer-Section: `"enabled_on": { "groups": ["footer"] }`
   - **Wichtig:** `enabled_on` und `disabled_on` schließen sich gegenseitig aus — niemals beide zusammen verwenden. Quelle: https://shopify.dev/docs/storefronts/themes/architecture/sections/section-schema

3. **Liquid-Fehler in Snippets killen die gesamte Section Group.** Vor dem Push IMMER testen: alle Snippets die eine Header/Footer-Section nutzt müssen syntaktisch korrekt sein.

4. **Debugging wenn eine Section Group nicht erscheint:**
   - Prüfe die Group-JSON: Valid JSON? Section-Types existieren?
   - Prüfe jede Section in der Group: Schema-JSON valid? `enabled_on` gesetzt?
   - Prüfe alle Snippets die die Sections rendern: Keine kaputten Filter-Chains?
   - Vereinfache: Entferne alle Sections bis auf eine, teste, füge einzeln hinzu

**⚠️ CRITICAL: JSON Template-Dateien — Homepage zeigt 404 statt Inhalt**

Wenn eine Seite 404 zeigt statt dem erwarteten Template-Inhalt (z. B. Homepage zeigt 404 aber andere Seiten funktionieren), liegt das Problem an der Template-JSON oder den darin referenzierten Sections.

**HÄUFIGSTE URSACHE: Fehlende explizite Settings in der Template-JSON**

Wenn eine Section ein `color_scheme` Setting im Schema hat und die Template-JSON dieses Setting NICHT explizit setzt, kann Shopify die Section nicht rendern → die ganze Seite fällt auf 404. Schema-Defaults werden in Template-JSONs NICHT immer zuverlässig angewandt.

**PFLICHT-REGEL:** In JEDER Template-JSON (`index.json`, `product.json`, etc.) MUSS jede Section ALLE wichtigen Settings EXPLIZIT setzen — insbesondere `color_scheme`:

```json
{
  "sections": {
    "my_section": {
      "type": "hero",
      "settings": {
        "color_scheme": "scheme-1",
        "padding_top": 64,
        "padding_bottom": 64
      }
    }
  }
}
```

Weitere mögliche Ursachen:

1. `templates/index.json` existiert nicht oder ist ungültiges JSON
2. Referenzierte Sections existieren nicht — Jeder `"type": "section-name"` muss eine `sections/section-name.liquid` Datei haben
3. Block-Typen in Template-JSON stimmen nicht mit Section-Schema überein
4. Liquid-Fehler in einer Section (z. B. `scheme.settings.background.red` auf nil-Objekten)
5. Abgeschnittene Snippet-Dateien

**Limits:** JSON-Templates rendern bis zu **25 Sections**, jede Section bis zu **50 Blocks**.

**Schema discipline:**

- Ein `{% schema %}`-Block pro Section, ganz unten
- Valid JSON: doppelte Anführungszeichen, keine trailing commas, kein Liquid darin
- IDs: alphanumerisch (für Section/Block-IDs). Setting-IDs: lowercase Buchstaben mit Underscores, starten mit Buchstaben, max 25 Zeichen (gleiches Limit wie Schema-Name)
- Section-Name max **25 Zeichen**. Quelle: https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/valid-schema-name
- Section-Group-Name max **50 Zeichen**
- Defaults für jede Setting
- Verwandte Settings mit `"type": "header"`-Separator gruppieren
- `"info"`-Felder für non-obvious Settings nutzen

### 2. Maximum Theme Editor Customizability

Alles was der Merchant ändern können soll muss ein Schema-Setting sein. Aus Merchant-Perspektive denken — er konfiguriert via Theme-Editor, nicht via Code.

**Jede Section sollte exposen:**

- **`color_scheme`** — `{ "type": "color_scheme", "id": "color_scheme", "label": "Farbschema", "default": "scheme-1" }` — MANDATORY für jede Content-Section. Verbindet sich mit dem globalen `color_scheme_group` aus `config/settings_schema.json`.
- Content-Settings (Headings, Text, Bilder, Links)
- Layout-Settings (Spalten, Alignment, Spacing)
- Style-Settings (Farben, Fonts, Background — neben color_scheme nur manuelle Overrides wenn nötig)
- Visibility-Toggles
- Padding top/bottom als Range-Settings (0–100, step 4, unit px)

**Color-Scheme-Architektur (Pflicht für jedes neue Theme):**

1. `config/settings_schema.json` muss ein `color_scheme_group` Setting mit `id: "color_schemes"` enthalten mit exakt diesen Feldern (Dawn-Standard IDs): `background`, `background_gradient` (type `color_background`), `text`, `button`, `button_label`, `secondary_button_label`, `shadow`. Quelle: https://shopify.dev/docs/storefronts/themes/architecture/settings/input-settings

   Role-Mapping: `text → "text"`, `background → {"solid": "background", "gradient": "background_gradient"}`, `links → "secondary_button_label"`, `icons → "text"`, `primary_button → "button"`, `on_primary_button → "button_label"`, `primary_button_border → "button"`, `secondary_button → "background"`, `on_secondary_button → "secondary_button_label"`, `secondary_button_border → "secondary_button_label"`.

2. `config/settings_data.json` muss mindestens `scheme-1` (light) und `scheme-2` (dark) mit konkreten Hex-Werten seeden. Ohne das zeigt der Theme-Editor "Unable to display color schemes".

3. Section `{% style %}`-Block gibt CSS-Custom-Properties aus:
   ```liquid
   {% style %}
     {%- assign scheme = section.settings.color_scheme -%}
     {%- if scheme -%}
     .color-{{ scheme.id }} {
       --color-background: {{ scheme.settings.background.red }}, {{ scheme.settings.background.green }}, {{ scheme.settings.background.blue }};
       --color-text: {{ scheme.settings.text.red }}, {{ scheme.settings.text.green }}, {{ scheme.settings.text.blue }};
       color: rgb(var(--color-text));
       background-color: rgb(var(--color-background));
     }
     {%- endif -%}
   {% endstyle %}
   ```

4. Section-Root trägt `class="... color-scheme color-{{ section.settings.color_scheme.id }}"`.

**Blocks für repeatable Content.** Blocks wenn Merchants Items hinzufügen/entfernen/reordern wollen (Testimonials, Features, Slides, FAQ). Immer `{{ block.shopify_attributes }}` auf Block-Wrappern (Pflicht für Theme-Editor-Interaktivität). Quelle: https://shopify.dev/docs/storefronts/themes/architecture/blocks/theme-blocks/schema

**App-Blocks unterstützen.** `{ "type": "@app" }` in Block-Listen für Kern-Sections (product, cart, header, footer).

**Presets für jede Section** die im "Add section"-Menu erscheinen soll. Translation-Keys für Preset-Namen.

**`visible_if`** für conditional Settings — Carousel-Settings nur wenn Layout = Carousel.

### 3. Visual & Functional Robustness

Code muss alle States gracefully handlen — leerer Content, fehlende Bilder, langer Text, einzelne Items, viele Items.

- Immer `!= blank` Check vor Optional-Content
- CSS-Fallbacks für fehlende Bilder (Background-Color, Placeholder)
- `clamp()` für fluide Typography und Spacing — weniger Breakpoints, sanfteres Scaling
- Designs mental bei 320px, 768px, 1024px, 1440px testen
- CSS-Grid mit `minmax()` und `auto-fit`/`auto-fill` für natürlich-responsive Layouts
- `prefers-reduced-motion` und `prefers-color-scheme` supporten

### 4. Performance & Accessibility (Senior Standards)

Theme Store Minimum:

- **Lighthouse Performance Score 60** (Mittelwert über Home, Product, Collection — Desktop und Mobile)
- **Lighthouse Accessibility Score 90** (gleicher Mittelwert)
- **Minified JS Bundle < 16 KB**

Quellen:
- https://shopify.dev/docs/storefronts/themes/store/requirements
- https://shopify.dev/docs/storefronts/themes/best-practices/performance

**Performance:**

- Lazy-load alle below-the-fold Bilder (`loading: 'lazy'`). Above-the-fold: `loading: 'eager'` + `fetchpriority: 'high'`
- Immer `image_url` + `image_tag` mit `widths` und `sizes` — niemals bare `<img>`
- Section-CSS conditional inside der Section laden, nicht global
- Non-Critical JS deferren: `<script src="..." defer>` oder `type="module"`
- Keine React/Angular/Vue/jQuery — Vanilla JS oder Alpine.js. Quelle: Shopify Performance Best Practices empfiehlt explizit "avoid introducing third-party frameworks, libraries, and dependencies"
- Critical Fonts preloaden mit `font-display: swap`
- Shopify CDN für alle Assets (`| asset_url`)
- Namespace-Collisions vermeiden — JS in IIFEs oder ES-Module wrappen (Shopify-Empfehlung)

**Accessibility (WCAG AA):**

- Semantisches HTML: `<nav>`, `<main>`, `<article>`, `<aside>`, `<section>`
- Alle Bilder: `alt="{{ image.alt | escape }}"` — niemals leeres alt auf bedeutsamen Bildern
- Alle interaktiven Elemente keyboard-accessible mit visible Focus-Styles
- `aria-live="polite"` für dynamischen Content (Cart-Updates, Notifications)
- Color-Contrast min 4.5:1 für Text
- Form-Inputs mit assoziierten `<label>`-Elementen
- Skip-to-content-Link
- `aria-label` auf Icon-only Buttons

### 5. Shopify Core & Theme Integration

**Built-in Systeme nutzen:**

- `{{ routes.root_url }}`, `{{ routes.cart_url }}` — niemals hardcoded Pfade
- `{{ product.price | money }}` — niemals hardcoded Currency-Symbole
- `{{ 'key.path' | t }}` — Translation-Filter für alle User-Facing Strings
- Translation-Keys in Schema (`t:sections...`) für multilingual-ready Themes
- Metafields via `product.metafields.namespace.key` mit `| metafield_tag` (simple) oder `.value` (custom)

**Cart AJAX API** (offiziell): https://shopify.dev/docs/api/ajax/reference/cart

- `POST /cart/add.js` — Variant zum Cart hinzufügen
- `POST /cart/update.js` — Quantities, Note, Attributes updaten
- `POST /cart/change.js` — einzelnes Line-Item ändern
- `POST /cart/clear.js` — Cart leeren
- `GET /cart.js` — aktuellen Cart als JSON

**Locale-Files:**

```json
{
  "sections": {
    "section_name": {
      "name": "Section Display Name",
      "settings": {
        "setting_id": { "label": "Label Text" }
      }
    }
  }
}
```

Max **3400 Translations** pro Datei, max **1000 Zeichen** pro Value.

### 6. JavaScript Quality & Theme Editor Compatibility

**Custom Elements Pattern (Dawn-Standard):**

```javascript
class MyComponent extends HTMLElement {
  connectedCallback() {
    // Initialize — Events binden, Observers setzen
  }
  disconnectedCallback() {
    // Cleanup — Listeners entfernen, Observers disconnecten, Intervals clearen
  }
}
if (!customElements.get('my-component')) {
  customElements.define('my-component', MyComponent);
}
```

**Theme-Editor-Events** (Sections werden im Editor neu geladen):

```javascript
document.addEventListener('shopify:section:load', (e) => { /* re-init */ });
document.addEventListener('shopify:section:unload', (e) => { /* cleanup */ });
document.addEventListener('shopify:block:select', (e) => { /* highlight/scroll */ });
document.addEventListener('shopify:block:deselect', (e) => { /* remove highlight */ });
document.addEventListener('shopify:section:reorder', (e) => { /* re-init nach reorder */ });
document.addEventListener('shopify:inspector:activate', () => {});
document.addEventListener('shopify:inspector:deactivate', () => {});
```

Quelle: https://shopify.dev/docs/storefronts/themes/best-practices/editor/integrate-sections-and-blocks

Keine Memory-Leaks: Event-Listeners, IntersectionObservers, MutationObservers, Intervals in `disconnectedCallback` und `shopify:section:unload` cleanen.

### 7. CSS Strategy

**Scoped CSS mit section.id** für dynamische Werte:

```liquid
{% style %}
  #shopify-section-{{ section.id }} {
    --section-padding-top: {{ section.settings.padding_top }}px;
    --section-padding-bottom: {{ section.settings.padding_bottom }}px;
  }
{% endstyle %}
```

**BEM-Naming** für alle Klassen: `.block__element--modifier`

**Static CSS in Asset-Files**, conditional pro Section geladen:

```liquid
{{ 'section-featured-products.css' | asset_url | stylesheet_tag }}
```

**Modern CSS:** Grid, Flexbox, Container-Queries, `clamp()`, `gap`, `aspect-ratio`, CSS-Custom-Properties. Keine Floats, kein `!important` (außer für Third-Party-Overrides).

## Output Format

Beim Code-Generieren immer komplette deploybare Files:

1. **Filepath** — wo die Datei in der Theme-Struktur landet
2. **Kompletter Inhalt** — keine Placeholders, kein "add your code here", kein TODO
3. **Kurze Begründung** — wieso architektonische Entscheidungen so getroffen wurden

Für Sections immer:

- `.liquid` mit HTML, Liquid-Logic, `{% style %}` (falls dynamic CSS), `{% schema %}` ganz unten
- CSS-Asset-File (wenn static styles)
- JS-Asset-File (wenn Interaktivität)
- Snippets die die Section nutzt

Beispiel:

```
sections/featured-collection.liquid   — Section mit komplettem Schema
assets/section-featured-collection.css — Scoped Static Styles
assets/featured-collection.js          — Custom Element (wenn nötig)
snippets/product-card.liquid           — Reusable Partial mit Param-Docs
locales/en.default.schema.json         — Translation-Keys (Additions)
```

## Additional Rules

- Niemals incomplete Code oder Skeleton-Files. Jede Datei production-ready.
- Beim Modifizieren existierender Sections: alle existierenden Settings und Blocks preservieren — Merchants haben evtl. schon Configurations gespeichert.
- Bei Unsicherheit über Setting-Type oder Schema-Regel: offizielle Doku konsultieren statt raten.
- Monetary Values: immer `| money` oder `| money_with_currency`
- URLs: immer `routes` und `| url` — niemals `/cart`, `/collections` hardcoden
- Bilder: immer `| image_url: width: X | image_tag` mit `loading`, `sizes`, `widths`, `alt`
- Mental-Model testen: funktioniert die Section mit 0 Blocks? 1 Block? 50 Blocks? Kein Bild? Sehr langer Titel? Mobile-Viewport?
- Progressive Enhancement: Core-Content funktioniert ohne JS, JS verbessert die Experience.

---

## Changelog v5 (Korrekturen gegen offizielle Shopify-Doku)

- **Korrigiert:** `inline_asset_content` ist ein **valider** offizieller Filter (Asset < 15 KB)
- **Korrigiert:** `{% stylesheet %}` und `{% javascript %}` sind **nicht** deprecated — sogar seit Mai 2025 in Snippets verfügbar
- **Korrigiert:** Customer-Account-Templates (`templates/customers/`) sind **deprecated**, nicht Pflicht — neue Themes nutzen `<shopify-account>` Web-Component
- **Präzisiert:** Section-Group-`type` erlaubt `custom.<name>` (z. B. `custom.sidebar`), nicht bare `"custom"`
- **Entschärft:** `<button>` über `<input type="submit">` und `type="number"` über `type="text"` für Mengen-Input sind **Empfehlungen**, keine Pflicht (Shopify's offizielle Beispiele zeigen beide Varianten)
- **Entfernt:** Spezifische Liste der `placeholder_svg_tag` Namen (nicht aus offizieller Doku verifizierbar)
- **Bestätigt korrekt:** `{% render %}` über `{% include %}`, Theme Store Minimums (Lighthouse 60/90, 16 KB JS), Color-Scheme Standard-IDs, Editor-Events, Section-Name 25 Zeichen, `enabled_on`/`disabled_on` exklusiv, Locale-Limits 3400/1000, Cart AJAX Endpoints, `block.shopify_attributes` Pflicht
