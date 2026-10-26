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

- **fahrzeug** (ein Datensatz): baujahr, vin, fahrzeugschein_angaben, motorcode, motor_variante_id, motor_vorgemerkt[] (`null` bis bestätigt), motor_bestaetigt_durch (`motorcode` | `vin` | `gussnummer` | `null`), getriebe, verteilergetriebe, achse_vorne, achse_hinten, vergaser, zuendung, kraftstoff (`benzin` | `bivalent_lpg`), gasanlage {hersteller, typ, typschild, tank_baujahr, verdampfer, gemischbildung, umschalter}
- **umbau**: bauteil_id?, modell_teil_id?, beschreibung, datum, ersetzt_handbuchwert (bool)
- **motor_variante** (aus der Wissensbasis): name, zylinder, hubraum_l, bauart, baujahr_von, baujahr_bis, motorcode_buchstaben[], vin_buchstaben[], erkennungsmerkmale[], quelle
- **baugruppe**: name, eltern_id?, modell_teil_id (Bezug zum 3D-Modell)
- **bauteil**: baugruppe_id, name, teilenummern[] {nummer, quelle}, motor_varianten[] (leer = alle), stichwoerter[]
- **anleitung**: bauteil_id, titel, schritte[] {text, bild?, werkzeug[], sollwerte[] {groesse, wert, einheit, quelle}, warnung?}, material[] {art (teil | verbrauch), bezeichnung, menge, einheit, teilenummer?, quelle?}, geprueft (bool), quelle
- **aufgabe**: titel, bauteil_id?, anleitung_id?, mangel_text?, prioritaet (`sicherheit` | `hoch` | `normal`), geschaetzt_min?, status (`offen` | `in_arbeit` | `erledigt`), erledigt_am?
- **listenposten**: aufgabe_id, art (`teil` | `verbrauch` | `werkzeug`), bezeichnung, teilenummer?, menge, einheit, vorhanden (bool)
- **inventar**: bezeichnung, teilenummer?, menge, ort?
- **foto**: bezug {art, id} (bauteil | aufgabe | schritt | fahrzeug), blob, aufgenommen_am, notiz?
- **notiz**: bauteil_id, text
- **messung**: bauteil_id?, modell_teil_id?, groesse (z. B. `kompression`), zylinder?, wert, einheit, betriebsart (benzin | gas)?, gemessen_am
- **messvorgabe** (aus der Wissensbasis, Dexie v2): groesse, motor_variante_id?, betriebsart?, min?, max?, max_abweichung_prozent?, einheit, hinweis?, quelle
- **symptom_knoten** (aus der Wissensbasis): frage, antworten[] {text, naechster_id? | befund_bauteil_id? | pruefschritt?}

Vorbereitet, aber ohne Code (V2/V3): wartung, logbuch, kosten, sensor_messwert.

## Wissensbasis
Format: `docs/wissensbasis-format.md`. Die Werte kommen aus dem Werkstatthandbuch und dem Teilekatalog von 1974 (noch zu beschaffen). Die echte Datei liegt in `wissensbasis/` (privat) und wird im Menü unter Bauteile importiert. Jeder Sollwert und jede Teilenummer braucht `quelle`; der Import lehnt Einträge ohne Quelle ab. Im Repo liegt nur das Schema mit einem kleinen, klar als Beispiel markierten Datensatz für Tests.

## Schritte
1. [x] **Projektgerüst:** Vite + TS strict, ESLint, Vitest, Preact, `npm run check`, PWA-Manifest „CJ6-Repair“ mit Icons und Service Worker, Übersetzungen de/en, GitHub-Action mit Deploy auf Pages, Start auf dem Handy per LAN.
2. [x] **Design-Grundlage:** Farb- und Schrift-Tokens hell/dunkel, Theme-Umschalter und Sprachwahl (gespeichert), App-Leiste. Theme und Sprache vorerst im Browser-Speicher (`src/geraet/speicher.ts`), Systemschrift statt eigener Schrift (offline, keine Abhängigkeit).
3. [x] **3D-Szene:** three.js-Szene aus dem Prototyp übernehmen (`src/szene/`), Outline-Linien in Theme-Farbe, Drehen und Zoomen, Modellteile mit festen IDs. Modell in `src/szene/modell.ts` (30 Teile in 5 Gruppen, Radstand 2642 mm wie CJ-6 ab 1972), Szene in `src/szene/szene.ts`; Startabstand passt sich der Bildschirmform an.
4. [x] **Auswahl im Modell:** Bauteil wählen → Kameraflug, Rotfärbung, Rest blasser; Antippen im Modell; Logik für Kamerablickwinkel getestet. Gewähltes Teil rot (Linien obenauf, leichte Füllung), Rest gedimmt; Antippen wählt das kleinste getroffene Teil; Escape oder × hebt auf.
5. [x] **Flyout:** Overlay mit Unschärfe, Tabs Bauteile und Diagnose, Suche, Gruppen; Bauteildetail mit Notizen-Platzhalter. Suche ignoriert Umlaute und Groß-/Kleinschreibung (`src/logic/suche.ts`); am Laptop offen, am Handy zu und nach Auswahl wieder zu; gewähltes Teil erscheint neben dem offenen Menü. Diagnose-Reiter zeigt die kommenden Funktionen als „folgt“.
6. [x] **Datenbank:** Dexie-Schema oben, `persist()`, Zeitstempel und Soft-Delete als gemeinsame Hilfsfunktion, Tests mit `fake-indexeddb`. Typen in `src/model/typen.ts`, Schema in `src/db/datenbank.ts` (17 Tabellen, V2/V3-Tabellen nur angelegt), Schreibzugriffe über `src/db/repo.ts`. Notizen und Fotos hängen über `bezug_art` + `bezug_id` auch direkt an Modellteilen, solange es noch keine Bauteile aus der Wissensbasis gibt.
7. [x] **Wissensbasis-Import:** JSON-Schema, Prüfung (Quelle Pflicht), Import aus Datei, Beispieldatensatz. Format in `docs/wissensbasis-format.md`, Beispiel in `docs/wissensbasis-beispiel.json` (wird im Test mitgeprüft). IDs der Wissensbasis kommen aus der Datei (stabil, damit ein erneuter Import aktualisiert statt verdoppelt). Die Datei ersetzt die Wissensbasis: Vorschau mit neu/geändert/entfernt, dann Import in einer Transaktion; Fehlendes wird weich gelöscht. Import unten im Reiter Bauteile.
8. [x] **Fahrzeugprofil:** Formular inkl. Gasanlage und Umbauten. Eigener Reiter „Fahrzeug“ im Menü; jedes Feld speichert beim Verlassen, ungültige Jahre werden erklärt statt gespeichert; VIN wird bereinigt; Gasanlage nur bei bivalentem Betrieb; Umbauten mit Datum, Modellteil und „ersetzt Handbuchwerte“, Entfernen mit Rückfrage. Datum je Sprache formatiert (`src/logic/format.ts`).
9. [x] **Motorerkennung:** Kandidaten aus Angaben filtern, mit Begründung und Sicherheitsgrad (reine Logik, getestet); Fotos anhängen; Bestätigung fixiert das Profil. Startdatei `public/startdaten/motoren-cj.json` (Hurricane F-Head 134, Dauntless 225 V6, AMC 232, AMC 258, AMC 304 mit Quellen), per Knopf ladbar. Wissensbasis-Import ersetzt nur Listen, die in der Datei stehen. Bewertung in `src/logic/motorerkennung.ts`: Motorcode- und Zylinder-Widerspruch schließen aus, Fahrgestellnummer und Hubraum nur Hinweise; Bestätigen nur mit passendem Nachweis; Gussnummer zählt nur, wenn kein baugleicher Motor (z. B. 232/258) mehr möglich ist. Bis zur Bestätigung lassen sich mehrere Motoren vormerken (`fahrzeug.motor_vorgemerkt`); spätere Schritte (Teile, Sollwerte) berücksichtigen dann alle vorgemerkten. Fotos werden auf 1600 px verkleinert (`src/ui/FotoAblage.tsx`, wiederverwendbar).
10. [x] **Notizen und Fotos an Bauteilen:** Kamera über Datei-Eingabe, Speicherung als Blob, Vorschaubilder. Im Bauteildetail des Menüs (Modellteil als Bezug): Notizen anlegen, bearbeiten, entfernen; Fotos über die Fotoablage. Notizzähler in der Teileliste (Fotos werden dort nicht gezählt, um keine Bilddaten zu laden). Entfernte Fotos geben ihre Bilddaten frei.
11. [x] **To-do-Liste:** Aufgaben mit Priorität (Sicherheit zuerst), Zeitaufwand, Abhaken, Verknüpfung zum Bauteil (springt im Modell dorthin). Eigener Reiter „Aufgaben“ (Bauteile · Aufgaben · Diagnose · Fahrzeug). Logik in `src/logic/aufgaben.ts`: Sortierung, Statuswechsel, Zeitsumme, Stunden-Eingabe; Priorität „Sicherheit“ als Vorschlag bei Bremsen, Lenkung, Rädern, Kraftstoff- und Gasanlage. Im Bauteildetail: offene Aufgaben des Teils und „Aufgabe zu diesem Teil“.
12. [x] **Mängel-Eingabe:** Freitext → Zuordnung zu Bauteil über Stichwörter, Rückfrage bei Mehrdeutigkeit (vorne/hinten); reine Logik, getestet. Im Reiter Diagnose; mehrere Mängel zeilenweise. Logik in `src/logic/maengel.ts`: Stichwörter de/en je Modellteil (plus Stichwörter der Wissensbasis-Bauteile), gewichtet nach Stichwortlänge; Lage-Rückfrage bei Bremsen und Achsen; Gleichstand führt zur Teile-Rückfrage. Gasgeruch zeigt sofort den Sicherheitshinweis und bietet die Gasanlagen-Teile an. Zugeordnete Mängel lassen sich als Aufgabe anlegen (Priorität aus Teil, bei Gasgeruch immer Sicherheit).
13. [x] **Reparaturpaket:** aus Zuordnung Anleitung (oder „ungeprüft“), Teile-, Verbrauchs- und Werkzeugliste mit Inventarabgleich und To-do erzeugen; mehrere Mängel zusammenfassen. Logik in `src/logic/reparaturpaket.ts`: Bauteile des Modellteils (gefiltert nach bestätigtem oder vorgemerkten Motoren), beste Anleitung (geprüft vor ungeprüft), Material aus dem neuen Anleitungsfeld `material` plus Werkzeug aus den Schritten, Abgleich mit dem Inventar, Zusammenfassen über alle Mängel. Bremsen und Lenkung ohne geprüfte Anleitung: Handbuch-Hinweis. Vorschau vor dem Speichern; danach Aufgaben mit Listenposten. Einkaufsliste im Reiter Aufgaben (offene Aufgaben, abhakbar).
14. [x] **Anleitungsansicht:** Schritt für Schritt, große Knöpfe, Sollwerte mit Quelle, Fotodokumentation je Schritt. Vollbild-Ansicht (`src/ui/AnleitungsAnsicht.tsx`) mit 64-px-Knöpfen, Banner bei ungeprüften Anleitungen (plus Handbuch-Hinweis bei Bremsen/Lenkung), Warnung hervorgehoben, Werkzeug je Schritt. Aus einer Aufgabe: Status „in Arbeit“, Fotos je Schritt mit Bezug `schritt` = Aufgabe:Schritt, Schritt pro Gerät gemerkt, am Ende „erledigt?“. Bildschirm bleibt an (Wake Lock, falls erlaubt). Im Bauteildetail: Anleitungen zum Nachlesen.
15. [x] **Messwerte:** Eingabe mit Soll-Ist-Abgleich (Kompression je Zylinder, Zündzeitpunkt, Schließwinkel, Spannung), getrennt nach Kraftstoff. Im Reiter Diagnose. Sollwerte nur aus der neuen Wissensbasis-Liste `messvorgaben` (Dexie v2, Quelle Pflicht); ohne Vorgabe wird gespeichert, nicht bewertet; bei mehreren vorgemerkten Motoren erst nach Bestätigung. Messgrößen: Kompression je Zylinder (bar/psi, mit Streuung und schwächstem Zylinder), Zündzeitpunkt, Schließwinkel, Batterie-/Ladespannung, Leerlaufdrehzahl, Öldruck. Betriebsart Benzin/Gas statt Kraftstoff. Verlauf je Messgröße. Motor-IDs in Handbuchdateien dürfen auf die Startdatei zeigen.
16. [x] **Symptom-Baum:** Ansicht für Entscheidungsbäume aus der Wissensbasis, offline, ohne KI; Gasgeruch als Abbruch. Im Reiter Diagnose. Startfragen = Knoten ohne Verweis darauf. Mit Gasanlage vor jedem Durchlauf „Riechst du Gas?“; Antworten mit Gasgeruch brechen ebenfalls ab. Schleifen und Verweise ins Leere enden mit Hinweis. Befund → Teil im Modell und Reparaturpaket (Titel = letzte Frage + Antwort, ganzer Weg als Mangeltext); Prüfschritt → Aufgabe.
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
