import type { Table } from 'dexie';
import { leseSicherung, planeWiederherstellung, SICHERUNG_FORMAT, SICHERUNG_VERSION, type Sicherung, type SicherungsFehler, type WiederherstellungsPlan } from '../logic/sicherung';
import type { MitId } from '../model/typen';
import { db } from './datenbank';

/** Fotos (Blobs) werden als Base64 in der Datei abgelegt. */
interface KodierterBlob {
  $blob: string;
  typ: string;
}

function istKodierterBlob(wert: unknown): wert is KodierterBlob {
  return typeof wert === 'object' && wert !== null && typeof (wert as KodierterBlob).$blob === 'string';
}

async function blobZuBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binaer = '';
  // In Stücken, damit große Fotos den Aufrufstapel nicht sprengen
  for (let i = 0; i < bytes.length; i += 0x8000) binaer += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binaer);
}

function base64ZuBlob(daten: string, typ: string): Blob {
  const binaer = atob(daten);
  const bytes = new Uint8Array(binaer.length);
  for (let i = 0; i < binaer.length; i++) bytes[i] = binaer.charCodeAt(i);
  return new Blob([bytes], { type: typ });
}

async function kodiere(datensatz: MitId): Promise<MitId> {
  const kopie: Record<string, unknown> = { ...datensatz };
  for (const [feld, wert] of Object.entries(kopie)) {
    if (wert instanceof Blob) kopie[feld] = { $blob: await blobZuBase64(wert), typ: wert.type } satisfies KodierterBlob;
  }
  return kopie as unknown as MitId;
}

function dekodiere(datensatz: MitId): MitId {
  const kopie: Record<string, unknown> = { ...datensatz };
  for (const [feld, wert] of Object.entries(kopie)) {
    if (istKodierterBlob(wert)) kopie[feld] = base64ZuBlob(wert.$blob, wert.typ);
  }
  return kopie as unknown as MitId;
}

const tabellen = () => db.tables as unknown as Table<MitId, string>[];
export const TABELLEN_NAMEN = () => tabellen().map((t) => t.name);

/** Alle Tabellen samt gelöschten Einträgen (für den späteren Abgleich) als JSON-Text. */
export async function erstelleSicherung(): Promise<string> {
  const daten: Record<string, MitId[]> = {};
  await db.transaction('r', tabellen(), async () => {
    for (const t of tabellen()) daten[t.name] = await t.toArray();
  });
  for (const name of Object.keys(daten)) daten[name] = await Promise.all(daten[name]!.map(kodiere));
  const sicherung: Sicherung = {
    format: SICHERUNG_FORMAT,
    version: SICHERUNG_VERSION,
    erstellt_am: new Date().toISOString(),
    db_version: db.verno,
    tabellen: daten,
  };
  return JSON.stringify(sicherung);
}

export type Vorbereitung = { ok: true; plan: WiederherstellungsPlan; erstellt_am: string } | { ok: false; fehler: SicherungsFehler };

/** Prüft die Datei und vergleicht mit dem Bestand; schreibt noch nichts. */
export async function bereiteWiederherstellungVor(text: string): Promise<Vorbereitung> {
  const gelesen = leseSicherung(text, TABELLEN_NAMEN());
  if (!gelesen.ok) return gelesen;
  const bestand: Record<string, MitId[]> = {};
  for (const t of tabellen()) bestand[t.name] = await t.toArray();
  const datei: Record<string, MitId[]> = {};
  for (const [name, zeilen] of Object.entries(gelesen.sicherung.tabellen)) datei[name] = zeilen.map(dekodiere);
  return { ok: true, plan: planeWiederherstellung(bestand, datei), erstellt_am: gelesen.sicherung.erstellt_am };
}

/** Schreibt den Plan in einem Rutsch: alles oder nichts. */
export async function stelleWiederHer(plan: WiederherstellungsPlan): Promise<void> {
  await db.transaction('rw', tabellen(), async () => {
    for (const t of tabellen()) {
      const zeilen = plan.schreiben[t.name];
      if (zeilen?.length) await t.bulkPut(zeilen);
    }
  });
}
