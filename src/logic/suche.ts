/** Vereinheitlicht Text für die Suche: Kleinschreibung, Umlaute ausgeschrieben, Akzente entfernt. */
export function normalisiere(text: string): string {
  return text
    .toLocaleLowerCase('de')
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

/** Passt, wenn jedes Wort der Anfrage in einem der Texte vorkommt. Leere Anfrage passt immer. */
export function passtZurSuche(texte: readonly string[], anfrage: string): boolean {
  const woerter = normalisiere(anfrage).split(/\s+/).filter(Boolean);
  if (woerter.length === 0) return true;
  const heuhaufen = texte.map(normalisiere).join(' ');
  return woerter.every((w) => heuhaufen.includes(w));
}
