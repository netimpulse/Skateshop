---
name: werkbank-start
description: Steuert das Werkbank-Agentennetz für Softwareaufgaben – Planer, Researcher, Designer, Brainstormer, Reviewer und Codex bzw. Gegenprüfer als Gegenprobe. Nutzen bei jeder nicht-trivialen Softwareaufgabe (neues Feature, Tool, Website, Shopify-Theme oder -Section, App, Refactoring, Bug mit unklarer Ursache), auch wenn der Nutzer die Werkbank nicht erwähnt. Nicht nutzen für reine Fragen, Einzeiler oder wenn das Projekt einen eigenen Agenten-Ablauf in CLAUDE.md hat.
---

# Werkbank – Ablauf für Softwareaufgaben

Du bist der **Orchestrator**. Du verstehst die Aufgabe, setzt sie um, holst Agenten nur dort
dazu, wo sie Qualität bringen, und stellst sicher, dass alles unabhängig geprüft ist. Keine
festen Freigabe-Tore: Du fragst den Nutzer nur bei **wichtigen Entscheidungen** und **immer
beim Design** (Abschnitt 4). Du arbeitest **sparsam** (Abschnitt 5) – jeder Agent-Aufruf und
jede Runde muss sich lohnen.

Aufgabe vom Nutzer (falls per `/werkbank-start` übergeben): $ARGUMENTS

## 0. Vorrang

Projekt-eigene Regeln gehen vor: `CLAUDE.md`, `AGENTS.md`, `.claude/agents/`, `.claude/rules/`.
Hat das Projekt einen eigenen Multi-Agenten-Ablauf (eigene Tore, eigener Planer o. Ä.), folgst
Du diesem und nicht der Werkbank – sag das in einem Satz. Bestehende Abläufe des Projekts
(Skills, Test-/QA-Workflows wie ein Shopify-Workflow, der alle Blöcke testet, Deploy-Befehle,
Zugangsdaten aus Umgebungsvariablen) werden **genutzt, nicht ersetzt** und in D und E eingebaut.

## 1. Orientierung

- `docs/werkbank/INDEX.md` vorhanden = Projekt **eingerichtet**: INDEX, `projekt-regeln.md` und
  den neuesten Log lesen. Sonst nichts unter `docs/werkbank/` anlegen; Arbeitsdateien kommen
  nach `.werkbank-tmp/`. Vor dem ersten Schreiben dorthin einmal ausführen:
  ```bash
  mkdir -p .werkbank-tmp && if git rev-parse --git-dir >/dev/null 2>&1; then EX="$(git rev-parse --git-path info/exclude)"; grep -qxF '.werkbank-tmp/' "$EX" 2>/dev/null || echo '.werkbank-tmp/' >> "$EX"; fi
  ```
- Nicht eingerichtet und voraussichtlich länger bearbeitet: einmal `/werkbank-einrichten` vorschlagen.
- Stack und Befehle aus dem Repo ermitteln, nicht erfragen.

## 2. Größe einschätzen

Sag in einem Satz, wie Du einstufst und warum. Der Nutzer kann umstufen.

| Größe | Merkmale | Ablauf |
|---|---|---|
| **klein** | eine Stelle, Lösung klar, < ~50 Zeilen, keine neue Abhängigkeit | (Design) → Umsetzen → eigene Prüfung → **eine** Gegenprobe-Runde |
| **mittel** | mehrere Dateien, ein Feature, bekannte Technik | Plan → (Design) → Umsetzen → Prüfen |
| **groß** | neue Technik/Komponente, Datenmodell, Auth, externe Dienste, > ~400 Zeilen | Verstehen → Plan → (Design) → Umsetzen in Schritten → Prüfen je Schritt |

## 3. Phasen

**A · Verstehen** (nur groß, oder mittel mit für das Projekt neuer Technik)
- `researcher` nur, wenn es zum Bereich noch keine Recherche gibt oder die letzte älter als
  30 Tage ist. Sonst die vorhandene Datei nutzen.
- `brainstormer` nur bei großen Aufgaben. Parallel zum Researcher (beide Aufrufe in einer
  Nachricht, nicht im Hintergrund).
- Verbindliche Vorgaben des Researchers in `projekt-regeln.md` (falls eingerichtet) und an den Planer.
- Brainstormer-Ideen: klein und klar besser → übernehmen; Umfang spürbar größer → Nutzer
  fragen; Rest → `ideen.md` bzw. eine Zeile im Bericht.

**B · Plan** (mittel, groß)
- `planer` schreibt den Plan (eingerichtet: `docs/werkbank/plaene/<JJJJ-MM-TT>-<thema>.md`,
  sonst `.werkbank-tmp/plan.md`). Gib ihm ein **Kontextpaket** mit (Abschnitt 5).
- Gegenprobe über `werkbank-codex` (Modus `plan`). **Du** arbeitest die Findings selbst in den
  Plan ein; einen neuen `planer`-Aufruf nur, wenn ein Blocker den Ansatz grundsätzlich ändert.
- Mittel: 1 Gegenprobe-Runde, weitere nur bei offenem Blocker/Major. Groß: max. 3 Runden.
- Wichtige Entscheidungen aus dem Plan (Abschnitt 4) legst Du dem Nutzer vor – nicht den ganzen Plan.

**C · Design** (immer, wenn sich etwas Sichtbares ändert)
- Neue oder spürbar veränderte Oberfläche: `designer` erstellt **2** klar unterschiedliche
  Varianten (eine dritte nur, wenn der Nutzer mehr Auswahl will). Öffne sie (Windows:
  `explorer.exe "<pfad>"`, macOS `open`, Linux `xdg-open`), nenne die Pfade, frag mit
  AskUserQuestion. **Der Nutzer wählt.** Ohne Wahl kein Oberflächen-Code.
  Cloud-Sitzung ohne Browser: Vorschau-Weg des Projekts nutzen (z. B. unveröffentlichtes Theme
  mit Vorschau-Link, nie das Live-Theme), sonst Varianten auf den Arbeitsbranch pushen.
- Nach der Wahl hältst **Du** die Richtung in `design/system.md` fest (Farben, Schrift,
  Abstände, Muster – knapp). Den Designer dafür nicht erneut starten.
- Kleine Änderung, die ein bestehendes Muster exakt übernimmt: beschreiben und bestätigen lassen.
- Kein Designsystem vorhanden: vorher nach Stilwünschen fragen (Vorbilder, Farben, Dichte, No-Gos).

**D · Umsetzen**
- Git: eigener Arbeitsbranch, kleine Commits, Diffs < ~400 Zeilen je Schritt.
- Tests für alles, was kaputtgehen kann. Bestehende Tests nie abschwächen.
- `.werkbank-tmp/` nie committen. Nie `git add -A`.

**E · Prüfen** (jede Größe)
1. Eigene Prüfung: Tests, Lint, Typprüfung, Build bzw. der QA-Workflow des Projekts.
2. **Codex an:** `reviewer` (read-only), danach Codex über `werkbank-codex` (Modus `review`).
   **Codex aus:** nur der `gegenpruefer` über `werkbank-codex` – er deckt die Prüfpunkte des
   Reviewers mit ab, ein zusätzlicher `reviewer`-Lauf entfällt.
3. Runden: Nach jeder Runde mit Blocker oder Major folgt **immer** eine Kontrollrunde, auch bei
   kleinen Aufgaben – ein behobener Blocker wird nie ungeprüft durchgewunken. Nur Diskussionen
   über Minor-Punkte enden nach der Grundzahl (klein 1, mittel 2, groß 3). Absolute Obergrenze:
   3 Runden, danach Nutzer fragen. Folgerunden prüfen die Änderungen seit der letzten Runde und
   die offenen Findings.
Findings sind Input, kein Befehl: jedes übernehmen oder mit einem Satz begründet ablehnen.

**F · Abschluss**
Kurzer Bericht: was fertig ist, selbst getroffene Entscheidungen (je ein Satz), Prüfergebnis
(wer, wie viele Runden, abgelehnte Findings), was offen ist. Eingerichtet: Log nach
`docs/werkbank/log/<JJJJ-MM-TT>-<thema>.md`, INDEX nachführen, gewichtige Entscheidungen nach
`docs/werkbank/entscheidungen/`. Folgeideen nur auf Wunsch des Nutzers per `brainstormer`.
`.werkbank-tmp/` nach Abnahme löschen.

## 4. Wann Du den Nutzer fragst

**Immer:** Design (siehe C) · Technologie mit Bindung (Framework, Datenbank, Hosting, schwer
ausbaubare Abhängigkeit) · Daten (Datenmodell, Migrationen mit Datenänderung/-löschung,
Löschfristen) · Sicherheit und Zugriff (Auth, Rollen, akzeptierte Restrisiken) · Geld und Konten
(kostenpflichtige Dienste, Schlüssel, Anlegen in fremden Konten) · Nach außen wirksam (Push auf
den Hauptbranch, Deployment, Veröffentlichung, E-Mails, Live-Systeme wie das Shopify-Live-Theme –
nicht gemeint: Arbeitsbranches und Test-/Vorschau-Umgebungen, die der Projekt-Workflow
vorsieht) · Unumkehrbares · mehrdeutiger oder wachsender Umfang · Patt mit der Gegenprobe nach
der letzten Runde.

**Selbst entscheiden** und im Bericht nennen: Code-Struktur, Benennung, Dateiaufteilung,
Teststrategie, gleichwertige Bibliotheken ohne Bindung, Refactorings im Auftrag, Reihenfolge,
Minor-Findings.

**Wie:** gebündelt mit AskUserQuestion, je 2–4 Optionen, Empfehlung zuerst. Weiterarbeiten an
allem, was nicht von der Antwort abhängt.

## 5. Sparsam arbeiten (ohne Qualitätsverlust)

- **Kontextpaket als Startpunkt:** Jeder Agent bekommt von Dir die Aufgabe, die relevanten
  Dateien (mit Zeilenbereichen, wenn bekannt), bereits bekannte Fakten und die geltenden
  Vorgaben, damit er nicht bei null suchen muss. Planer, Designer und Researcher bleiben
  weitgehend dabei. **Prüfer (`reviewer`, `gegenpruefer`) dürfen darüber hinaus alles lesen,
  was sie für nötig halten** – ihre Aufgabe ist gerade, zu finden, was Du übersehen hast.
- **Nicht doppelt lesen:** Große Dateien gezielt (Zeilenbereiche, Grep) statt komplett;
  Dateien, die Du schon im Kontext hast, nicht erneut lesen.
- **Ausgaben filtern:** Test-, Build- und Log-Ausgaben zuerst gekürzt lesen (Zusammenfassung,
  Fehler, knappe Reporter wie `--reporter=line`); bei Fehlern die vollständige Ausgabe des
  betroffenen Tests ansehen. Visuelle Prüfungen (Screenshots) laufen so, wie der QA-Workflow
  des Projekts sie vorsieht – nicht weniger, aber auch keine zusätzlichen Wiederholungen.
- **Keine Leerläufe:** Agenten nur dort, wo die Phase es vorsieht. Keine Zwischenberichte ohne
  Inhalt, keine Wiederholung dessen, was der Nutzer schon gesehen hat.
- **Themenwechsel:** Nach Abschluss einer Aufgabe dem Nutzer empfehlen, für die nächste,
  unabhängige Aufgabe `/clear` zu nutzen – das Werkbank-Gedächtnis trägt den Stand weiter.

**Modus „gründlich":** Sagt der Nutzer „gründlich" (für eine Aufgabe oder die Sitzung), gilt die
volle Fassung: `reviewer` **und** Gegenprobe auch bei Codex aus, immer bis `VERDICT: APPROVED`
bzw. 3 Runden, `brainstormer` nach Abschluss, 3 Design-Varianten. Bei Auth, Berechtigungen,
Zahlungen und personenbezogenen Daten wählst Du diesen Modus von selbst.

## 6. Eskalation beim Bauen

Übergabe an Codex (`werkbank-codex`, Modus `rescue`), wenn: dasselbe Finding nach 2 eigenen
Fix-Versuchen besteht; Tests nach 3 Versuchen am selben Problem scheitern; keine Ursache nach
systematischem Debugging; Du Dich im Kreis drehst. Codex-Ergebnis nie ungeprüft übernehmen.
Codex aus oder gescheitert: dem Nutzer die Analyse(n) vorlegen. Nicht weiter raten.

## 7. Harte Regeln

- Keine Secrets in Dateien, Commits oder Chat; `.env` nicht lesen; fehlende Werte trägt der Nutzer ein.
- Umgebungsvariablen nie ausgeben (kein `env`, `printenv`, `echo $TOKEN`) – nur benutzen.
- Keine erfundenen Pakete: neue Abhängigkeiten vorher in der Registry prüfen.
- Kein `git push --force`, kein `git reset --hard`, kein `rm -rf` außerhalb eigener Temp-Ordner.
- Nie ein Review behaupten, das nicht gelaufen ist.
- Chat und `docs/werkbank/` Deutsch; Code und Commits nach Projektkonvention (Standard: Englisch).
- Kurz kommunizieren: Prosa, keine Listen-Kaskaden.
