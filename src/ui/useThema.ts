import { useEffect, useState } from 'preact/hooks';
import { lies, schreibe, SCHLUESSEL } from '../geraet/speicher';
import { effektivesThema, gegenteil, istThema, type Thema } from '../logic/thema';

const systemAbfrage = matchMedia('(prefers-color-scheme: dark)');

export function gespeichertesThema(): Thema | null {
  const wert = lies(SCHLUESSEL.thema);
  return istThema(wert) ? wert : null;
}

/** Setzt das Attribut, über das die CSS-Tokens umschalten; ohne Wahl gilt die Media-Query. */
export function wendeThemaAn(gespeichert: Thema | null): void {
  const wurzel = document.documentElement;
  if (gespeichert) wurzel.dataset.thema = gespeichert;
  else delete wurzel.dataset.thema;
  // Statusleiste auf dem Handy an den Hintergrund anpassen.
  const hintergrund = getComputedStyle(wurzel).getPropertyValue('--bg').trim();
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', hintergrund);
}

export function useThema() {
  const [gespeichert, setzeGespeichert] = useState(gespeichertesThema);
  const [systemDunkel, setzeSystemDunkel] = useState(systemAbfrage.matches);

  useEffect(() => {
    const beiAenderung = (e: MediaQueryListEvent) => setzeSystemDunkel(e.matches);
    systemAbfrage.addEventListener('change', beiAenderung);
    return () => systemAbfrage.removeEventListener('change', beiAenderung);
  }, []);

  useEffect(() => wendeThemaAn(gespeichert), [gespeichert, systemDunkel]);

  const thema = effektivesThema(gespeichert, systemDunkel);
  const umschalten = () => {
    const neu = gegenteil(thema);
    schreibe(SCHLUESSEL.thema, neu);
    // Sofort anwenden: Kind-Effekte (z. B. die 3D-Bühne) laufen vor diesem Hook und lesen die neuen Tokens.
    wendeThemaAn(neu);
    setzeGespeichert(neu);
  };
  return { thema, umschalten };
}
