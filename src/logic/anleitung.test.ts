import { describe, expect, it } from 'vitest';
import type { Anleitung, Bauteil } from '../model/typen';
import { anleitungenFuerTeil, begrenzeSchritt, formatiereSollwert, quellenText, schrittFotoBezug } from './anleitung';

const SYNC = { aktualisiert_am: '2026-10-20T00:00:00.000Z', geloescht: false };

describe('begrenzeSchritt', () => {
  it('hält die Schrittnummer im gültigen Bereich', () => {
    expect(begrenzeSchritt(3, 5)).toBe(3);
    expect(begrenzeSchritt(9, 5)).toBe(4);
    expect(begrenzeSchritt(-1, 5)).toBe(0);
    expect(begrenzeSchritt(2, 0)).toBe(0);
  });
});

describe('Anzeigehilfen', () => {
  it('formatieren Sollwert, Quelle und Fotobezug', () => {
    const quelle = { dokument: 'BEISPIEL-Handbuch', stelle: 'S. 12' };
    expect(formatiereSollwert({ groesse: 'Anzugsmoment', wert: 12.5, einheit: 'Nm', quelle }, 'de')).toBe('12,5 Nm');
    expect(quellenText(quelle)).toBe('BEISPIEL-Handbuch, S. 12');
    expect(quellenText({ dokument: 'BEISPIEL-Handbuch', stelle: null })).toBe('BEISPIEL-Handbuch');
    expect(schrittFotoBezug('aufgabe-1', 2)).toBe('aufgabe-1:2');
  });
});

describe('anleitungenFuerTeil', () => {
  it('findet Anleitungen über die Bauteile des Modellteils, geprüfte zuerst', () => {
    const bauteile: Bauteil[] = [
      { ...SYNC, id: 'b1', baugruppe_id: 'g', name: 'b1', modell_teil_id: 'kuehler', teilenummern: [], motor_varianten: [], stichwoerter: [] },
      { ...SYNC, id: 'b2', baugruppe_id: 'g', name: 'b2', modell_teil_id: 'motor', teilenummern: [], motor_varianten: [], stichwoerter: [] },
    ];
    const anleitung = (id: string, bauteil_id: string, geprueft: boolean): Anleitung => ({
      ...SYNC,
      id,
      bauteil_id,
      titel: id,
      geprueft,
      quelle: null,
      schritte: [],
      material: [],
    });
    const gefunden = anleitungenFuerTeil('kuehler', bauteile, [anleitung('a-entwurf', 'b1', false), anleitung('z-geprueft', 'b1', true), anleitung('motor', 'b2', true)]);
    expect(gefunden.map((a) => a.id)).toEqual(['z-geprueft', 'a-entwurf']);
  });
});
