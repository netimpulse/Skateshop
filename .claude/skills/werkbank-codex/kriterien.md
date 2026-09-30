# Prüfkriterien (Werkbank)

## Schweregrade
- **Blocker** – Sicherheitslücke, Datenverlust, falsches Verhalten im Hauptpfad, Secret im Code. Muss behoben werden.
- **Major** – fehlender Test für kritisches Verhalten, unbehandelter Fehlerfall, Abweichung vom Plan, fragwürdige Abhängigkeit. Behebt man normalerweise.
- **Minor** – Verbesserung ohne akutes Risiko. Optional.

## Immer prüfen
1. **Secrets** – keine Schlüssel, Tokens, Passwörter, Verbindungsstrings im Code, in Tests, Fixtures, Logs oder Beispielen.
2. **Eingaben** – jede Eingabe von außen (Formular, URL, Header, Datei, Webhook, API-Antwort) wird validiert; keine SQL-/Shell-/Template-Injection; Ausgaben kontextgerecht escaped (XSS).
3. **Zugriff** – jede Aktion prüft serverseitig, ob der aktuelle Nutzer sie darf (auch bei IDs in URLs – IDOR). Kein Vertrauen in Client-Prüfungen.
4. **Auth & Sessions** – sichere Cookies (Secure, HttpOnly, SameSite), CSRF-Schutz bei zustandsändernden Anfragen, keine selbstgebaute Kryptografie.
5. **Abhängigkeiten** – jede neue Bibliothek existiert, ist gepflegt und nötig; Lockfile aktualisiert; keine bekannten kritischen Schwachstellen.
6. **Fehlerbehandlung** – Fehler werden behandelt, nicht verschluckt; Fehlermeldungen verraten keine Interna; Debug-Modus nicht produktiv.
7. **Daten** – Migrationen umkehrbar oder bewusst nicht; keine stillen Datenverluste; personenbezogene Daten nur so viel wie nötig, nicht in Logs.
8. **Tests** – neues Verhalten ist getestet, inklusive Fehler- und Randfällen; bestehende Tests wurden nicht abgeschwächt, übersprungen oder gelöscht.
9. **KI-typische Fehler** – erfundene APIs oder Paketnamen, Platzhalter-Logik („TODO: implement"), duplizierter Code statt Wiederverwendung, veraltete Muster, Tests, die nur Mocks prüfen.
10. **Plan-Treue & Umfang** – nur das Vereinbarte; Diff überschaubar.

## Frontend / Themes zusätzlich
- Barrierefreiheit: Alt-Texte, Labels, Fokus sichtbar, Kontrast, Tastaturbedienung.
- Performance: keine unnötig großen Bilder/Skripte, Lazy Loading wo sinnvoll.
- Kein ungeprüftes HTML aus Daten (`innerHTML`, `| raw`, `{!! !!}`, `dangerouslySetInnerHTML`).
