// Mängel-Eingabe: ordnet Freitext („Öl tropft am Verteilergetriebe“) einem Teil des Modells zu.
// Stichwörter sind Wortanfänge in vereinheitlichter Schreibweise (siehe normalisiere): „brems“ passt auf
// „Bremse“, „Bremsen“, „Bremsbelag“. Treffer zählen nach Länge des Stichworts, damit das genauere gewinnt
// („kuehlergrill“ vor „kuehler“). Gleichstand zwischen Teilen führt zur Rückfrage.
import type { ModellTeilId } from '../szene/modell';
import { normalisiere } from './suche';

const STICHWOERTER: Readonly<Record<ModellTeilId, readonly string[]>> = {
  wanne: ['wanne', 'karosserie', 'bodenblech', 'tub', 'body'],
  motorhaube: ['haube', 'motorhaube', 'hood'],
  kotfluegel: ['kotfluegel', 'fender'],
  kuehlergrill: ['grill', 'kuehlergrill', 'grille'],
  frontscheibe: ['frontscheibe', 'scheibe', 'windschutz', 'wischer', 'windshield', 'wiper'],
  armaturenbrett: ['armaturen', 'tacho', 'instrument', 'anzeige', 'dashboard', 'gauge', 'speedo'],
  stossstangen: ['stossstange', 'bumper'],
  sitze: ['sitz', 'bezug', 'seat'],
  reserverad: ['reserverad', 'ersatzrad', 'spare'],
  motor: [
    'motor',
    'zylinder',
    'ventil',
    'kolben',
    'oelwanne',
    'kopfdichtung',
    'vergaser',
    'zuendkerze',
    'zuendverteiler',
    'verteilerkappe',
    'verteiler',
    'lichtmaschine',
    'anlasser',
    'keilriemen',
    'stottert',
    'ruckelt',
    'klopft',
    'engine',
    'carburetor',
    'carb',
    'spark',
    'alternator',
    'starter',
  ],
  kuehler: ['kuehler', 'kuehlwasser', 'kuehlmittel', 'ueberhitz', 'wasserpumpe', 'thermostat', 'radiator', 'coolant', 'overheat'],
  getriebe: ['getriebe', 'schaltgetriebe', 'gang', 'schalt', 'kupplung', 'transmission', 'gearbox', 'clutch', 'shift'],
  verteilergetriebe: ['verteilergetriebe', 'verteiler', 'allrad', 'untersetzung', '4x4', 'transfer'],
  kardanwellen: ['kardan', 'gelenkwelle', 'kreuzgelenk', 'antriebswelle', 'driveshaft', 'ujoint'],
  auspuff: ['auspuff', 'schalldaempfer', 'endrohr', 'abgas', 'exhaust', 'muffler'],
  rahmen: ['rahmen', 'quertraeger', 'frame'],
  vorderachse: ['vorderachse', 'frontachse'],
  hinterachse: ['hinterachse'],
  blattfedern: ['feder', 'blattfeder', 'spring', 'leaf'],
  stossdaempfer: ['stossdaempfer', 'daempfer', 'shock'],
  bremsen_vorne: [],
  bremsen_hinten: ['handbremse', 'feststellbremse'],
  raeder: ['rad', 'raeder', 'reifen', 'felge', 'radlager', 'luftdruck', 'wheel', 'tire', 'tyre', 'rim'],
  lenkung: ['lenk', 'spurstange', 'steering', 'tierod'],
  benzintank: ['benzin', 'tank', 'kraftstoff', 'sprit', 'fuel', 'petrol'],
  gastank: ['gastank', 'tank', 'lpg', 'autogas', 'multiventil'],
  gasleitung: ['gasleitung'],
  verdampfer: ['verdampfer', 'gasmischer', 'mischer', 'umschalter', 'vaporizer', 'mixer', 'regulator'],
  batterie: ['batterie', 'akku', 'battery'],
  beleuchtung: ['beleuchtung', 'licht', 'scheinwerfer', 'blinker', 'ruecklicht', 'lampe', 'light', 'lamp', 'indicator'],
};

/** Teile, die es vorn und hinten gibt: das Stichwort allein reicht nicht, die Lage entscheidet. */
const LAGE_GRUPPEN: readonly { stichwoerter: readonly string[]; vorne: ModellTeilId; hinten: ModellTeilId }[] = [
  { stichwoerter: ['brems', 'trommel', 'brake', 'drum'], vorne: 'bremsen_vorne', hinten: 'bremsen_hinten' },
  { stichwoerter: ['achse', 'differential', 'diff', 'axle'], vorne: 'vorderachse', hinten: 'hinterachse' },
];

const VORNE = ['vorn', 'vorder', 'front'];
const HINTEN = ['hinten', 'hinter', 'heck', 'rear'];

/** Gasgeruch ist ein Sicherheitsfall (CLAUDE.md): Diagnose abbrechen. */
const GASGERUCH = ['gasgeruch', 'riecht nach gas', 'gas riecht', 'gas stinkt', 'stinkt nach gas', 'nach gas riecht', 'smell gas', 'smells of gas', 'smell of gas', 'lpg smell'];

/** Erwähnt der Text Gasgeruch? Dann ist es ein Sicherheitsfall (CLAUDE.md). */
export function enthaeltGasgeruch(text: string): boolean {
  const roh = normalisiere(text);
  return GASGERUCH.some((g) => roh.includes(normalisiere(g)));
}

export type Zuordnung =
  | { text: string; gasgeruch: boolean; art: 'eindeutig'; teil: ModellTeilId }
  | { text: string; gasgeruch: boolean; art: 'rueckfrage'; grund: 'lage' | 'mehrdeutig'; optionen: ModellTeilId[] }
  | { text: string; gasgeruch: boolean; art: 'unbekannt' };

/** Höchstens so viele Teile bietet eine Rückfrage an. */
const MAX_OPTIONEN = 4;

function woerter(text: string): string[] {
  return normalisiere(text)
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean);
}

/** Summe der Stichwortlängen: längere, genauere Stichwörter wiegen mehr. */
function gewicht(stichwoerter: readonly string[]): number {
  return stichwoerter.reduce((summe, s) => summe + s.length, 0);
}

function passt(wortliste: readonly string[], stichwort: string): boolean {
  return wortliste.some((w) => w.startsWith(stichwort));
}

/**
 * Ordnet einen Mangel zu. Zusätzliche Stichwörter (z. B. aus Bauteilen der Wissensbasis) ergänzen die
 * eingebauten. Gewinnt ein Teil mit den meisten Treffern, ist die Zuordnung eindeutig.
 */
export function ordneMangelZu(text: string, zusatz: Partial<Record<ModellTeilId, readonly string[]>> = {}): Zuordnung {
  const w = woerter(text);
  const gasgeruch = enthaeltGasgeruch(text);
  const punkte = new Map<ModellTeilId, number>();
  const plus = (teil: ModellTeilId, n: number) => punkte.set(teil, (punkte.get(teil) ?? 0) + n);

  for (const [teil, liste] of Object.entries(STICHWOERTER) as [ModellTeilId, readonly string[]][]) {
    const alle = [...liste, ...(zusatz[teil] ?? []).flatMap(woerter)];
    const treffer = [...new Set(alle.filter((s) => passt(w, s)))];
    if (treffer.length > 0) plus(teil, gewicht(treffer));
  }

  const vorne = VORNE.some((s) => passt(w, s));
  const hinten = HINTEN.some((s) => passt(w, s));
  let offeneLage: { vorne: ModellTeilId; hinten: ModellTeilId; treffer: number } | null = null;
  for (const gruppe of LAGE_GRUPPEN) {
    const passend = gruppe.stichwoerter.filter((s) => passt(w, s));
    if (passend.length === 0) continue;
    // Die genannte Lage zählt zusätzlich, damit „Bremse vorne“ vor einem allgemeinen Treffer liegt.
    const treffer = gewicht(passend);
    if (vorne && !hinten) plus(gruppe.vorne, treffer + 1);
    else if (hinten && !vorne) plus(gruppe.hinten, treffer + 1);
    else if (!punkte.has(gruppe.vorne) && !punkte.has(gruppe.hinten)) offeneLage = { ...gruppe, treffer };
  }

  const bestePunkte = Math.max(0, ...punkte.values());
  if (offeneLage && offeneLage.treffer >= bestePunkte) {
    return { text, gasgeruch, art: 'rueckfrage', grund: 'lage', optionen: [offeneLage.vorne, offeneLage.hinten] };
  }
  if (bestePunkte === 0) {
    // Gasgeruch ohne genanntes Teil: die Teile der Gasanlage zur Auswahl anbieten.
    if (gasgeruch) return { text, gasgeruch, art: 'rueckfrage', grund: 'mehrdeutig', optionen: ['gastank', 'gasleitung', 'verdampfer'] };
    return { text, gasgeruch, art: 'unbekannt' };
  }
  const beste = [...punkte].filter(([, p]) => p === bestePunkte).map(([teil]) => teil);
  if (beste.length === 1) return { text, gasgeruch, art: 'eindeutig', teil: beste[0]! };
  return { text, gasgeruch, art: 'rueckfrage', grund: 'mehrdeutig', optionen: beste.slice(0, MAX_OPTIONEN) };
}

/** Mehrere Mängel, einer pro Zeile (oder durch Semikolon getrennt). */
export function ordneMaengelZu(eingabe: string, zusatz?: Partial<Record<ModellTeilId, readonly string[]>>): Zuordnung[] {
  return eingabe
    .split(/[\n;]+/)
    .map((z) => z.trim())
    .filter(Boolean)
    .map((z) => ordneMangelZu(z, zusatz));
}
