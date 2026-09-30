---
name: werkbank-einrichten
description: Richtet in einem Projekt einmalig das Werkbank-Gedächtnis ein (docs/werkbank/ mit Projektregeln, Plänen, Recherche, Design, Ideen, Log) und optional Schutzregeln für .env-Dateien und einen Git-Pre-Commit-Check gegen Secrets.
disable-model-invocation: true
---

# Werkbank im Projekt einrichten

Zusatzhinweise vom Nutzer: $ARGUMENTS

## 1. Prüfen

- Gibt es `docs/werkbank/INDEX.md` schon? Dann nichts überschreiben – nur fehlende Teile
  ergänzen und das dem Nutzer sagen.
- Hat das Projekt einen eigenen Agenten-Ablauf in `CLAUDE.md` oder `.claude/agents/`?
  Dann den Nutzer darauf hinweisen, dass dessen Regeln Vorrang haben, und fragen, ob die
  Werkbank trotzdem eingerichtet werden soll.
- Ist es ein Git-Repo (`git rev-parse --git-dir`)? Ohne Git entfallen Pre-Commit-Check und
  Commit (Schritte 4.5 und 4.6); das dem Nutzer in einem Satz sagen.

## 2. Projekt erkunden

Ermittle aus dem Repo selbst: Zweck (README), Stack, Befehle für Tests, Lint, Typprüfung,
Build, lokalen Start, Commit-Konvention (`git log --oneline -20`), Hauptbranch. Nur was sich
nicht ermitteln lässt, kommt in die Frage unten.

## 3. Eine gebündelte Frage (AskUserQuestion)

- Frage 1, Mehrfachauswahl „Was soll zusätzlich eingerichtet werden?":
  **Schutzregeln (Empfohlen)** – ergänzt `.claude/settings.json` um Leseverbote für `.env`,
  Verbote für Force-Push/Hard-Reset und Freigaben für die Werkbank-Ordner (weniger Rückfragen);
  **Pre-Commit-Secret-Check (Empfohlen)** – Git-Hook, der Commits mit Secrets blockiert
  (nur in Git-Repos anbieten).
- Weitere Fragen nur, wenn etwas aus Schritt 2 offen blieb (z. B. Zweck des Projekts).

## 4. Anlegen

1. Ordner `docs/werkbank/` mit `entscheidungen/`, `plaene/`, `recherche/`, `design/`, `log/`
   (je mit leerer `.gitkeep`).
2. Vorlagen kopieren und ausfüllen:
   `${CLAUDE_SKILL_DIR}/vorlagen/INDEX.md` → `docs/werkbank/INDEX.md`,
   `${CLAUDE_SKILL_DIR}/vorlagen/projekt-regeln.md` → `docs/werkbank/projekt-regeln.md`
   (Platzhalter `{{…}}` ersetzen; Unbekanntes als „noch offen"),
   `${CLAUDE_SKILL_DIR}/vorlagen/ideen.md` → `docs/werkbank/ideen.md`.
3. `.gitignore`: Zeile `.werkbank-tmp/` ergänzen, falls nicht vorhanden (Datei anlegen, falls
   es keine gibt).
4. **Schutzregeln** (falls gewählt): `.claude/settings.json` anlegen oder zusammenführen –
   bestehende Einträge behalten, nur fehlende ergänzen, JSON gültig halten:
   ```json
   {
     "permissions": {
       "deny": [
         "Read(./**/.env)", "Read(./**/.env.local)", "Read(./**/.env.*.local)",
         "Read(./**/.env.production)", "Read(./**/.env.testing)", "Read(./**/secrets/**)",
         "Bash(git push --force*)", "Bash(git push -f*)",
         "Bash(git push * --force*)", "Bash(git push * -f*)",
         "Bash(git reset --hard*)"
       ],
       "allow": [
         "WebSearch", "WebFetch",
         "Edit(./docs/werkbank/**)", "Edit(./.werkbank-tmp/**)",
         "Bash(codex login status)"
       ]
     }
   }
   ```
   Bewusst **kein** Muster `.env.*`, damit Vorlagen wie `.env.example` lesbar bleiben.
   Nutzt das Projekt andere Secret-Dateien (z. B. `config/master.key`, `*.pem`), diese ergänzen.
5. **Pre-Commit-Check** (falls gewählt, nur Git):
   - Existiert schon `core.hooksPath` (`git config --get core.hooksPath`) oder ein Pre-Commit-Hook:
     nicht überschreiben, sondern dem Nutzer zeigen und fragen.
   - Sonst:
     ```bash
     mkdir -p .githooks && cp "${CLAUDE_SKILL_DIR}/../../hooks/werkbank/secret-guard.js" .githooks/secret-guard.js && printf '#!/bin/sh\nnode .githooks/secret-guard.js --staged\n' > .githooks/pre-commit && chmod +x .githooks/pre-commit && printf '.githooks/* text eol=lf\n' >> .gitattributes && git add .githooks .gitattributes && git update-index --chmod=+x .githooks/pre-commit && git config core.hooksPath .githooks && node .githooks/secret-guard.js --self-test
     ```
     Muss `self-test: OK` ausgeben. Steht in `.gitattributes` die Zeile schon, nicht doppelt anhängen.
   - Hinweis an den Nutzer: `core.hooksPath` gilt nur in diesem Klon; auf einem anderen Rechner
     einmal `git config core.hooksPath .githooks` ausführen.
6. Commit (nur Git) auf dem aktuellen Branch mit allen Dateien, die die Einrichtung angelegt
   oder geändert hat – ausdrücklich benannt, nicht `git add -A`:
   `docs/werkbank`, `.gitignore`, ggf. `.claude/settings.json`, `.githooks`, `.gitattributes`.
   Message: `chore: set up werkbank memory`.

## 5. Abschluss

Dem Nutzer in drei Sätzen: was angelegt wurde, was aus dem Repo ermittelt wurde und was noch
offen ist. Hinweis: Ab jetzt reicht es, Aufgaben einfach zu beschreiben – die Werkbank liest
beim Start jeder Sitzung das Gedächtnis.
