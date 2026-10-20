import type { Anleitung, Bauteil, Quelle, Sollwert } from '../model/typen';
import type { ModellTeilId } from '../szene/modell';
import { formatiereZahl } from './format';
import type { Sprache } from './sprache';

/** Schrittnummer in den gültigen Bereich holen (z. B. nach einem Re-Import mit weniger Schritten). */
export function begrenzeSchritt(index: number, anzahl: number): number {
  if (anzahl <= 0) return 0;
  return Math.min(Math.max(0, Math.trunc(index)), anzahl - 1);
}

/** Fotos eines Schritts gehören zur Aufgabe: die Dokumentation genau dieser Reparatur. */
export function schrittFotoBezug(aufgabeId: string, index: number): string {
  return `${aufgabeId}:${index}`;
}

export function formatiereSollwert(s: Sollwert, sprache: Sprache): string {
  return `${formatiereZahl(s.wert, sprache)} ${s.einheit}`;
}

export function quellenText(q: Quelle): string {
  return q.stelle ? `${q.dokument}, ${q.stelle}` : q.dokument;
}

/** Anleitungen zu einem Modellteil über dessen Bauteile; geprüfte zuerst. */
export function anleitungenFuerTeil(teil: ModellTeilId, bauteile: readonly Bauteil[], anleitungen: readonly Anleitung[]): Anleitung[] {
  const ids = new Set(bauteile.filter((b) => b.modell_teil_id === teil).map((b) => b.id));
  return anleitungen
    .filter((a) => ids.has(a.bauteil_id))
    .sort((a, b) => Number(b.geprueft) - Number(a.geprueft) || a.titel.localeCompare(b.titel));
}
