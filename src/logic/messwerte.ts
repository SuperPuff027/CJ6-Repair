// Messwerte mit Soll-Ist-Abgleich. Sollwerte kommen nur aus den Messvorgaben der Wissensbasis (mit Quelle);
// ohne Vorgabe werden Messungen gespeichert und verglichen, aber nicht als „zu hoch/zu niedrig“ bewertet.
import type { Betriebsart, Messung, Messvorgabe } from '../model/typen';
import type { ModellTeilId } from '../szene/modell';
import { rechne } from './einheiten';

export const MESSGROESSEN = [
  'kompression',
  'zuendzeitpunkt',
  'schliesswinkel',
  'batteriespannung',
  'ladespannung',
  'leerlaufdrehzahl',
  'oeldruck',
] as const;
export type Messgroesse = (typeof MESSGROESSEN)[number];

/** Erlaubte Einheiten je Messgröße; die erste ist der Standard. */
export const EINHEITEN: Readonly<Record<Messgroesse, readonly string[]>> = {
  kompression: ['bar', 'psi'],
  zuendzeitpunkt: ['° v. OT'],
  schliesswinkel: ['°'],
  batteriespannung: ['V'],
  ladespannung: ['V'],
  leerlaufdrehzahl: ['1/min'],
  oeldruck: ['bar', 'psi'],
};

/** Welches Teil im Modell zur Messung gehört. */
export const MESS_TEIL: Readonly<Record<Messgroesse, ModellTeilId>> = {
  kompression: 'motor',
  zuendzeitpunkt: 'motor',
  schliesswinkel: 'motor',
  batteriespannung: 'batterie',
  ladespannung: 'batterie',
  leerlaufdrehzahl: 'motor',
  oeldruck: 'motor',
};

export function istMessgroesse(wert: unknown): wert is Messgroesse {
  return typeof wert === 'string' && (MESSGROESSEN as readonly string[]).includes(wert);
}

/** Rechnet zwischen Einheiten derselben Messgröße um (Druck: bar/psi); null, wenn das nicht geht. */
export function rechneUm(wert: number, von: string, nach: string): number | null {
  if (von === nach) return wert;
  return rechne(wert, 'druck', von, nach);
}

/**
 * Passende Vorgaben: Messgröße stimmt, Motor passt (bestätigter, sonst vorgemerkte; ohne Motor alle),
 * Betriebsart passt. Vorgaben speziell für Benzin oder Gas gehen allgemeinen vor.
 */
export function passendeVorgaben(
  vorgaben: readonly Messvorgabe[],
  groesse: Messgroesse,
  motoren: readonly string[],
  betriebsart: Betriebsart,
): Messvorgabe[] {
  const passend = vorgaben.filter(
    (v) =>
      v.groesse === groesse &&
      (v.motor_variante_id === null || motoren.length === 0 || motoren.includes(v.motor_variante_id)) &&
      (v.betriebsart === null || v.betriebsart === betriebsart),
  );
  const speziell = passend.filter((v) => v.betriebsart === betriebsart);
  return speziell.length > 0 ? speziell : passend;
}

export type Urteil = 'ok' | 'zu_niedrig' | 'zu_hoch' | 'ohne_sollwert';

/** Einen Wert mit einer Vorgabe vergleichen; der Wert wird bei Bedarf in die Einheit der Vorgabe umgerechnet. */
export function bewerte(wert: number, einheit: string, vorgabe: Messvorgabe | null): Urteil {
  if (!vorgabe || (vorgabe.min === null && vorgabe.max === null)) return 'ohne_sollwert';
  const umgerechnet = rechneUm(wert, einheit, vorgabe.einheit);
  if (umgerechnet === null) return 'ohne_sollwert';
  if (vorgabe.min !== null && umgerechnet < vorgabe.min) return 'zu_niedrig';
  if (vorgabe.max !== null && umgerechnet > vorgabe.max) return 'zu_hoch';
  return 'ok';
}

export interface KompressionsBild {
  urteile: Urteil[];
  /** Index des schwächsten Zylinders (0-basiert) */
  schwaechster: number;
  /** (höchster − niedrigster) / höchster in Prozent */
  streuungProzent: number;
  /** Nur mit Vorgabe: Streuung größer als erlaubt */
  streuungZuGross: boolean | null;
}

/** Kompression aller Zylinder: Einzelurteile, schwächster Zylinder und Streuung. */
export function bewerteKompression(werte: readonly number[], einheit: string, vorgabe: Messvorgabe | null): KompressionsBild | null {
  if (werte.length === 0) return null;
  const hoechster = Math.max(...werte);
  const niedrigster = Math.min(...werte);
  const streuungProzent = hoechster > 0 ? ((hoechster - niedrigster) / hoechster) * 100 : 0;
  const grenze = vorgabe?.max_abweichung_prozent ?? null;
  return {
    urteile: werte.map((w) => bewerte(w, einheit, vorgabe)),
    schwaechster: werte.indexOf(niedrigster),
    streuungProzent,
    streuungZuGross: grenze === null ? null : streuungProzent > grenze,
  };
}

/** Zahl aus einer Eingabe wie „8,5“ oder „135“; leer oder unlesbar = null. */
export function messwertEingabe(text: string): number | null {
  const t = text.trim().replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(t)) return null;
  return Number(t);
}

export interface Messreihe {
  groesse: string;
  gemessen_am: string;
  betriebsart: Messung['betriebsart'];
  einheit: string;
  /** Nach Zylinder sortiert; bei Einzelmessungen genau ein Wert */
  werte: { id: string; zylinder: number | null; wert: number }[];
}

/** Fasst aktive Messungen mit gleichem Zeitpunkt, gleicher Größe und Betriebsart zusammen; neueste zuerst. */
export function gruppiereMessreihen(messungen: readonly Messung[]): Messreihe[] {
  const reihen = new Map<string, Messreihe>();
  for (const m of messungen) {
    if (m.geloescht) continue;
    const schluessel = `${m.groesse}|${m.gemessen_am}|${m.betriebsart ?? ''}`;
    let reihe = reihen.get(schluessel);
    if (!reihe) {
      reihe = { groesse: m.groesse, gemessen_am: m.gemessen_am, betriebsart: m.betriebsart, einheit: m.einheit, werte: [] };
      reihen.set(schluessel, reihe);
    }
    reihe.werte.push({ id: m.id, zylinder: m.zylinder, wert: m.wert });
  }
  for (const r of reihen.values()) r.werte.sort((a, b) => (a.zylinder ?? 0) - (b.zylinder ?? 0));
  return [...reihen.values()].sort((a, b) => b.gemessen_am.localeCompare(a.gemessen_am));
}
