import { describe, expect, it } from 'vitest';
import { formatiereDatum, formatiereGroesse, formatiereZahl, lokalesDatum } from './format';

describe('formatiereDatum', () => {
  it('schreibt das Datum je Sprache', () => {
    expect(formatiereDatum('2019-05-01', 'de')).toBe('01.05.2019');
    expect(formatiereDatum('2019-05-01', 'en')).toBe('01/05/2019');
  });

  it('lässt Unlesbares unverändert', () => {
    expect(formatiereDatum('irgendwann', 'de')).toBe('irgendwann');
  });
});

describe('formatiereZahl', () => {
  it('nutzt das Dezimalzeichen der Sprache', () => {
    expect(formatiereZahl(3.8, 'de')).toBe('3,8');
    expect(formatiereZahl(4.98, 'en')).toBe('4.98');
  });
});

describe('lokalesDatum', () => {
  it('nimmt das Datum in der lokalen Zeitzone', () => {
    const lokal = new Date(2026, 9, 18, 23, 30); // 18.10.2026, 23:30 Ortszeit
    expect(lokalesDatum(lokal.toISOString())).toBe('2026-10-18');
  });
});

describe('formatiereGroesse', () => {
  it('nimmt KB unter einem Megabyte, sonst MB', () => {
    expect(formatiereGroesse(3000, 'de')).toBe('3 KB');
    expect(formatiereGroesse(200, 'de')).toBe('1 KB');
    expect(formatiereGroesse(13 * 1024 * 1024, 'de')).toBe('13 MB');
    expect(formatiereGroesse(12.44 * 1024 * 1024, 'en')).toBe('12.4 MB');
  });
});
