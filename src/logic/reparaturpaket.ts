// Reparaturpaket: aus zugeordneten Mängeln Anleitung, Teile-, Verbrauchs- und Werkzeugliste und Aufgaben.
// Alles kommt aus der Wissensbasis; fehlt dort etwas, sagt das Paket das, statt etwas zu erfinden.
import type { Anleitung, Bauteil, Inventar, ListenArt, Prioritaet, Quelle } from '../model/typen';
import type { ModellTeilId } from '../szene/modell';
import { vorgeschlagenePrioritaet } from './aufgaben';
import { normalisiere } from './suche';

export interface PaketMangel {
  text: string;
  teil: ModellTeilId;
  gasgeruch: boolean;
}

export interface MotorStand {
  bestaetigt: string | null;
  vorgemerkt: readonly string[];
}

export type AnleitungsStatus = 'geprueft' | 'ungeprueft' | 'keine';

export interface PaketPosten {
  art: ListenArt;
  bezeichnung: string;
  teilenummer: string | null;
  menge: number;
  einheit: string;
  /** Laut Inventar in ausreichender Menge da */
  vorhanden: boolean;
  quelle: Quelle | null;
}

export interface MangelPaket {
  mangel: PaketMangel;
  bauteile: Bauteil[];
  anleitung: Anleitung | null;
  /** Weitere passende Anleitungen, falls es mehrere gibt */
  weitere: Anleitung[];
  status: AnleitungsStatus;
  posten: PaketPosten[];
  prioritaet: Prioritaet;
  /** Bremsen und Lenkung ohne geprüfte Anleitung: erst mit dem Handbuch abgleichen (CLAUDE.md) */
  handbuchPruefen: boolean;
}

export interface Reparaturpaket {
  pakete: MangelPaket[];
  /** Was fehlt, über alle Mängel zusammengefasst (Teile, Verbrauch, Werkzeug) */
  einkaufsliste: PaketPosten[];
  /** Alles benötigte Werkzeug, zusammengefasst */
  werkzeug: PaketPosten[];
}

const HANDBUCH_PFLICHT: ReadonlySet<ModellTeilId> = new Set<ModellTeilId>(['bremsen_vorne', 'bremsen_hinten', 'lenkung']);
const STUECK = 'Stück';

/** Motoren, auf die es ankommt: der bestätigte, sonst die vorgemerkten; leer = alle. */
function relevanteMotoren(motor: MotorStand): readonly string[] {
  return motor.bestaetigt ? [motor.bestaetigt] : motor.vorgemerkt;
}

function passtZumMotor(bauteil: Bauteil, motoren: readonly string[]): boolean {
  return motoren.length === 0 || bauteil.motor_varianten.length === 0 || bauteil.motor_varianten.some((m) => motoren.includes(m));
}

/** Gleiche Posten haben denselben Schlüssel: Art, Teilenummer (sonst Bezeichnung) und Einheit. */
export function postenSchluessel(p: Pick<PaketPosten, 'art' | 'bezeichnung' | 'teilenummer' | 'einheit'>): string {
  return [p.art, p.teilenummer ? `nr:${normalisiere(p.teilenummer)}` : normalisiere(p.bezeichnung), normalisiere(p.einheit)].join('|');
}

function imInventar(p: Omit<PaketPosten, 'vorhanden'>, inventar: readonly Inventar[]): boolean {
  const bestand = inventar
    .filter((i) =>
      p.teilenummer && i.teilenummer
        ? normalisiere(i.teilenummer) === normalisiere(p.teilenummer)
        : normalisiere(i.bezeichnung) === normalisiere(p.bezeichnung),
    )
    .reduce((summe, i) => summe + i.menge, 0);
  return bestand >= p.menge;
}

/** Gleiche Posten zusammenfassen: Mengen addieren, Werkzeug nur einmal. Danach Inventar neu prüfen. */
export function fasseZusammen(posten: readonly PaketPosten[], inventar: readonly Inventar[]): PaketPosten[] {
  const gesammelt = new Map<string, Omit<PaketPosten, 'vorhanden'>>();
  for (const p of posten) {
    const k = postenSchluessel(p);
    const da = gesammelt.get(k);
    if (!da) gesammelt.set(k, { art: p.art, bezeichnung: p.bezeichnung, teilenummer: p.teilenummer, menge: p.menge, einheit: p.einheit, quelle: p.quelle });
    else if (p.art !== 'werkzeug') da.menge += p.menge;
  }
  return [...gesammelt.values()].map((p) => ({ ...p, vorhanden: imInventar(p, inventar) }));
}

function postenAus(anleitung: Anleitung | null, inventar: readonly Inventar[]): PaketPosten[] {
  if (!anleitung) return [];
  const material = anleitung.material.map((m) => ({
    art: m.art,
    bezeichnung: m.bezeichnung,
    teilenummer: m.teilenummer,
    menge: m.menge,
    einheit: m.einheit,
    quelle: m.quelle,
    vorhanden: false,
  }));
  const werkzeug = anleitung.schritte.flatMap((s) =>
    s.werkzeug.map((w) => ({ art: 'werkzeug' as const, bezeichnung: w, teilenummer: null, menge: 1, einheit: STUECK, quelle: null, vorhanden: false })),
  );
  return fasseZusammen([...material, ...werkzeug], inventar);
}

export function erstellePaket(
  maengel: readonly PaketMangel[],
  wissen: { bauteile: readonly Bauteil[]; anleitungen: readonly Anleitung[] },
  inventar: readonly Inventar[],
  motor: MotorStand,
): Reparaturpaket {
  const motoren = relevanteMotoren(motor);

  const pakete = maengel.map((mangel): MangelPaket => {
    const bauteile = wissen.bauteile.filter((b) => b.modell_teil_id === mangel.teil && passtZumMotor(b, motoren));
    const ids = new Set(bauteile.map((b) => b.id));
    const [anleitung = null, ...weitere] = wissen.anleitungen
      .filter((a) => ids.has(a.bauteil_id))
      .sort((a, b) => Number(b.geprueft) - Number(a.geprueft) || a.titel.localeCompare(b.titel));
    const status: AnleitungsStatus = !anleitung ? 'keine' : anleitung.geprueft ? 'geprueft' : 'ungeprueft';
    return {
      mangel,
      bauteile,
      anleitung,
      weitere,
      status,
      posten: postenAus(anleitung, inventar),
      prioritaet: mangel.gasgeruch ? 'sicherheit' : vorgeschlagenePrioritaet(mangel.teil),
      handbuchPruefen: HANDBUCH_PFLICHT.has(mangel.teil) && status !== 'geprueft',
    };
  });

  const alle = fasseZusammen(
    pakete.flatMap((p) => p.posten),
    inventar,
  );
  return {
    pakete,
    einkaufsliste: alle.filter((p) => !p.vorhanden),
    werkzeug: alle.filter((p) => p.art === 'werkzeug'),
  };
}
