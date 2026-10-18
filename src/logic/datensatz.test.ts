import { describe, expect, it } from 'vitest';
import type { Notiz } from '../model/typen';
import { alsGeloescht, geaendert, neuerDatensatz, nurAktive, standardFahrzeug } from './datensatz';

const JETZT = new Date('2026-10-18T10:00:00Z');
const SPAETER = new Date('2026-10-18T11:30:00Z');

describe('neuerDatensatz', () => {
  it('vergibt UUID und Zeitstempel und ist nicht gelöscht', () => {
    const n = neuerDatensatz<Notiz>({ bezug_art: 'modellteil', bezug_id: 'motor', text: 'Beispiel' }, JETZT);
    expect(n.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(n).toMatchObject({ text: 'Beispiel', aktualisiert_am: JETZT.toISOString(), geloescht: false });
  });

  it('vergibt jedes Mal eine neue ID', () => {
    const a = neuerDatensatz<Notiz>({ bezug_art: 'modellteil', bezug_id: 'motor', text: 'a' }, JETZT);
    const b = neuerDatensatz<Notiz>({ bezug_art: 'modellteil', bezug_id: 'motor', text: 'b' }, JETZT);
    expect(a.id).not.toBe(b.id);
  });
});

describe('geaendert und alsGeloescht', () => {
  it('setzen den Zeitstempel neu, ohne das Original zu verändern', () => {
    const n = neuerDatensatz<Notiz>({ bezug_art: 'modellteil', bezug_id: 'motor', text: 'a' }, JETZT);
    expect(geaendert(n, SPAETER).aktualisiert_am).toBe(SPAETER.toISOString());
    const weg = alsGeloescht(n, SPAETER);
    expect(weg).toMatchObject({ geloescht: true, aktualisiert_am: SPAETER.toISOString() });
    expect(n.geloescht).toBe(false);
  });
});

describe('nurAktive', () => {
  it('blendet gelöschte Datensätze aus', () => {
    const a = neuerDatensatz<Notiz>({ bezug_art: 'modellteil', bezug_id: 'motor', text: 'a' }, JETZT);
    const b = alsGeloescht(neuerDatensatz<Notiz>({ bezug_art: 'modellteil', bezug_id: 'motor', text: 'b' }, JETZT), JETZT);
    expect(nurAktive([a, b])).toEqual([a]);
  });
});

describe('standardFahrzeug', () => {
  it('kennt Baujahr und Gasanlage, lässt den Motor aber offen', () => {
    const f = standardFahrzeug(JETZT);
    expect(f).toMatchObject({ baujahr: 1974, kraftstoff: 'bivalent_lpg', motor_variante_id: null, motor_bestaetigt_durch: null });
  });
});
