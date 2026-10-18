import { describe, expect, it } from 'vitest';
import { zielGroesse } from './foto';

describe('zielGroesse', () => {
  it('verkleinert auf die längste Kante und behält das Seitenverhältnis', () => {
    expect(zielGroesse(4032, 3024)).toEqual({ breite: 1600, hoehe: 1200 });
    expect(zielGroesse(3024, 4032)).toEqual({ breite: 1200, hoehe: 1600 });
  });

  it('lässt kleine Bilder unverändert', () => {
    expect(zielGroesse(1200, 1600)).toEqual({ breite: 1200, hoehe: 1600 });
  });
});
