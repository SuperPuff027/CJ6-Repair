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
