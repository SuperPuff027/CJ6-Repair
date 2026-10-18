import type { Sprache } from './sprache';

const GEBIETSSCHEMA: Record<Sprache, string> = { de: 'de-DE', en: 'en-GB' };

/** Lokales Datum „JJJJ-MM-TT“ in der Schreibweise der Sprache, z. B. 01.05.2019 oder 01/05/2019. */
export function formatiereDatum(datum: string, sprache: Sprache): string {
  const [jahr, monat, tag] = datum.split('-').map(Number);
  if (!jahr || !monat || !tag) return datum;
  return new Intl.DateTimeFormat(GEBIETSSCHEMA[sprache], { day: '2-digit', month: '2-digit', year: 'numeric' }).format(
    new Date(jahr, monat - 1, tag),
  );
}
