import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import beispiel from '../../docs/wissensbasis-beispiel.json';
import { pruefeWissensbasis, type Wissensbasis } from '../logic/wissensbasis';
import { db } from './datenbank';
import { fuehreWissensbasisImportAus, planeWissensbasisImport, zaehleWissensbasis } from './wissensbasis';

function daten(): Wissensbasis {
  const ergebnis = pruefeWissensbasis(beispiel);
  if (!ergebnis.ok) throw new Error('Beispieldatei ungültig');
  return ergebnis.daten;
}

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

describe('Wissensbasis-Import', () => {
  it('schreibt die Datei und zählt die aktiven Einträge', async () => {
    expect(await zaehleWissensbasis()).toEqual({ bauteile: 0, anleitungen: 0, symptome: 0 });
    await fuehreWissensbasisImportAus(await planeWissensbasisImport(daten()));
    expect(await zaehleWissensbasis()).toEqual({ bauteile: 1, anleitungen: 1, symptome: 1 });
    expect(await db.bauteile.get('bremstrommel-vorn')).toMatchObject({ modell_teil_id: 'bremsen_vorne', geloescht: false });
  });

  it('erkennt beim zweiten Import derselben Datei, dass sich nichts geändert hat', async () => {
    await fuehreWissensbasisImportAus(await planeWissensbasisImport(daten()));
    const zweiter = await planeWissensbasisImport(daten());
    expect(zweiter.zusammenfassung.bauteile).toEqual({ neu: 0, geaendert: 0, entfernt: 0, unveraendert: 1 });
    expect(Object.values(zweiter.schreiben).flat()).toEqual([]);
  });

  it('löscht Einträge weich, die in der neuen Datei fehlen', async () => {
    await fuehreWissensbasisImportAus(await planeWissensbasisImport(daten()));
    const ohneSymptome = { ...daten(), symptom_knoten: [] };
    await fuehreWissensbasisImportAus(await planeWissensbasisImport(ohneSymptome));
    expect(await zaehleWissensbasis()).toMatchObject({ symptome: 0 });
    expect(await db.symptom_knoten.get('start')).toMatchObject({ geloescht: true });
  });
});
