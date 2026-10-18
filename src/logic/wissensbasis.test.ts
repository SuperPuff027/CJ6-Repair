import { describe, expect, it } from 'vitest';
import beispiel from '../../docs/wissensbasis-beispiel.json';
import type { MitId } from '../model/typen';
import { leseWissensbasis, planeImport, pruefeWissensbasis, WISSENSBASIS_TABELLEN, type Wissensbasis, type WissensbasisTabelle } from './wissensbasis';

const JETZT = new Date('2026-10-18T12:00:00Z');
const FRUEHER = '2026-01-01T00:00:00.000Z';

/** Tiefe Kopie der Beispieldatei, die ein Test verändern darf. */
function kopie(): Record<string, unknown> & typeof beispiel {
  return structuredClone(beispiel);
}

function codes(roh: unknown) {
  const ergebnis = pruefeWissensbasis(roh);
  return ergebnis.ok ? [] : ergebnis.fehler.map((f) => `${f.code} ${f.pfad}`);
}

function gueltig(roh: unknown): Wissensbasis {
  const ergebnis = pruefeWissensbasis(roh);
  if (!ergebnis.ok) throw new Error(JSON.stringify(ergebnis.fehler));
  return ergebnis.daten;
}

const leererBestand = (): Record<WissensbasisTabelle, MitId[]> =>
  Object.fromEntries(WISSENSBASIS_TABELLEN.map((t) => [t, []])) as unknown as Record<WissensbasisTabelle, MitId[]>;

describe('pruefeWissensbasis', () => {
  it('akzeptiert die Beispieldatei aus docs/', () => {
    const daten = gueltig(beispiel);
    expect(daten.bauteile[0]).toMatchObject({ id: 'bremstrommel-vorn', modell_teil_id: 'bremsen_vorne' });
    expect(daten.anleitungen[0]?.schritte[0]).toMatchObject({ bild: null, werkzeug: ['BEISPIEL Radmutternschlüssel'] });
  });

  it('lehnt fremde Dateien und kaputtes JSON ab', () => {
    expect(codes({ format: 'etwas-anderes', version: 1 })).toEqual(['falsches_format ']);
    expect(codes([])).toEqual(['falsches_format ']);
    const kaputt = leseWissensbasis('{ nicht json');
    expect(kaputt.ok ? null : kaputt.fehler[0]?.code).toBe('kein_json');
  });

  it('verlangt eine Quelle für jede Teilenummer und jeden Sollwert', () => {
    const d = kopie();
    delete (d.bauteile[0]!.teilenummern[0] as { quelle?: unknown }).quelle;
    (d.anleitungen[0]!.schritte[0]!.sollwerte[0]!.quelle as { dokument: string }).dokument = '  ';
    expect(codes(d)).toEqual([
      'quelle_fehlt bauteile[0].teilenummern[0].quelle',
      'quelle_fehlt anleitungen[0].schritte[0].sollwerte[0].quelle.dokument',
    ]);
  });

  it('verlangt eine Quelle für geprüfte Anleitungen', () => {
    const d = kopie();
    d.anleitungen[0]!.geprueft = true;
    expect(codes(d)).toEqual(['quelle_fehlt anleitungen[0].quelle']);
  });

  it('meldet fehlende Pflichtfelder und falsche Typen mit Pfad', () => {
    const d = kopie();
    delete (d.bauteile[0] as { name?: string }).name;
    (d.motor_varianten[0] as { zylinder: unknown }).zylinder = 'sechs';
    expect(codes(d)).toEqual(['falscher_typ motor_varianten[0].zylinder', 'pflichtfeld bauteile[0].name']);
  });

  it('meldet doppelte IDs, fehlende Verweise und unbekannte Modellteile', () => {
    const d = kopie();
    d.bauteile.push({ ...d.bauteile[0]!, baugruppe_id: 'gibt-es-nicht', modell_teil_id: 'fluxkompensator' });
    d.anleitungen[0]!.bauteil_id = 'fehlt';
    expect(codes(d)).toEqual([
      'modellteil_unbekannt bauteile[1].modell_teil_id',
      'id_doppelt bauteile[1].id',
      'verweis_fehlt bauteile[1].baugruppe_id',
      'verweis_fehlt anleitungen[0].bauteil_id',
    ]);
  });

  it('erkennt Baugruppen, die im Kreis aufeinander verweisen', () => {
    const d = kopie();
    d.baugruppen[0]!.eltern_id = 'bremsen-vorn';
    expect(codes(d)).toEqual(['zyklus baugruppen[0].eltern_id', 'zyklus baugruppen[1].eltern_id']);
  });

  it('verlangt für jede Antwort im Symptom-Baum ein Ziel', () => {
    const d = kopie();
    d.symptom_knoten[0]!.antworten.push({ text: 'Weiß nicht' } as (typeof d.symptom_knoten)[0]['antworten'][0]);
    expect(codes(d)).toEqual(['antwort_ohne_ziel symptom_knoten[0].antworten[2]']);
  });
});

describe('planeImport', () => {
  it('legt beim ersten Import alles neu an', () => {
    const plan = planeImport(leererBestand(), gueltig(beispiel), JETZT);
    expect(plan.zusammenfassung.bauteile).toEqual({ neu: 1, geaendert: 0, entfernt: 0, unveraendert: 0 });
    expect(plan.schreiben.bauteile[0]).toMatchObject({ id: 'bremstrommel-vorn', geloescht: false, aktualisiert_am: JETZT.toISOString() });
  });

  it('lässt Unverändertes stehen, schreibt Geändertes und löscht Fehlendes weich', () => {
    const erster = planeImport(leererBestand(), gueltig(beispiel), new Date(FRUEHER));
    const bestand = erster.schreiben;

    const d = kopie();
    d.anleitungen[0]!.schritte[0]!.text = 'BEISPIEL: geänderter Schritt'; // verschachtelte Änderung
    (d as { baugruppen: unknown[] }).baugruppen = d.baugruppen.slice(1, 2).map((g) => ({ ...g, eltern_id: null }));
    const plan = planeImport(bestand, gueltig(d), JETZT);

    expect(plan.zusammenfassung.bauteile).toEqual({ neu: 0, geaendert: 0, entfernt: 0, unveraendert: 1 });
    expect(plan.zusammenfassung.anleitungen).toEqual({ neu: 0, geaendert: 1, entfernt: 0, unveraendert: 0 });
    expect(plan.zusammenfassung.baugruppen).toEqual({ neu: 0, geaendert: 1, entfernt: 1, unveraendert: 0 });
    expect(plan.schreiben.bauteile).toEqual([]);
    expect(plan.schreiben.baugruppen.find((g) => g.id === 'bremsen')).toMatchObject({ geloescht: true, aktualisiert_am: JETZT.toISOString() });
  });

  it('holt weich gelöschte Einträge zurück, wenn sie wieder in der Datei stehen', () => {
    const bestand = planeImport(leererBestand(), gueltig(beispiel), new Date(FRUEHER)).schreiben;
    bestand.bauteile = bestand.bauteile.map((b) => ({ ...b, geloescht: true }));
    expect(planeImport(bestand, gueltig(beispiel), JETZT).zusammenfassung.bauteile.neu).toBe(1);
  });
});
