import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { neuerDatensatz } from '../logic/datensatz';
import type { Aufgabe, Foto, Notiz } from '../model/typen';
import { db } from './datenbank';
import { aendereFahrzeug, speichere } from './repo';
import { bereiteWiederherstellungVor, erstelleSicherung, stelleWiederHer } from './sicherung';

const ALT = new Date('2026-01-01T00:00:00Z');

async function alles() {
  const ergebnis: Record<string, unknown[]> = {};
  for (const t of db.tables) ergebnis[t.name] = (await t.toArray()).sort((a, b) => String(a.id).localeCompare(String(b.id)));
  return ergebnis;
}

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

async function beispielDaten() {
  await aendereFahrzeug({ getriebe: 'BEISPIEL-Getriebe', motor_vorgemerkt: ['amc-232', 'amc-258'] });
  await speichere(db.notizen, neuerDatensatz<Notiz>({ bezug_art: 'modellteil', bezug_id: 'motor', text: 'BEISPIEL Notiz' }, ALT));
  const geloescht = neuerDatensatz<Notiz>({ bezug_art: 'modellteil', bezug_id: 'kuehler', text: 'weg' }, ALT);
  await db.notizen.put({ ...geloescht, geloescht: true });
  await speichere(
    db.aufgaben,
    neuerDatensatz<Aufgabe>(
      { titel: 'BEISPIEL', bauteil_id: null, modell_teil_id: 'motor', anleitung_id: null, mangel_text: null, prioritaet: 'hoch', geschaetzt_min: 90, status: 'offen', erledigt_am: null },
      ALT,
    ),
  );
  // Ein „Foto“ mit Bytes über die Stückgrenze von 32 KiB hinaus
  const bytes = new Uint8Array(70000).map((_, i) => i % 251);
  await db.fotos.put(
    neuerDatensatz<Foto>({ bezug_art: 'modellteil', bezug_id: 'motor', blob: new Blob([bytes], { type: 'image/jpeg' }), aufgenommen_am: ALT.toISOString(), notiz: null }, ALT),
  );
}

describe('Datensicherung', () => {
  it('ergibt nach Export und Import in eine leere Datenbank genau dieselben Daten (Rundreise)', async () => {
    await beispielDaten();
    const vorher = await alles();
    const fotoVorher = new Uint8Array(await (await db.fotos.toArray())[0]!.blob.arrayBuffer());

    const text = await erstelleSicherung();
    await Promise.all(db.tables.map((t) => t.clear()));
    const vorbereitung = await bereiteWiederherstellungVor(text);
    if (!vorbereitung.ok) throw new Error(vorbereitung.fehler);
    expect(vorbereitung.plan.zusammenfassung.notizen).toEqual({ neu: 2, aktualisiert: 0, unveraendert: 0, lokalNeuer: 0 });
    await stelleWiederHer(vorbereitung.plan);

    const nachher = await alles();
    const ohneBlob = (d: Record<string, unknown[]>) => ({ ...d, fotos: d.fotos!.map((f) => ({ ...(f as object), blob: null })) });
    expect(ohneBlob(nachher)).toEqual(ohneBlob(vorher));
    const foto = (await db.fotos.toArray())[0]!;
    expect(foto.blob.type).toBe('image/jpeg');
    expect(new Uint8Array(await foto.blob.arrayBuffer())).toEqual(fotoVorher);
  });

  it('überschreibt beim Einspielen keine neueren lokalen Änderungen', async () => {
    await beispielDaten();
    const text = await erstelleSicherung();
    const [notiz] = (await db.notizen.toArray()).filter((n) => !n.geloescht);
    await speichere(db.notizen, { ...notiz!, text: 'später geändert' });

    const vorbereitung = await bereiteWiederherstellungVor(text);
    if (!vorbereitung.ok) throw new Error(vorbereitung.fehler);
    expect(vorbereitung.plan.zusammenfassung.notizen).toMatchObject({ lokalNeuer: 1 });
    await stelleWiederHer(vorbereitung.plan);
    expect((await db.notizen.get(notiz!.id))?.text).toBe('später geändert');
  });

  it('meldet fremde Dateien', async () => {
    expect(await bereiteWiederherstellungVor('{"format":"etwas"}')).toEqual({ ok: false, fehler: 'falsches_format' });
  });
});
