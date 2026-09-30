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
   notiere sie unter `## Offene Abhängigkeiten (To-do)

> Geplante Verbindungen, die noch nicht im Code existieren.
> Claude trägt hier ein, was später noch verdrahtet werden muss.

- [ ] Search & Discovery: Filter laut `docs/theme-setup.md` Abschnitt 6 anlegen (Breite, Länge, Concave, Achsbreite, Höhe,
      Durchmesser, Härte, Rating, Farbe als Swatch) – derzeit nur Verfügbarkeit + Preis aktiv. Nur in der App möglich.
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
