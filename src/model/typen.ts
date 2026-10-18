// Datenmodell (siehe docs/plan-mvp.md). Alle Datensätze lassen sich später zwischen Handy und
// Laptop abgleichen: UUID, Zeitpunkt der letzten Änderung, Soft-Delete.
import type { ModellTeilId } from '../szene/modell';

export interface Synchronisierbar {
  /** ISO-Zeitpunkt der letzten Änderung. */
  aktualisiert_am: string;
  /** Soft-Delete: gelöschte Datensätze bleiben für den Abgleich erhalten. */
  geloescht: boolean;
}

export interface MitId extends Synchronisierbar {
  /** UUID */
  id: string;
}

/**
 * Herkunft eines technischen Werts. Pflicht für Sollwerte, Anzugsmomente und Teilenummern:
 * Die App erfindet keine Werte (CLAUDE.md, Fachliche Regeln).
 */
export interface Quelle {
  /** z. B. „Technical Service Manual 1974“ */
  dokument: string;
  /** Seite oder Abschnitt */
  stelle: string | null;
}

// ---------- Fahrzeug ----------

export const FAHRZEUG_ID = 'fahrzeug';

export type Kraftstoff = 'benzin' | 'bivalent_lpg';
export type MotorBestaetigung = 'motorcode' | 'vin' | 'gussnummer';

export interface Gasanlage {
  hersteller: string | null;
  typ: string | null;
  /** Angaben vom Typschild / Genehmigungsstand */
  typschild: string | null;
  tank_baujahr: number | null;
  verdampfer: string | null;
  /** Gasmischer oder Einblasung */
  gemischbildung: string | null;
  umschalter: string | null;
}

/** Genau ein Datensatz mit id = FAHRZEUG_ID. */
export interface Fahrzeug extends MitId {
  baujahr: number | null;
  vin: string | null;
  /** Freitext aus dem Fahrzeugschein (z. B. Hubraum, Leistung) */
  fahrzeugschein_angaben: string | null;
  /** Am Block eingeschlagener Motorcode, z. B. „802E20“ */
  motorcode: string | null;
  /** null, bis der Motor bestätigt ist */
  motor_variante_id: string | null;
  /** Vorgemerkte Motorvarianten, solange der Motor nicht bestätigt ist (z. B. AMC 232 und 258) */
  motor_vorgemerkt: string[];
  motor_bestaetigt_durch: MotorBestaetigung | null;
  getriebe: string | null;
  verteilergetriebe: string | null;
  achse_vorne: string | null;
  achse_hinten: string | null;
  vergaser: string | null;
  zuendung: string | null;
  kraftstoff: Kraftstoff;
  gasanlage: Gasanlage | null;
}

/** Abweichung vom Werkszustand. Eigene Werte überschreiben Handbuchwerte sichtbar. */
export interface Umbau extends MitId {
  bauteil_id: string | null;
  /** Ohne Datenbank-Bauteil: Teil im 3D-Modell */
  modell_teil_id: ModellTeilId | null;
  beschreibung: string;
  /** Lokales Datum JJJJ-MM-TT */
  datum: string | null;
  ersetzt_handbuchwert: boolean;
}

// ---------- Wissensbasis (aus Handbuch und Teilekatalog importiert) ----------

export interface MotorVariante extends MitId {
  name: string;
  zylinder: number;
  hubraum_l: number;
  bauart: string;
  /** Baujahre im CJ; null = nicht belegt */
  baujahr_von: number | null;
  baujahr_bis: number | null;
  /** 4. Zeichen des eingeschlagenen Motorcodes (z. B. „E“ in 802E20); leer = nicht belegt */
  motorcode_buchstaben: string[];
  /** 8. Zeichen der Fahrgestellnummer 1971–1974; leer = nicht belegt */
  vin_buchstaben: string[];
  erkennungsmerkmale: string[];
  quelle: Quelle;
}

export interface Baugruppe extends MitId {
  name: string;
  eltern_id: string | null;
  /** Bezug zum 3D-Modell, falls die Baugruppe dort ein eigenes Teil hat */
  modell_teil_id: ModellTeilId | null;
}

export interface Teilenummer {
  nummer: string;
  quelle: Quelle;
}

export interface Bauteil extends MitId {
  baugruppe_id: string;
  name: string;
  modell_teil_id: ModellTeilId | null;
  teilenummern: Teilenummer[];
  /** Leer = passt zu allen Motorvarianten */
  motor_varianten: string[];
  /** Für die Zuordnung von Mängeln („Bremse“, „Trommel“) */
  stichwoerter: string[];
}

export interface Sollwert {
  /** z. B. „Anzugsmoment Radmutter“ */
  groesse: string;
  wert: number;
  einheit: string;
  quelle: Quelle;
}

export interface AnleitungsSchritt {
  text: string;
  /** Foto-ID oder Bild aus der Wissensbasis */
  bild: string | null;
  werkzeug: string[];
  sollwerte: Sollwert[];
  warnung: string | null;
}

/** Für eine Anleitung benötigtes Ersatzteil oder Verbrauchsmaterial. */
export interface Material {
  art: 'teil' | 'verbrauch';
  bezeichnung: string;
  menge: number;
  einheit: string;
  /** Mit Teilenummer ist die Quelle Pflicht. */
  teilenummer: string | null;
  quelle: Quelle | null;
}

export interface Anleitung extends MitId {
  bauteil_id: string;
  titel: string;
  schritte: AnleitungsSchritt[];
  material: Material[];
  /** false = Entwurf ohne geprüfte Grundlage; wird deutlich als ungeprüft markiert */
  geprueft: boolean;
  quelle: Quelle | null;
}

export interface SymptomAntwort {
  text: string;
  naechster_id: string | null;
  befund_bauteil_id: string | null;
  pruefschritt: string | null;
}

export interface SymptomKnoten extends MitId {
  frage: string;
  antworten: SymptomAntwort[];
}

// ---------- Werkstatt ----------

export type Prioritaet = 'sicherheit' | 'hoch' | 'normal';
export type AufgabenStatus = 'offen' | 'in_arbeit' | 'erledigt';

export interface Aufgabe extends MitId {
  titel: string;
  bauteil_id: string | null;
  /** Ohne Datenbank-Bauteil: Teil im 3D-Modell */
  modell_teil_id: ModellTeilId | null;
  anleitung_id: string | null;
  /** Ursprünglicher Mangeltext, falls aus der Mängel-Eingabe */
  mangel_text: string | null;
  prioritaet: Prioritaet;
  geschaetzt_min: number | null;
  status: AufgabenStatus;
  erledigt_am: string | null;
}

export type ListenArt = 'teil' | 'verbrauch' | 'werkzeug';

export interface Listenposten extends MitId {
  aufgabe_id: string;
  art: ListenArt;
  bezeichnung: string;
  teilenummer: string | null;
  menge: number;
  einheit: string;
  vorhanden: boolean;
}

export interface Inventar extends MitId {
  bezeichnung: string;
  teilenummer: string | null;
  menge: number;
  ort: string | null;
}

/** Woran ein Foto oder eine Notiz hängt. */
export type BezugArt = 'modellteil' | 'bauteil' | 'aufgabe' | 'schritt' | 'fahrzeug';

export interface Foto extends MitId {
  bezug_art: BezugArt;
  bezug_id: string;
  blob: Blob;
  aufgenommen_am: string;
  notiz: string | null;
}

export interface Notiz extends MitId {
  bezug_art: BezugArt;
  bezug_id: string;
  text: string;
}

export interface Messung extends MitId {
  bauteil_id: string | null;
  modell_teil_id: ModellTeilId | null;
  /** z. B. „kompression“, „zuendzeitpunkt“, „spannung“ */
  groesse: string;
  zylinder: number | null;
  wert: number;
  einheit: string;
  kraftstoff: Kraftstoff | null;
  gemessen_am: string;
}

// ---------- Vorbereitet für V2/V3 (nur Schema, noch ohne Funktionen) ----------

export interface Wartung extends MitId {
  bezeichnung: string;
  intervall_km: number | null;
  intervall_monate: number | null;
  zuletzt_am: string | null;
  zuletzt_km: number | null;
}

export interface LogbuchEintrag extends MitId {
  datum: string;
  km_stand: number | null;
  text: string;
}

export interface Kosten extends MitId {
  aufgabe_id: string | null;
  betrag_cent: number;
  beschreibung: string;
  datum: string;
}

export interface SensorMesswert extends MitId {
  sensor: string;
  zeitpunkt: string;
  wert: number;
  einheit: string;
}
