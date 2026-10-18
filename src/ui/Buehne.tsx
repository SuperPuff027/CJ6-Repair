import { useEffect, useRef } from 'preact/hooks';
import { teilSchluessel } from '../i18n';
import { useSprache } from '../i18n/kontext';
import type { Thema } from '../logic/thema';
import type { ModellTeilId } from '../szene/modell';
import { erstelleSzene, type SzenenSteuerung } from '../szene/szene';

function themaFarben() {
  const stil = getComputedStyle(document.documentElement);
  const token = (name: string) => stil.getPropertyValue(name).trim();
  return { linie: token('--line'), linieSchwach: token('--line-schwach'), rot: token('--rot') };
}

const KREUZ = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

export function Buehne(props: {
  thema: Thema;
  auswahl: ModellTeilId | null;
  waehle: (id: ModellTeilId | null) => void;
  menueOffen: boolean;
}) {
  const { t } = useSprache();
  const leinwand = useRef<HTMLCanvasElement>(null);
  const szene = useRef<SzenenSteuerung | null>(null);
  // Die Szene wird nur einmal gebaut; der Rückruf soll trotzdem immer die aktuelle Funktion nutzen.
  const waehleAktuell = useRef(props.waehle);
  waehleAktuell.current = props.waehle;
  // Nur bei einer neuen Auswahl gelesen: Öffnen oder Schließen des Menüs bewegt das Modell nicht.
  const menueOffen = useRef(props.menueOffen);
  menueOffen.current = props.menueOffen;

  useEffect(() => {
    const bewegungReduziert = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const steuerung = erstelleSzene(leinwand.current!, {
      bewegungReduziert,
      beiAntippen: (id) => waehleAktuell.current(id),
    });
    szene.current = steuerung;
    steuerung.setzeFarben(themaFarben());
    return () => {
      steuerung.zerstoere();
      szene.current = null;
    };
  }, []);

  // Das Theme setzt zuerst data-thema; die Farben werden danach aus den CSS-Tokens gelesen.
  useEffect(() => {
    szene.current?.setzeFarben(themaFarben());
  }, [props.thema]);

  useEffect(() => {
    const menue = document.getElementById('flyout');
    szene.current?.waehle(props.auswahl, menueOffen.current && menue ? menue.offsetWidth : 0);
  }, [props.auswahl]);

  return (
    <main class="buehne">
      <canvas ref={leinwand} class="leinwand" aria-label={t('buehne.modell')} role="img" />
      <div class="buehne-fuss">
        {props.auswahl ? (
          <div class="auswahl-chip">
            <span class="auswahl-punkt" aria-hidden="true" />
            <span class="auswahl-name">{t(teilSchluessel(props.auswahl))}</span>
            <button class="auswahl-weg" onClick={() => props.waehle(null)} aria-label={t('auswahl.aufheben')}>
              {KREUZ}
            </button>
          </div>
        ) : (
          <p class="bedienhinweis">{t('buehne.bedienhinweis')}</p>
        )}
      </div>
    </main>
  );
}
