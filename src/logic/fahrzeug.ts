import type { Gasanlage, Umbau } from '../model/typen';

/** Frühestes sinnvolles Jahr für Fahrzeug, Gastank und Umbauten. */
export const FRUEHESTES_JAHR = 1940;

/** Leere oder nur aus Leerzeichen bestehende Eingaben werden zu null. */
export function textFeld(eingabe: string): string | null {
  const t = eingabe.trim().replace(/\s+/g, ' ');
  return t === '' ? null : t;
}

export type JahrErgebnis = { ok: true; wert: number | null } | { ok: false; von: number; bis: number };

/** Jahreszahl zwischen 1940 und nächstem Jahr; leer ist erlaubt (unbekannt). */
export function jahrFeld(eingabe: string, jetzt: Date): JahrErgebnis {
  const bis = jetzt.getFullYear() + 1;
  const t = eingabe.trim();
  if (t === '') return { ok: true, wert: null };
  if (!/^\d{4}$/.test(t)) return { ok: false, von: FRUEHESTES_JAHR, bis };
  const jahr = Number(t);
  return jahr >= FRUEHESTES_JAHR && jahr <= bis ? { ok: true, wert: jahr } : { ok: false, von: FRUEHESTES_JAHR, bis };
}

/** Fahrgestellnummer: Großbuchstaben, ohne Leerzeichen und Bindestriche. Alte Jeeps haben kürzere Nummern als 17 Stellen. */
export function vinFeld(eingabe: string): string | null {
  const t = eingabe.toUpperCase().replace(/[\s-]/g, '');
  return t === '' ? null : t;
}

export const GAS_TEXTFELDER = ['hersteller', 'typ', 'typschild', 'verdampfer', 'gemischbildung', 'umschalter'] as const;

export function leereGasanlage(): Gasanlage {
  return { hersteller: null, typ: null, typschild: null, tank_baujahr: null, verdampfer: null, gemischbildung: null, umschalter: null };
}

/** Umbauten: neueste zuerst; ohne Datum ans Ende, dort nach Erfassung. */
export function sortiereUmbauten(umbauten: readonly Umbau[]): Umbau[] {
  return [...umbauten].sort((a, b) => {
    if (a.datum && b.datum && a.datum !== b.datum) return b.datum.localeCompare(a.datum);
    if (a.datum && !b.datum) return -1;
    if (!a.datum && b.datum) return 1;
    return b.aktualisiert_am.localeCompare(a.aktualisiert_am);
  });
}

/**
 * Hubraum in Litern aus einer Eingabe wie „3,8“, „3.8 l“ oder „1600 cm³“.
 * Zahlen über 100 gelten als cm³ (so steht es in den meisten Fahrzeugpapieren).
 */
export function hubraumLiter(eingabe: string): number | null {
  const treffer = eingabe.replace(',', '.').match(/\d+(\.\d+)?/);
  if (!treffer) return null;
  const zahl = Number(treffer[0]);
  if (!Number.isFinite(zahl) || zahl <= 0) return null;
  return zahl > 100 ? zahl / 1000 : zahl;
}
