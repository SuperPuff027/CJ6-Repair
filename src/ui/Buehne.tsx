import { useEffect, useRef } from 'preact/hooks';
import { useSprache } from '../i18n/kontext';
import type { Thema } from '../logic/thema';
import { erstelleSzene, type SzenenSteuerung } from '../szene/szene';

function themaFarben() {
  const stil = getComputedStyle(document.documentElement);
  return {
    linie: stil.getPropertyValue('--line').trim(),
    linieSchwach: stil.getPropertyValue('--line-schwach').trim(),
  };
}

export function Buehne(props: { thema: Thema }) {
  const { t } = useSprache();
  const leinwand = useRef<HTMLCanvasElement>(null);
  const szene = useRef<SzenenSteuerung | null>(null);

  useEffect(() => {
    const bewegungReduziert = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const steuerung = erstelleSzene(leinwand.current!, { bewegungReduziert });
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

  return (
    <main class="buehne">
      <canvas ref={leinwand} class="leinwand" aria-label={t('buehne.modell')} role="img" />
      <p class="bedienhinweis">{t('buehne.bedienhinweis')}</p>
    </main>
  );
}
