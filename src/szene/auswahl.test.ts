import { describe, expect, it } from 'vitest';
import { istTippen, kleinsterTreffer } from './auswahl';

describe('kleinsterTreffer', () => {
  it('wählt das kleinste getroffene Bauteil', () => {
    expect(
      kleinsterTreffer([
        { id: 'motorhaube', volumen: 0.2 },
        { id: 'motor', volumen: 0.12 },
        { id: 'motorhaube', volumen: 0.2 },
      ]),
    ).toBe('motor');
  });

  it('liefert null ohne Treffer', () => {
    expect(kleinsterTreffer([])).toBeNull();
  });
});

describe('istTippen', () => {
  it('unterscheidet Tippen von Ziehen', () => {
    expect(istTippen({ x: 100, y: 100 }, { x: 103, y: 104 })).toBe(true);
    expect(istTippen({ x: 100, y: 100 }, { x: 110, y: 100 })).toBe(false);
  });
});
