import { Box3 } from 'three';
import { describe, expect, it } from 'vitest';
import { baueModell, MODELL_GRUPPEN, MODELL_TEIL_IDS, TEIL_GRUPPE } from './modell';

const modell = baueModell();

function huelle(teile = modell) {
  const box = new Box3();
  for (const teil of teile) {
    for (const g of teil.geometrien) {
      g.computeBoundingBox();
      box.union(g.boundingBox!);
    }
  }
  return box;
}

describe('Outline-Modell', () => {
  it('enthält jedes Modellteil genau einmal', () => {
    expect(modell.map((t) => t.id).sort()).toEqual([...MODELL_TEIL_IDS].sort());
  });

  it('ordnet jedes Teil einer bekannten Gruppe zu und hat Geometrie', () => {
    for (const teil of modell) {
      expect(TEIL_GRUPPE[teil.id], teil.id).toBe(teil.gruppe);
      expect(MODELL_GRUPPEN, teil.id).toContain(teil.gruppe);
      expect(teil.geometrien.length, teil.id).toBeGreaterThan(0);
    }
  });

  it('hat ungefähr die Abmessungen eines CJ-6', () => {
    const box = huelle();
    const laenge = box.max.x - box.min.x;
    const breite = box.max.z - box.min.z;
    expect(laenge).toBeGreaterThan(3.8);
    expect(laenge).toBeLessThan(4.5);
    expect(breite).toBeGreaterThan(1.4);
    expect(breite).toBeLessThan(1.8);
    expect(box.min.y).toBeGreaterThan(-1e-6); // nichts unter dem Boden (Rundung erlaubt)
    expect(box.max.y).toBeLessThan(1.9);
  });

  it('steht mit den Rädern auf dem Boden', () => {
    const raeder = huelle(modell.filter((t) => t.id === 'raeder'));
    expect(raeder.min.y).toBeCloseTo(0, 5);
  });
});
