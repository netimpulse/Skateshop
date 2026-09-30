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
- **Theme-Basis:** <!-- z.B. Dawn / Skeleton / Custom – bitte ergänzen -->
- **Zweck / Shop:** <!-- kurz beschreiben -->

## Konventionen

- CSS wird pro Section gescoped (keine globalen Klassen-Kollisionen).
- Keine Inline-Styles.
- Snippets für wiederverwendbare Bausteine, Sections für Seitenblöcke.
- Kundengebundene Daten laufen über `customer.metafields` (Namespace unten notieren).
- <!-- weitere Regeln nach Bedarf ergänzen -->

---

## Architektur & Abhängigkeiten

> Der zentrale Abhängigkeits-Log. Hier trägt Claude laufend ein,
> welches Feature mit welchem zusammenhängt (siehe Memory-Pflege-Regel oben).

### Wishlist / Favoriten
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

- [ ] Header: Wishlist-Counter an `customer.metafields.custom.wishlist` anbinden

---

## Metafields & Namespaces (Referenz)

| Namespace.Key | Typ | Verwendung |
|---|---|---|
| `custom.wishlist` | list / json | Gespeicherte Favoriten pro Kunde |
| <!-- weitere --> | | |
