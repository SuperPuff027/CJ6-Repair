import { describe, expect, it } from 'vitest';
import startdaten from '../../public/startdaten/motoren-cj.json';
import type { MotorVariante } from '../model/typen';
import { bewerteMotoren, kannBestaetigen, motorcodeBuchstabe, vinMotorBuchstabe, vormerkenUmschalten, type MotorAngaben } from './motorerkennung';
import { pruefeWissensbasis } from './wissensbasis';

/** Die mitgelieferte Startdatei, so wie sie importiert würde. */
function motoren(): MotorVariante[] {
  const ergebnis = pruefeWissensbasis(startdaten);
  if (!ergebnis.ok) throw new Error(JSON.stringify(ergebnis.fehler));
  return ergebnis.daten.motor_varianten.map((m) => ({ ...m, aktualisiert_am: '', geloescht: false }));
}

const LEER: MotorAngaben = { zylinder: null, hubraum_l: null, baujahr: null, motorcode: null, vin: null };
// Ausgedachte, aber dem Schema entsprechende Fahrgestellnummern
const VIN_232 = 'J4F845TE00001';
const VIN_258 = 'J4F845TA00001';

describe('Startdatei public/startdaten/motoren-cj.json', () => {
  it('ist eine gültige Wissensbasis mit Quelle für jeden Motor', () => {
    const m = motoren();
    expect(m.map((v) => v.id)).toEqual(['willys-hurricane-134', 'buick-dauntless-225', 'amc-232', 'amc-258', 'amc-304']);
    for (const v of m) expect(v.quelle.stelle, v.id).toMatch(/^https:\/\//);
  });
});

describe('motorcodeBuchstabe und vinMotorBuchstabe', () => {
  it('lesen den Kennbuchstaben', () => {
    expect(motorcodeBuchstabe('802E20')).toBe('E');
    expect(motorcodeBuchstabe(' 802 e20 ')).toBe('E');
    expect(motorcodeBuchstabe('E')).toBeNull();
    expect(vinMotorBuchstabe(VIN_232)).toBe('E');
    expect(vinMotorBuchstabe('1J4FY19P0SP123456')).toBeNull();
  });
});

describe('bewerteMotoren', () => {
  it('erkennt einen AMC 232 am Motorcode sicher, auch wenn der Hubraum in den Papieren falsch ist', () => {
    const [erster, ...rest] = bewerteMotoren(motoren(), { zylinder: 6, hubraum_l: 1.6, baujahr: 1974, motorcode: '802E20', vin: null });
    expect(erster).toMatchObject({ variante: { id: 'amc-232' }, sicherheit: 'hoch', ausgeschlossen: false });
    expect(erster!.gruende.map((g) => g.code)).toEqual(['motorcode_passt', 'zylinder_passt', 'hubraum_widerspricht', 'baujahr_passt']);
    // Der 258 hat einen anderen Kennbuchstaben, Hurricane und V8 eine andere Zylinderzahl.
    expect(rest.find((b) => b.variante.id === 'amc-258')?.ausgeschlossen).toBe(true);
    // Für den Buick-V6 ist kein Codeschema belegt: bleibt, aber nur mit niedriger Sicherheit.
    const offen = rest.filter((b) => !b.ausgeschlossen);
    expect(offen.map((b) => b.variante.id)).toEqual(['buick-dauntless-225']);
    expect(offen[0]).toMatchObject({ sicherheit: 'niedrig' });
    expect(offen[0]!.gruende).toContainEqual({ code: 'motorcode_unbekannt', art: 'hinweis' });
  });

  it('kann 232 und 258 ohne Motorcode nicht sicher trennen', () => {
    const bewertungen = bewerteMotoren(motoren(), { ...LEER, zylinder: 6, baujahr: 1974 });
    const sechser = bewertungen.filter((b) => !b.ausgeschlossen);
    expect(sechser.map((b) => b.variante.id).sort()).toEqual(['amc-232', 'amc-258', 'buick-dauntless-225']);
    for (const b of sechser) expect(b.sicherheit).toBe('niedrig');
    expect(sechser[0]!.gruende.some((g) => g.code === 'ohne_motorcode')).toBe(true);
  });

  it('nimmt die Fahrgestellnummer als Hinweis, schließt aber einen Tauschmotor nicht aus', () => {
    const bewertungen = bewerteMotoren(motoren(), { ...LEER, vin: VIN_258, motorcode: '802E20' });
    expect(bewertungen[0]).toMatchObject({ variante: { id: 'amc-232' }, sicherheit: 'hoch' });
    expect(bewertungen[0]!.gruende.find((g) => g.code === 'vin_widerspricht')).toBeTruthy();
    expect(bewerteMotoren(motoren(), { ...LEER, vin: VIN_232 })[0]).toMatchObject({ variante: { id: 'amc-232' }, sicherheit: 'mittel' });
  });

  it('weist auf Baujahre außerhalb der belegten Zeit hin', () => {
    const hurricane = bewerteMotoren(motoren(), { ...LEER, baujahr: 1974 }).find((b) => b.variante.id === 'willys-hurricane-134');
    expect(hurricane?.gruende).toContainEqual({ code: 'baujahr_ausserhalb', art: 'hinweis' });
  });
});

describe('kannBestaetigen', () => {
  it('verlangt einen passenden Nachweis', () => {
    const alle = bewerteMotoren(motoren(), { ...LEER, motorcode: '802E20' });
    const [mitCode] = alle;
    expect(kannBestaetigen(mitCode!, 'motorcode', alle)).toBe(true);
    expect(kannBestaetigen(mitCode!, 'vin', alle)).toBe(false);
    // Der 258 ist durch den Motorcode ausgeschlossen: die Gussnummer darf bestätigen.
    expect(kannBestaetigen(mitCode!, 'gussnummer', alle)).toBe(true);
    expect(kannBestaetigen(alle.find((b) => b.ausgeschlossen)!, 'gussnummer', alle)).toBe(false);
  });

  it('lässt die Gussnummer nicht gelten, solange ein baugleicher Motor möglich ist', () => {
    const alle = bewerteMotoren(motoren(), { ...LEER, zylinder: 6 });
    const amc232 = alle.find((b) => b.variante.id === 'amc-232')!;
    const dauntless = alle.find((b) => b.variante.id === 'buick-dauntless-225')!;
    expect(kannBestaetigen(amc232, 'gussnummer', alle)).toBe(false); // AMC 258 hat denselben Block
    expect(kannBestaetigen(dauntless, 'gussnummer', alle)).toBe(true); // einziger V6
  });
});

describe('vormerkenUmschalten', () => {
  it('fügt hinzu und nimmt wieder heraus, ohne die Liste zu verändern', () => {
    const leer: string[] = [];
    const eins = vormerkenUmschalten(leer, 'amc-232');
    expect(eins).toEqual(['amc-232']);
    expect(vormerkenUmschalten(eins, 'amc-258')).toEqual(['amc-232', 'amc-258']);
    expect(vormerkenUmschalten(eins, 'amc-232')).toEqual([]);
    expect(leer).toEqual([]);
  });
});
