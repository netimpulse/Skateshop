# Kerbside – Theme-Setup & Datenmodell

Einrichtung des Skateboard-Themes für einen Shop: Metafields, Collections, Seiten, Menüs, Filter und Board-Builder.
Demo-Daten für einen Test-Store legt `scripts/demo-data/` an (siehe `scripts/demo-data/README.md`).

## 1. Installation

1. Theme hochladen: `shopify theme push -e development --unpublished` (erzeugt ein unveröffentlichtes Theme) oder den
   Repo-Inhalt als ZIP unter *Onlineshop → Themes → Theme hochladen* einspielen.
2. Sprache: Standard ist Deutsch (`locales/de.default.json`), Englisch liegt in `locales/en.json`. Zusätzliche Sprachen
   unter *Einstellungen → Sprachen* aktivieren und der Markt-Präsenz zuordnen.
3. Im Customizer: Logo, Farben/Akzente (*Theme-Einstellungen → Farben*), Schriften, Social-Links, Warenkorb-Verhalten.

## 2. Metafield-Definitionen (Namespace `custom`)

Anlegen unter *Einstellungen → Benutzerdefinierte Daten*. Storefront-Zugriff aktivieren. Maße in **Zoll** (Dezimalzahl),
Rollendurchmesser in **mm**.

### Produkt

| Key | Typ | Werte / Einheit | Genutzt von |
|---|---|---|---|
| `builder_category` | Einzeiliger Text (Auswahl) | deck, trucks, wheels, bearings, griptape, hardware, riser, complete, accessory | Builder, Spezifikationstabelle (PDP), Platzhalter-Grafik |
| `deck_width` | Dezimalzahl | Zoll, z. B. 8.25 | Filter, Builder (Kompatibilität), PDP-Specs |
| `deck_length` | Dezimalzahl | Zoll, z. B. 31.8 | Filter, Builder-Vorschau, PDP-Specs |
| `wheelbase` | Dezimalzahl | Zoll, z. B. 14.25 | Builder-Vorschau, PDP-Specs |
| `concave` | Einzeiliger Text (Auswahl) | Low, Medium, High | Filter, Builder, PDP-Specs |
| `deck_shape` | Einzeiliger Text (Auswahl) | Popsicle, Shaped, Cruiser | PDP-Specs |
| `truck_width` | Dezimalzahl | Zoll (Achsbreite), z. B. 8.25 | Filter, Builder-Regel „Achsbreite ↔ Deckbreite“ |
| `truck_height` | Einzeiliger Text (Auswahl) | Low, Mid, High | Filter, Builder (Wheelbite-Regel, Profilansicht) |
| `wheel_size` | Ganzzahl | mm, z. B. 54 | Filter, Builder-Regel „Riser ab 56 mm“ |
| `wheel_hardness` | Einzeiliger Text | z. B. 99A, 101A, 84B | Filter, Builder, PDP-Specs |
| `bearing_rating` | Einzeiliger Text (Auswahl) | ABEC 5, ABEC 7, ABEC 9, Swiss, Ceramic | Filter, Builder, PDP-Specs |
| `grip_style` | Einzeiliger Text (Auswahl) | Standard, Color, Pattern | Builder-Filter und Vorschau (Muster), PDP-Specs |
| `hardware_length` | Dezimalzahl | Zoll, z. B. 0.875 (= 7/8") | Builder-Regel „Schrauben mit Risern“, PDP-Specs |
| `riser_height` | Dezimalzahl | Zoll, z. B. 0.125 | Builder-Vorschau, PDP-Specs |
| `preview_layer` | Datei (Bild) | transparentes PNG/WebP, Querformat ca. 2000 × 520 px, nur die Unterseiten-Grafik (Nose links) | Builder-Vorschau (wird in die Deck-Form geclippt) |
| `preview_color` | Farbe | Hex | Builder-Vorschau (Achsen, Rollen, Griptape, Schrauben) |
| `features` | Liste einzeiliger Text | 3–5 Stichpunkte | PDP „Features“ |

### Variante (überschreibt den Produktwert, wenn gesetzt)

`deck_width`, `deck_length`, `wheelbase`, `truck_width`, `wheel_size`, `hardware_length`, `preview_layer`, `preview_color`
(gleiche Typen wie oben). Reihenfolge der Auflösung im Builder: **Varianten-Metafield → Optionswert → Produkt-Metafield**.
Optionswerte werden gelesen, wenn die Option wie folgt heißt: Breite/Width/Größe/Size (Deck, Achse),
Durchmesser/Diameter (Rollen), Länge/Length (Hardware). Unplausible Werte (z. B. „149“ als Achsgröße) werden ignoriert.

### Collection

| Key | Typ | Genutzt von |
|---|---|---|
| `seo_text` | Rich Text | Langer SEO-Text unter dem Produktraster |
| `banner` | Datei (Bild) | Großes Banner im Collection-Kopf |
| `hidden_filters` | Liste einzeiliger Text | Blendet Filter anhand ihres `param_name` aus, z. B. `filter.p.m.custom.concave` |

### Badges (Tags, Namen in *Theme-Einstellungen → Produktkarten*)

`new` → NEW, `bestseller` → BESTSELLER, `limited` → LIMITED; SALE automatisch bei Vergleichspreis; optional NEW nach Alter.

## 3. Collections

| Zweck | Handle (Vorschlag) | Regel |
|---|---|---|
| Kategorien | `decks`, `trucks`, `wheels`, `bearings`, `griptape`, `hardware`, `risers`, `completes`, `accessories` | Produkttyp = Deck / Trucks / … |
| Builder-Schritte | `builder-decks`, `builder-trucks`, `builder-wheels`, `builder-bearings`, `builder-griptape`, `builder-hardware` | Produkttyp + Tag `builder` |
| Builder-Extra | `builder-risers` | Produkttyp Riser Pads + Tag `builder` |
| Homepage | `featured-boards` (Tag `featured`), `bestsellers` (Tag `bestseller`) | |

Neue Produkte erscheinen automatisch im Builder, sobald sie in der jeweiligen `builder-*`-Collection sind – kein JS nötig.
Ein Builder-Schritt lädt maximal 500 Produkte (10 × 50).

## 4. Seiten und Templates

| Seite | Handle | Template |
|---|---|---|
| Skateboard-Konfigurator | `skateboard-builder` | `page.skateboard-builder` |
| Marken | `brands` | `page.brands` |
| Kontakt | `contact` | `page.contact` |
| Versand, Rückgabe, Über uns, Größenberatung | frei | `page` |

## 5. Menüs

- Hauptmenü (Header-Setting „Menü“): Punkte mit Unterpunkten werden zum Mega-Menü, Unter-Unterpunkte zu Spalten.
  Beispiel: Skateboards › Completes/Decks/…; Decks; Trucks; Wheels; Bearings; Zubehör › Griptape/Hardware/Riser;
  Konfigurator → `/pages/skateboard-builder`; Brands → `/pages/brands`.
- Footer: drei Link-Blöcke (Shop, Hilfe, Über uns) mit je einem Menü.

## 6. Filter (Search & Discovery)

Die Filter kommen aus der App *Shopify Search & Discovery → Filter* (nicht per API setzbar). Filter ohne Werte in einer
Collection blendet Shopify automatisch aus – so entstehen die kategorieabhängigen Filter.

Empfohlene Filterliste: Verfügbarkeit, Preis, Hersteller (Marke), Option „Breite“, `custom.deck_width`, `custom.deck_length`,
`custom.concave`, `custom.truck_width`, `custom.truck_height`, Option „Durchmesser“, `custom.wheel_size`,
`custom.wheel_hardness`, `custom.bearing_rating`, Option „Farbe“ (als Swatch).

| Kategorie | Filter |
|---|---|
| Decks | Marke, Preis, Breite, Länge, Farbe, Concave, Verfügbarkeit |
| Trucks | Marke, Preis, Breite, Höhe, Farbe |
| Wheels | Marke, Preis, Durchmesser, Härte, Farbe |
| Bearings | Marke, Preis, Rating |

## 7. Board-Builder

- Section **Board Builder** auf der Seite `skateboard-builder`: ein Block **Schritt** je Bauteil (Deck, Trucks, Wheels,
  Bearings, Griptape, Hardware) mit Collection, Kurzname, Überschrift, Hinweistext, Filterliste und „Pflichtschritt“.
  Reihenfolge = Reihenfolge der Blöcke.
- Filter-Schlüssel je Schritt (kommagetrennt, leer = Standard): `vendor, price, available, color, deck_width, deck_length,
  concave, truck_width, truck_height, wheel_size, wheel_hardness, bearing_rating, grip_style, hardware_length`.
- Kompatibilitätsregeln stehen zentral in `assets/board-builder-rules.js` (`CONFIG` + `RULES`): Achsbreite ±0.25" zur
  Deckbreite, Riser-Hinweis ab 56 mm, Wheelbite bei Low Trucks, Schraubenlänge mit Risern. Toleranz und Riser-Schwelle sind
  zusätzlich als Section-Settings einstellbar. Neue Regel = neuer Eintrag in `RULES` + Text unter `builder.rules.*` in beiden
  Locale-Dateien.
- Warenkorb: Alle Teile werden mit einem Request hinzugefügt, jede Zeile trägt die versteckten Properties `_build_id`,
  `_build_part`, `_build_pos`. Drawer und Warenkorbseite gruppieren sie als „CUSTOM BOARD BUILD“; ein Build ist nur als
  Ganzes entfernbar. Teile sind Sets (Achsen-Paar, 4 Rollen, 8 Lager, Schraubensatz) und werden mit Menge 1 gelegt.
- Auswahl wird im Browser gespeichert (`localStorage`, 30 Tage); Preise und Verfügbarkeit werden immer frisch geladen.
- Deep-Link: `/pages/skateboard-builder?deck=<produkt-handle>` wählt ein Deck vor, `?step=trucks` öffnet einen Schritt.

## 8. Produktbilder

Jedes Produkt zeigt ein Bild; ohne Bild erscheint automatisch ein technischer Platzhalter im Shop-Stil. Empfehlung:
Produktfotos freigestellt auf neutralem Hintergrund, Hochformat 4:5, mindestens 1600 px Breite; zweites Bild für den
Hover-Wechsel auf Produktkarten.
