import { useEffect, useRef, useState } from 'preact/hooks';
import { gruppenSchluessel, teilSchluessel } from '../i18n';
import { useSprache } from '../i18n/kontext';
import { db } from '../db/datenbank';
import { ladeAktive } from '../db/repo';
import { anleitungenFuerTeil } from '../logic/anleitung';
import { sortiereAufgaben } from '../logic/aufgaben';
import type { Anleitung, Aufgabe, Bauteil } from '../model/typen';
import { zaehleJeBezug } from '../logic/bezug';
import { passtZurSuche } from '../logic/suche';
import { MODELL_GRUPPEN, MODELL_TEIL_IDS, TEIL_GRUPPE, type ModellTeilId } from '../szene/modell';
import { Aufgaben } from './Aufgaben';
import { FahrzeugProfil } from './FahrzeugProfil';
import { FotoAblage } from './FotoAblage';
import { Maengel } from './Maengel';
import { Messwerte } from './Messwerte';
import { Notizen } from './Notizen';
import { WissensbasisImport } from './WissensbasisImport';

type Reiter = 'bauteile' | 'aufgaben' | 'diagnose' | 'fahrzeug';
const REITER: readonly Reiter[] = ['bauteile', 'aufgaben', 'diagnose', 'fahrzeug'];

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
  oeffneAnleitung: (anleitungId: string, aufgabeId: string | null) => void;
  aufgabenStand: number;
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
  const [aufgaben, setzeAufgaben] = useState<Aufgabe[]>([]);
  // undefined = kein Wunsch; null = neue Aufgabe ohne Teil; sonst mit diesem Teil
  const [neueAufgabeFuer, setzeNeueAufgabeFuer] = useState<ModellTeilId | null | undefined>(undefined);
  const ladeAufgaben = () => ladeAktive(db.aufgaben).then(setzeAufgaben, (e) => console.error('Aufgaben nicht lesbar', e));

  const [wissen, setzeWissen] = useState<{ bauteile: Bauteil[]; anleitungen: Anleitung[] }>({ bauteile: [], anleitungen: [] });
  const ladeWissen = () =>
    Promise.all([ladeAktive(db.bauteile), ladeAktive(db.anleitungen)]).then(
      ([bauteile, anleitungen]) => setzeWissen({ bauteile, anleitungen }),
      (e) => console.error('Wissensbasis nicht lesbar', e),
    );

  useEffect(() => {
    if (!props.offen) return;
    void zaehleNotizen();
    void ladeAufgaben();
    void ladeWissen();
  }, [props.offen, props.aufgabenStand]);

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
                      {anleitungenFuerTeil(id, wissen.bauteile, wissen.anleitungen).length > 0 && (
                        <>
                          <h4 class="detail-titel">{t('anleitung.titel_liste')}</h4>
                          <ul class="detail-anleitungen">
                            {anleitungenFuerTeil(id, wissen.bauteile, wissen.anleitungen).map((a) => (
                              <li key={a.id}>
                                <button class="text-knopf" onClick={() => props.oeffneAnleitung(a.id, null)}>
                                  {a.titel}
                                </button>
                                {!a.geprueft && <span class="chip prio sicherheit">{t('anleitung.ungeprueft_kurz')}</span>}
                              </li>
                            ))}
                          </ul>
                        </>
                      )}
                      <h4 class="detail-titel">{t('reiter.aufgaben')}</h4>
                      <ul class="detail-aufgaben">
                        {sortiereAufgaben(aufgaben.filter((a) => a.modell_teil_id === id && a.status !== 'erledigt')).map((a) => (
                          <li key={a.id} class={`prio-${a.prioritaet}`}>
                            {a.titel}
                          </li>
                        ))}
                      </ul>
                      <button
                        class="rand-knopf"
                        onClick={() => {
                          setzeNeueAufgabeFuer(id);
                          setzeReiter('aufgaben');
                        }}
                      >
                        {t('detail.aufgabe_neu')}
                      </button>
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

      <div class="flyout-bereich" id="bereich-aufgaben" role="tabpanel" aria-labelledby="reiter-aufgaben" hidden={reiter !== 'aufgaben'}>
        <Aufgaben
          aufgaben={aufgaben}
          neuLaden={ladeAufgaben}
          waehle={(teil) => props.waehle(teil)}
          neuFuer={neueAufgabeFuer}
          neuGeoeffnet={() => setzeNeueAufgabeFuer(undefined)}
          oeffneAnleitung={props.oeffneAnleitung}
        />
      </div>

      <div class="flyout-bereich" id="bereich-diagnose" role="tabpanel" aria-labelledby="reiter-diagnose" hidden={reiter !== 'diagnose'}>
        <h3 class="gruppe-titel">{t('diagnose.mangel')}</h3>
        <Maengel waehle={(teil) => props.waehle(teil)} beiNeuerAufgabe={ladeAufgaben} />
        <h3 class="gruppe-titel diagnose-weitere">{t('diagnose.messwerte')}</h3>
        {reiter === 'diagnose' && <Messwerte />}
        <h3 class="gruppe-titel diagnose-weitere">{t('diagnose.weitere')}</h3>
        {([['diagnose.symptome', 'diagnose.symptome_info']] as const).map(([titel, info]) => (
          <div key={titel} class="diagnose-eintrag" aria-disabled="true">
            <span>
              <span class="diagnose-titel">{t(titel)}</span>
              <span class="diagnose-info">{t(info)}</span>
            </span>
            <span class="bald">{t('diagnose.bald')}</span>
          </div>
        ))}
      </div>

      <div class="flyout-bereich" id="bereich-fahrzeug" role="tabpanel" aria-labelledby="reiter-fahrzeug" hidden={reiter !== 'fahrzeug'}>
        {reiter === 'fahrzeug' && <FahrzeugProfil />}
      </div>
    </aside>
  );
}
