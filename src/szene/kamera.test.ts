import { describe, expect, it } from 'vitest';
import { ansichtFuerTeil, MIN_ABSTAND, passendeEntfernung, sanft, type Vektor } from './kamera';

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

describe('ansichtFuerTeil', () => {
  const abstand = (a: Vektor, b: Vektor) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

  it('richtet den Blick auf die Mitte des Bauteils', () => {
    const mitte: Vektor = [1.0, 0.7, 0];
    expect(ansichtFuerTeil(mitte, [0.8, 0.5, 0.3], 1.5, 34).ziel).toEqual(mitte);
  });

  it('zeigt vordere Teile von vorn und hintere von hinten', () => {
    expect(ansichtFuerTeil([1.3, 0.4, 0.5], [0.3, 0.3, 0.1], 1.5, 34).kamera[0]).toBeGreaterThan(1.3);
    expect(ansichtFuerTeil([-1.7, 0.8, 0], [0.3, 0.3, 0.9], 1.5, 34).kamera[0]).toBeLessThan(-1.7);
  });

  it('schaut von der Seite, auf der das Teil sitzt, und von oben', () => {
    const rechts = ansichtFuerTeil([0.3, 0.6, -0.4], [0.2, 0.2, 0.2], 1.5, 34);
    expect(rechts.kamera[2]).toBeLessThan(-0.4);
    expect(rechts.kamera[1]).toBeGreaterThan(0.6);
    expect(ansichtFuerTeil([0.3, 0.6, 0.4], [0.2, 0.2, 0.2], 1.5, 34).kamera[2]).toBeGreaterThan(0.4);
  });

  it('geht für große Teile weiter weg, aber nie näher als der Mindestabstand', () => {
    const klein = ansichtFuerTeil([0, 0.6, 0], [0.05, 0.05, 0.05], 1.5, 34);
    const gross = ansichtFuerTeil([0, 0.6, 0], [3.9, 0.2, 0.9], 1.5, 34);
    expect(abstand(klein.kamera, klein.ziel)).toBeCloseTo(MIN_ABSTAND, 5);
    expect(abstand(gross.kamera, gross.ziel)).toBeGreaterThan(3);
  });
});

describe('sanft', () => {
  it('beginnt bei 0, endet bei 1 und begrenzt Werte außerhalb', () => {
    expect(sanft(0)).toBe(0);
    expect(sanft(0.5)).toBeCloseTo(0.5, 5);
    expect(sanft(1)).toBe(1);
    expect(sanft(-1)).toBe(0);
    expect(sanft(2)).toBe(1);
  });
});
