import { describe, expect, it } from 'vitest';
import { passendeEntfernung } from './kamera';

describe('passendeEntfernung', () => {
  it('nutzt im Querformat den vertikalen Blickwinkel', () => {
    // 60° vertikal: sin(30°) = 0,5 → Abstand = 2 × Radius
    expect(passendeEntfernung(16 / 9, 60, 1)).toBeCloseTo(2, 5);
  });

  it('braucht im Hochformat mehr Abstand als im Querformat', () => {
    const quer = passendeEntfernung(16 / 9, 34, 2.2);
    const hoch = passendeEntfernung(375 / 812, 34, 2.2);
    expect(hoch).toBeGreaterThan(quer * 1.8);
  });

  it('wächst linear mit dem Radius', () => {
    expect(passendeEntfernung(1, 40, 3)).toBeCloseTo(3 * passendeEntfernung(1, 40, 1), 5);
  });
});
