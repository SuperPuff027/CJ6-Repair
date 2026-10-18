# CJ6-Repair

Persönliche, offlinefähige Werkstatt-App (PWA) für genau einen Jeep CJ-6, Baujahr 1974. Bündelt Fahrzeugprofil, Teilekatalog, Reparaturanleitungen, Diagnose und Aufgabenplanung. Nur ein Nutzer, kein Store. Einsatz in der Garage mit schlechtem Empfang und schmutzigen Händen, auf einem Android-Handy und am Laptop.

Projekt-Brief (Funktionsumfang, Ausbaustufen, Wartungsintervalle, Risiken): Claude-Docs-Dokument „Project Brief: CJ-6 Werkstatt-App“, https://claude.ai/code/artifact/1aa58d86-9eb8-440b-8306-5928bd25df31 (nur über den Docs-Connector lesen).

**Aktuelle Stufe: MVP.** Plan und Fortschritt: `docs/plan-mvp.md` (erledigte Schritte dort abhaken).

## Arbeitsweise
- Nur die aktuelle Stufe umsetzen. V2/V3 nur im Datenmodell vorbereiten, keinen Code dafür schreiben.
- Zu Beginn jeder Stufe einen Plan vorlegen; Code erst nach Freigabe.
- Kleine Schritte. Nach jedem Schritt `npm run check` ausführen, dann committen, pushen und warten, bis die GitHub Action (Check, Build, Deploy auf GitHub Pages) grün ist.
- Antworten an den Nutzer auf Deutsch. Code-Bezeichner deutsch, wie in der Olivenernte-App.
- Reine Logik (Motorerkennung, Mängel-Zuordnung, Soll-Ist-Abgleich, Einheiten, Wartungsfälligkeit) liegt in `src/logic/` ohne UI-Abhängigkeiten und hat Vitest-Tests.
- Keine neuen Abhängigkeiten außerhalb des Stacks ohne Rückfrage.

## Fachliche Regeln (Sicherheit)
- **Keine technischen Werte erfinden.** Sollwerte, Anzugsmomente, Teilenummern, Füllmengen und Einstellwerte kommen nur aus der Wissensbasis und tragen immer eine Quelle (Handbuch + Seite). Fehlt ein Wert, zeigt die App „nicht erfasst“, nie eine Schätzung.
- Anleitungen werden aus der geprüften Wissensbasis zusammengesetzt. Ein Entwurf ohne Grundlage wird deutlich als **ungeprüft** markiert; bei Bremsen und Lenkung zusätzlich der Hinweis, erst nach Abgleich mit dem Handbuch zu arbeiten.
- Gasgeruch ist ein Sicherheitsfall: sofortiger Abbruch-Hinweis, keine weitere Diagnose.
- Das Fahrzeugprofil (Motor) wird erst nach Bestätigung durch Motorcode, VIN oder Gussnummer fixiert. 232 und 258 sind von außen kaum unterscheidbar.

## Private Daten
- `wissensbasis/` (digitalisierte Handbücher, Teilekataloge, Explosionszeichnungen) ist privat und nie im Repo. Inhalte daraus nicht in Code, Tests oder Commits übernehmen; Tests, die sie brauchen, überspringen sich, wenn der Ordner fehlt.
- Tests nutzen ausgedachte Beispieldaten, klar als Beispiel benannt.

## Stack (festgelegt)
- Vite + TypeScript (strict), `vite-plugin-pwa` (Service Worker, installierbar)
- three.js für das 3D-Outline-Modell
- Preact für Flyout, Formulare und Listen; die 3D-Szene bleibt imperativ (`src/szene/`)
- Dexie (IndexedDB) für lokale Daten inkl. Fotos als Blobs; beim Start `navigator.storage.persist()` anfordern
- Vitest für Tests; `fake-indexeddb` (nur Entwicklung) für Datenbank-Tests
- `npm run check` = Typecheck + Lint + Tests
- Zielgeräte: Android Chrome und Desktop-Browser. Web-Bluetooth (V3) ist damit möglich.

## Hosting
- GitHub Pages, öffentliches Repo `SuperPuff027/CJ6-Repair`, Branch `main`. Der Base-Pfad kommt aus `BASE_PATH` (in der Action gesetzt). Commits nur mit der GitHub-noreply-Adresse.
- Weil das Repo öffentlich ist: keine Handbuchinhalte, VIN, Kennzeichen oder eigene Fotos ins Repo.

## Sprachen
- Deutsch und Englisch. Alle Texte über `src/i18n/de.ts` und `en.ts` mit gemeinsamem Schlüssel-Typ, damit fehlende Übersetzungen ein Typfehler sind. Keine UI-Texte direkt im Code.
- Standard = Gerätesprache, sonst Deutsch; in den Einstellungen umschaltbar und gespeichert.
- Zahlen, Einheiten und Datum pro Sprache über `Intl` (Dezimalkomma im Deutschen).
- Englische Texte, die Claude Code schreibt, als ungeprüft markieren.

## Design
- Minimalistisch, heller und dunkler Modus (Standard = Systemeinstellung, umschaltbar, gespeichert).
- Mitte: 3D-Outline-Modell des CJ-6, dünne Linien: dunkel = Hellblau, hell = Schwarz.
- Seitliches Flyout-Menü legt sich über das Modell (verschiebt es nicht), nimmt nur einen Teil der Breite ein; dahinter ist das Modell leicht unscharf und abgedunkelt sichtbar.
- Bauteil im Flyout wählen → Modell dreht und zoomt dorthin, Bauteil wird rot, Rest blasser. Antippen im Modell wählt ebenfalls.
- Diagnose-Einstieg im Flyout.
- Referenz: `docs/prototyp-design.html` (Design-Prototyp, Geometrie grob aus Grundformen).
- Große Touch-Ziele (Handschuhe, schmutzige Hände).

## Datenmodell
Alle IDs sind UUIDs. Alle Datensätze haben `aktualisiert_am` (ISO-Zeit) und `geloescht` (bool, Soft-Delete), damit später Handy und Laptop synchronisiert werden können (V3).

Kern: Fahrzeugprofil → Motorvariante → Baugruppen → Bauteile → Anleitungen → Aufgaben. Diagnose, Notizen, Fotos, Messwerte und Kosten hängen an Bauteil oder Aufgabe. Einzelheiten legt der MVP-Plan fest.

## Technische Hinweise
- Keine `\uXXXX`-Escapes in Quelltext schreiben (werden beim Schreiben zu echten Zeichen, ESLint `no-irregular-whitespace`).
- Unter Windows kollidieren Dateinamen, die sich nur in der Groß-/Kleinschreibung unterscheiden.
- Commits mit der GitHub-noreply-Adresse (globale Git-Konfiguration).
