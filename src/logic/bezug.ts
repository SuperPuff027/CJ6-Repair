import type { BezugArt } from '../model/typen';

/** Anzahl aktiver Einträge (Notizen, Fotos) je Bezug einer Art, z. B. Notizen je Modellteil. */
export function zaehleJeBezug(
  eintraege: readonly { bezug_art: BezugArt; bezug_id: string; geloescht: boolean }[],
  art: BezugArt,
): Map<string, number> {
  const zaehler = new Map<string, number>();
  for (const e of eintraege) {
    if (e.geloescht || e.bezug_art !== art) continue;
    zaehler.set(e.bezug_id, (zaehler.get(e.bezug_id) ?? 0) + 1);
  }
  return zaehler;
}
