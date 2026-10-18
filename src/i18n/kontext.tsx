import { createContext, type ComponentChildren } from 'preact';
import { useContext, useEffect, useMemo, useState } from 'preact/hooks';
import type { Sprache } from '../logic/sprache';
import { erstelleUebersetzer, type Uebersetzer } from './index';

interface SprachKontext {
  sprache: Sprache;
  t: Uebersetzer;
  /** Schaltet die Oberfläche sofort um (Speichern übernehmen die Einstellungen). */
  setzeSprache: (sprache: Sprache) => void;
}

const Kontext = createContext<SprachKontext | null>(null);

export function SprachAnbieter(props: { sprache: Sprache; children: ComponentChildren }) {
  const [sprache, setzeSprache] = useState(props.sprache);
  const wert = useMemo(() => ({ sprache, t: erstelleUebersetzer(sprache), setzeSprache }), [sprache]);

  useEffect(() => {
    document.documentElement.lang = sprache;
    document.title = wert.t('app.titel');
  }, [sprache, wert]);

  return <Kontext.Provider value={wert}>{props.children}</Kontext.Provider>;
}

export function useSprache(): SprachKontext {
  const wert = useContext(Kontext);
  if (!wert) throw new Error('useSprache außerhalb von SprachAnbieter');
  return wert;
}
