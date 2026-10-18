import { FAHRZEUG_ID, type Fahrzeug, type MitId, type Synchronisierbar } from '../model/typen';

export function neueId(): string {
  return crypto.randomUUID();
}

/** Legt einen neuen Datensatz mit UUID und Zeitstempel an. */
export function neuerDatensatz<T extends MitId>(felder: Omit<T, keyof MitId>, jetzt: Date): T {
  return { ...felder, id: neueId(), aktualisiert_am: jetzt.toISOString(), geloescht: false } as T;
}

/** Setzt aktualisiert_am auf den Zeitpunkt der Änderung. */
export function geaendert<T extends Synchronisierbar>(datensatz: T, jetzt: Date): T {
  return { ...datensatz, aktualisiert_am: jetzt.toISOString() };
}

export function alsGeloescht<T extends Synchronisierbar>(datensatz: T, jetzt: Date): T {
  return { ...datensatz, geloescht: true, aktualisiert_am: jetzt.toISOString() };
}

export function nurAktive<T extends Synchronisierbar>(datensaetze: readonly T[]): T[] {
  return datensaetze.filter((d) => !d.geloescht);
}

/**
 * Fahrzeug, solange noch nichts erfasst ist. Baujahr und Kraftstoff stehen im Projekt-Brief;
 * alles andere (insbesondere der Motor) bleibt leer, bis es bestätigt ist.
 */
export function standardFahrzeug(jetzt: Date): Fahrzeug {
  return {
    id: FAHRZEUG_ID,
    baujahr: 1974,
    vin: null,
    fahrzeugschein_angaben: null,
    motorcode: null,
    motor_variante_id: null,
    motor_bestaetigt_durch: null,
    getriebe: null,
    verteilergetriebe: null,
    achse_vorne: null,
    achse_hinten: null,
    vergaser: null,
    zuendung: null,
    kraftstoff: 'bivalent_lpg',
    gasanlage: null,
    aktualisiert_am: jetzt.toISOString(),
    geloescht: false,
  };
}
