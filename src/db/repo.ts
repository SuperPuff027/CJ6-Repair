import type { Table } from 'dexie';
import { alsGeloescht, geaendert, nurAktive, standardFahrzeug } from '../logic/datensatz';
import { sortiereUmbauten } from '../logic/fahrzeug';
import { FAHRZEUG_ID, type BezugArt, type Fahrzeug, type Foto, type MitId, type Notiz, type Umbau } from '../model/typen';
import { db } from './datenbank';

// Alle Schreibzugriffe laufen über diese Funktionen, damit aktualisiert_am
// immer gesetzt wird und nie hart gelöscht wird.

export async function ladeAktive<T extends MitId>(tabelle: Table<T, string>): Promise<T[]> {
  return nurAktive(await tabelle.toArray());
}

export async function speichere<T extends MitId>(tabelle: Table<T, string>, datensatz: T): Promise<T> {
  const neu = geaendert(datensatz, new Date());
  await tabelle.put(neu);
  return neu;
}

export async function loescheWeich<T extends MitId>(tabelle: Table<T, string>, id: string): Promise<void> {
  await db.transaction('rw', tabelle, async () => {
    const vorhanden = await tabelle.get(id);
    if (vorhanden && !vorhanden.geloescht) await tabelle.put(alsGeloescht(vorhanden, new Date()));
  });
}

/** Gespeichertes Fahrzeug; Felder, die es bei der Speicherung noch nicht gab, kommen aus dem Standard. */
export async function ladeFahrzeug(): Promise<Fahrzeug> {
  const gespeichert = await db.fahrzeug.get(FAHRZEUG_ID);
  return { ...standardFahrzeug(new Date()), ...gespeichert };
}

export type FahrzeugAenderung = Partial<Omit<Fahrzeug, 'id' | 'aktualisiert_am' | 'geloescht'>>;

/** Übernimmt einzelne Felder ins gespeicherte Fahrzeug (oder ins Standardfahrzeug). */
export async function aendereFahrzeug(aenderung: FahrzeugAenderung): Promise<Fahrzeug> {
  return db.transaction('rw', db.fahrzeug, async () => {
    const neu = geaendert({ ...(await ladeFahrzeug()), ...aenderung }, new Date());
    await db.fahrzeug.put(neu);
    return neu;
  });
}

export async function ladeUmbauten(): Promise<Umbau[]> {
  return sortiereUmbauten(await ladeAktive(db.umbauten));
}

/** Aktive Notizen oder Fotos zu einem Bezug, älteste zuerst. */
async function ladeZuBezug<T extends Notiz | Foto>(tabelle: Table<T, string>, art: BezugArt, id: string): Promise<T[]> {
  const treffer = await tabelle.where('[bezug_art+bezug_id]').equals([art, id]).toArray();
  return nurAktive(treffer).sort((a, b) => a.aktualisiert_am.localeCompare(b.aktualisiert_am));
}

export function ladeNotizen(art: BezugArt, id: string): Promise<Notiz[]> {
  return ladeZuBezug(db.notizen, art, id);
}

export function ladeFotos(art: BezugArt, id: string): Promise<Foto[]> {
  return ladeZuBezug(db.fotos, art, id);
}
