# Plan MVP: Nutzbar in der Garage

Ziel laut Brief: Die erste echte Reparatur lässt sich komplett mit der App planen, durchführen und dokumentieren. Erst danach beginnt V2.

**Status: freigegeben am 2026-10-18.**

## Umfang (aus dem Brief)
- Fahrzeugprofil mit Motorerkennung (Angaben + Fotos, alle CJ-6-Motoren), Kraftstoff bivalent mit Gasanlage, Umbau-Tracking
- Mängel-Eingabe → Reparaturpaket (Zuordnung, Anleitung, Teile-, Werkzeugliste, To-do)
- Teilekatalog und Anleitungen für die Baugruppen, an denen gerade gearbeitet wird
- To-do-Liste, Teile- und Werkzeugliste, Fotodokumentation beim Zerlegen
- Symptom-Entscheidungsbaum, Messwerte mit Sollwerten, Notizen an Bauteilen
- Offline-Betrieb, Einheitenumrechnung
- Design: 3D-Outline-Modell + Flyout (siehe `CLAUDE.md`, Abschnitt Design)

## Datenmodell (Dexie, Version 1)
Alle Datensätze: `id` (UUID), `aktualisiert_am`, `geloescht`.

- **fahrzeug** (ein Datensatz): baujahr, vin, fahrzeugschein_angaben, motor_variante_id (`null` bis bestätigt), motor_bestaetigt_durch (`motorcode` | `vin` | `gussnummer` | `null`), getriebe, verteilergetriebe, achse_vorne, achse_hinten, vergaser, zuendung, kraftstoff (`benzin` | `bivalent_lpg`), gasanlage {hersteller, typ, typschild, tank_baujahr, verdampfer, gemischbildung, umschalter}
- **umbau**: bauteil_id?, beschreibung, datum, ersetzt_handbuchwert (bool)
- **motor_variante** (aus der Wissensbasis): name, zylinder, hubraum_l, bauart, baujahre, erkennungsmerkmale[]
- **baugruppe**: name, eltern_id?, modell_teil_id (Bezug zum 3D-Modell)
- **bauteil**: baugruppe_id, name, teilenummern[] {nummer, quelle}, motor_varianten[] (leer = alle), stichwoerter[]
- **anleitung**: bauteil_id, titel, schritte[] {text, bild?, werkzeug[], sollwerte[] {groesse, wert, einheit, quelle}, warnung?}, geprueft (bool), quelle
- **aufgabe**: titel, bauteil_id?, anleitung_id?, mangel_text?, prioritaet (`sicherheit` | `hoch` | `normal`), geschaetzt_min?, status (`offen` | `in_arbeit` | `erledigt`), erledigt_am?
- **listenposten**: aufgabe_id, art (`teil` | `verbrauch` | `werkzeug`), bezeichnung, teilenummer?, menge, einheit, vorhanden (bool)
- **inventar**: bezeichnung, teilenummer?, menge, ort?
- **foto**: bezug {art, id} (bauteil | aufgabe | schritt | fahrzeug), blob, aufgenommen_am, notiz?
- **notiz**: bauteil_id, text
- **messung**: bauteil_id?, groesse (z. B. `kompression`), zylinder?, wert, einheit, kraftstoff?, gemessen_am, soll_quelle?
- **symptom_knoten** (aus der Wissensbasis): frage, antworten[] {text, naechster_id? | befund_bauteil_id? | pruefschritt?}

Vorbereitet, aber ohne Code (V2/V3): wartung, logbuch, kosten, sensor_messwert.

## Wissensbasis
Die Werte kommen aus dem Werkstatthandbuch und dem Teilekatalog von 1974 (noch zu beschaffen). Format: JSON-Dateien in `wissensbasis/` (privat), eingelesen über einen Import in den Einstellungen. Jeder Sollwert und jede Teilenummer braucht `quelle`; der Import lehnt Einträge ohne Quelle ab. Im Repo liegt nur das Schema mit einem kleinen, klar als Beispiel markierten Datensatz für Tests.

## Schritte
1. [x] **Projektgerüst:** Vite + TS strict, ESLint, Vitest, Preact, `npm run check`, PWA-Manifest „CJ6-Repair“ mit Icons und Service Worker, Übersetzungen de/en, GitHub-Action mit Deploy auf Pages, Start auf dem Handy per LAN.
2. [x] **Design-Grundlage:** Farb- und Schrift-Tokens hell/dunkel, Theme-Umschalter und Sprachwahl (gespeichert), App-Leiste. Theme und Sprache vorerst im Browser-Speicher (`src/geraet/speicher.ts`), Systemschrift statt eigener Schrift (offline, keine Abhängigkeit).
3. [x] **3D-Szene:** three.js-Szene aus dem Prototyp übernehmen (`src/szene/`), Outline-Linien in Theme-Farbe, Drehen und Zoomen, Modellteile mit festen IDs. Modell in `src/szene/modell.ts` (30 Teile in 5 Gruppen, Radstand 2642 mm wie CJ-6 ab 1972), Szene in `src/szene/szene.ts`; Startabstand passt sich der Bildschirmform an.
4. [x] **Auswahl im Modell:** Bauteil wählen → Kameraflug, Rotfärbung, Rest blasser; Antippen im Modell; Logik für Kamerablickwinkel getestet. Gewähltes Teil rot (Linien obenauf, leichte Füllung), Rest gedimmt; Antippen wählt das kleinste getroffene Teil; Escape oder × hebt auf.
5. [ ] **Flyout:** Overlay mit Unschärfe, Tabs Bauteile und Diagnose, Suche, Gruppen; Bauteildetail mit Notizen-Platzhalter.
6. [ ] **Datenbank:** Dexie-Schema oben, `persist()`, Zeitstempel und Soft-Delete als gemeinsame Hilfsfunktion, Tests mit `fake-indexeddb`.
7. [ ] **Wissensbasis-Import:** JSON-Schema, Prüfung (Quelle Pflicht), Import aus Datei, Beispieldatensatz.
8. [ ] **Fahrzeugprofil:** Formular inkl. Gasanlage und Umbauten.
9. [ ] **Motorerkennung:** Kandidaten aus Angaben filtern, mit Begründung und Sicherheitsgrad (reine Logik, getestet); Fotos anhängen; Bestätigung fixiert das Profil.
10. [ ] **Notizen und Fotos an Bauteilen:** Kamera über Datei-Eingabe, Speicherung als Blob, Vorschaubilder.
11. [ ] **To-do-Liste:** Aufgaben mit Priorität (Sicherheit zuerst), Zeitaufwand, Abhaken, Verknüpfung zum Bauteil (springt im Modell dorthin).
12. [ ] **Mängel-Eingabe:** Freitext → Zuordnung zu Bauteil über Stichwörter, Rückfrage bei Mehrdeutigkeit (vorne/hinten); reine Logik, getestet.
13. [ ] **Reparaturpaket:** aus Zuordnung Anleitung (oder „ungeprüft“), Teile-, Verbrauchs- und Werkzeugliste mit Inventarabgleich und To-do erzeugen; mehrere Mängel zusammenfassen.
14. [ ] **Anleitungsansicht:** Schritt für Schritt, große Knöpfe, Sollwerte mit Quelle, Fotodokumentation je Schritt.
15. [ ] **Messwerte:** Eingabe mit Soll-Ist-Abgleich (Kompression je Zylinder, Zündzeitpunkt, Schließwinkel, Spannung), getrennt nach Kraftstoff.
16. [ ] **Symptom-Baum:** Ansicht für Entscheidungsbäume aus der Wissensbasis, offline, ohne KI; Gasgeruch als Abbruch.
17. [ ] **Einheitenumrechnung:** SAE ↔ metrisch, ft-lb ↔ Nm, getestet.
18. [ ] **Datensicherung:** Export und Import aller Daten inkl. Fotos als eine Datei; Rundreise-Test.
19. [ ] **Feldtest:** Offline auf dem Android-Handy in der Garage, Befunde sammeln.

## Entscheidungen
- **Hosting:** GitHub Pages wie bei HRVST (öffentliches Repo `SuperPuff027/CJ6-Repair`). Die Wissensbasis bleibt privat, weil sie nur lokal importiert wird.
- **Sprachen:** Deutsch und Englisch (Schritt 1 legt die Übersetzungsdateien an; Umschalter in den Einstellungen mit Schritt 2).
- **Commits:** nach jedem Schritt committen, pushen, auf grüne Action warten.

## Offene Fragen
- **3D-Modell:** Für den MVP die grobe Prototyp-Geometrie, später ein genaues Modell aus benannten Teilen. Quelle offen.
- **Handbuch:** Werkstatthandbuch und Teilekatalog 1974 beschaffen. Ohne sie bleiben Anleitungen und Sollwerte leer.
