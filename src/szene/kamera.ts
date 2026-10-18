export type Vektor = [number, number, number];

/**
 * Abstand, aus dem eine Kugel mit diesem Radius bei gegebenem vertikalem Blickwinkel
 * und Seitenverhältnis (Breite / Höhe) vollständig ins Bild passt.
 * Im Hochformat begrenzt der horizontale Blickwinkel.
 */
export function passendeEntfernung(seitenverhaeltnis: number, vertikalGrad: number, radius: number): number {
  const vertikal = (vertikalGrad * Math.PI) / 180;
  const horizontal = 2 * Math.atan(Math.tan(vertikal / 2) * seitenverhaeltnis);
  const engster = Math.min(vertikal, horizontal);
  return radius / Math.sin(engster / 2);
}

/** Bauteile hinter dieser x-Position (m) werden von hinten gezeigt. */
const GRENZE_HECK_X = -0.9;
/** Kleinster Kameraabstand zum Bauteil (m), damit kleine Teile nicht formatfüllend werden. */
export const MIN_ABSTAND = 1.3;
/** Luft um das Bauteil im Bild. */
const RAND_FAKTOR = 1.35;

/**
 * Kamera für ein ausgewähltes Bauteil: schräg von oben, von der Seite und dem Ende des
 * Fahrzeugs, auf dem das Teil sitzt; Abstand so, dass das Teil mit etwas Rand ins Bild passt.
 */
export function ansichtFuerTeil(
  mitte: Vektor,
  groesse: Vektor,
  seitenverhaeltnis: number,
  vertikalGrad: number,
): { kamera: Vektor; ziel: Vektor } {
  const [x, , z] = mitte;
  const vonVorn = x >= GRENZE_HECK_X ? 1 : -1;
  const vonLinks = z >= -0.05 ? 1 : -1;
  const richtung: Vektor = [vonVorn * 1, 0.62, vonLinks * 1.15];
  const laenge = Math.hypot(...richtung);

  const radius = Math.hypot(...groesse) / 2;
  const abstand = Math.max(MIN_ABSTAND, passendeEntfernung(seitenverhaeltnis, vertikalGrad, radius) * RAND_FAKTOR);

  return {
    ziel: mitte,
    kamera: [x + (richtung[0] / laenge) * abstand, mitte[1] + (richtung[1] / laenge) * abstand, z + (richtung[2] / laenge) * abstand],
  };
}

/** Weicher Übergang 0 → 1 für den Kameraflug. */
export function sanft(t: number): number {
  const k = Math.min(1, Math.max(0, t));
  return k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2;
}
