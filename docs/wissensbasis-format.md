# Format der Wissensbasis

Die Wissensbasis enthält, was die App über den CJ-6 weiß: Motorvarianten, Baugruppen, Bauteile mit Teilenummern, Reparaturanleitungen mit Sollwerten und den Symptom-Baum. Sie kommt aus dem Werkstatthandbuch und dem Teilekatalog und wird als **eine JSON-Datei** in der App importiert (Menü → Bauteile → ganz unten „Datei importieren“).

Die echte Datei liegt im privaten Ordner `wissensbasis/` und kommt nie ins Repo. Ein Beispiel mit erfundenen, deutlich markierten Werten: [`wissensbasis-beispiel.json`](wissensbasis-beispiel.json).

## Grundregeln

- **Jede Teilenummer und jeder Sollwert braucht eine Quelle**: `{ "dokument": "...", "stelle": "S. 123" }`. Ohne Quelle lehnt die App die ganze Datei ab.
- Eine Anleitung mit `"geprueft": true` braucht ebenfalls eine Quelle. Ungeprüfte Anleitungen zeigt die App deutlich als ungeprüft.
- **IDs vergibst du selbst** (z. B. `"bremstrommel-vorn"`). Sie müssen pro Liste eindeutig sein und dürfen sich später nicht ändern: Beim erneuten Import werden Einträge mit gleicher ID aktualisiert.
- **Jede Liste in der Datei ersetzt die gleichnamige Liste in der App.** Einträge, die darin fehlen, werden entfernt (weich gelöscht; eigene Notizen, Fotos und Aufgaben bleiben erhalten). Unveränderte Einträge bleiben unberührt. **Listen, die in der Datei gar nicht vorkommen, bleiben unverändert** – eine Datei nur mit `motor_varianten` ändert also nichts an Bauteilen oder Anleitungen.
- Verweise (`baugruppe_id`, `bauteil_id` usw.) müssen innerhalb derselben Datei aufgehen. Ausnahme: Motor-IDs dürfen auf die Startdatei zeigen.
- Vor dem Import zeigt die App, was neu, geändert und entfernt wird. Erst nach „Importieren“ wird gespeichert, und zwar ganz oder gar nicht.

## Aufbau

```json
{
  "format": "cj6-wissensbasis",
  "version": 1,
  "motor_varianten": [],
  "baugruppen": [],
  "bauteile": [],
  "anleitungen": [],
  "symptom_knoten": [],
  "messvorgaben": []
}
```

Alle Listen sind optional (siehe oben: fehlende Listen bleiben unverändert). Felder mit `?` sind optional.

### motor_varianten

| Feld | Typ | Bedeutung |
| --- | --- | --- |
| `id` | Text | eigene ID |
| `name` | Text | z. B. „AMC 232“ |
| `zylinder` | Zahl | |
| `hubraum_l` | Zahl | Liter |
| `bauart` | Text | z. B. „Reihensechser“ |
| `baujahr_von?`, `baujahr_bis?` | Zahl | Baujahre im CJ; weglassen, wenn nicht belegt |
| `motorcode_buchstaben?` | Liste von Großbuchstaben | 4. Zeichen des am Block eingeschlagenen Codes, z. B. `E` in „802E20“ |
| `vin_buchstaben?` | Liste von Großbuchstaben | 8. Zeichen der Fahrgestellnummer (Schema 1971–1974) |
| `erkennungsmerkmale?` | Liste von Text | woran man den Motor erkennt |
| `quelle` | Quelle | Pflicht |

### baugruppen

| Feld | Typ | Bedeutung |
| --- | --- | --- |
| `id`, `name` | Text | |
| `eltern_id?` | ID einer Baugruppe | für Unterbaugruppen; keine Kreise |
| `modell_teil_id?` | Modellteil | Bezug zum 3D-Modell (siehe unten) |

### bauteile

| Feld | Typ | Bedeutung |
| --- | --- | --- |
| `id`, `name` | Text | |
| `baugruppe_id` | ID einer Baugruppe | |
| `modell_teil_id?` | Modellteil | wird im 3D-Modell rot, wenn das Bauteil gewählt ist |
| `teilenummern?` | Liste von `{ nummer, quelle }` | Quelle Pflicht |
| `motor_varianten?` | Liste von Motor-IDs | leer = passt zu allen |
| `stichwoerter?` | Liste von Text | für die Zuordnung von Mängeln, z. B. „Trommel“ |

### anleitungen

| Feld | Typ | Bedeutung |
| --- | --- | --- |
| `id`, `titel` | Text | |
| `bauteil_id` | ID eines Bauteils | |
| `geprueft` | ja/nein | `true` nur mit Quelle |
| `quelle?` | Quelle | |
| `schritte` | Liste von Schritten | |
| `material?` | Liste | Ersatzteile und Verbrauchsmaterial für die Einkaufsliste (siehe unten) |

Ein Schritt: `text`; optional `bild`, `werkzeug` (Liste), `sollwerte` (Liste von `{ groesse, wert, einheit, quelle }`, Quelle Pflicht) und `warnung`.

Ein Material: `art` (`"teil"` oder `"verbrauch"`), `bezeichnung`, `menge` (größer 0), `einheit` (z. B. „Stück“, „l“); optional `teilenummer` – dann ist `quelle` Pflicht. Das Werkzeug für die Werkzeugliste kommt aus den Schritten.

### symptom_knoten

| Feld | Typ | Bedeutung |
| --- | --- | --- |
| `id`, `frage` | Text | |
| `antworten` | Liste | jede Antwort: `text` und mindestens eines von `naechster_id` (nächste Frage), `befund_bauteil_id` (vermutetes Bauteil) oder `pruefschritt` (was zu prüfen ist) |

### messvorgaben

Sollwerte für den Reiter Diagnose → Messwerte. Ohne Vorgabe speichert die App Messungen trotzdem, bewertet sie aber nicht.

| Feld | Typ | Bedeutung |
| --- | --- | --- |
| `id` | Text | eigene ID |
| `groesse` | Messgröße | `kompression`, `zuendzeitpunkt`, `schliesswinkel`, `batteriespannung`, `ladespannung`, `leerlaufdrehzahl`, `oeldruck` |
| `einheit` | Text | je Messgröße: Kompression und Öldruck `bar` oder `psi`, Zündzeitpunkt `° v. OT`, Schließwinkel `°`, Spannungen `V`, Drehzahl `1/min` |
| `min?`, `max?` | Zahl | erlaubter Bereich (mindestens eines) |
| `max_abweichung_prozent?` | Zahl | nur Kompression: erlaubte Abweichung zwischen den Zylindern |
| `motor_variante_id?` | Motor-ID | weglassen = gilt für alle Motoren |
| `betriebsart?` | `benzin` oder `gas` | weglassen = gilt für beide |
| `hinweis?` | Text | Messbedingungen, z. B. „Motor warm“ |
| `quelle` | Quelle | Pflicht |

Motor-IDs (hier und in `bauteile.motor_varianten`) dürfen auf Motoren aus der Startdatei zeigen, z. B. `amc-232`.

## Modellteile

Diese IDs verbinden Einträge mit dem 3D-Modell:

`wanne`, `motorhaube`, `kotfluegel`, `kuehlergrill`, `frontscheibe`, `armaturenbrett`, `stossstangen`, `sitze`, `reserverad`, `motor`, `kuehler`, `getriebe`, `verteilergetriebe`, `kardanwellen`, `auspuff`, `rahmen`, `vorderachse`, `hinterachse`, `blattfedern`, `stossdaempfer`, `bremsen_vorne`, `bremsen_hinten`, `raeder`, `lenkung`, `benzintank`, `gastank`, `gasleitung`, `verdampfer`, `batterie`, `beleuchtung`
