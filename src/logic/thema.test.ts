import { describe, expect, it } from 'vitest';
import { effektivesThema, gegenteil, istThema } from './thema';

describe('istThema', () => {
  it('erkennt nur hell und dunkel', () => {
    expect(istThema('hell')).toBe(true);
    expect(istThema('dunkel')).toBe(true);
    expect(istThema('dark')).toBe(false);
    expect(istThema(null)).toBe(false);
  });
});

describe('effektivesThema', () => {
  it('folgt ohne Wahl dem System', () => {
    expect(effektivesThema(null, true)).toBe('dunkel');
    expect(effektivesThema(null, false)).toBe('hell');
  });

  it('nimmt eine ausdrückliche Wahl auch gegen das System', () => {
    expect(effektivesThema('hell', true)).toBe('hell');
    expect(effektivesThema('dunkel', false)).toBe('dunkel');
  });
});

describe('gegenteil', () => {
  it('schaltet um', () => {
    expect(gegenteil('hell')).toBe('dunkel');
    expect(gegenteil('dunkel')).toBe('hell');
  });
});
