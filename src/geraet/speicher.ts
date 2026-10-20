// Geräte-Einstellungen (Theme, Sprache) im Browser-Speicher. Werden nicht abgeglichen.
// Der Zugriff kann scheitern (z. B. blockierter Speicher); die App startet dann mit Standardwerten.

export const SCHLUESSEL = {
  sprache: 'cj6.sprache',
  thema: 'cj6.thema',
} as const;

type Schluessel = (typeof SCHLUESSEL)[keyof typeof SCHLUESSEL];

export function lies(schluessel: Schluessel): string | null {
  try {
    return localStorage.getItem(schluessel);
  } catch {
    return null;
  }
}

export function schreibe(schluessel: Schluessel, wert: string): void {
  try {
    localStorage.setItem(schluessel, wert);
  } catch (fehler) {
    console.error('Einstellung konnte nicht gespeichert werden', fehler);
  }
}

const SCHRITT_PRAEFIX = 'cj6.schritt.';

/** Zuletzt geöffneter Anleitungsschritt einer Aufgabe auf diesem Gerät. */
export function liesSchritt(aufgabeId: string): number | null {
  try {
    const wert = localStorage.getItem(SCHRITT_PRAEFIX + aufgabeId);
    return wert === null ? null : Number(wert) || 0;
  } catch {
    return null;
  }
}

export function schreibeSchritt(aufgabeId: string, schritt: number): void {
  try {
    localStorage.setItem(SCHRITT_PRAEFIX + aufgabeId, String(schritt));
  } catch {
    // Nur eine Bequemlichkeit; ohne Speicher beginnt die Anleitung beim ersten Schritt.
  }
}
