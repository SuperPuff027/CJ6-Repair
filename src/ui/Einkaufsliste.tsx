import { useEffect, useState } from 'preact/hooks';
import { ladeEinkaufsliste, markiereBesorgt, type EinkaufsPosten } from '../db/reparaturpaket';
import { useSprache } from '../i18n/kontext';
import type { Aufgabe } from '../model/typen';
import { PostenListe } from './PostenListe';

/** Was für offene Aufgaben fehlt; abhaken = besorgt. Lädt neu, wenn sich die Aufgaben ändern. */
export function Einkaufsliste(props: { aufgaben: readonly Aufgabe[] }) {
  const { t } = useSprache();
  const [posten, setzePosten] = useState<EinkaufsPosten[]>([]);

  const laden = () => ladeEinkaufsliste().then(setzePosten, (e) => console.error('Einkaufsliste nicht lesbar', e));
  useEffect(() => {
    void laden();
  }, [props.aufgaben]);

  const besorgt = async (p: EinkaufsPosten) => {
    await markiereBesorgt(p.ids);
    await laden();
  };

  return (
    <section class="einkaufsliste">
      <h3 class="gruppe-titel">
        {t('einkauf.titel')}
        {posten.length > 0 && ` (${posten.length})`}
      </h3>
      {posten.length === 0 ? <p class="feld-hinweis">{t('einkauf.leer')}</p> : <PostenListe posten={posten} abhaken={besorgt} />}
    </section>
  );
}
