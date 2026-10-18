import { useEffect, useRef, useState } from 'preact/hooks';
import { gruppenSchluessel, teilSchluessel } from '../i18n';
import { useSprache } from '../i18n/kontext';
import { passtZurSuche } from '../logic/suche';
import { MODELL_GRUPPEN, MODELL_TEIL_IDS, TEIL_GRUPPE, type ModellTeilId } from '../szene/modell';

type Reiter = 'bauteile' | 'diagnose';

const KREUZ = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

export function Flyout(props: {
  offen: boolean;
  schliessen: () => void;
  auswahl: ModellTeilId | null;
  waehle: (id: ModellTeilId | null) => void;
}) {
  const { t } = useSprache();
  const [reiter, setzeReiter] = useState<Reiter>('bauteile');
  const [anfrage, setzeAnfrage] = useState('');
  const suchfeld = useRef<HTMLInputElement>(null);

  // Am Laptop gleich tippen können; am Handy würde das die Tastatur über das Menü schieben.
  useEffect(() => {
    if (props.offen && reiter === 'bauteile' && matchMedia('(pointer: fine)').matches) {
      suchfeld.current?.focus({ preventScroll: true });
    }
  }, [props.offen, reiter]);

  const gruppen = MODELL_GRUPPEN.map((gruppe) => ({
    gruppe,
    teile: MODELL_TEIL_IDS.filter(
      (id) => TEIL_GRUPPE[id] === gruppe && passtZurSuche([t(teilSchluessel(id)), t(gruppenSchluessel(gruppe))], anfrage),
    ),
  })).filter((g) => g.teile.length > 0);

  return (
    <aside id="flyout" class={props.offen ? 'flyout offen' : 'flyout'} aria-label={t('menue.titel')} aria-hidden={!props.offen} inert={!props.offen}>
      <div class="flyout-kopf">
        <span class="flyout-titel">{t('menue.titel')}</span>
        <button class="rund-knopf" onClick={props.schliessen} aria-label={t('menue.schliessen')}>
          {KREUZ}
        </button>
      </div>

      <div class="reiter" role="tablist">
        {(['bauteile', 'diagnose'] as const).map((r) => (
          <button
            key={r}
            role="tab"
            id={`reiter-${r}`}
            class="reiter-knopf"
            aria-selected={reiter === r}
            aria-controls={`bereich-${r}`}
            onClick={() => setzeReiter(r)}
          >
            {t(r === 'bauteile' ? 'reiter.bauteile' : 'reiter.diagnose')}
          </button>
        ))}
      </div>

      <div class="flyout-bereich" id="bereich-bauteile" role="tabpanel" aria-labelledby="reiter-bauteile" hidden={reiter !== 'bauteile'}>
        <input
          ref={suchfeld}
          id="bauteil-suche"
          class="suchfeld"
          type="search"
          value={anfrage}
          onInput={(e) => setzeAnfrage(e.currentTarget.value)}
          placeholder={t('suche.platzhalter')}
          aria-label={t('suche.platzhalter')}
        />
        {gruppen.length === 0 && <p class="flyout-notiz">{t('suche.keine_treffer', { anfrage })}</p>}
        {gruppen.map(({ gruppe, teile }) => (
          <section key={gruppe} class="gruppe">
            <h3 class="gruppe-titel">{t(gruppenSchluessel(gruppe))}</h3>
            {teile.map((id) => {
              const gewaehlt = props.auswahl === id;
              return (
                <div key={id}>
                  <button class="teil-knopf" aria-pressed={gewaehlt} onClick={() => props.waehle(gewaehlt ? null : id)}>
                    <span class="teil-punkt" aria-hidden="true" />
                    <span class="teil-name">{t(teilSchluessel(id))}</span>
                  </button>
                  {gewaehlt && (
                    <div class="teil-detail">
                      <p>{t('detail.hinweis')}</p>
                      <button class="rand-knopf" onClick={() => props.waehle(null)}>
                        {t('detail.gesamtansicht')}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        ))}
      </div>

      <div class="flyout-bereich" id="bereich-diagnose" role="tabpanel" aria-labelledby="reiter-diagnose" hidden={reiter !== 'diagnose'}>
        {(
          [
            ['diagnose.mangel', 'diagnose.mangel_info'],
            ['diagnose.messwerte', 'diagnose.messwerte_info'],
            ['diagnose.symptome', 'diagnose.symptome_info'],
          ] as const
        ).map(([titel, info]) => (
          <div key={titel} class="diagnose-eintrag" aria-disabled="true">
            <span>
              <span class="diagnose-titel">{t(titel)}</span>
              <span class="diagnose-info">{t(info)}</span>
            </span>
            <span class="bald">{t('diagnose.bald')}</span>
          </div>
        ))}
        <p class="flyout-notiz">{t('diagnose.hinweis')}</p>
      </div>
    </aside>
  );
}
