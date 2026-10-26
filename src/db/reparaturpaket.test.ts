import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import beispiel from '../../docs/wissensbasis-beispiel.json';
import { pruefeWissensbasis } from '../logic/wissensbasis';
import { db } from './datenbank';
import { ladeEinkaufsliste, legeReparaturpaketAn, markiereBesorgt, planeReparaturpaket } from './reparaturpaket';
import { ladeAktive } from './repo';
import { fuehreWissensbasisImportAus, planeWissensbasisImport } from './wissensbasis';

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  const ergebnis = pruefeWissensbasis(beispiel);
  if (!ergebnis.ok) throw new Error('Beispieldatei ungültig');
  await fuehreWissensbasisImportAus(await planeWissensbasisImport(ergebnis.daten));
});

const MANGEL = { text: 'Bremse vorne zieht', teil: 'bremsen_vorne' as const, gasgeruch: false };

describe('Reparaturpaket in der Datenbank', () => {
  it('plant mit der Beispiel-Wissensbasis und legt Aufgabe und Listen an', async () => {
    const paket = await planeReparaturpaket([MANGEL]);
    expect(paket.pakete[0]).toMatchObject({ status: 'ungeprueft', handbuchPruefen: true, anleitung: { id: 'bremstrommel-vorn-pruefen' } });
    await legeReparaturpaketAn(paket);
    const [aufgabe] = await ladeAktive(db.aufgaben);
    expect(aufgabe).toMatchObject({ titel: 'Bremse vorne zieht', anleitung_id: 'bremstrommel-vorn-pruefen', bauteil_id: 'bremstrommel-vorn', prioritaet: 'sicherheit' });
    expect((await ladeAktive(db.listenposten)).map((l) => l.bezeichnung).sort()).toEqual([
      'BEISPIEL Bremsenreiniger',
      'BEISPIEL Bremstrommel',
      'BEISPIEL Radmutternschlüssel',
    ]);
  });

  it('fasst die Einkaufsliste über Aufgaben zusammen und hakt besorgte Posten ab', async () => {
    await legeReparaturpaketAn(await planeReparaturpaket([MANGEL, { ...MANGEL, text: 'Bremse vorne quietscht' }]));
    const liste = await ladeEinkaufsliste();
    const reiniger = liste.find((p) => p.bezeichnung === 'BEISPIEL Bremsenreiniger')!;
    expect(reiniger).toMatchObject({ menge: 2, einheit: 'Dose' });
    expect(reiniger.ids).toHaveLength(2);
    await markiereBesorgt(reiniger.ids);
    expect((await ladeEinkaufsliste()).map((p) => p.bezeichnung)).not.toContain('BEISPIEL Bremsenreiniger');
  });

  it('zeigt nichts für erledigte Aufgaben', async () => {
    await legeReparaturpaketAn(await planeReparaturpaket([MANGEL]));
    const [aufgabe] = await ladeAktive(db.aufgaben);
    await db.aufgaben.put({ ...aufgabe!, status: 'erledigt' });
    expect(await ladeEinkaufsliste()).toEqual([]);
  });
});

describe('Aufgabentitel', () => {
  it('nimmt einen eigenen kurzen Titel und behält den ganzen Text als Mangeltext', async () => {
    await legeReparaturpaketAn(await planeReparaturpaket([{ ...MANGEL, text: 'Weg: A · B · C', titel: 'C' }]));
    const [aufgabe] = await ladeAktive(db.aufgaben);
    expect(aufgabe).toMatchObject({ titel: 'C', mangel_text: 'Weg: A · B · C' });
  });
});
