import Dexie, { type Table } from 'dexie';
import type {
  Anleitung,
  Aufgabe,
  Baugruppe,
  Bauteil,
  Fahrzeug,
  Foto,
  Inventar,
  Kosten,
  Listenposten,
  LogbuchEintrag,
  Messung,
  Messvorgabe,
  MotorVariante,
  Notiz,
  SensorMesswert,
  SymptomKnoten,
  Umbau,
  Wartung,
} from '../model/typen';

export class CJ6Datenbank extends Dexie {
  /** Ein Datensatz (FAHRZEUG_ID) */
  fahrzeug!: Table<Fahrzeug, string>;
  umbauten!: Table<Umbau, string>;

  // Wissensbasis
  motor_varianten!: Table<MotorVariante, string>;
  baugruppen!: Table<Baugruppe, string>;
  bauteile!: Table<Bauteil, string>;
  anleitungen!: Table<Anleitung, string>;
  symptom_knoten!: Table<SymptomKnoten, string>;
  messvorgaben!: Table<Messvorgabe, string>;

  // Werkstatt
  aufgaben!: Table<Aufgabe, string>;
  listenposten!: Table<Listenposten, string>;
  inventar!: Table<Inventar, string>;
  fotos!: Table<Foto, string>;
  notizen!: Table<Notiz, string>;
  messungen!: Table<Messung, string>;

  // Ab V2/V3; bis dahin ungenutzt.
  wartungen!: Table<Wartung, string>;
  logbuch!: Table<LogbuchEintrag, string>;
  kosten!: Table<Kosten, string>;
  sensor_messwerte!: Table<SensorMesswert, string>;

  constructor(name = 'cj6-repair') {
    super(name);
    // Nur indizierte Felder angeben. Schemaänderungen immer als neue Version anhängen.
    this.version(1).stores({
      fahrzeug: 'id',
      umbauten: 'id, bauteil_id',
      motor_varianten: 'id',
      baugruppen: 'id, eltern_id, modell_teil_id',
      bauteile: 'id, baugruppe_id, modell_teil_id',
      anleitungen: 'id, bauteil_id',
      symptom_knoten: 'id',
      aufgaben: 'id, bauteil_id, modell_teil_id, status',
      listenposten: 'id, aufgabe_id',
      inventar: 'id, teilenummer',
      fotos: 'id, [bezug_art+bezug_id]',
      notizen: 'id, [bezug_art+bezug_id]',
      messungen: 'id, bauteil_id, modell_teil_id, groesse, gemessen_am',
      wartungen: 'id',
      logbuch: 'id, datum',
      kosten: 'id, aufgabe_id',
      sensor_messwerte: 'id, sensor, zeitpunkt',
    });
    // v2: Sollwerte für Messungen (Wissensbasis); Messungen nach Betriebsart statt Kraftstoff
    this.version(2).stores({ messvorgaben: 'id, groesse, motor_variante_id' });
  }
}

export const db = new CJ6Datenbank();
