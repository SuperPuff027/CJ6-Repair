import { describe, expect, it } from 'vitest';
import type { Umbau } from '../model/typen';
import { hubraumLiter, jahrFeld, sortiereUmbauten, textFeld, vinFeld } from './fahrzeug';

const JETZT = new Date('2026-10-18T12:00:00Z');

describe('textFeld', () => {
  it('kürzt Leerzeichen und macht Leeres zu null', () => {
    expect(textFeld('  Dana   20 ')).toBe('Dana 20');
    expect(textFeld('   ')).toBeNull();
  });
});

describe('jahrFeld', () => {
  it('akzeptiert vierstellige Jahre im erlaubten Bereich und leer', () => {
    expect(jahrFeld('1974', JETZT)).toEqual({ ok: true, wert: 1974 });
    expect(jahrFeld(' ', JETZT)).toEqual({ ok: true, wert: null });
    expect(jahrFeld('2027', JETZT)).toEqual({ ok: true, wert: 2027 });
  });

  it('lehnt Unsinn mit dem erlaubten Bereich ab', () => {
    expect(jahrFeld('74', JETZT)).toEqual({ ok: false, von: 1940, bis: 2027 });
    expect(jahrFeld('1939', JETZT)).toMatchObject({ ok: false });
    expect(jahrFeld('2028', JETZT)).toMatchObject({ ok: false });
    expect(jahrFeld('19a4', JETZT)).toMatchObject({ ok: false });
  });
});

describe('vinFeld', () => {
  it('schreibt groß und entfernt Leerzeichen und Bindestriche', () => {
    expect(vinFeld(' j4f-835 te12345 ')).toBe('J4F835TE12345');
    expect(vinFeld('')).toBeNull();
  });
});

describe('sortiereUmbauten', () => {
  const umbau = (id: string, datum: string | null, aktualisiert_am: string): Umbau => ({
    id,
    datum,
    aktualisiert_am,
    geloescht: false,
    bauteil_id: null,
    modell_teil_id: null,
    beschreibung: id,
    ersetzt_handbuchwert: false,
  });

  it('zeigt die neuesten zuerst und Umbauten ohne Datum am Ende', () => {
    const sortiert = sortiereUmbauten([
      umbau('ohne-alt', null, '2026-01-01'),
      umbau('2019', '2019-05-01', '2026-01-01'),
      umbau('ohne-neu', null, '2026-03-01'),
      umbau('2023', '2023-07-15', '2026-01-01'),
    ]);
    expect(sortiert.map((u) => u.id)).toEqual(['2023', '2019', 'ohne-neu', 'ohne-alt']);
  });
});

describe('hubraumLiter', () => {
  it('liest Liter und cm³', () => {
    expect(hubraumLiter('3,8')).toBe(3.8);
    expect(hubraumLiter('3.8 l')).toBe(3.8);
    expect(hubraumLiter('1600 cm³')).toBe(1.6);
    expect(hubraumLiter('4229')).toBe(4.229);
  });

  it('liefert null ohne Zahl', () => {
    expect(hubraumLiter('')).toBeNull();
    expect(hubraumLiter('unbekannt')).toBeNull();
    expect(hubraumLiter('0')).toBeNull();
  });
});
