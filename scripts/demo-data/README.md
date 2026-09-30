# Demo-Daten für das Skateshop-Theme

Legt im Dev-Store per Admin API (2025-07) alles an, was das Theme zum Testen braucht: Metafield-Definitionen,
Bilder, 33 Produkte, Smart Collections, Seiten und Menüs. Alles ist markiert und mit `cleanup.mjs` wieder löschbar.
Der Store wird mit anderen Projekten geteilt – die Skripte ändern oder löschen **nichts, was nicht vom Seed stammt**.

## Voraussetzungen

- Node 22, Aufruf immer mit `NODE_USE_ENV_PROXY=1` (fetch über den Proxy)
- Umgebungsvariablen `SHOPIFY_STORE_URL` und `SHOPIFY_ADMIN_TOKEN` (nie ins Repo schreiben, nie loggen)
- Admin-API-Scopes: `write_products`, `write_inventory`, `write_content` bzw. `write_online_store_pages`,
  `write_online_store_navigation`, `write_files`, `write_publications`
- Für den Schritt `images`: Playwright 1.56 global unter `/opt/node22/lib/node_modules/playwright`,
  Chromium unter `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers` (wird automatisch gesetzt)

## Aufruf

```bash
NODE_USE_ENV_PROXY=1 node scripts/demo-data/seed.mjs                 # alle Schritte
NODE_USE_ENV_PROXY=1 node scripts/demo-data/seed.mjs --dry-run       # nur anzeigen, nichts ändern
NODE_USE_ENV_PROXY=1 node scripts/demo-data/seed.mjs --only=images,files
NODE_USE_ENV_PROXY=1 node scripts/demo-data/seed.mjs --only=report --report=.werkbank-tmp/fixtures/seed.json

NODE_USE_ENV_PROXY=1 node scripts/demo-data/cleanup.mjs --dry-run
NODE_USE_ENV_PROXY=1 node scripts/demo-data/cleanup.mjs                # Daten löschen, Definitionen behalten
NODE_USE_ENV_PROXY=1 node scripts/demo-data/cleanup.mjs --definitions  # zusätzlich die Seed-Definitionen
```

Schritte (Reihenfolge): `defs, images, files, products, collections, pages, menus, report`.
Jeder Schritt lässt sich auch einzeln starten (`node scripts/demo-data/products.mjs --dry-run`).
Weitere Flags: `--handle=a,b` (nur diese Produkte), `--filter=teil` (nur passende Bilder rendern), `--report=<pfad>`.

## Idempotenz und Schutz fremder Daten

| Ressource | Erkennung „gehört dem Seed“ | Bei Konflikt |
|---|---|---|
| Metafield-Definitionen | Beschreibung endet auf `[skate-demo]` | Gleicher Key vorhanden → übersprungen und gemeldet |
| Produkte | Tag `skate-demo`, Upsert per `productSet(identifier: {handle})` | Handle ohne Tag → nicht angefasst, gemeldet |
| Collections | Metafield `skate_demo.seeded = true` | Handle ohne Marker → nicht angefasst, gemeldet |
| Seiten | Metafield `skate_demo.seeded = true` | Fremde Seite → bleibt, Demo-Seite unter `skate-<handle>` |
| Menüs | Handle beginnt mit `skate-`; Cleanup löscht nur die exakten Seed-Handles (`MENUS`) | `main-menu` & Co. werden nie berührt |
| Dateien | Dateiname `skate-demo-*` | Vorhandene Namen werden nicht neu hochgeladen |

Alle Smart Collections verlangen zusätzlich den Tag `skate-demo`, damit keine Produkte anderer Projekte hineinrutschen.
Varianten behalten beim erneuten Lauf ihre IDs (Abgleich über die Optionswerte). Bestände werden bei jedem Lauf
auf die Katalogwerte zurückgesetzt.

## Was angelegt wird

- **Definitionen** (Namespace `custom`, Storefront `PUBLIC_READ`, angepinnt): Plan 2e inkl. Variant-Definitionen für
  `deck_width`, `deck_length`, `wheelbase`, `truck_width`, `wheel_size`, `hardware_length`, `preview_layer`, `preview_color`;
  Collection: `seo_text`, `banner`, `hidden_filters`. Choices-Validierung für `builder_category`, `concave`, `deck_shape`,
  `truck_height`, `bearing_rating`, `grip_style`.
- **Marken** (`data/brands.mjs`, fiktiv, per Websuche gegen reale Skate-/Surf-Marken geprüft): Axlemoor, Boltworks,
  Duskline, Gritfield, Nine Ply Co., Quarry Lane, Rolltype, Swiftbore.
- **Produkte** (`data/catalog.mjs`): 8 Decks (Option „Breite“, 3 Breiten), 5 Trucks, 5 Wheels (Option „Durchmesser“,
  u. a. 58 mm), 3 Bearings, 3 Griptape (eins mit Option „Farbe“), 2 Hardware (Option „Länge“, eins zusätzlich „Farbe“),
  2 Riser, 3 Completes, 2 Zubehör. Tags `skate-demo`, `builder` (alle Builder-Teile), `bestseller`, `featured`, `new`,
  `limited`; einige mit Vergleichspreis. Bestand getrackt 5–40, genau eine Variante mit Bestand 0
  (Checker Classic Deck 7.75") und genau eine mit Bestand 1 (Curb Wax).
- **Bilder** (`lib/svg.mjs`, `lib/scenes.mjs`, Ausgabe `.out/images/`, nicht im Repo): je Produkt zwei Ansichten
  (1600×2000), je Deck ein transparenter Preview-Layer (2000×520, quer, Nose links, randabfallend – das Theme clippt
  ihn in die Deckform), Section-Bilder: Hero, 5 Kategorien, 3 Editorial, 6 Community, Builder-Promo und 3 Collection-Banner.
- **Collections**: `decks, trucks, wheels, bearings, griptape, hardware, risers, completes, accessories`,
  `builder-decks … builder-risers`, `bestsellers`, `featured-boards`, `skate-all`.
- **Seiten**: `skateboard-builder`, `brands`, `contact` (jeweils mit `templateSuffix`), `versand`, `rueckgabe`,
  `ueber-uns`, `groessenberatung`. Im Dev-Store gehören `contact` und `ueber-uns` einem anderen Projekt – die
  Demo-Seiten heißen dort `skate-contact` (Template `contact`) und `skate-ueber-uns`.
- **Menüs**: `skate-main-menu`, `skate-footer-shop`, `skate-footer-help`, `skate-footer-about`.

## Report

`report` liest den Stand aus dem Store zurück und schreibt JSON (Standard `.out/seed-report.json`): Produkt-Handles je
Kategorie, Varianten mit Bestand 0/1, Deck mit drei Breiten, Wheel mit 58 mm, Collections mit Produktanzahl, Seiten
(inkl. Template-Suffix und Fallback), Menüs und die exakten Dateinamen der Section-Bilder für
`shopify://shop_images/<dateiname>`.

## Hinweise

- Search-&-Discovery-Filter lassen sich nicht per API anlegen (siehe `docs/theme-setup.md`).
- Die Storefront ist passwortgeschützt; `products.json`/`.js`-Endpunkte antworten ohne Passwort mit einem Redirect.
- Werden Bilder neu gerendert, lädt `files` sie nicht erneut hoch (gleicher Name). Zum Austausch zuerst
  `cleanup.mjs` ausführen oder die betroffenen Dateien im Admin löschen.
