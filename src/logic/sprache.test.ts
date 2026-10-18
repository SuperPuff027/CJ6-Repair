import { describe, expect, it } from 'vitest';
import { ermittleSprache, istSprache } from './sprache';

describe('istSprache', () => {
  it('erkennt nur unterstützte Sprachen', () => {
    expect(istSprache('de')).toBe(true);
    expect(istSprache('en')).toBe(true);
    expect(istSprache('tr')).toBe(false);
    expect(istSprache(null)).toBe(false);
  });
});

describe('ermittleSprache', () => {
  it('nimmt die gespeicherte Wahl zuerst', () => {
    expect(ermittleSprache('en', ['de-DE'])).toBe('en');
  });

  it('nimmt sonst die erste unterstützte Gerätesprache', () => {
    expect(ermittleSprache(null, ['fr-FR', 'en-GB', 'de'])).toBe('en');
    expect(ermittleSprache('xx', ['EN-us'])).toBe('en');
  });

  it('fällt auf Deutsch zurück', () => {
    expect(ermittleSprache(undefined, ['fr-FR'])).toBe('de');
    expect(ermittleSprache(null, [])).toBe('de');
  });
});
