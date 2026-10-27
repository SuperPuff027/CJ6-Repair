import { describe, expect, it } from 'vitest';
import { de } from './de';
import { en } from './en';
import { KATEGORIE_LISTE } from '../logic/einheiten';
import { MESSGROESSEN } from '../logic/messwerte';
import { GRUND_CODES } from '../logic/motorerkennung';
import { FEHLER_CODES, WISSENSBASIS_TABELLEN } from '../logic/wissensbasis';
import { MODELL_GRUPPEN, MODELL_TEIL_IDS } from '../szene/modell';
import { erstelleUebersetzer, gruppenSchluessel, pruefSchluessel, tabellenSchluessel, teilSchluessel } from './index';

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

describe('Namen der Modellteile', () => {
  it('gibt es für jedes Teil und jede Gruppe', () => {
    for (const id of MODELL_TEIL_IDS) expect(de, id).toHaveProperty([teilSchluessel(id)]);
    for (const g of MODELL_GRUPPEN) expect(de, g).toHaveProperty([gruppenSchluessel(g)]);
  });
});

describe('Texte zum Wissensbasis-Import', () => {
  it('gibt es für jeden Prüffehler und jede Tabelle', () => {
    for (const code of FEHLER_CODES) expect(de, code).toHaveProperty([pruefSchluessel(code)]);
    for (const tabelle of WISSENSBASIS_TABELLEN) expect(de, tabelle).toHaveProperty([tabellenSchluessel(tabelle)]);
  });
});

describe('Texte zur Motorerkennung', () => {
  it('gibt es für jeden Grund', () => {
    for (const code of GRUND_CODES) expect(de, code).toHaveProperty([`grund.${code}`]);
  });
});

describe('Texte zu Messwerten', () => {
  it('gibt es für jede Messgröße', () => {
    for (const g of MESSGROESSEN) expect(de, g).toHaveProperty([`messgroesse.${g}`]);
  });
});

describe('Texte zum Rechner', () => {
  it('gibt es für jede Kategorie', () => {
    for (const k of KATEGORIE_LISTE) expect(de, k).toHaveProperty([`kategorie.${k}`]);
  });
});
