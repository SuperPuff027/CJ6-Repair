// Symptom-Baum: Fragen aus der Wissensbasis Schritt für Schritt bis zu Befund oder Prüfschritt.
import type { SymptomAntwort, SymptomKnoten } from '../model/typen';
import { enthaeltGasgeruch } from './maengel';

/** Startfragen: Knoten, auf die keine Antwort verweist; alphabetisch. */
export function startKnoten(knoten: readonly SymptomKnoten[]): SymptomKnoten[] {
  const verwiesen = new Set(knoten.flatMap((k) => k.antworten.map((a) => a.naechster_id).filter((id): id is string => id !== null)));
  return knoten.filter((k) => !verwiesen.has(k.id)).sort((a, b) => a.frage.localeCompare(b.frage));
}

export interface PfadSchritt {
  knoten: SymptomKnoten;
  antwort: SymptomAntwort;
}

export type Ergebnis =
  | { art: 'frage'; knoten: SymptomKnoten }
  | { art: 'ende'; antwort: SymptomAntwort }
  | { art: 'gasgeruch' }
  /** Verweis auf eine Frage, die es nicht (mehr) gibt oder die schon im Weg vorkam */
  | { art: 'sackgasse' };

/** Wohin eine Antwort führt. Gasgeruch bricht immer ab. */
export function folge(antwort: SymptomAntwort, pfad: readonly PfadSchritt[], knoten: readonly SymptomKnoten[]): Ergebnis {
  if (enthaeltGasgeruch(antwort.text)) return { art: 'gasgeruch' };
  if (antwort.naechster_id === null) return { art: 'ende', antwort };
  const naechster = knoten.find((k) => k.id === antwort.naechster_id);
  if (!naechster || pfad.some((s) => s.knoten.id === naechster.id)) return { art: 'sackgasse' };
  return { art: 'frage', knoten: naechster };
}

/** Der gegangene Weg als Text, z. B. für den Mangeltext einer Aufgabe. */
export function wegAlsText(pfad: readonly PfadSchritt[]): string {
  return pfad.map((s) => `${s.knoten.frage} ${s.antwort.text}`).join(' · ');
}
