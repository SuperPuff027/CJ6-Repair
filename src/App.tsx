import { useEffect, useState } from 'preact/hooks';
import type { ModellTeilId } from './szene/modell';
import { Buehne } from './ui/Buehne';
import { Leiste } from './ui/Leiste';
import { useThema } from './ui/useThema';

export function App() {
  const { thema, umschalten } = useThema();
  const [auswahl, setzeAuswahl] = useState<ModellTeilId | null>(null);

  // Escape hebt die Auswahl auf (Laptop).
  useEffect(() => {
    const beiTaste = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setzeAuswahl(null);
    };
    addEventListener('keydown', beiTaste);
    return () => removeEventListener('keydown', beiTaste);
  }, []);

  return (
    <>
      <Leiste thema={thema} themaUmschalten={umschalten} />
      <Buehne thema={thema} auswahl={auswahl} waehle={setzeAuswahl} />
    </>
  );
}
