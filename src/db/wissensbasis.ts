import type { Table } from 'dexie';
import { nurAktive } from '../logic/datensatz';
import { planeImport, WISSENSBASIS_TABELLEN, type ImportPlan, type Wissensbasis, type WissensbasisTabelle } from '../logic/wissensbasis';
import type { MitId } from '../model/typen';
import { db } from './datenbank';

function tabelle(name: WissensbasisTabelle): Table<MitId, string> {
  return db[name] as unknown as Table<MitId, string>;
}

const TABELLEN = () => WISSENSBASIS_TABELLEN.map(tabelle);

/** Vergleicht die geprüfte Datei mit dem Bestand; schreibt noch nichts (Vorschau). */
export async function planeWissensbasisImport(daten: Wissensbasis): Promise<ImportPlan> {
  const bestand = {} as Record<WissensbasisTabelle, MitId[]>;
  await db.transaction('r', TABELLEN(), async () => {
    for (const name of WISSENSBASIS_TABELLEN) bestand[name] = await tabelle(name).toArray();
  });
  return planeImport(bestand, daten, new Date());
}

/** Schreibt den Plan in einem Rutsch: entweder alles oder nichts. */
export async function fuehreWissensbasisImportAus(plan: ImportPlan): Promise<void> {
  await db.transaction('rw', TABELLEN(), async () => {
    for (const name of WISSENSBASIS_TABELLEN) await tabelle(name).bulkPut(plan.schreiben[name]);
  });
}

export interface WissensbasisUmfang {
  bauteile: number;
  anleitungen: number;
  symptome: number;
}

export async function zaehleWissensbasis(): Promise<WissensbasisUmfang> {
  const [bauteile, anleitungen, symptome] = await Promise.all([db.bauteile.toArray(), db.anleitungen.toArray(), db.symptom_knoten.toArray()]);
  return { bauteile: nurAktive(bauteile).length, anleitungen: nurAktive(anleitungen).length, symptome: nurAktive(symptome).length };
}
