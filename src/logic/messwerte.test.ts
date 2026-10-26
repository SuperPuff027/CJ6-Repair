import { describe, expect, it } from 'vitest';
import type { Messvorgabe } from '../model/typen';
import { bewerte, bewerteKompression, gruppiereMessreihen, messwertEingabe, passendeVorgaben, rechneUm } from './messwerte';

const QUELLE = { dokument: 'BEISPIEL-Handbuch', stelle: 'S. 0' };
function vorgabe(felder: Partial<Messvorgabe>): Messvorgabe {
  return {
    id: 'v',
    groesse: 'kompression',
    motor_variante_id: null,
    betriebsart: null,
    min: null,
    max: null,
    max_abweichung_prozent: null,
    einheit: 'bar',
    hinweis: null,
    quelle: QUELLE,
    aktualisiert_am: '',
    geloescht: false,
    ...felder,
  };
}

describe('rechneUm', () => {
  it('rechnet psi und bar um und lehnt Fremdes ab', () => {
    expect(rechneUm(100, 'psi', 'bar')).toBeCloseTo(6.894757, 6);
    expect(rechneUm(1, 'bar', 'psi')).toBeCloseTo(14.5038, 3);
    expect(rechneUm(12, 'V', 'V')).toBe(12);
    expect(rechneUm(12, 'V', 'bar')).toBeNull();
  });
});

describe('passendeVorgaben', () => {
  const alle = [
    vorgabe({ id: 'alle' }),
    vorgabe({ id: '232', motor_variante_id: 'amc-232' }),
    vorgabe({ id: '258', motor_variante_id: 'amc-258' }),
    vorgabe({ id: '232-gas', motor_variante_id: 'amc-232', betriebsart: 'gas' }),
    vorgabe({ id: 'spannung', groesse: 'batteriespannung', einheit: 'V' }),
  ];

  it('filtert nach Messgröße, Motor und Betriebsart', () => {
    expect(passendeVorgaben(alle, 'kompression', ['amc-232'], 'benzin').map((v) => v.id)).toEqual(['alle', '232']);
    expect(passendeVorgaben(alle, 'kompression', ['amc-232', 'amc-258'], 'benzin').map((v) => v.id)).toEqual(['alle', '232', '258']);
    expect(passendeVorgaben(alle, 'kompression', [], 'benzin').map((v) => v.id)).toEqual(['alle', '232', '258']);
  });

  it('nimmt Vorgaben für Benzin oder Gas vor allgemeinen', () => {
    expect(passendeVorgaben(alle, 'kompression', ['amc-232'], 'gas').map((v) => v.id)).toEqual(['232-gas']);
  });
});

describe('bewerte', () => {
  const bereich = vorgabe({ min: 8, max: 11 });

  it('urteilt nur mit Vorgabe', () => {
    expect(bewerte(9, 'bar', bereich)).toBe('ok');
    expect(bewerte(7.5, 'bar', bereich)).toBe('zu_niedrig');
    expect(bewerte(12, 'bar', bereich)).toBe('zu_hoch');
    expect(bewerte(9, 'bar', null)).toBe('ohne_sollwert');
    expect(bewerte(9, 'bar', vorgabe({}))).toBe('ohne_sollwert');
  });

  it('rechnet die Messung in die Einheit der Vorgabe um', () => {
    expect(bewerte(130, 'psi', bereich)).toBe('ok'); // ≈ 8,96 bar
    expect(bewerte(100, 'psi', bereich)).toBe('zu_niedrig'); // ≈ 6,89 bar
  });
});

describe('bewerteKompression', () => {
  it('findet den schwächsten Zylinder und die Streuung, auch ohne Vorgabe', () => {
    const bild = bewerteKompression([9.5, 9.4, 7.6, 9.6, 9.5, 9.3], 'bar', null)!;
    expect(bild.schwaechster).toBe(2);
    expect(bild.streuungProzent).toBeCloseTo(20.83, 2);
    expect(bild.streuungZuGross).toBeNull();
    expect(bild.urteile.every((u) => u === 'ohne_sollwert')).toBe(true);
  });

  it('prüft die Streuung gegen die erlaubte Abweichung der Vorgabe', () => {
    const v = vorgabe({ min: 8, max_abweichung_prozent: 10 });
    expect(bewerteKompression([9.5, 9.4, 7.6], 'bar', v)).toMatchObject({ streuungZuGross: true, urteile: ['ok', 'ok', 'zu_niedrig'] });
    expect(bewerteKompression([9.5, 9.4, 9.0], 'bar', v)).toMatchObject({ streuungZuGross: false });
    expect(bewerteKompression([], 'bar', v)).toBeNull();
  });
});

describe('messwertEingabe', () => {
  it('liest Zahlen mit Komma oder Punkt', () => {
    expect(messwertEingabe('8,5')).toBe(8.5);
    expect(messwertEingabe(' 135 ')).toBe(135);
    expect(messwertEingabe('-2')).toBe(-2);
    expect(messwertEingabe('')).toBeNull();
    expect(messwertEingabe('acht')).toBeNull();
  });
});

describe('gruppiereMessreihen', () => {
  it('fasst Zylinderwerte einer Messung zusammen, neueste Reihe zuerst', () => {
    const m = (id: string, groesse: string, gemessen_am: string, zylinder: number | null, wert: number, geloescht = false) => ({
      id,
      groesse,
      gemessen_am,
      zylinder,
      wert,
      einheit: 'bar',
      betriebsart: 'benzin' as const,
      bauteil_id: null,
      modell_teil_id: null,
      aktualisiert_am: gemessen_am,
      geloescht,
    });
    const reihen = gruppiereMessreihen([
      m('a2', 'kompression', '2026-10-01T10:00:00.000Z', 2, 9.4),
      m('a1', 'kompression', '2026-10-01T10:00:00.000Z', 1, 9.5),
      m('b', 'kompression', '2026-10-20T10:00:00.000Z', 1, 9.1),
      m('weg', 'kompression', '2026-10-25T10:00:00.000Z', 1, 1, true),
    ]);
    expect(reihen.map((r) => r.gemessen_am)).toEqual(['2026-10-20T10:00:00.000Z', '2026-10-01T10:00:00.000Z']);
    expect(reihen[1]!.werte.map((w) => `${w.zylinder}:${w.wert}`)).toEqual(['1:9.5', '2:9.4']);
  });
});
