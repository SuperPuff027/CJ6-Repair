import { useEffect, useState } from 'preact/hooks';
import { db } from '../db/datenbank';
import { ladeAktive, speichere } from '../db/repo';
import { teilSchluessel } from '../i18n';
import { useSprache } from '../i18n/kontext';
import { vorgeschlagenePrioritaet } from '../logic/aufgaben';
import { neuerDatensatz } from '../logic/datensatz';
import { ordneMaengelZu, type Zuordnung } from '../logic/maengel';
import type { Aufgabe } from '../model/typen';
import { MODELL_TEIL_IDS, type ModellTeilId } from '../szene/modell';

interface Eintrag {
  zuordnung: Zuordnung;
  /** Vom Nutzer gewählt (Rückfrage oder unbekannt) oder eindeutig erkannt */
  teil: ModellTeilId | null;
  aufgabeAngelegt: boolean;
}

/** Stichwörter aus den Bauteilen der Wissensbasis, je Modellteil. */
async function ladeZusatzStichwoerter(): Promise<Partial<Record<ModellTeilId, string[]>>> {
  const zusatz: Partial<Record<ModellTeilId, string[]>> = {};
  for (const b of await ladeAktive(db.bauteile)) {
    if (!b.modell_teil_id) continue;
    (zusatz[b.modell_teil_id] ??= []).push(b.name, ...b.stichwoerter);
  }
  return zusatz;
}

export function Maengel(props: { waehle: (id: ModellTeilId) => void; beiNeuerAufgabe: () => void }) {
  const { t } = useSprache();
  const [text, setzeText] = useState('');
  const [eintraege, setzeEintraege] = useState<Eintrag[]>([]);
  const [zusatz, setzeZusatz] = useState<Partial<Record<ModellTeilId, string[]>>>({});
  const [fehler, setzeFehler] = useState(false);

  useEffect(() => {
    ladeZusatzStichwoerter().then(setzeZusatz, (e) => console.error('Bauteile nicht lesbar', e));
  }, []);

  const zuordnen = (e: Event) => {
    e.preventDefault();
    setzeEintraege(
      ordneMaengelZu(text, zusatz).map((z) => ({ zuordnung: z, teil: z.art === 'eindeutig' ? z.teil : null, aufgabeAngelegt: false })),
    );
  };

  const setzeTeil = (index: number, teil: ModellTeilId | null) =>
    setzeEintraege((alt) => alt.map((e, i) => (i === index ? { ...e, teil } : e)));

  const alsAufgabe = async (indizes: number[]) => {
    setzeFehler(false);
    try {
      for (const i of indizes) {
        const e = eintraege[i]!;
        await speichere(
          db.aufgaben,
          neuerDatensatz<Aufgabe>(
            {
              titel: e.zuordnung.text,
              bauteil_id: null,
              modell_teil_id: e.teil,
              anleitung_id: null,
              mangel_text: e.zuordnung.text,
              prioritaet: e.zuordnung.gasgeruch ? 'sicherheit' : vorgeschlagenePrioritaet(e.teil),
              geschaetzt_min: null,
              status: 'offen',
              erledigt_am: null,
            },
            new Date(),
          ),
        );
      }
      setzeEintraege((alt) => alt.map((e, i) => (indizes.includes(i) ? { ...e, aufgabeAngelegt: true } : e)));
      props.beiNeuerAufgabe();
    } catch (fehler) {
      console.error('Aufgabe nicht gespeichert', fehler);
      setzeFehler(true);
    }
  };

  const bereit = eintraege.map((e, i) => (e.teil && !e.aufgabeAngelegt ? i : -1)).filter((i) => i >= 0);
  const gasgeruch = eintraege.some((e) => e.zuordnung.gasgeruch);

  return (
    <section class="maengel">
      <form onSubmit={zuordnen}>
        <div class="feld">
          <label for="maengel-text">{t('mangel.eingabe')}</label>
          <textarea
            id="maengel-text"
            class="eingabe"
            rows={4}
            value={text}
            onInput={(e) => setzeText(e.currentTarget.value)}
            placeholder={t('mangel.platzhalter')}
            aria-describedby="maengel-info"
          />
          <p id="maengel-info" class="feld-hinweis">
            {t('mangel.hinweis')}
          </p>
        </div>
        <button type="submit" class="voll-knopf" disabled={!text.trim()}>
          {t('mangel.zuordnen')}
        </button>
      </form>

      {gasgeruch && (
        <div class="gefahr" role="alert">
          <p class="gefahr-titel">{t('mangel.gas_titel')}</p>
          <p>{t('mangel.gas_text')}</p>
        </div>
      )}

      {eintraege.length > 0 && (
        <ul class="mangel-liste">
          {eintraege.map((e, i) => {
            const z = e.zuordnung;
            return (
              <li key={i} class="mangel">
                <p class="mangel-text">{z.text}</p>
                {e.teil ? (
                  <div class="aufgabe-chips">
                    <button class="chip teil-link" onClick={() => props.waehle(e.teil!)}>
                      {t(teilSchluessel(e.teil))}
                    </button>
                    {z.art !== 'eindeutig' && !e.aufgabeAngelegt && (
                      <button class="text-knopf" onClick={() => setzeTeil(i, null)}>
                        {t('mangel.anders')}
                      </button>
                    )}
                  </div>
                ) : z.art === 'rueckfrage' ? (
                  <>
                    <p class="feld-hinweis">{z.grund === 'lage' ? t('mangel.frage_lage') : t('mangel.frage_teil')}</p>
                    <div class="knopf-reihe">
                      {z.optionen.map((o) => (
                        <button key={o} class="rand-knopf" onClick={() => setzeTeil(i, o)}>
                          {t(teilSchluessel(o))}
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <div class="feld">
                    <label for={`mangel-teil-${i}`} class="feld-hinweis">
                      {t('mangel.unbekannt')}
                    </label>
                    <select
                      id={`mangel-teil-${i}`}
                      class="eingabe"
                      value=""
                      onChange={(ev) => ev.currentTarget.value && setzeTeil(i, ev.currentTarget.value as ModellTeilId)}
                    >
                      <option value="">{t('mangel.teil_waehlen')}</option>
                      {MODELL_TEIL_IDS.map((id) => (
                        <option key={id} value={id}>
                          {t(teilSchluessel(id))}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {e.aufgabeAngelegt ? (
                  <p class="mangel-fertig">{t('mangel.aufgabe_angelegt')}</p>
                ) : (
                  e.teil && (
                    <button class="rand-knopf" onClick={() => alsAufgabe([i])}>
                      {t('mangel.als_aufgabe')}
                    </button>
                  )
                )}
              </li>
            );
          })}
        </ul>
      )}
      {bereit.length > 1 && (
        <button class="voll-knopf" onClick={() => alsAufgabe(bereit)}>
          {t('mangel.alle_als_aufgaben', { n: bereit.length })}
        </button>
      )}
      {fehler && <p class="feld-fehler">{t('aufgabe.fehler')}</p>}
    </section>
  );
}
