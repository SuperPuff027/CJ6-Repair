// Einheitenumrechnung US/SAE ↔ metrisch. Alle Faktoren sind exakte Definitionen
// (internationales Zoll 25,4 mm, Pfund 0,45359237 kg, Normfallbeschleunigung 9,80665 m/s², US-Gallone 231 in³).

const ZOLL_M = 0.0254;
const FUSS_M = 0.3048;
const MEILE_M = 1609.344;
const PFUND_KG = 0.45359237;
const G = 9.80665;
/** Pfund-Kraft in Newton */
const LBF_N = PFUND_KG * G;
const PSI_PA = LBF_N / (ZOLL_M * ZOLL_M);
/** US-Gallone in Litern (231 Kubikzoll) */
const GALLONE_L = 231 * ZOLL_M ** 3 * 1000;

interface Einheit {
  /** In die Basiseinheit der Kategorie */
  zuBasis: (x: number) => number;
  /** Aus der Basiseinheit */
  vonBasis: (x: number) => number;
}

const linear = (faktor: number): Einheit => ({ zuBasis: (x) => x * faktor, vonBasis: (x) => x / faktor });

export const KATEGORIEN = {
  // Basis: Meter
  laenge: { mm: linear(0.001), cm: linear(0.01), m: linear(1), km: linear(1000), in: linear(ZOLL_M), ft: linear(FUSS_M), mi: linear(MEILE_M) },
  // Basis: Newtonmeter
  drehmoment: { Nm: linear(1), 'ft-lb': linear(LBF_N * FUSS_M), 'in-lb': linear(LBF_N * ZOLL_M), kpm: linear(G) },
  // Basis: Pascal
  druck: { bar: linear(100000), kPa: linear(1000), psi: linear(PSI_PA), 'kp/cm²': linear(G * 10000) },
  // Basis: Grad Celsius
  temperatur: { '°C': linear(1), '°F': { zuBasis: (x: number) => ((x - 32) * 5) / 9, vonBasis: (x: number) => (x * 9) / 5 + 32 } },
  // Basis: Liter
  volumen: { l: linear(1), ml: linear(0.001), gal: linear(GALLONE_L), qt: linear(GALLONE_L / 4), pt: linear(GALLONE_L / 8), 'fl oz': linear(GALLONE_L / 128) },
  // Basis: Liter
  hubraum: { l: linear(1), 'cm³': linear(0.001), ci: linear(ZOLL_M ** 3 * 1000) },
  // Basis: Kilogramm
  gewicht: { kg: linear(1), g: linear(0.001), lb: linear(PFUND_KG), oz: linear(PFUND_KG / 16) },
  // Basis: km/h
  geschwindigkeit: { 'km/h': linear(1), mph: linear(MEILE_M / 1000) },
  // Basis: l/100 km (mpg ist umgekehrt proportional)
  verbrauch: {
    'l/100 km': linear(1),
    mpg: { zuBasis: (x: number) => (100 * GALLONE_L) / ((x * MEILE_M) / 1000), vonBasis: (x: number) => (100 * GALLONE_L) / ((x * MEILE_M) / 1000) },
  },
} as const satisfies Record<string, Record<string, Einheit>>;

export type Kategorie = keyof typeof KATEGORIEN;
export const KATEGORIE_LISTE = Object.keys(KATEGORIEN) as Kategorie[];

export function einheitenVon(kategorie: Kategorie): string[] {
  return Object.keys(KATEGORIEN[kategorie]);
}

/** Rechnet um; null, wenn eine Einheit nicht zur Kategorie gehört oder das Ergebnis keine Zahl ist. */
export function rechne(wert: number, kategorie: Kategorie, von: string, nach: string): number | null {
  const einheiten = KATEGORIEN[kategorie] as Record<string, Einheit>;
  const a = einheiten[von];
  const b = einheiten[nach];
  if (!a || !b) return null;
  if (kategorie === 'verbrauch' && wert === 0) return null;
  const ergebnis = b.vonBasis(a.zuBasis(wert));
  return Number.isFinite(ergebnis) ? ergebnis : null;
}

/** Zahl oder Bruch: „1,5“, „9/16“, „1 1/8“, „1-1/8“. */
export function leseZahlOderBruch(text: string): number | null {
  const t = text.trim().replace(',', '.').replace(/["”]/g, '').replace(/\s*-\s*(?=\d+\/)/, ' ');
  const bruch = t.match(/^(?:(\d+)\s+)?(\d+)\/(\d+)$/);
  if (bruch) {
    const ganz = Number(bruch[1] ?? 0);
    const nenner = Number(bruch[3]);
    return nenner === 0 ? null : ganz + Number(bruch[2]) / nenner;
  }
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : null;
}

/** Gängige metrische Schlüsselweiten (mm). */
export const METRISCHE_WEITEN = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 32];

/** Gängige SAE-Schlüsselweiten (Zoll). */
export const SAE_WEITEN = ['1/4', '5/16', '11/32', '3/8', '7/16', '1/2', '9/16', '5/8', '11/16', '3/4', '13/16', '7/8', '15/16', '1', '1 1/16', '1 1/8'];

export interface Schluesselweite {
  mm: number;
  /** Nächstkleinerer oder gleicher metrischer Schlüssel und um wie viel er kleiner ist */
  darunter: { mm: number; differenz: number } | null;
  /** Nächstgrößerer metrischer Schlüssel und um wie viel er größer ist */
  darueber: { mm: number; differenz: number } | null;
}

/** Zoll-Schlüsselweite in mm und die benachbarten metrischen Schlüssel. */
export function schluesselweite(zoll: number): Schluesselweite {
  const mm = zoll * 25.4;
  const unten = [...METRISCHE_WEITEN].reverse().find((w) => w <= mm + 1e-9);
  const oben = METRISCHE_WEITEN.find((w) => w > mm + 1e-9);
  return {
    mm,
    darunter: unten === undefined ? null : { mm: unten, differenz: mm - unten },
    darueber: oben === undefined ? null : { mm: oben, differenz: oben - mm },
  };
}

/** Zu welcher Einheit ein Sollwert sinnvoll umgerechnet wird (US ↔ metrisch). */
const GEGENSTUECK: Readonly<Record<string, { kategorie: Kategorie; nach: string }>> = {
  'ft-lb': { kategorie: 'drehmoment', nach: 'Nm' },
  'lb-ft': { kategorie: 'drehmoment', nach: 'Nm' },
  'in-lb': { kategorie: 'drehmoment', nach: 'Nm' },
  Nm: { kategorie: 'drehmoment', nach: 'ft-lb' },
  psi: { kategorie: 'druck', nach: 'bar' },
  bar: { kategorie: 'druck', nach: 'psi' },
  in: { kategorie: 'laenge', nach: 'mm' },
  mm: { kategorie: 'laenge', nach: 'in' },
  '°F': { kategorie: 'temperatur', nach: '°C' },
  '°C': { kategorie: 'temperatur', nach: '°F' },
  qt: { kategorie: 'volumen', nach: 'l' },
  gal: { kategorie: 'volumen', nach: 'l' },
  l: { kategorie: 'volumen', nach: 'qt' },
  lb: { kategorie: 'gewicht', nach: 'kg' },
  kg: { kategorie: 'gewicht', nach: 'lb' },
  ci: { kategorie: 'hubraum', nach: 'l' },
};

/** Umrechnung eines Sollwerts in die jeweils andere Welt, z. B. 30 ft-lb → 40,7 Nm; null, wenn unbekannt. */
export function gegenstueck(wert: number, einheit: string): { wert: number; einheit: string } | null {
  const ziel = GEGENSTUECK[einheit === 'lb-ft' ? 'ft-lb' : einheit];
  if (!ziel) return null;
  const von = einheit === 'lb-ft' ? 'ft-lb' : einheit;
  const ergebnis = rechne(wert, ziel.kategorie, von, ziel.nach);
  return ergebnis === null ? null : { wert: ergebnis, einheit: ziel.nach };
}
