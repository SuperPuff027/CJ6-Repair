import { useEffect, useState } from 'preact/hooks';
import { db } from '../db/datenbank';
import { speichere } from '../db/repo';
import { liesSchritt, schreibeSchritt } from '../geraet/speicher';
import { teilSchluessel } from '../i18n';
import { useSprache } from '../i18n/kontext';
import { begrenzeSchritt, formatiereSollwert, quellenText, schrittFotoBezug } from '../logic/anleitung';
import { mitStatus } from '../logic/aufgaben';
import { gegenstueck } from '../logic/einheiten';
import { formatiereZahl } from '../logic/format';
import type { Anleitung, Aufgabe, Bauteil } from '../model/typen';
import { FotoAblage } from './FotoAblage';

const HANDBUCH_PFLICHT = new Set(['bremsen_vorne', 'bremsen_hinten', 'lenkung']);

const PFEIL_ZURUECK = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M15 5l-7 7 7 7" />
  </svg>
);
const PFEIL_WEITER = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M9 5l7 7-7 7" />
  </svg>
);
const KREUZ = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

/** Hält den Bildschirm an, solange die Anleitung offen ist (Android Chrome); scheitert still. */
function useBildschirmAn() {
  useEffect(() => {
    let sperre: WakeLockSentinel | null = null;
    const anfordern = () => {
      if (document.visibilityState !== 'visible' || !('wakeLock' in navigator)) return;
      navigator.wakeLock.request('screen').then(
        (s) => (sperre = s),
        () => undefined,
      );
    };
    anfordern();
    // Beim Wechsel in eine andere App gibt der Browser die Sperre frei; danach neu anfordern.
    document.addEventListener('visibilitychange', anfordern);
    return () => {
      document.removeEventListener('visibilitychange', anfordern);
      void sperre?.release();
    };
  }, []);
}

/**
 * Werkstatt-Ansicht einer Anleitung: ein Schritt pro Seite, große Knöpfe.
 * Aus einer Aufgabe geöffnet: Aufgabe wird „in Arbeit“, Fotos je Schritt gehören zu ihr, Schritt wird gemerkt.
 */
export function AnleitungsAnsicht(props: { anleitungId: string; aufgabeId: string | null; schliessen: () => void }) {
  const { t, sprache } = useSprache();
  const [anleitung, setzeAnleitung] = useState<Anleitung | null>(null);
  const [bauteil, setzeBauteil] = useState<Bauteil | null>(null);
  const [aufgabe, setzeAufgabe] = useState<Aufgabe | null>(null);
  const [schritt, setzeSchritt] = useState(0);
  const [fertigFrage, setzeFertigFrage] = useState(false);
  useBildschirmAn();

  useEffect(() => {
    void (async () => {
      const a = await db.anleitungen.get(props.anleitungId);
      if (!a || a.geloescht) return;
      setzeAnleitung(a);
      setzeBauteil((await db.bauteile.get(a.bauteil_id)) ?? null);
      if (props.aufgabeId) {
        let auf = (await db.aufgaben.get(props.aufgabeId)) ?? null;
        if (auf && auf.status === 'offen') auf = await speichere(db.aufgaben, mitStatus(auf, 'in_arbeit', new Date()));
        setzeAufgabe(auf);
        setzeSchritt(begrenzeSchritt(liesSchritt(props.aufgabeId) ?? 0, a.schritte.length));
      }
    })().catch((e) => console.error('Anleitung nicht lesbar', e));
  }, [props.anleitungId, props.aufgabeId]);

  useEffect(() => {
    const beiTaste = (e: KeyboardEvent) => {
      if (e.key === 'Escape') props.schliessen();
    };
    addEventListener('keydown', beiTaste);
    return () => removeEventListener('keydown', beiTaste);
  }, []);

  if (!anleitung) return null;
  const anzahl = anleitung.schritte.length;
  const aktuell = anleitung.schritte[schritt];

  const gehe = (index: number) => {
    const neu = begrenzeSchritt(index, anzahl);
    setzeSchritt(neu);
    if (props.aufgabeId) schreibeSchritt(props.aufgabeId, neu);
    document.querySelector('.anleitung-inhalt')?.scrollTo({ top: 0 });
  };

  const erledigt = async () => {
    if (aufgabe) await speichere(db.aufgaben, mitStatus(aufgabe, 'erledigt', new Date()));
    props.schliessen();
  };

  const handbuch = bauteil?.modell_teil_id && HANDBUCH_PFLICHT.has(bauteil.modell_teil_id) && !anleitung.geprueft;

  return (
    <div class="anleitung" role="dialog" aria-modal="true" aria-labelledby="anleitung-titel">
      <header class="anleitung-kopf">
        <div class="anleitung-titel-block">
          <h2 id="anleitung-titel" class="anleitung-titel">
            {anleitung.titel}
          </h2>
          {bauteil?.modell_teil_id && <span class="feld-hinweis">{t(teilSchluessel(bauteil.modell_teil_id))}</span>}
        </div>
        <button class="rund-knopf" onClick={props.schliessen} aria-label={t('anleitung.schliessen')}>
          {KREUZ}
        </button>
      </header>

      <div class="anleitung-inhalt">
        {!anleitung.geprueft && (
          <div class="gefahr">
            <p class="gefahr-titel">{t('anleitung.ungeprueft_titel')}</p>
            <p>{t('anleitung.ungeprueft_text')}</p>
            {handbuch && <p>{t('paket.handbuch')}</p>}
          </div>
        )}
        {anleitung.quelle && (
          <p class="quelle">
            {t('motor.quelle')}: {quellenText(anleitung.quelle)}
          </p>
        )}

        {aktuell ? (
          <article class="schritt">
            <p class="schritt-nummer" aria-live="polite">
              {t('anleitung.schritt_von', { nr: schritt + 1, von: anzahl })}
            </p>
            {aktuell.warnung && (
              <p class="schritt-warnung" role="note">
                {aktuell.warnung}
              </p>
            )}
            <p class="schritt-text">{aktuell.text}</p>

            {aktuell.sollwerte.length > 0 && (
              <ul class="sollwerte">
                {aktuell.sollwerte.map((s, i) => (
                  <li key={i} class="sollwert">
                    <span class="sollwert-groesse">{s.groesse}</span>
                    <span class="sollwert-wert">
                      {formatiereSollwert(s, sprache)}
                      {(() => {
                        const g = gegenstueck(s.wert, s.einheit);
                        return g && <span class="sollwert-umgerechnet"> ≈ {`${formatiereZahl(g.wert, sprache, 1)} ${g.einheit}`}</span>;
                      })()}
                    </span>
                    <span class="sollwert-quelle">
                      {t('motor.quelle')}: {quellenText(s.quelle)}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {aktuell.werkzeug.length > 0 && (
              <>
                <h4 class="detail-titel">{t('art.werkzeug')}</h4>
                <ul class="schritt-werkzeug">
                  {aktuell.werkzeug.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </>
            )}

            {props.aufgabeId && (
              <>
                <h4 class="detail-titel">{t('anleitung.fotos')}</h4>
                <FotoAblage art="schritt" id={schrittFotoBezug(props.aufgabeId, schritt)} hinweis={t('anleitung.fotos_hinweis')} />
              </>
            )}
          </article>
        ) : (
          <p class="flyout-notiz">{t('anleitung.ohne_schritte')}</p>
        )}

        {fertigFrage && (
          <div class="anleitung-fertig">
            <p>{t('anleitung.erledigt_frage', { titel: aufgabe!.titel })}</p>
            <div class="knopf-reihe">
              <button class="voll-knopf" onClick={erledigt}>
                {t('anleitung.erledigt_ja')}
              </button>
              <button class="rand-knopf" onClick={props.schliessen}>
                {t('anleitung.erledigt_nein')}
              </button>
            </div>
          </div>
        )}
      </div>

      <nav class="anleitung-fuss">
        <button class="gross-knopf" onClick={() => gehe(schritt - 1)} disabled={schritt === 0}>
          {PFEIL_ZURUECK}
          {t('anleitung.zurueck')}
        </button>
        {schritt < anzahl - 1 ? (
          <button class="gross-knopf haupt" onClick={() => gehe(schritt + 1)}>
            {t('anleitung.weiter')}
            {PFEIL_WEITER}
          </button>
        ) : (
          <button class="gross-knopf haupt" onClick={() => (aufgabe && aufgabe.status !== 'erledigt' ? setzeFertigFrage(true) : props.schliessen())}>
            {t('anleitung.fertig')}
          </button>
        )}
      </nav>
    </div>
  );
}
