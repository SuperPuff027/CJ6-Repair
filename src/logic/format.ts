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

/** Zahl in der Schreibweise der Sprache, z. B. 3,8 oder 3.8. */
export function formatiereZahl(zahl: number, sprache: Sprache, nachkommastellen = 2): string {
  return new Intl.NumberFormat(GEBIETSSCHEMA[sprache], { maximumFractionDigits: nachkommastellen }).format(zahl);
}

/** Lokales Datum „JJJJ-MM-TT“ eines Zeitstempels, z. B. für „Notiz vom …“. */
export function lokalesDatum(zeitpunkt: string): string {
  const d = new Date(zeitpunkt);
  const zwei = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${zwei(d.getMonth() + 1)}-${zwei(d.getDate())}`;
}
