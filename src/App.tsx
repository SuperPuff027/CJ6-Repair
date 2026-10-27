import { useEffect, useState } from 'preact/hooks';
import type { ModellTeilId } from './szene/modell';
import { AnleitungsAnsicht } from './ui/AnleitungsAnsicht';
import { Buehne } from './ui/Buehne';
import { Flyout } from './ui/Flyout';
import { Leiste } from './ui/Leiste';
import { Umrechner } from './ui/Umrechner';
import { useThema } from './ui/useThema';

/** Unter dieser Breite verdeckt das Menü fast den ganzen Bildschirm; nach einer Auswahl schließt es. */
const SCHMAL_PX = 700;

export function App() {
  const { thema, umschalten } = useThema();
  const [auswahl, setzeAuswahl] = useState<ModellTeilId | null>(null);
  const [menueOffen, setzeMenueOffen] = useState(() => innerWidth >= SCHMAL_PX);
  const [anleitung, setzeAnleitung] = useState<{ anleitungId: string; aufgabeId: string | null } | null>(null);
  // Zählt hoch, wenn sich Aufgaben außerhalb des Menüs ändern (z. B. in der Anleitung), damit es neu lädt.
  const [aufgabenStand, setzeAufgabenStand] = useState(0);
  const [rechnerOffen, setzeRechnerOffen] = useState(false);

  const waehleImMenue = (id: ModellTeilId | null) => {
    setzeAuswahl(id);
    if (id && innerWidth < SCHMAL_PX) setzeMenueOffen(false);
  };

  // Escape schließt zuerst das Menü, dann die Auswahl (Laptop).
  useEffect(() => {
    const beiTaste = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || anleitung || rechnerOffen) return; // diese schließen sich selbst
      if (menueOffen) setzeMenueOffen(false);
      else setzeAuswahl(null);
    };
    addEventListener('keydown', beiTaste);
    return () => removeEventListener('keydown', beiTaste);
  }, [menueOffen, anleitung, rechnerOffen]);

  return (
    <>
      <Buehne thema={thema} auswahl={auswahl} waehle={setzeAuswahl} menueOffen={menueOffen} />
      <Leiste thema={thema} themaUmschalten={umschalten} menueOffen={menueOffen} menueOeffnen={() => setzeMenueOffen(true)} rechnerOeffnen={() => setzeRechnerOffen(true)} />
      <Flyout
        offen={menueOffen}
        schliessen={() => setzeMenueOffen(false)}
        auswahl={auswahl}
        waehle={waehleImMenue}
        oeffneAnleitung={(anleitungId, aufgabeId) => setzeAnleitung({ anleitungId, aufgabeId })}
        aufgabenStand={aufgabenStand}
      />
      {rechnerOffen && <Umrechner schliessen={() => setzeRechnerOffen(false)} />}
      {anleitung && (
        <AnleitungsAnsicht
          {...anleitung}
          schliessen={() => {
            setzeAnleitung(null);
            setzeAufgabenStand((n) => n + 1);
          }}
        />
      )}
    </>
  );
}
