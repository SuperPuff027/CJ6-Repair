# Format der Wissensbasis

Die Wissensbasis enthält, was die App über den CJ-6 weiß: Motorvarianten, Baugruppen, Bauteile mit Teilenummern, Reparaturanleitungen mit Sollwerten und den Symptom-Baum. Sie kommt aus dem Werkstatthandbuch und dem Teilekatalog und wird als **eine JSON-Datei** in der App importiert (Menü → Bauteile → ganz unten „Datei importieren“).

Die echte Datei liegt im privaten Ordner `wissensbasis/` und kommt nie ins Repo. Ein Beispiel mit erfundenen, deutlich markierten Werten: [`wissensbasis-beispiel.json`](wissensbasis-beispiel.json).

## Grundregeln

- **Jede Teilenummer und jeder Sollwert braucht eine Quelle**: `{ "dokument": "...", "stelle": "S. 123" }`. Ohne Quelle lehnt die App die ganze Datei ab.
- Eine Anleitung mit `"geprueft": true` braucht ebenfalls eine Quelle. Ungeprüfte Anleitungen zeigt die App deutlich als ungeprüft.
- **IDs vergibst du selbst** (z. B. `"bremstrommel-vorn"`). Sie müssen pro Liste eindeutig sein und dürfen sich später nicht ändern: Beim erneuten Import werden Einträge mit gleicher ID aktualisiert.
- **Die Datei ersetzt die Wissensbasis.** Einträge, die in einer neuen Datei fehlen, werden entfernt (weich gelöscht; eigene Notizen, Fotos und Aufgaben bleiben erhalten). Unveränderte Einträge bleiben unberührt.
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
  "symptom_knoten": []
}
```

Alle Listen sind optional. Felder mit `?` sind optional.

### motor_varianten

| Feld | Typ | Bedeutung |
| --- | --- | --- |
| `id` | Text | eigene ID |
| `name` | Text | z. B. „AMC 232“ |
| `zylinder` | Zahl | |
| `hubraum_l` | Zahl | Liter |
| `bauart` | Text | z. B. „Reihensechser“ |
| `baujahre` | Text | z. B. „1972–1979“ |
| `erkennungsmerkmale?` | Liste von Text | woran man den Motor erkennt |

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

Ein Schritt: `text`; optional `bild`, `werkzeug` (Liste), `sollwerte` (Liste von `{ groesse, wert, einheit, quelle }`, Quelle Pflicht) und `warnung`.

### symptom_knoten

| Feld | Typ | Bedeutung |
| --- | --- | --- |
| `id`, `frage` | Text | |
| `antworten` | Liste | jede Antwort: `text` und mindestens eines von `naechster_id` (nächste Frage), `befund_bauteil_id` (vermutetes Bauteil) oder `pruefschritt` (was zu prüfen ist) |

## Modellteile

Diese IDs verbinden Einträge mit dem 3D-Modell:

`wanne`, `motorhaube`, `kotfluegel`, `kuehlergrill`, `frontscheibe`, `armaturenbrett`, `stossstangen`, `sitze`, `reserverad`, `motor`, `kuehler`, `getriebe`, `verteilergetriebe`, `kardanwellen`, `auspuff`, `rahmen`, `vorderachse`, `hinterachse`, `blattfedern`, `stossdaempfer`, `bremsen_vorne`, `bremsen_hinten`, `raeder`, `lenkung`, `benzintank`, `gastank`, `gasleitung`, `verdampfer`, `batterie`, `beleuchtung`
