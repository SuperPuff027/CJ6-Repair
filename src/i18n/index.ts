import type { Sprache } from '../logic/sprache';
import { de, type Schluessel, type Uebersetzung } from './de';
import { en } from './en';

export type { Schluessel } from './de';

const UEBERSETZUNGEN: Record<Sprache, Uebersetzung> = { de, en };

export type Platzhalter = Record<string, string | number>;
export type Uebersetzer = (schluessel: Schluessel, platzhalter?: Platzhalter) => string;

/** Liefert eine t()-Funktion für eine Sprache. Platzhalter im Text: {name}. */
export function erstelleUebersetzer(sprache: Sprache): Uebersetzer {
  const texte = UEBERSETZUNGEN[sprache];
  return (schluessel, platzhalter) => {
    const text = texte[schluessel];
    if (!platzhalter) return text;
    return text.replace(/\{(\w+)\}/g, (roh, name: string) =>
      name in platzhalter ? String(platzhalter[name]) : roh,
    );
  };
}
