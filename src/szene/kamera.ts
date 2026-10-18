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
