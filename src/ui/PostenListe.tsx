import { useSprache } from '../i18n/kontext';
import { formatiereZahl } from '../logic/format';
import type { PaketPosten } from '../logic/reparaturpaket';
import type { ListenArt } from '../model/typen';

const ARTEN: readonly ListenArt[] = ['teil', 'verbrauch', 'werkzeug'];

/** Posten nach Art gruppiert; optional mit Haken zum Abhaken (Einkaufsliste). */
export function PostenListe<P extends PaketPosten>(props: {
  posten: readonly P[];
  abhaken?: (posten: P) => void;
  zeigeVorhanden?: boolean;
}) {
  const { t, sprache } = useSprache();
  return (
    <>
      {ARTEN.map((art) => {
        const liste = props.posten.filter((p) => p.art === art);
        if (liste.length === 0) return null;
        return (
          <div key={art} class="posten-gruppe">
            <h5 class="posten-titel">{t(`art.${art}`)}</h5>
            <ul class="posten-liste">
              {liste.map((p) => {
                const text = (
                  <>
                    <span class="posten-name">
                      {p.bezeichnung}
                      {p.teilenummer && <span class="posten-nummer"> · {p.teilenummer}</span>}
                    </span>
                    <span class="posten-menge">
                      {art === 'werkzeug' ? '' : `${formatiereZahl(p.menge, sprache)} ${p.einheit}`}
                      {props.zeigeVorhanden ? ` ${p.vorhanden ? t('paket.vorhanden') : t('paket.fehlt')}` : ''}
                    </span>
                  </>
                );
                return (
                  <li key={`${p.bezeichnung}|${p.teilenummer}|${p.einheit}`} class={p.vorhanden ? 'posten vorhanden' : 'posten'}>
                    {props.abhaken ? (
                      <label class="posten-haken">
                        <input type="checkbox" onChange={() => props.abhaken!(p)} aria-label={t('einkauf.besorgt', { bezeichnung: p.bezeichnung })} />
                        {text}
                      </label>
                    ) : (
                      text
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </>
  );
}
