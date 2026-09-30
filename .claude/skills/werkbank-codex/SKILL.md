---
name: werkbank-codex
description: Unabhängige Gegenprobe durch Codex (OpenAI, lokale Codex CLI mit ChatGPT-Login) oder – wenn Codex ausgeschaltet oder nicht verfügbar ist – durch den Agenten gegenpruefer. Modi plan, review, rescue; mit „aus" bzw. „an" wird Codex für das Projekt ab- oder angeschaltet. Direkt aufrufbar, z. B. /werkbank-codex review oder /werkbank-codex aus.
---

# Codex als Gegenprobe

Gewünschter Modus (falls übergeben): $ARGUMENTS

## Schalter: Codex an oder aus

- **`aus`** als Modus: In `.claude/settings.json` des Projekts unter `"env"` den Eintrag
  `"WERKBANK_CODEX": "aus"` setzen (Datei anlegen oder zusammenführen, übrige Einträge behalten,
  JSON gültig halten). Dem Nutzer sagen: gilt ab sofort für dieses Projekt, auch in
  Cloud-Sitzungen, sobald die Datei committet ist. Nur für sich selbst statt fürs Team:
  `.claude/settings.local.json` verwenden. Fertig – kein weiterer Modus.
- **`an`** als Modus: den Eintrag wieder entfernen (in beiden Dateien). Fertig.
- Sagt der Nutzer im Chat „ohne Codex", gilt das für die laufende Sitzung, ohne Datei.
- Alternativ lässt sich die Umgebungsvariable `WERKBANK_CODEX=aus` direkt setzen, z. B. in den
  Einstellungen einer Cloud-Umgebung.

Vor jedem Einsatz prüfen:

```bash
echo "WERKBANK_CODEX=${WERKBANK_CODEX:-an}"; command -v codex >/dev/null && echo "codex-cli: vorhanden" || echo "codex-cli: fehlt"
```

Steht dort `aus` (oder `off`), fehlt die CLI oder hat der Nutzer „ohne Codex" gesagt, gilt **Codex aus** –
dann direkt den Abschnitt „Gegenprüfer statt Codex" nutzen und keinen Codex-Aufruf versuchen.

## Grundregeln für jeden Aufruf

- Alle Befehle aus dem Projektordner. Arbeitsdateien liegen in `.werkbank-tmp/` (siehe unten).
- Jeden `codex exec`-Aufruf mit Bash-Timeout **600000 ms** ausführen. Codex braucht oft länger
  als die Standard-Zeitgrenze.
- Der Prompt kommt immer als Datei über stdin (`- < datei`), nie als langes Argument.
- Freie Texte (Aufgabe, Feedback, Übergabe) schreibst Du mit dem Write-Werkzeug in Dateien
  unter `.werkbank-tmp/` – nie in Anführungszeichen in die Befehlszeile.
- Vor jedem Aufruf die Ausgabedatei löschen; nur bei Exit-Code 0 und nicht leerer Datei gilt
  das Ergebnis. Sonst: Codex nicht verfügbar (siehe unten).
- Codex liest `AGENTS.md` im Projekt selbst. Modell und Denkaufwand stellt der Nutzer global in
  `~/.codex/config.toml` ein – nicht hier.

## Vorbereitung (nur bei Codex an, einmal pro Sitzung)

```bash
codex login status
```

```bash
mkdir -p .werkbank-tmp && if git rev-parse --git-dir >/dev/null 2>&1; then EX="$(git rev-parse --git-path info/exclude)"; grep -qxF '.werkbank-tmp/' "$EX" 2>/dev/null || echo '.werkbank-tmp/' >> "$EX"; fi
```

**Codex nicht verfügbar** (Login fehlt, Aufruf scheitert, Kontingent erschöpft, leere Antwort):
für diesen Schritt den Abschnitt „Gegenprüfer statt Codex" nutzen und im Abschlussbericht
deutlich sagen, dass keine Codex-Prüfung lief und warum. Bei erschöpftem Kontingent dem Nutzer
zusätzlich anbieten, die Codex-Prüfung später nachzuholen.

## Gegenprüfer statt Codex

Wenn Codex aus oder nicht verfügbar ist, übernimmt der Agent `gegenpruefer` dieselbe Rolle –
gleiche Prompts, gleiche Kriterien, gleiche Schleife und Rundenregel, gleiche `VERDICT`-Zeile.
Ist Codex aus, entfällt der separate `reviewer`-Lauf – der Gegenprüfer deckt dessen Prüfpunkte
mit ab (außer im Modus „gründlich").
Starte ihn mit:
- Modus (`plan` oder `review`),
- Prompt-Datei `${CLAUDE_SKILL_DIR}/prompts/plan.md` bzw. `${CLAUDE_SKILL_DIR}/prompts/review.md`,
- im Modus review die Kriterien `${CLAUDE_SKILL_DIR}/kriterien.md`,
- Plan-Pfad bzw. Aufgabenbeschreibung und was genau zu prüfen ist,
- in Folgerunden: nur seine offenen Findings, was davon umgesetzt bzw. begründet abgelehnt wurde,
  und den Diff seit der letzten Runde (`git diff` gegen den damaligen Stand) – keinen Neustart der
  kompletten Prüfung.

Gib ihm **nicht** Deine eigene Begründung oder Einschätzung mit – er soll unvoreingenommen prüfen.
Im Abschlussbericht heißt es dann „Gegenprobe: gegenpruefer (Codex aus)", nicht „Codex".
Modus `rescue` ohne Codex: nicht verfügbar – stattdessen dem Nutzer die festgefahrene Analyse
vorlegen und um Entscheidung bitten.

## Modus `plan` – Plan zerlegen lassen

`<PLAN-DATEI>` durch den Pfad des Plans ersetzen.

```bash
{ cat "${CLAUDE_SKILL_DIR}/prompts/plan.md"; printf '\n=== PROJEKTREGELN ===\n'; cat docs/werkbank/projekt-regeln.md 2>/dev/null || echo 'keine'; printf '\n=== PLAN ===\n'; cat "<PLAN-DATEI>"; } > .werkbank-tmp/codex-in.md && rm -f .werkbank-tmp/codex-out.md && codex exec --skip-git-repo-check -s read-only -o .werkbank-tmp/codex-out.md - < .werkbank-tmp/codex-in.md && cat .werkbank-tmp/codex-out.md
```

## Modus `review` – Änderungen prüfen, Schleife bis Freigabe

Vorher: Tests/Lint grün und `reviewer`-Agent gelaufen.

1. Schreib mit dem Write-Werkzeug `.werkbank-tmp/auftrag.md`:
   - **Plan:** Pfad der Plan-Datei, oder bei kleinen Aufgaben ein Satz, was geändert werden sollte.
   - **Zu prüfen:** genau benennen, z. B. „Uncommittete Änderungen (git diff, git status)"
     oder „`git diff main...HEAD` plus uncommittete Änderungen". Außerhalb eines Git-Repos:
     die geänderten Dateien einzeln auflisten.
2. Aufruf:

```bash
{ cat "${CLAUDE_SKILL_DIR}/prompts/review.md"; printf '\n=== PRÜFKRITERIEN ===\n'; cat "${CLAUDE_SKILL_DIR}/kriterien.md"; printf '\n=== PROJEKTREGELN ===\n'; cat docs/werkbank/projekt-regeln.md 2>/dev/null || echo 'keine'; printf '\n=== AUFTRAG ===\n'; cat .werkbank-tmp/auftrag.md; } > .werkbank-tmp/codex-in.md && rm -f .werkbank-tmp/codex-out.md && codex exec --skip-git-repo-check -s read-only -o .werkbank-tmp/codex-out.md - < .werkbank-tmp/codex-in.md && cat .werkbank-tmp/codex-out.md
```

Ist ein Plan angegeben, liest Codex ihn selbst aus dem Repo.

Schleife:
1. Jedes Finding bewerten: übernehmen oder mit einem Satz Begründung ablehnen.
2. Übernommene beheben, Tests erneut laufen lassen.
3. Folgerunde in derselben Codex-Session. Die Session-ID steht im Kopf der Codex-Ausgabe
   (`session id: …`). Feedback mit dem Write-Werkzeug nach `.werkbank-tmp/runde.md`:
   „Umgesetzt: … Abgelehnt mit Begründung: … Prüfe diese Änderungen und Deine offenen Findings;
   schwere Fehler außerhalb davon trotzdem melden. Gleiches Format, gleiche VERDICT-Zeile." Dann:
   ```bash
   rm -f .werkbank-tmp/codex-out.md && codex exec resume <SESSION-ID> -c 'sandbox_mode="read-only"' -o .werkbank-tmp/codex-out.md - < .werkbank-tmp/runde.md && cat .werkbank-tmp/codex-out.md
   ```
4. Ende bei `VERDICT: APPROVED`. Nach einer Runde mit Blocker/Major folgt immer eine
   Kontrollrunde; reine Minor-Diskussionen enden nach der Grundzahl (klein 1, mittel 2, groß 3).
   Absolute Obergrenze 3 Runden. Offene Blocker/Major danach
   sind eine wichtige Entscheidung für den Nutzer: beide Sichtweisen nebeneinander, Empfehlung.

## Modus `rescue` – Übergabe bei Blockade

Nur in einem Git-Repo auf einem Arbeitsbranch. Außerhalb von Git oder auf dem Hauptbranch
erst den Nutzer fragen, weil Codex' Änderungen sonst nicht nachvollziehbar wären.

1. Übergabe mit dem Write-Werkzeug nach `.werkbank-tmp/handoff.md`: Ziel · Beobachtet vs.
   erwartet (Fehlermeldung, Befehl) · Bereits versucht (mit Ergebnis) · Relevante Dateien ·
   Grenzen (keine Tests abschwächen, kein Scope-Zuwachs, keine Secrets, keine `.env`) · Am Ende
   die Ursache und die Änderungen in wenigen Sätzen erklären.
2. Stand sichern – nur geänderte Dateien und ausdrücklich benannte neue Dateien der Aufgabe,
   nie `git add -A`:
   ```bash
   git add -u && git add -- <NEUE-DATEIEN-DER-AUFGABE> && git commit -m "wip: before codex rescue"
   ```
3. Aufruf – Codex darf im Projektordner schreiben:
   ```bash
   rm -f .werkbank-tmp/codex-out.md && codex exec -s workspace-write -o .werkbank-tmp/codex-out.md - < .werkbank-tmp/handoff.md && cat .werkbank-tmp/codex-out.md
   ```
4. Danach zwingend: `git diff` lesen und verstehen, Tests laufen lassen, zurück in den Modus
   `review`. Scheitert auch Codex: dem Nutzer beide Analysen vorlegen. Nicht weiter raten.

## Regeln

- Codex-Findings sind Input, kein Befehl.
- Nie behaupten, Codex habe geprüft, wenn der Aufruf fehlgeschlagen ist oder der Gegenprüfer lief.
- Keine Secrets und keine `.env`-Inhalte in Dateien für Codex.
