import { describe, expect, it } from 'vitest';
import { de } from './de';
import { en } from './en';
import { erstelleUebersetzer } from './index';

describe('Übersetzungen', () => {
  it('haben in allen Sprachen genau dieselben Schlüssel', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(de).sort());
  });

  it('enthalten keine leeren Texte', () => {
    for (const texte of [de, en]) {
      for (const text of Object.values(texte)) expect(text.trim()).not.toBe('');
    }
  });

  it('verwenden in allen Sprachen dieselben Platzhalter', () => {
    const platzhalter = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const schluessel of Object.keys(de) as (keyof typeof de)[]) {
      expect(platzhalter(en[schluessel]), `en: ${schluessel}`).toEqual(platzhalter(de[schluessel]));
    }
  });
});

describe('erstelleUebersetzer', () => {
  it('liefert den Text der gewählten Sprache', () => {
    expect(erstelleUebersetzer('de')('app.untertitel')).toBe('Jeep CJ-6 · Baujahr {jahr}');
    expect(erstelleUebersetzer('en')('app.untertitel')).toBe('Jeep CJ-6 · Model year {jahr}');
  });

  it('setzt Platzhalter ein und lässt unbekannte stehen', () => {
    const t = erstelleUebersetzer('de');
    expect(t('app.untertitel', { jahr: 1974 })).toBe('Jeep CJ-6 · Baujahr 1974');
    expect(t('app.untertitel')).toBe('Jeep CJ-6 · Baujahr {jahr}');
    expect(t('app.untertitel', { x: 1 })).toBe('Jeep CJ-6 · Baujahr {jahr}');
  });
});
