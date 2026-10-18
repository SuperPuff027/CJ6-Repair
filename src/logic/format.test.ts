import { describe, expect, it } from 'vitest';
import { formatiereDatum } from './format';

describe('formatiereDatum', () => {
  it('schreibt das Datum je Sprache', () => {
    expect(formatiereDatum('2019-05-01', 'de')).toBe('01.05.2019');
    expect(formatiereDatum('2019-05-01', 'en')).toBe('01/05/2019');
  });

  it('lässt Unlesbares unverändert', () => {
    expect(formatiereDatum('irgendwann', 'de')).toBe('irgendwann');
  });
});
