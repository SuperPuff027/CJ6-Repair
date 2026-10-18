import { describe, expect, it } from 'vitest';
import type { Anleitung, Bauteil, Inventar } from '../model/typen';
import { erstellePaket, fasseZusammen, type PaketMangel } from './reparaturpaket';

const SYNC = { aktualisiert_am: '2026-10-18T00:00:00.000Z', geloescht: false };
const QUELLE = { dokument: 'BEISPIEL-Handbuch', stelle: 'S. 0' };

function bauteil(id: string, modell_teil_id: Bauteil['modell_teil_id'], motor_varianten: string[] = []): Bauteil {
  return { ...SYNC, id, baugruppe_id: 'g', name: id, modell_teil_id, teilenummern: [], motor_varianten, stichwoerter: [] };
}

function anleitung(id: string, bauteil_id: string, geprueft: boolean, felder: Partial<Anleitung> = {}): Anleitung {
  return { ...SYNC, id, bauteil_id, titel: id, geprueft, quelle: geprueft ? QUELLE : null, schritte: [], material: [], ...felder };
}

const BREMSE_VORNE: PaketMangel = { text: 'Bremse vorne zieht', teil: 'bremsen_vorne', gasgeruch: false };
const KUEHLER: PaketMangel = { text: 'Kühler leckt', teil: 'kuehler', gasgeruch: false };
const OHNE_MOTOR = { bestaetigt: null, vorgemerkt: [] };

const WISSEN = {
  bauteile: [bauteil('trommel-vorn', 'bremsen_vorne'), bauteil('kuehler-232', 'kuehler', ['amc-232']), bauteil('kuehler-258', 'kuehler', ['amc-258'])],
  anleitungen: [
    anleitung('trommel-entwurf', 'trommel-vorn', false, {
      material: [{ art: 'verbrauch', bezeichnung: 'Bremsenreiniger', menge: 1, einheit: 'Dose', teilenummer: null, quelle: null }],
      schritte: [
        { text: 'a', bild: null, werkzeug: ['Wagenheber', 'Radmutternschlüssel'], sollwerte: [], warnung: null },
        { text: 'b', bild: null, werkzeug: ['Wagenheber'], sollwerte: [], warnung: null },
      ],
    }),
    anleitung('trommel-geprueft', 'trommel-vorn', true, {
      material: [
        { art: 'teil', bezeichnung: 'Bremsbacken-Satz', menge: 1, einheit: 'Satz', teilenummer: 'BSP-1', quelle: QUELLE },
        { art: 'verbrauch', bezeichnung: 'Bremsflüssigkeit', menge: 0.5, einheit: 'l', teilenummer: null, quelle: null },
      ],
      schritte: [{ text: 'a', bild: null, werkzeug: ['Wagenheber'], sollwerte: [], warnung: null }],
    }),
    anleitung('kuehler-232-tauschen', 'kuehler-232', true, {
      material: [{ art: 'verbrauch', bezeichnung: 'Bremsflüssigkeit', menge: 0.5, einheit: 'l', teilenummer: null, quelle: null }],
    }),
    anleitung('kuehler-258-tauschen', 'kuehler-258', true),
  ],
};

describe('erstellePaket', () => {
  it('nimmt die geprüfte Anleitung vor dem Entwurf und listet Material und Werkzeug', () => {
    const [p] = erstellePaket([BREMSE_VORNE], WISSEN, [], OHNE_MOTOR).pakete;
    expect(p).toMatchObject({ status: 'geprueft', prioritaet: 'sicherheit', handbuchPruefen: false, anleitung: { id: 'trommel-geprueft' } });
    expect(p!.weitere.map((a) => a.id)).toEqual(['trommel-entwurf']);
    expect(p!.posten.map((x) => `${x.art}:${x.bezeichnung}`)).toEqual(['teil:Bremsbacken-Satz', 'verbrauch:Bremsflüssigkeit', 'werkzeug:Wagenheber']);
  });

  it('warnt bei Bremsen ohne geprüfte Anleitung und meldet fehlende Anleitungen', () => {
    const nurEntwurf = { ...WISSEN, anleitungen: WISSEN.anleitungen.filter((a) => a.id !== 'trommel-geprueft') };
    const [entwurf] = erstellePaket([BREMSE_VORNE], nurEntwurf, [], OHNE_MOTOR).pakete;
    expect(entwurf).toMatchObject({ status: 'ungeprueft', handbuchPruefen: true });
    // Werkzeug aus mehreren Schritten nur einmal
    expect(entwurf!.posten.filter((x) => x.art === 'werkzeug').map((x) => x.bezeichnung)).toEqual(['Wagenheber', 'Radmutternschlüssel']);

    const [leer] = erstellePaket([BREMSE_VORNE], { bauteile: [], anleitungen: [] }, [], OHNE_MOTOR).pakete;
    expect(leer).toMatchObject({ status: 'keine', handbuchPruefen: true, posten: [], anleitung: null });
  });

  it('berücksichtigt den bestätigten oder die vorgemerkten Motoren', () => {
    const bestaetigt = erstellePaket([KUEHLER], WISSEN, [], { bestaetigt: 'amc-232', vorgemerkt: [] }).pakete[0]!;
    expect(bestaetigt.bauteile.map((b) => b.id)).toEqual(['kuehler-232']);
    const vorgemerkt = erstellePaket([KUEHLER], WISSEN, [], { bestaetigt: null, vorgemerkt: ['amc-232', 'amc-258'] }).pakete[0]!;
    expect(vorgemerkt.bauteile.map((b) => b.id)).toEqual(['kuehler-232', 'kuehler-258']);
    expect(vorgemerkt.weitere).toHaveLength(1);
  });

  it('fasst mehrere Mängel zu einer Einkaufsliste zusammen und gleicht mit dem Inventar ab', () => {
    const inventar: Inventar[] = [
      { ...SYNC, id: 'i1', bezeichnung: 'Bremsbacken', teilenummer: 'bsp-1', menge: 1, ort: null },
      { ...SYNC, id: 'i2', bezeichnung: 'wagenheber', teilenummer: null, menge: 1, ort: 'Garage' },
      { ...SYNC, id: 'i3', bezeichnung: 'Bremsflüssigkeit', teilenummer: null, menge: 0.5, ort: null },
    ];
    const paket = erstellePaket([BREMSE_VORNE, KUEHLER], WISSEN, inventar, { bestaetigt: 'amc-232', vorgemerkt: [] });
    // 0,5 l + 0,5 l Bremsflüssigkeit = 1 l; nur 0,5 l da → fehlt. Bremsbacken (Teilenummer) und Wagenheber sind da.
    expect(paket.einkaufsliste.map((x) => `${x.bezeichnung} ${x.menge} ${x.einheit}`)).toEqual(['Bremsflüssigkeit 1 l']);
    expect(paket.werkzeug).toEqual([expect.objectContaining({ bezeichnung: 'Wagenheber', vorhanden: true })]);
  });

  it('setzt bei Gasgeruch immer Sicherheit', () => {
    const [p] = erstellePaket([{ text: 'Gasgeruch', teil: 'sitze', gasgeruch: true }], WISSEN, [], OHNE_MOTOR).pakete;
    expect(p!.prioritaet).toBe('sicherheit');
  });
});

describe('fasseZusammen', () => {
  it('addiert Mengen gleicher Posten, Werkzeug aber nicht', () => {
    const posten = [
      { art: 'verbrauch' as const, bezeichnung: 'Öl', teilenummer: null, menge: 1, einheit: 'l', vorhanden: false, quelle: null },
      { art: 'verbrauch' as const, bezeichnung: 'öl', teilenummer: null, menge: 2, einheit: 'L', vorhanden: false, quelle: null },
      { art: 'werkzeug' as const, bezeichnung: 'Zange', teilenummer: null, menge: 1, einheit: 'Stück', vorhanden: false, quelle: null },
      { art: 'werkzeug' as const, bezeichnung: 'Zange', teilenummer: null, menge: 1, einheit: 'Stück', vorhanden: false, quelle: null },
    ];
    expect(fasseZusammen(posten, []).map((p) => `${p.bezeichnung}:${p.menge}`)).toEqual(['Öl:3', 'Zange:1']);
  });
});
