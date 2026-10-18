import { describe, expect, it } from 'vitest';
import { MODELL_TEIL_IDS } from '../szene/modell';
import { ordneMaengelZu, ordneMangelZu } from './maengel';

const teil = (text: string) => {
  const z = ordneMangelZu(text);
  return z.art === 'eindeutig' ? z.teil : z.art;
};

describe('ordneMangelZu', () => {
  it('ordnet typische Mängel eindeutig zu', () => {
    expect(teil('Öl tropft am Verteilergetriebe')).toBe('verteilergetriebe');
    expect(teil('Motor überhitzt, Kühlwasser kocht')).toBe('kuehler');
    expect(teil('Spurstange hat Spiel')).toBe('lenkung');
    expect(teil('Reifen vorne links abgefahren')).toBe('raeder');
    expect(teil('Auspuff ist laut, Schalldämpfer durchgerostet')).toBe('auspuff');
    expect(teil('Rücklicht links geht nicht')).toBe('beleuchtung');
    expect(teil('Engine overheats, coolant leaking')).toBe('kuehler');
    expect(teil('Kühlergrill verbogen')).toBe('kuehlergrill');
  });

  it('nimmt bei Bremsen und Achsen die Lage aus dem Text', () => {
    expect(teil('Bremsscheiben vorne kaputt')).toBe('bremsen_vorne');
    expect(teil('Bremse hinten quietscht')).toBe('bremsen_hinten');
    expect(teil('Handbremse zieht nicht')).toBe('bremsen_hinten');
    expect(teil('Differential hinten heult')).toBe('hinterachse');
    expect(teil('Rear brake drum scored')).toBe('bremsen_hinten');
  });

  it('fragt nach vorne oder hinten, wenn die Lage fehlt', () => {
    expect(ordneMangelZu('Bremsen ziehen nach links')).toMatchObject({
      art: 'rueckfrage',
      grund: 'lage',
      optionen: ['bremsen_vorne', 'bremsen_hinten'],
    });
  });

  it('fragt nach, wenn ein Wort zu mehreren Teilen passt', () => {
    expect(ordneMangelZu('Verteiler undicht')).toMatchObject({ art: 'rueckfrage', grund: 'mehrdeutig', optionen: ['motor', 'verteilergetriebe'] });
    expect(ordneMangelZu('Tank leckt')).toMatchObject({ art: 'rueckfrage', grund: 'mehrdeutig', optionen: ['benzintank', 'gastank'] });
  });

  it('meldet Unbekanntes, statt zu raten', () => {
    expect(ordneMangelZu('Irgendwas klappert')).toMatchObject({ art: 'unbekannt' });
  });

  it('erkennt Gasgeruch als Sicherheitsfall, auch ohne Teil', () => {
    expect(ordneMangelZu('Es riecht nach Gas im Fußraum')).toMatchObject({
      gasgeruch: true,
      art: 'rueckfrage',
      optionen: ['gastank', 'gasleitung', 'verdampfer'],
    });
    expect(ordneMangelZu('Gasgeruch am Verdampfer')).toMatchObject({ gasgeruch: true, art: 'eindeutig', teil: 'verdampfer' });
    expect(ordneMangelZu('Gas springt schlecht an')).toMatchObject({ gasgeruch: false });
  });

  it('nutzt zusätzliche Stichwörter aus der Wissensbasis', () => {
    expect(ordneMangelZu('Trittbrett lose')).toMatchObject({ art: 'unbekannt' });
    expect(ordneMangelZu('Trittbrett lose', { wanne: ['Trittbrett'] })).toMatchObject({ art: 'eindeutig', teil: 'wanne' });
  });

  it('hat für jedes Modellteil einen Weg zur Zuordnung', () => {
    // Jedes Teil muss sich über seinen eigenen Namen finden lassen (Bremsen über die Lage).
    const namen: Record<string, string> = { bremsen_vorne: 'Bremse vorne', bremsen_hinten: 'Bremse hinten', raeder: 'Reifen' };
    for (const id of MODELL_TEIL_IDS) {
      const z = ordneMangelZu(namen[id] ?? id.replace('_', ' '));
      const gefunden = z.art === 'eindeutig' ? [z.teil] : z.art === 'rueckfrage' ? z.optionen : [];
      expect(gefunden, id).toContain(id);
    }
  });
});

describe('ordneMaengelZu', () => {
  it('trennt mehrere Mängel nach Zeilen und Semikolon', () => {
    const z = ordneMaengelZu('Bremse vorne zieht\n\nAuspuff laut; Scheinwerfer blind');
    expect(z.map((e) => (e.art === 'eindeutig' ? e.teil : e.art))).toEqual(['bremsen_vorne', 'auspuff', 'beleuchtung']);
  });
});
