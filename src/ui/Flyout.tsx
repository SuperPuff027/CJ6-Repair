import { useEffect, useRef, useState } from 'preact/hooks';
import { gruppenSchluessel, teilSchluessel } from '../i18n';
import { useSprache } from '../i18n/kontext';
import { db } from '../db/datenbank';
import { zaehleJeBezug } from '../logic/bezug';
import { passtZurSuche } from '../logic/suche';
import { MODELL_GRUPPEN, MODELL_TEIL_IDS, TEIL_GRUPPE, type ModellTeilId } from '../szene/modell';
import { FahrzeugProfil } from './FahrzeugProfil';
import { FotoAblage } from './FotoAblage';
import { Notizen } from './Notizen';
import { WissensbasisImport } from './WissensbasisImport';

type Reiter = 'bauteile' | 'diagnose' | 'fahrzeug';
const REITER: readonly Reiter[] = ['bauteile', 'diagnose', 'fahrzeug'];

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
  const [notizZaehler, setzeNotizZaehler] = useState<Map<string, number>>(new Map());

  // Notizen sind klein; Fotos werden hier bewusst nicht gezählt, um keine Bilddaten zu laden.
  const zaehleNotizen = () =>
    db.notizen.toArray().then(
      (alle) => setzeNotizZaehler(zaehleJeBezug(alle, 'modellteil')),
      (e) => console.error('Notizen nicht lesbar', e),
    );
  useEffect(() => {
    if (props.offen) void zaehleNotizen();
  }, [props.offen]);

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
        {REITER.map((r) => (
          <button
            key={r}
            role="tab"
            id={`reiter-${r}`}
            class="reiter-knopf"
            aria-selected={reiter === r}
            aria-controls={`bereich-${r}`}
            onClick={() => setzeReiter(r)}
          >
            {t(`reiter.${r}`)}
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
                    {(notizZaehler.get(id) ?? 0) > 0 && (
                      <span class="teil-zaehler" aria-label={notizZaehler.get(id) === 1 ? t('notiz.anzahl_eins') : t('notiz.anzahl', { n: notizZaehler.get(id)! })}>
                        {notizZaehler.get(id)}
                      </span>
                    )}
                  </button>
                  {gewaehlt && (
                    <div class="teil-detail">
                      <h4 class="detail-titel">{t('notiz.titel')}</h4>
                      <Notizen art="modellteil" id={id} beiAenderung={zaehleNotizen} />
                      <h4 class="detail-titel">{t('detail.fotos')}</h4>
                      <FotoAblage art="modellteil" id={id} hinweis={t('detail.fotos_hinweis')} />
                      <button class="rand-knopf detail-zurueck" onClick={() => props.waehle(null)}>
                        {t('detail.gesamtansicht')}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        ))}
        {!anfrage && <WissensbasisImport />}
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

      <div class="flyout-bereich" id="bereich-fahrzeug" role="tabpanel" aria-labelledby="reiter-fahrzeug" hidden={reiter !== 'fahrzeug'}>
        {reiter === 'fahrzeug' && <FahrzeugProfil />}
      </div>
    </aside>
  );
}
