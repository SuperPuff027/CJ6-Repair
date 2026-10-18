import { describe, expect, it } from 'vitest';
import type { Aufgabe } from '../model/typen';
import { formatiereDauer, mitStatus, offeneMinuten, sortiereAufgaben, stundenAlsMinuten, vorgeschlagenePrioritaet } from './aufgaben';

function aufgabe(titel: string, felder: Partial<Aufgabe> = {}): Aufgabe {
  return {
    id: titel,
    titel,
    bauteil_id: null,
    modell_teil_id: null,
    anleitung_id: null,
    mangel_text: null,
    prioritaet: 'normal',
    geschaetzt_min: null,
    status: 'offen',
    erledigt_am: null,
    aktualisiert_am: '2026-10-01T00:00:00.000Z',
    geloescht: false,
    ...felder,
  };
}

describe('vorgeschlagenePrioritaet', () => {
  it('schlägt bei Bremsen, Lenkung und Gasanlage Sicherheit vor', () => {
    expect(vorgeschlagenePrioritaet('bremsen_vorne')).toBe('sicherheit');
    expect(vorgeschlagenePrioritaet('lenkung')).toBe('sicherheit');
    expect(vorgeschlagenePrioritaet('gasleitung')).toBe('sicherheit');
    expect(vorgeschlagenePrioritaet('sitze')).toBe('normal');
    expect(vorgeschlagenePrioritaet(null)).toBe('normal');
  });
});

describe('sortiereAufgaben', () => {
  it('ordnet nach Priorität, dann „in Arbeit“, dann Alter; Erledigte ans Ende', () => {
    const sortiert = sortiereAufgaben([
      aufgabe('erledigt-alt', { status: 'erledigt', erledigt_am: '2026-10-02T00:00:00.000Z' }),
      aufgabe('normal-alt', { aktualisiert_am: '2026-09-01T00:00:00.000Z' }),
      aufgabe('normal-neu'),
      aufgabe('hoch', { prioritaet: 'hoch' }),
      aufgabe('sicherheit', { prioritaet: 'sicherheit' }),
      aufgabe('normal-in-arbeit', { status: 'in_arbeit' }),
      aufgabe('erledigt-neu', { status: 'erledigt', erledigt_am: '2026-10-05T00:00:00.000Z' }),
    ]);
    expect(sortiert.map((a) => a.id)).toEqual([
      'sicherheit',
      'hoch',
      'normal-in-arbeit',
      'normal-alt',
      'normal-neu',
      'erledigt-neu',
      'erledigt-alt',
    ]);
  });
});

describe('mitStatus', () => {
  it('setzt erledigt_am beim Abhaken und löscht es beim Wiederöffnen', () => {
    const jetzt = new Date('2026-10-18T12:00:00Z');
    const fertig = mitStatus(aufgabe('a'), 'erledigt', jetzt);
    expect(fertig).toMatchObject({ status: 'erledigt', erledigt_am: jetzt.toISOString() });
    expect(mitStatus(fertig, 'offen', jetzt)).toMatchObject({ status: 'offen', erledigt_am: null });
  });
});

describe('offeneMinuten', () => {
  it('summiert nur nicht erledigte Aufgaben und zählt die ohne Schätzung', () => {
    expect(
      offeneMinuten([
        aufgabe('a', { geschaetzt_min: 90 }),
        aufgabe('b', { geschaetzt_min: 30, status: 'in_arbeit' }),
        aufgabe('c'),
        aufgabe('d', { geschaetzt_min: 600, status: 'erledigt' }),
      ]),
    ).toEqual({ minuten: 120, ohneSchaetzung: 1 });
  });
});

describe('stundenAlsMinuten', () => {
  it('liest Stunden mit Komma, Punkt und „h“', () => {
    expect(stundenAlsMinuten('1,5')).toBe(90);
    expect(stundenAlsMinuten('2 h')).toBe(120);
    expect(stundenAlsMinuten('0.25')).toBe(15);
    expect(stundenAlsMinuten('  ')).toBeNull();
  });

  it('lehnt Unsinn ab', () => {
    expect(stundenAlsMinuten('viel')).toBeUndefined();
    expect(stundenAlsMinuten('0')).toBeUndefined();
    expect(stundenAlsMinuten('-2')).toBeUndefined();
  });
});

describe('formatiereDauer', () => {
  it('zeigt Stunden und Minuten', () => {
    expect(formatiereDauer(45)).toBe('45 min');
    expect(formatiereDauer(120)).toBe('2 h');
    expect(formatiereDauer(210)).toBe('3 h 30 min');
  });
});
