import { useState } from 'preact/hooks';
import { legeReparaturpaketAn } from '../db/reparaturpaket';
import { teilSchluessel } from '../i18n';
import { useSprache } from '../i18n/kontext';
import type { Reparaturpaket } from '../logic/reparaturpaket';
import { PostenListe } from './PostenListe';

/** Vorschau eines Reparaturpakets; erst „Anlegen“ speichert Aufgaben und Listen. */
export function PaketVorschau(props: { paket: Reparaturpaket; angelegt: () => void; verwerfen: () => void }) {
  const { t } = useSprache();
  const [fehler, setzeFehler] = useState(false);
  const { paket } = props;
  const hatListen = paket.pakete.some((p) => p.posten.length > 0);
  // Werkzeug steht im eigenen Abschnitt (mit „fehlt“); auf der Einkaufsliste landet es erst nach dem Anlegen.
  const zuKaufen = paket.einkaufsliste.filter((p) => p.art !== 'werkzeug');

  const anlegen = async () => {
    setzeFehler(false);
    try {
      await legeReparaturpaketAn(paket);
      props.angelegt();
    } catch (e) {
      console.error('Reparaturpaket nicht gespeichert', e);
      setzeFehler(true);
    }
  };

  return (
    <div class="paket">
      <h4 class="detail-titel">{t('paket.titel')}</h4>
      <ul class="paket-liste">
        {paket.pakete.map((p, i) => (
          <li key={i} class="paket-mangel">
            <p class="mangel-text">
              {p.mangel.text} <span class="chip">{t(teilSchluessel(p.mangel.teil))}</span>{' '}
              <span class={`chip prio ${p.prioritaet}`}>{t(`prioritaet.${p.prioritaet}`)}</span>
            </p>
            <p class={`anleitung-status ${p.status}`}>
              {p.anleitung ? t(`paket.status.${p.status as 'geprueft' | 'ungeprueft'}`, { titel: p.anleitung.titel }) : t('paket.status.keine')}
              {p.weitere.length > 0 && ` ${t('paket.weitere', { n: p.weitere.length })}`}
            </p>
            {p.handbuchPruefen && <p class="feld-fehler">{t('paket.handbuch')}</p>}
          </li>
        ))}
      </ul>

      {hatListen ? (
        <>
          <h4 class="detail-titel">{t('paket.einkaufsliste')}</h4>
          {zuKaufen.length === 0 ? <p class="feld-hinweis">{t('paket.nichts_fehlt')}</p> : <PostenListe posten={zuKaufen} />}
          {paket.werkzeug.length > 0 && (
            <>
              <h4 class="detail-titel">{t('art.werkzeug')}</h4>
              <PostenListe posten={paket.werkzeug} zeigeVorhanden />
            </>
          )}
        </>
      ) : (
        <p class="feld-hinweis">{t('paket.keine_listen')}</p>
      )}

      <div class="knopf-reihe">
        <button class="voll-knopf" onClick={anlegen}>
          {t('paket.anlegen', { n: paket.pakete.length })}
        </button>
        <button class="rand-knopf" onClick={props.verwerfen}>
          {t('paket.verwerfen')}
        </button>
      </div>
      {fehler && <p class="feld-fehler">{t('aufgabe.fehler')}</p>}
    </div>
  );
}
