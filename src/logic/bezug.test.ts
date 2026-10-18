import { describe, expect, it } from 'vitest';
import { zaehleJeBezug } from './bezug';

describe('zaehleJeBezug', () => {
  it('zählt nur aktive Einträge der gewünschten Art', () => {
    const z = zaehleJeBezug(
      [
        { bezug_art: 'modellteil', bezug_id: 'motor', geloescht: false },
        { bezug_art: 'modellteil', bezug_id: 'motor', geloescht: false },
        { bezug_art: 'modellteil', bezug_id: 'motor', geloescht: true },
        { bezug_art: 'modellteil', bezug_id: 'kuehler', geloescht: false },
        { bezug_art: 'fahrzeug', bezug_id: 'motor', geloescht: false },
      ],
      'modellteil',
    );
    expect([...z]).toEqual([
      ['motor', 2],
      ['kuehler', 1],
    ]);
  });
});
