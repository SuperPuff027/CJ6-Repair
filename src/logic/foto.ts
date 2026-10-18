/** Längste Bildkante nach dem Verkleinern (px): reicht zum Erkennen von Gussnummern, spart Speicher. */
export const MAX_KANTE_PX = 1600;

/** Zielgröße mit gleichem Seitenverhältnis; kleinere Bilder bleiben unverändert. */
export function zielGroesse(breite: number, hoehe: number, maxKante = MAX_KANTE_PX): { breite: number; hoehe: number } {
  const laengste = Math.max(breite, hoehe);
  if (laengste <= maxKante) return { breite, hoehe };
  const faktor = maxKante / laengste;
  return { breite: Math.round(breite * faktor), hoehe: Math.round(hoehe * faktor) };
}
