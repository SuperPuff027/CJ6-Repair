import { useEffect, useState } from 'preact/hooks';
import { db } from '../db/datenbank';
import { planeReparaturpaket } from '../db/reparaturpaket';
import { ladeAktive } from '../db/repo';
import { teilSchluessel } from '../i18n';
import { useSprache } from '../i18n/kontext';
import { ordneMaengelZu, type Zuordnung } from '../logic/maengel';
import type { Reparaturpaket } from '../logic/reparaturpaket';
import { MODELL_TEIL_IDS, type ModellTeilId } from '../szene/modell';
import { PaketVorschau } from './Reparaturpaket';

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
  const [paket, setzePaket] = useState<{ paket: Reparaturpaket; indizes: number[] } | null>(null);

  useEffect(() => {
    ladeZusatzStichwoerter().then(setzeZusatz, (e) => console.error('Bauteile nicht lesbar', e));
  }, []);

  const zuordnen = (e: Event) => {
    e.preventDefault();
    setzePaket(null);
    setzeEintraege(
      ordneMaengelZu(text, zusatz).map((z) => ({ zuordnung: z, teil: z.art === 'eindeutig' ? z.teil : null, aufgabeAngelegt: false })),
    );
  };

  const setzeTeil = (index: number, teil: ModellTeilId | null) => {
    setzePaket(null); // Eine geänderte Zuordnung macht ein vorbereitetes Paket ungültig.
    setzeEintraege((alt) => alt.map((e, i) => (i === index ? { ...e, teil } : e)));
  };

  const paketErstellen = async (indizes: number[]) => {
    setzeFehler(false);
    try {
      const maengel = indizes.map((i) => ({ text: eintraege[i]!.zuordnung.text, teil: eintraege[i]!.teil!, gasgeruch: eintraege[i]!.zuordnung.gasgeruch }));
      setzePaket({ paket: await planeReparaturpaket(maengel), indizes });
    } catch (fehler) {
      console.error('Reparaturpaket nicht erstellt', fehler);
      setzeFehler(true);
    }
  };

  const angelegt = () => {
    const indizes = paket?.indizes ?? [];
    setzeEintraege((alt) => alt.map((e, i) => (indizes.includes(i) ? { ...e, aufgabeAngelegt: true } : e)));
    setzePaket(null);
    props.beiNeuerAufgabe();
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
                {e.aufgabeAngelegt && <p class="mangel-fertig">{t('mangel.aufgabe_angelegt')}</p>}
              </li>
            );
          })}
        </ul>
      )}
      {bereit.length > 0 && !paket && (
        <button class="voll-knopf" onClick={() => paketErstellen(bereit)}>
          {t('paket.erstellen', { n: bereit.length })}
        </button>
      )}
      {paket && <PaketVorschau paket={paket.paket} angelegt={angelegt} verwerfen={() => setzePaket(null)} />}
      {fehler && <p class="feld-fehler">{t('aufgabe.fehler')}</p>}
    </section>
  );
}
