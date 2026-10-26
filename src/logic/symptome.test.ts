import { describe, expect, it } from 'vitest';
import type { SymptomAntwort, SymptomKnoten } from '../model/typen';
import { folge, startKnoten, wegAlsText } from './symptome';

const antwort = (text: string, felder: Partial<SymptomAntwort> = {}): SymptomAntwort => ({
  text,
  naechster_id: null,
  befund_bauteil_id: null,
  pruefschritt: null,
  ...felder,
});
const knoten = (id: string, frage: string, antworten: SymptomAntwort[]): SymptomKnoten => ({ id, frage, antworten, aktualisiert_am: '', geloescht: false });

// BEISPIEL-Baum, keine echten Diagnosen
const BAUM = [
  knoten('start', 'BEISPIEL: Springt der Motor an?', [
    antwort('Ja', { naechster_id: 'leerlauf' }),
    antwort('Nein', { pruefschritt: 'BEISPIEL: Batteriespannung messen' }),
  ]),
  knoten('leerlauf', 'BEISPIEL: Läuft er im Leerlauf rund?', [
    antwort('Ja'),
    antwort('Nein', { befund_bauteil_id: 'vergaser', pruefschritt: 'BEISPIEL: Leerlaufgemisch prüfen' }),
    antwort('Nein, und es riecht nach Gas'),
    antwort('Weiß nicht', { naechster_id: 'start' }),
  ]),
  knoten('bremse', 'BEISPIEL: Zieht die Bremse zur Seite?', [antwort('Ja', { naechster_id: 'gibt-es-nicht' })]),
];

describe('startKnoten', () => {
  it('liefert die Fragen, auf die keine Antwort verweist', () => {
    // „start“ wird von „Weiß nicht“ angesteuert, ist also kein Start mehr; übrig bleibt „bremse“.
    expect(startKnoten(BAUM).map((k) => k.id)).toEqual(['bremse']);
    expect(startKnoten(BAUM.slice(0, 1)).map((k) => k.id)).toEqual(['start']);
  });
});

describe('folge', () => {
  const [start, leerlauf, bremse] = BAUM;

  it('führt zur nächsten Frage oder zum Ende', () => {
    expect(folge(start!.antworten[0]!, [], BAUM)).toEqual({ art: 'frage', knoten: leerlauf });
    expect(folge(start!.antworten[1]!, [], BAUM)).toMatchObject({ art: 'ende', antwort: { pruefschritt: 'BEISPIEL: Batteriespannung messen' } });
  });

  it('bricht bei Gasgeruch ab', () => {
    expect(folge(leerlauf!.antworten[2]!, [], BAUM)).toEqual({ art: 'gasgeruch' });
  });

  it('erkennt Schleifen und Verweise ins Leere', () => {
    const pfad = [{ knoten: start!, antwort: start!.antworten[0]! }];
    expect(folge(leerlauf!.antworten[3]!, pfad, BAUM)).toEqual({ art: 'sackgasse' });
    expect(folge(bremse!.antworten[0]!, [], BAUM)).toEqual({ art: 'sackgasse' });
  });
});

describe('wegAlsText', () => {
  it('fasst Fragen und Antworten zusammen', () => {
    const [start, leerlauf] = BAUM;
    expect(wegAlsText([
      { knoten: start!, antwort: start!.antworten[0]! },
      { knoten: leerlauf!, antwort: leerlauf!.antworten[1]! },
    ])).toBe('BEISPIEL: Springt der Motor an? Ja · BEISPIEL: Läuft er im Leerlauf rund? Nein');
  });
});
