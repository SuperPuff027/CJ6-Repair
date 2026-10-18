import type { Aufgabe, AufgabenStatus, Prioritaet } from '../model/typen';
import type { ModellTeilId } from '../szene/modell';

export const PRIORITAETEN: readonly Prioritaet[] = ['sicherheit', 'hoch', 'normal'];

const PRIO_RANG: Record<Prioritaet, number> = { sicherheit: 0, hoch: 1, normal: 2 };
const STATUS_RANG: Record<AufgabenStatus, number> = { in_arbeit: 0, offen: 1, erledigt: 2 };

/**
 * Teile, deren Mängel die Fahrsicherheit betreffen (Bremsen, Lenkung, Räder) oder Brand- und
 * Gasgefahr bergen. Aufgaben daran bekommen „Sicherheit“ als Vorschlag; der Nutzer kann ändern.
 */
const SICHERHEITS_TEILE: ReadonlySet<ModellTeilId> = new Set<ModellTeilId>([
  'bremsen_vorne',
  'bremsen_hinten',
  'lenkung',
  'raeder',
  'benzintank',
  'gastank',
  'gasleitung',
  'verdampfer',
]);

export function vorgeschlagenePrioritaet(teil: ModellTeilId | null): Prioritaet {
  return teil && SICHERHEITS_TEILE.has(teil) ? 'sicherheit' : 'normal';
}

/**
 * Offene Aufgaben: Sicherheit vor hoch vor normal, darin „in Arbeit“ zuerst, dann die ältesten.
 * Erledigte kommen ans Ende, zuletzt erledigte zuerst.
 */
export function sortiereAufgaben(aufgaben: readonly Aufgabe[]): Aufgabe[] {
  return [...aufgaben].sort((a, b) => {
    const aFertig = a.status === 'erledigt';
    const bFertig = b.status === 'erledigt';
    if (aFertig !== bFertig) return aFertig ? 1 : -1;
    if (aFertig) return (b.erledigt_am ?? '').localeCompare(a.erledigt_am ?? '');
    return (
      PRIO_RANG[a.prioritaet] - PRIO_RANG[b.prioritaet] ||
      STATUS_RANG[a.status] - STATUS_RANG[b.status] ||
      a.aktualisiert_am.localeCompare(b.aktualisiert_am)
    );
  });
}

/** Neuer Status; erledigt_am wird gesetzt oder beim Wiederöffnen gelöscht. */
export function mitStatus(aufgabe: Aufgabe, status: AufgabenStatus, jetzt: Date): Aufgabe {
  return { ...aufgabe, status, erledigt_am: status === 'erledigt' ? jetzt.toISOString() : null };
}

/** Geschätzte Minuten aller nicht erledigten Aufgaben; ohne Schätzung zählen sie nicht mit. */
export function offeneMinuten(aufgaben: readonly Aufgabe[]): { minuten: number; ohneSchaetzung: number } {
  let minuten = 0;
  let ohneSchaetzung = 0;
  for (const a of aufgaben) {
    if (a.status === 'erledigt') continue;
    if (a.geschaetzt_min === null) ohneSchaetzung++;
    else minuten += a.geschaetzt_min;
  }
  return { minuten, ohneSchaetzung };
}

/** Zeitaufwand in Stunden („1,5“, „2 h“, „0.25“) als Minuten; leer = null, Unsinn = undefined. */
export function stundenAlsMinuten(eingabe: string): number | null | undefined {
  const t = eingabe.trim().replace(',', '.').replace(/\s*h$/i, '');
  if (t === '') return null;
  if (!/^\d+(\.\d+)?$/.test(t)) return undefined;
  const minuten = Math.round(Number(t) * 60);
  return minuten > 0 && minuten <= 1000 * 60 ? minuten : undefined;
}

/** Minuten als „3 h 30 min“, „45 min“ oder „2 h“. */
export function formatiereDauer(minuten: number): string {
  const h = Math.floor(minuten / 60);
  const m = minuten % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}
