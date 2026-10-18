export const THEMEN = ['hell', 'dunkel'] as const;
export type Thema = (typeof THEMEN)[number];

export function istThema(wert: unknown): wert is Thema {
  return typeof wert === 'string' && (THEMEN as readonly string[]).includes(wert);
}

/** Eine ausdrückliche Wahl hat Vorrang, sonst gilt die Systemeinstellung. */
export function effektivesThema(gespeichert: Thema | null, systemDunkel: boolean): Thema {
  return gespeichert ?? (systemDunkel ? 'dunkel' : 'hell');
}

export function gegenteil(thema: Thema): Thema {
  return thema === 'dunkel' ? 'hell' : 'dunkel';
}
