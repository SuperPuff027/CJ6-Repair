import { describe, expect, it } from 'vitest';
import { einheitenVon, gegenstueck, KATEGORIE_LISTE, leseZahlOderBruch, rechne, schluesselweite } from './einheiten';

describe('rechne', () => {
  it('nutzt die exakten Definitionen', () => {
    expect(rechne(1, 'laenge', 'in', 'mm')).toBeCloseTo(25.4, 10);
    expect(rechne(1, 'gewicht', 'lb', 'kg')).toBeCloseTo(0.45359237, 10);
    expect(rechne(1, 'volumen', 'gal', 'l')).toBeCloseTo(3.785411784, 9);
    expect(rechne(232, 'hubraum', 'ci', 'l')).toBeCloseTo(3.8018, 4);
    expect(rechne(1, 'geschwindigkeit', 'mph', 'km/h')).toBeCloseTo(1.609344, 10);
  });

  it('rechnet Drehmoment und Druck', () => {
    expect(rechne(1, 'drehmoment', 'ft-lb', 'Nm')).toBeCloseTo(1.3558179483, 9);
    expect(rechne(100, 'drehmoment', 'in-lb', 'Nm')).toBeCloseTo(11.298483, 5);
    expect(rechne(1, 'druck', 'psi', 'bar')).toBeCloseTo(0.0689475729, 9);
    expect(rechne(1, 'druck', 'bar', 'kPa')).toBe(100);
  });

  it('rechnet Temperatur mit Versatz', () => {
    expect(rechne(212, 'temperatur', '°F', '°C')).toBeCloseTo(100, 10);
    expect(rechne(-40, 'temperatur', '°C', '°F')).toBeCloseTo(-40, 10);
  });

  it('rechnet Verbrauch umgekehrt proportional', () => {
    expect(rechne(10, 'verbrauch', 'mpg', 'l/100 km')).toBeCloseTo(23.5215, 4);
    expect(rechne(23.5214583, 'verbrauch', 'l/100 km', 'mpg')).toBeCloseTo(10, 5);
    expect(rechne(0, 'verbrauch', 'mpg', 'l/100 km')).toBeNull();
  });

  it('lehnt fremde Einheiten ab und rechnet hin und zurück ohne Verlust', () => {
    expect(rechne(1, 'laenge', 'in', 'kg')).toBeNull();
    for (const k of KATEGORIE_LISTE) {
      const [a, b] = einheitenVon(k);
      expect(rechne(rechne(7, k, a!, b!)!, k, b!, a!), k).toBeCloseTo(7, 9);
    }
  });
});

describe('leseZahlOderBruch', () => {
  it('liest Zahlen und Zoll-Brüche', () => {
    expect(leseZahlOderBruch('9/16')).toBe(0.5625);
    expect(leseZahlOderBruch('1 1/8')).toBe(1.125);
    expect(leseZahlOderBruch('1-1/8"')).toBe(1.125);
    expect(leseZahlOderBruch('0,5')).toBe(0.5);
    expect(leseZahlOderBruch('1/0')).toBeNull();
    expect(leseZahlOderBruch('neun')).toBeNull();
  });
});

describe('schluesselweite', () => {
  it('nennt mm und die benachbarten metrischen Schlüssel', () => {
    const w = schluesselweite(9 / 16);
    expect(w.mm).toBeCloseTo(14.2875, 4);
    expect(w.darunter).toMatchObject({ mm: 14 });
    expect(w.darunter!.differenz).toBeCloseTo(0.2875, 4);
    expect(w.darueber).toMatchObject({ mm: 15 });
    // 1/2" = 12,7 mm: darunter 12, darüber 13
    expect(schluesselweite(0.5)).toMatchObject({ darunter: { mm: 12 }, darueber: { mm: 13 } });
  });
});

describe('gegenstueck', () => {
  it('rechnet Sollwerte in die andere Welt um', () => {
    expect(gegenstueck(30, 'ft-lb')).toMatchObject({ einheit: 'Nm' });
    expect(gegenstueck(30, 'ft-lb')!.wert).toBeCloseTo(40.67, 2);
    expect(gegenstueck(30, 'lb-ft')!.wert).toBeCloseTo(40.67, 2);
    expect(gegenstueck(2, 'bar')).toMatchObject({ einheit: 'psi' });
    expect(gegenstueck(5, 'Stück')).toBeNull();
  });
});
