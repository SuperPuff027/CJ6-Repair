import { describe, expect, it } from 'vitest';
import type { MitId } from '../model/typen';
import { leseSicherung, planeWiederherstellung, sicherungsDateiname } from './sicherung';

const d = (id: string, aktualisiert_am: string, mehr: Record<string, unknown> = {}): MitId => ({ id, aktualisiert_am, geloescht: false, ...mehr });

describe('leseSicherung', () => {
  const gueltig = { format: 'cj6-sicherung', version: 1, erstellt_am: '2026-10-27T00:00:00.000Z', db_version: 2, tabellen: { notizen: [d('n1', '2026-01-01')], fremd: [{ x: 1 }] } };

  it('liest eine gültige Sicherung und übergeht unbekannte Tabellen', () => {
    const e = leseSicherung(JSON.stringify(gueltig), ['notizen', 'aufgaben']);
    expect(e.ok && Object.keys(e.sicherung.tabellen)).toEqual(['notizen']);
  });

  it('lehnt Fremdes, Kaputtes und neuere Versionen ab', () => {
    const fehler = (text: string) => {
      const e = leseSicherung(text, ['notizen']);
      return e.ok ? null : e.fehler;
    };
    expect(fehler('{nicht json')).toBe('kein_json');
    expect(fehler(JSON.stringify({ format: 'cj6-wissensbasis', version: 1 }))).toBe('falsches_format');
    expect(fehler(JSON.stringify({ ...gueltig, version: 2 }))).toBe('neuere_version');
    expect(fehler(JSON.stringify({ ...gueltig, tabellen: { notizen: [{ id: 1 }] } }))).toBe('beschaedigt');
  });
});

describe('planeWiederherstellung', () => {
  it('übernimmt Neues und Neueres und lässt Lokales, das neuer ist, stehen', () => {
    const bestand = { notizen: [d('gleich', '2026-02-01'), d('lokal-neuer', '2026-05-01'), d('datei-neuer', '2026-01-01')] };
    const datei = {
      notizen: [d('gleich', '2026-02-01'), d('lokal-neuer', '2026-03-01'), d('datei-neuer', '2026-04-01', { text: 'neu' }), d('ganz-neu', '2026-01-01')],
      aufgaben: [d('a1', '2026-01-01')],
    };
    const plan = planeWiederherstellung(bestand, datei);
    expect(plan.zusammenfassung.notizen).toEqual({ neu: 1, aktualisiert: 1, unveraendert: 1, lokalNeuer: 1 });
    expect(plan.schreiben.notizen!.map((x) => x.id)).toEqual(['datei-neuer', 'ganz-neu']);
    expect(plan.zusammenfassung.aufgaben).toEqual({ neu: 1, aktualisiert: 0, unveraendert: 0, lokalNeuer: 0 });
  });
});

describe('sicherungsDateiname', () => {
  it('trägt das lokale Datum', () => {
    expect(sicherungsDateiname(new Date(2026, 9, 27, 23, 0))).toBe('cj6-repair-sicherung-2026-10-27.json');
  });
});
