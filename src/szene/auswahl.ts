export interface Treffer<Id> {
  id: Id;
  /** Volumen der Umhüllenden des ganzen Bauteils (m³) */
  volumen: number;
}

/**
 * Beim Antippen liegen oft mehrere Bauteile hintereinander oder ineinander (Motor unter der Haube,
 * Bremse im Rad). Gewählt wird das kleinste getroffene, weil die großen es sonst immer verdecken.
 */
export function kleinsterTreffer<Id>(treffer: readonly Treffer<Id>[]): Id | null {
  let bester: Treffer<Id> | null = null;
  for (const t of treffer) if (!bester || t.volumen < bester.volumen) bester = t;
  return bester?.id ?? null;
}

/** Ein Tippen ist es nur, wenn sich der Finger kaum bewegt hat; sonst war es Drehen oder Zoomen. */
export const TIPP_TOLERANZ_PX = 6;

export function istTippen(start: { x: number; y: number }, ende: { x: number; y: number }): boolean {
  return Math.hypot(ende.x - start.x, ende.y - start.y) <= TIPP_TOLERANZ_PX;
}
