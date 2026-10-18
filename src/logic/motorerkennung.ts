// Motorerkennung: filtert die Motorvarianten der Wissensbasis anhand der Angaben und begründet jedes Ergebnis.
// Die Motordaten selbst kommen nur aus der Wissensbasis (mit Quelle), nie aus dem Code.
import type { MotorBestaetigung, MotorVariante } from '../model/typen';

export interface MotorAngaben {
  zylinder: number | null;
  hubraum_l: number | null;
  baujahr: number | null;
  /** Am Block eingeschlagen, z. B. „802E20“ */
  motorcode: string | null;
  vin: string | null;
}

export const GRUND_CODES = [
  'motorcode_passt',
  'motorcode_widerspricht',
  'motorcode_unbekannt',
  'vin_passt',
  'vin_widerspricht',
  'zylinder_passt',
  'zylinder_widerspricht',
  'hubraum_passt',
  'hubraum_widerspricht',
  'baujahr_passt',
  'baujahr_ausserhalb',
  'ohne_motorcode',
] as const;
export type GrundCode = (typeof GRUND_CODES)[number];

export interface Grund {
  code: GrundCode;
  /** passt = spricht dafür, widerspricht = dagegen, hinweis = weder noch */
  art: 'passt' | 'widerspricht' | 'hinweis';
}

export type Sicherheit = 'hoch' | 'mittel' | 'niedrig';

export interface Bewertung {
  variante: MotorVariante;
  /** Ausgeschlossen durch Zylinderzahl oder einen eindeutig anderen Motorcode */
  ausgeschlossen: boolean;
  sicherheit: Sicherheit;
  gruende: Grund[];
}

/** Erlaubte Abweichung beim Hubraum (Liter), z. B. 3,8 gegen 3,77. */
const HUBRAUM_TOLERANZ_L = 0.15;

/** 4. Zeichen eines AMC-Motorcodes: Jahr (1 Ziffer), Monat (2), Buchstabe, Tag (2), z. B. 802E20. */
export function motorcodeBuchstabe(code: string | null): string | null {
  const treffer = code?.toUpperCase().replace(/\s/g, '').match(/^\d{3}([A-Z])\d{2}$/);
  return treffer?.[1] ?? null;
}

/** 8. Zeichen einer 13-stelligen Jeep-Fahrgestellnummer (Schema 1971–1974), sonst null. */
export function vinMotorBuchstabe(vin: string | null): string | null {
  const v = vin?.toUpperCase().replace(/[\s-]/g, '') ?? '';
  return /^J\d[A-Z]\d{3}[A-Z][A-Z]\d{5}$/.test(v) ? v[7]! : null;
}

const RANG: Record<Sicherheit, number> = { hoch: 0, mittel: 1, niedrig: 2 };

export function bewerteMotoren(varianten: readonly MotorVariante[], angaben: MotorAngaben): Bewertung[] {
  const codeBuchstabe = motorcodeBuchstabe(angaben.motorcode);
  const vinBuchstabe = vinMotorBuchstabe(angaben.vin);

  const bewertungen = varianten.map((variante): Bewertung => {
    const gruende: Grund[] = [];
    let ausgeschlossen = false;

    if (codeBuchstabe && variante.motorcode_buchstaben.length > 0) {
      if (variante.motorcode_buchstaben.includes(codeBuchstabe)) gruende.push({ code: 'motorcode_passt', art: 'passt' });
      else {
        gruende.push({ code: 'motorcode_widerspricht', art: 'widerspricht' });
        ausgeschlossen = true;
      }
    } else if (codeBuchstabe) {
      gruende.push({ code: 'motorcode_unbekannt', art: 'hinweis' });
    }

    // Die Fahrgestellnummer nennt den Motor ab Werk; ein Tauschmotor schließt die Variante nicht aus.
    if (vinBuchstabe && variante.vin_buchstaben.length > 0) {
      gruende.push(
        variante.vin_buchstaben.includes(vinBuchstabe)
          ? { code: 'vin_passt', art: 'passt' }
          : { code: 'vin_widerspricht', art: 'widerspricht' },
      );
    }

    if (angaben.zylinder !== null) {
      if (angaben.zylinder === variante.zylinder) gruende.push({ code: 'zylinder_passt', art: 'passt' });
      else {
        gruende.push({ code: 'zylinder_widerspricht', art: 'widerspricht' });
        ausgeschlossen = true;
      }
    }

    // Hubraumangaben in Papieren sind bei alten Fahrzeugen oft falsch: nur Hinweis, kein Ausschluss.
    if (angaben.hubraum_l !== null) {
      gruende.push(
        Math.abs(angaben.hubraum_l - variante.hubraum_l) <= HUBRAUM_TOLERANZ_L
          ? { code: 'hubraum_passt', art: 'passt' }
          : { code: 'hubraum_widerspricht', art: 'widerspricht' },
      );
    }

    if (angaben.baujahr !== null && (variante.baujahr_von !== null || variante.baujahr_bis !== null)) {
      const imZeitraum =
        (variante.baujahr_von === null || angaben.baujahr >= variante.baujahr_von) &&
        (variante.baujahr_bis === null || angaben.baujahr <= variante.baujahr_bis);
      gruende.push(imZeitraum ? { code: 'baujahr_passt', art: 'passt' } : { code: 'baujahr_ausserhalb', art: 'hinweis' });
    }

    if (!codeBuchstabe) gruende.push({ code: 'ohne_motorcode', art: 'hinweis' });

    const hat = (code: GrundCode) => gruende.some((g) => g.code === code);
    const sicherheit: Sicherheit = hat('motorcode_passt')
      ? 'hoch'
      : hat('vin_passt') || (hat('zylinder_passt') && hat('hubraum_passt'))
        ? 'mittel'
        : 'niedrig';

    return { variante, ausgeschlossen, sicherheit, gruende };
  });

  const punkte = (b: Bewertung) => b.gruende.filter((g) => g.art === 'passt').length - b.gruende.filter((g) => g.art === 'widerspricht').length;
  return bewertungen.sort(
    (a, b) =>
      Number(a.ausgeschlossen) - Number(b.ausgeschlossen) ||
      RANG[a.sicherheit] - RANG[b.sicherheit] ||
      punkte(b) - punkte(a) ||
      a.variante.name.localeCompare(b.variante.name),
  );
}

/**
 * Noch mögliche Varianten derselben Bauart und Zylinderzahl (z. B. AMC 232 und 258 mit gemeinsamem Block).
 * Solange es solche gibt, beweist eine Gussnummer nichts.
 */
export function baugleicheMoeglich(bewertung: Bewertung, alle: readonly Bewertung[]): boolean {
  return alle.some(
    (b) =>
      b !== bewertung &&
      !b.ausgeschlossen &&
      b.variante.zylinder === bewertung.variante.zylinder &&
      b.variante.bauart === bewertung.variante.bauart,
  );
}

/**
 * Das Profil wird erst fixiert, wenn ein Nachweis vorliegt (CLAUDE.md, Fachliche Regeln):
 * Motorcode oder Fahrgestellnummer müssen zur Variante passen; eine Gussnummer prüft der Nutzer selbst,
 * sie zählt aber nur, wenn kein baugleicher Motor mehr in Frage kommt.
 */
export function kannBestaetigen(bewertung: Bewertung, durch: MotorBestaetigung, alle: readonly Bewertung[]): boolean {
  if (bewertung.ausgeschlossen) return false;
  if (durch === 'motorcode') return bewertung.gruende.some((g) => g.code === 'motorcode_passt');
  if (durch === 'vin') return bewertung.gruende.some((g) => g.code === 'vin_passt');
  return !baugleicheMoeglich(bewertung, alle);
}

/** Merkt eine Variante vor oder nimmt sie wieder heraus. */
export function vormerkenUmschalten(vorgemerkt: readonly string[], id: string): string[] {
  return vorgemerkt.includes(id) ? vorgemerkt.filter((v) => v !== id) : [...vorgemerkt, id];
}
