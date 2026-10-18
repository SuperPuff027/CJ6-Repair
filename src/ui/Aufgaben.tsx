import { useEffect, useState } from 'preact/hooks';
import { db } from '../db/datenbank';
import { loescheWeich, speichere } from '../db/repo';
import { teilSchluessel } from '../i18n';
import { useSprache } from '../i18n/kontext';
import { formatiereDauer, mitStatus, offeneMinuten, PRIORITAETEN, sortiereAufgaben, stundenAlsMinuten, vorgeschlagenePrioritaet } from '../logic/aufgaben';
import { neuerDatensatz } from '../logic/datensatz';
import { formatiereDatum, lokalesDatum } from '../logic/format';
import type { Aufgabe, AufgabenStatus, Prioritaet } from '../model/typen';
import { MODELL_TEIL_IDS, type ModellTeilId } from '../szene/modell';

function NeueAufgabe(props: { teil: ModellTeilId | null; fertig: () => void; abbrechen: () => void; melde: (fehler: boolean) => void }) {
  const { t } = useSprache();
  const [titel, setzeTitel] = useState('');
  const [teil, setzeTeil] = useState<ModellTeilId | ''>(props.teil ?? '');
  const [prioritaet, setzePrioritaet] = useState<Prioritaet>(vorgeschlagenePrioritaet(props.teil));
  const [prioGeaendert, setzePrioGeaendert] = useState(false);
  const [stunden, setzeStunden] = useState('');
  const minuten = stundenAlsMinuten(stunden);

  const teilGewaehlt = (neu: ModellTeilId | '') => {
    setzeTeil(neu);
    // Den Vorschlag nur nachführen, solange der Nutzer die Priorität nicht selbst gewählt hat.
    if (!prioGeaendert) setzePrioritaet(vorgeschlagenePrioritaet(neu || null));
  };

  const speichern = async (e: Event) => {
    e.preventDefault();
    const text = titel.trim();
    if (!text || minuten === undefined) return;
    try {
      await speichere(
        db.aufgaben,
        neuerDatensatz<Aufgabe>(
          {
            titel: text,
            bauteil_id: null,
            modell_teil_id: teil || null,
            anleitung_id: null,
            mangel_text: null,
            prioritaet,
            geschaetzt_min: minuten,
            status: 'offen',
            erledigt_am: null,
          },
          new Date(),
        ),
      );
      props.fertig();
    } catch (fehler) {
      console.error('Aufgabe nicht gespeichert', fehler);
      props.melde(true);
    }
  };

  return (
    <form class="aufgabe-formular" onSubmit={speichern}>
      <div class="feld">
        <label for="aufgabe-titel">{t('aufgabe.titel')}</label>
        <input id="aufgabe-titel" class="eingabe" type="text" value={titel} onInput={(e) => setzeTitel(e.currentTarget.value)} required />
      </div>
      <div class="feld">
        <label for="aufgabe-teil">{t('aufgabe.bauteil')}</label>
        <select id="aufgabe-teil" class="eingabe" value={teil} onChange={(e) => teilGewaehlt(e.currentTarget.value as ModellTeilId | '')}>
          <option value="">{t('aufgabe.kein_bauteil')}</option>
          {MODELL_TEIL_IDS.map((id) => (
            <option key={id} value={id}>
              {t(teilSchluessel(id))}
            </option>
          ))}
        </select>
      </div>
      <fieldset class="feld prio-wahl">
        <legend>{t('aufgabe.prioritaet')}</legend>
        <div class="segmente">
          {PRIORITAETEN.map((p) => (
            <label key={p} class={prioritaet === p ? `segment ${p} gewaehlt` : `segment ${p}`}>
              <input
                type="radio"
                name="aufgabe-prioritaet"
                value={p}
                checked={prioritaet === p}
                onChange={() => {
                  setzePrioritaet(p);
                  setzePrioGeaendert(true);
                }}
              />
              {t(`prioritaet.${p}`)}
            </label>
          ))}
        </div>
        {!prioGeaendert && prioritaet === 'sicherheit' && <p class="feld-hinweis">{t('aufgabe.sicherheit_vorschlag')}</p>}
      </fieldset>
      <div class="feld">
        <label for="aufgabe-zeit">{t('aufgabe.zeit')}</label>
        <input
          id="aufgabe-zeit"
          class="eingabe"
          type="text"
          inputMode="decimal"
          value={stunden}
          onInput={(e) => setzeStunden(e.currentTarget.value)}
          placeholder={t('aufgabe.zeit_platzhalter')}
          aria-invalid={minuten === undefined ? true : undefined}
        />
        {minuten === undefined && <p class="feld-fehler">{t('aufgabe.zeit_fehler')}</p>}
      </div>
      <div class="knopf-reihe">
        <button type="submit" class="voll-knopf" disabled={!titel.trim() || minuten === undefined}>
          {t('aufgabe.speichern')}
        </button>
        <button type="button" class="rand-knopf" onClick={props.abbrechen}>
          {t('aufgabe.abbrechen')}
        </button>
      </div>
    </form>
  );
}

export function Aufgaben(props: {
  aufgaben: Aufgabe[];
  neuLaden: () => Promise<void>;
  waehle: (id: ModellTeilId) => void;
  /** Vom Bauteildetail aus geöffnet: Formular gleich mit diesem Teil anzeigen */
  neuFuer: ModellTeilId | null | undefined;
  neuGeoeffnet: () => void;
}) {
  const { t, sprache } = useSprache();
  const [formular, setzeFormular] = useState<{ teil: ModellTeilId | null } | null>(null);
  const [erledigteZeigen, setzeErledigteZeigen] = useState(false);
  const [loeschFrage, setzeLoeschFrage] = useState<string | null>(null);
  const [fehler, setzeFehler] = useState(false);

  useEffect(() => {
    if (props.neuFuer !== undefined) {
      setzeFormular({ teil: props.neuFuer });
      props.neuGeoeffnet();
    }
  }, [props.neuFuer]);

  const sortiert = sortiereAufgaben(props.aufgaben);
  const offen = sortiert.filter((a) => a.status !== 'erledigt');
  const erledigt = sortiert.filter((a) => a.status === 'erledigt');
  const zeit = offeneMinuten(props.aufgaben);

  const aendereStatus = async (a: Aufgabe, status: AufgabenStatus) => {
    try {
      await speichere(db.aufgaben, mitStatus(a, status, new Date()));
      await props.neuLaden();
    } catch (e) {
      console.error('Aufgabe nicht gespeichert', e);
      setzeFehler(true);
    }
  };

  const entfernen = async (id: string) => {
    setzeLoeschFrage(null);
    await loescheWeich(db.aufgaben, id);
    await props.neuLaden();
  };

  const eintrag = (a: Aufgabe) => (
    <li key={a.id} class={`aufgabe ${a.status} prio-${a.prioritaet}`}>
      <label class="aufgabe-haken">
        <input
          id={`aufgabe-erledigt-${a.id}`}
          type="checkbox"
          checked={a.status === 'erledigt'}
          onChange={(e) => aendereStatus(a, e.currentTarget.checked ? 'erledigt' : 'offen')}
          aria-label={t('aufgabe.abhaken', { titel: a.titel })}
        />
      </label>
      <div class="aufgabe-inhalt">
        <p class="aufgabe-text">{a.titel}</p>
        <div class="aufgabe-chips">
          {a.status !== 'erledigt' && <span class={`chip prio ${a.prioritaet}`}>{t(`prioritaet.${a.prioritaet}`)}</span>}
          {a.status === 'in_arbeit' && <span class="chip">{t('aufgabe.in_arbeit')}</span>}
          {a.modell_teil_id && (
            <button class="chip teil-link" onClick={() => props.waehle(a.modell_teil_id!)}>
              {t(teilSchluessel(a.modell_teil_id))}
            </button>
          )}
          {a.geschaetzt_min !== null && a.status !== 'erledigt' && <span class="chip">{formatiereDauer(a.geschaetzt_min)}</span>}
          {a.erledigt_am && <span class="chip">{formatiereDatum(lokalesDatum(a.erledigt_am), sprache)}</span>}
        </div>
        {loeschFrage === a.id ? (
          <div class="knopf-reihe">
            <button class="voll-knopf warn" onClick={() => entfernen(a.id)}>
              {t('aufgabe.wirklich')}
            </button>
            <button class="rand-knopf" onClick={() => setzeLoeschFrage(null)}>
              {t('aufgabe.abbrechen')}
            </button>
          </div>
        ) : (
          <div class="notiz-aktionen">
            {a.status === 'offen' && (
              <button class="text-knopf" onClick={() => aendereStatus(a, 'in_arbeit')}>
                {t('aufgabe.beginnen')}
              </button>
            )}
            {a.status === 'in_arbeit' && (
              <button class="text-knopf" onClick={() => aendereStatus(a, 'offen')}>
                {t('aufgabe.pausieren')}
              </button>
            )}
            <button class="text-knopf" onClick={() => setzeLoeschFrage(a.id)}>
              {t('aufgabe.entfernen')}
            </button>
          </div>
        )}
      </div>
    </li>
  );

  return (
    <div class="aufgaben">
      <p class="flyout-notiz aufgaben-summe">
        {offen.length === 0
          ? t('aufgabe.keine_offenen')
          : zeit.minuten === 0
            ? t('aufgabe.summe_ohne_zeit', { n: offen.length })
            : t('aufgabe.summe', { n: offen.length, dauer: formatiereDauer(zeit.minuten) }) +
              (zeit.ohneSchaetzung > 0 ? ` ${t('aufgabe.ohne_schaetzung', { n: zeit.ohneSchaetzung })}` : '')}
      </p>

      {formular ? (
        <NeueAufgabe
          key={formular.teil ?? 'ohne'}
          teil={formular.teil}
          fertig={async () => {
            setzeFormular(null);
            await props.neuLaden();
          }}
          abbrechen={() => setzeFormular(null)}
          melde={setzeFehler}
        />
      ) : (
        <button class="voll-knopf" onClick={() => setzeFormular({ teil: null })}>
          {t('aufgabe.hinzufuegen')}
        </button>
      )}
      {fehler && <p class="feld-fehler">{t('aufgabe.fehler')}</p>}

      <ul class="aufgaben-liste">{offen.map(eintrag)}</ul>

      {erledigt.length > 0 && (
        <>
          <button class="text-knopf" onClick={() => setzeErledigteZeigen(!erledigteZeigen)} aria-expanded={erledigteZeigen}>
            {erledigteZeigen ? t('aufgabe.erledigte_verbergen') : t('aufgabe.erledigte_zeigen', { n: erledigt.length })}
          </button>
          {erledigteZeigen && <ul class="aufgaben-liste erledigte">{erledigt.map(eintrag)}</ul>}
        </>
      )}
    </div>
  );
}
