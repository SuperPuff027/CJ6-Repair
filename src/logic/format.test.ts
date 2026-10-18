import { describe, expect, it } from 'vitest';
import { formatiereDatum, formatiereZahl } from './format';

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
