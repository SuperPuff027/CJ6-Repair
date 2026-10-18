import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { neuerDatensatz } from '../logic/datensatz';
import type { Fahrzeug, Foto, Notiz } from '../model/typen';
import { db } from './datenbank';
import { ladeAktive, ladeFahrzeug, ladeFotos, ladeNotizen, loescheWeich, speichere } from './repo';

const ALT = new Date('2026-01-01T00:00:00Z');

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

function notiz(bezug_id: string, text: string, jetzt = ALT): Notiz {
  return neuerDatensatz<Notiz>({ bezug_art: 'modellteil', bezug_id, text }, jetzt);
}

describe('speichere', () => {
  it('setzt den Zeitstempel auf jetzt', async () => {
    const gespeichert = await speichere(db.notizen, notiz('motor', 'Beispiel'));
    expect(gespeichert.aktualisiert_am > ALT.toISOString()).toBe(true);
    expect(await db.notizen.get(gespeichert.id)).toEqual(gespeichert);
  });
});

describe('loescheWeich', () => {
  it('markiert als gelöscht statt zu entfernen', async () => {
    const n = await speichere(db.notizen, notiz('motor', 'Beispiel'));
    await loescheWeich(db.notizen, n.id);
    expect(await db.notizen.get(n.id)).toMatchObject({ geloescht: true });
    expect(await ladeAktive(db.notizen)).toEqual([]);
  });

  it('ignoriert unbekannte IDs', async () => {
    await expect(loescheWeich(db.notizen, 'gibt-es-nicht')).resolves.toBeUndefined();
  });
});

describe('ladeFahrzeug', () => {
  it('liefert ohne Eintrag das Standardfahrzeug', async () => {
    expect(await ladeFahrzeug()).toMatchObject({ baujahr: 1974, kraftstoff: 'bivalent_lpg' });
  });

  it('liefert das gespeicherte Fahrzeug', async () => {
    const f: Fahrzeug = { ...(await ladeFahrzeug()), getriebe: 'Beispielgetriebe' };
    await speichere(db.fahrzeug, f);
    expect((await ladeFahrzeug()).getriebe).toBe('Beispielgetriebe');
  });
});

describe('Notizen und Fotos zu einem Bezug', () => {
  it('liefert nur die aktiven Einträge dieses Bezugs, älteste zuerst', async () => {
    await db.notizen.bulkPut([
      notiz('motor', 'zweite', new Date('2026-02-02T00:00:00Z')),
      notiz('motor', 'erste', new Date('2026-02-01T00:00:00Z')),
      notiz('kuehler', 'anderes Teil'),
      { ...notiz('motor', 'gelöscht'), geloescht: true },
    ]);
    expect((await ladeNotizen('modellteil', 'motor')).map((n) => n.text)).toEqual(['erste', 'zweite']);
  });

  it('speichert Fotos als Blob', async () => {
    const foto = neuerDatensatz<Foto>(
      { bezug_art: 'modellteil', bezug_id: 'bremsen_vorne', blob: new Blob(['Beispielbild'], { type: 'image/jpeg' }), aufgenommen_am: ALT.toISOString(), notiz: null },
      ALT,
    );
    await db.fotos.put(foto);
    const [geladen] = await ladeFotos('modellteil', 'bremsen_vorne');
    expect(geladen?.blob.size).toBe(12);
  });
});
