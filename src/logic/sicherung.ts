// Datensicherung: alle Tabellen in einer Datei. Beim Einspielen wird zusammengeführt,
// je Datensatz gewinnt der neuere (aktualisiert_am); nichts Lokales wird ohne Grund überschrieben.
import type { MitId } from '../model/typen';

export const SICHERUNG_FORMAT = 'cj6-sicherung';
export const SICHERUNG_VERSION = 1;

export interface Sicherung {
  format: typeof SICHERUNG_FORMAT;
  version: number;
  erstellt_am: string;
  /** Datenbankversion beim Export (Dexie) */
  db_version: number;
  tabellen: Record<string, MitId[]>;
}

export type SicherungsFehler = 'kein_json' | 'falsches_format' | 'neuere_version' | 'beschaedigt';

export type SicherungsPruefung = { ok: true; sicherung: Sicherung } | { ok: false; fehler: SicherungsFehler };

function istDatensatz(wert: unknown): wert is MitId {
  if (typeof wert !== 'object' || wert === null) return false;
  const d = wert as Record<string, unknown>;
  return typeof d.id === 'string' && typeof d.aktualisiert_am === 'string' && typeof d.geloescht === 'boolean';
}

/** Liest Dateitext; nur bekannte Tabellen werden übernommen, andere ignoriert. */
export function leseSicherung(text: string, bekannteTabellen: readonly string[]): SicherungsPruefung {
  let roh: unknown;
  try {
    roh = JSON.parse(text);
  } catch {
    return { ok: false, fehler: 'kein_json' };
  }
  const s = roh as Partial<Sicherung> | null;
  if (typeof s !== 'object' || s === null || s.format !== SICHERUNG_FORMAT) return { ok: false, fehler: 'falsches_format' };
  if (typeof s.version !== 'number' || s.version > SICHERUNG_VERSION) return { ok: false, fehler: 'neuere_version' };
  if (typeof s.tabellen !== 'object' || s.tabellen === null) return { ok: false, fehler: 'beschaedigt' };
  const tabellen: Record<string, MitId[]> = {};
  for (const name of bekannteTabellen) {
    const zeilen = (s.tabellen as Record<string, unknown>)[name];
    if (zeilen === undefined) continue;
    if (!Array.isArray(zeilen) || !zeilen.every(istDatensatz)) return { ok: false, fehler: 'beschaedigt' };
    tabellen[name] = zeilen;
  }
  return {
    ok: true,
    sicherung: {
      format: SICHERUNG_FORMAT,
      version: s.version,
      erstellt_am: typeof s.erstellt_am === 'string' ? s.erstellt_am : '',
      db_version: typeof s.db_version === 'number' ? s.db_version : 0,
      tabellen,
    },
  };
}

export interface Zusammenfuehrung {
  neu: number;
  aktualisiert: number;
  unveraendert: number;
  /** Lokal gibt es eine neuere Fassung; die aus der Datei wird nicht übernommen */
  lokalNeuer: number;
}

export interface WiederherstellungsPlan {
  schreiben: Record<string, MitId[]>;
  zusammenfassung: Record<string, Zusammenfuehrung>;
}

/** Je Datensatz gewinnt die neuere Fassung; gleich alte bleiben unberührt. */
export function planeWiederherstellung(bestand: Record<string, readonly MitId[]>, datei: Record<string, readonly MitId[]>): WiederherstellungsPlan {
  const schreiben: Record<string, MitId[]> = {};
  const zusammenfassung: Record<string, Zusammenfuehrung> = {};
  for (const [name, zeilen] of Object.entries(datei)) {
    const lokal = new Map((bestand[name] ?? []).map((d) => [d.id, d]));
    const z: Zusammenfuehrung = { neu: 0, aktualisiert: 0, unveraendert: 0, lokalNeuer: 0 };
    const liste: MitId[] = [];
    for (const d of zeilen) {
      const vorhanden = lokal.get(d.id);
      if (!vorhanden) {
        z.neu++;
        liste.push(d);
      } else if (d.aktualisiert_am > vorhanden.aktualisiert_am) {
        z.aktualisiert++;
        liste.push(d);
      } else if (d.aktualisiert_am === vorhanden.aktualisiert_am) {
        z.unveraendert++;
      } else {
        z.lokalNeuer++;
      }
    }
    schreiben[name] = liste;
    zusammenfassung[name] = z;
  }
  return { schreiben, zusammenfassung };
}

/** Dateiname mit Datum, z. B. cj6-repair-sicherung-2026-10-27.json */
export function sicherungsDateiname(jetzt: Date): string {
  const zwei = (n: number) => String(n).padStart(2, '0');
  return `cj6-repair-sicherung-${jetzt.getFullYear()}-${zwei(jetzt.getMonth() + 1)}-${zwei(jetzt.getDate())}.json`;
}
