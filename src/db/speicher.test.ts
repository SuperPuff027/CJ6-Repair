import { describe, expect, it } from 'vitest';
import { fordereDauerhaftenSpeicher } from './speicher';

describe('fordereDauerhaftenSpeicher', () => {
  it('fragt nicht erneut, wenn der Speicher schon dauerhaft ist', async () => {
    let gefragt = false;
    const zustand = await fordereDauerhaftenSpeicher({
      persisted: async () => true,
      persist: async () => {
        gefragt = true;
        return true;
      },
    });
    expect(zustand).toBe('dauerhaft');
    expect(gefragt).toBe(false);
  });

  it('meldet Ablehnung und Fehler als nicht dauerhaft', async () => {
    expect(await fordereDauerhaftenSpeicher({ persisted: async () => false, persist: async () => false })).toBe('nicht_dauerhaft');
    expect(
      await fordereDauerhaftenSpeicher({
        persisted: async () => false,
        persist: async () => {
          throw new Error('Beispiel');
        },
      }),
    ).toBe('nicht_dauerhaft');
  });

  it('kommt ohne Storage-API aus', async () => {
    expect(await fordereDauerhaftenSpeicher(undefined)).toBe('nicht_unterstuetzt');
  });
});
