import { useEffect, useState } from 'preact/hooks';
import { fuehreWissensbasisImportAus, planeWissensbasisImport, zaehleWissensbasis, type WissensbasisUmfang } from '../db/wissensbasis';
import { pruefSchluessel, tabellenSchluessel } from '../i18n';
import { useSprache } from '../i18n/kontext';
import { leseWissensbasis, WISSENSBASIS_TABELLEN, type ImportPlan, type PruefFehler } from '../logic/wissensbasis';

/** So viele Prüffehler werden einzeln gezeigt; der Rest als Anzahl. */
const MAX_FEHLER = 8;

type Zustand =
  | { art: 'ruhe'; meldung: 'fertig' | 'nichts_neu' | 'fehler_lesen' | 'fehler_speichern' | null }
  | { art: 'vorschau'; plan: ImportPlan }
  | { art: 'fehler'; fehler: PruefFehler[] };

export function WissensbasisImport(props: { beiImport?: () => void }) {
  const { t } = useSprache();
  const [umfang, setzeUmfang] = useState<WissensbasisUmfang | null>(null);
  const [zustand, setzeZustand] = useState<Zustand>({ art: 'ruhe', meldung: null });

  const aktualisiereUmfang = () => {
    zaehleWissensbasis().then(setzeUmfang, (fehler) => console.error('Wissensbasis nicht lesbar', fehler));
  };
  useEffect(aktualisiereUmfang, []);

  const dateiGewaehlt = async (e: Event) => {
    const eingabe = e.currentTarget as HTMLInputElement;
    const datei = eingabe.files?.[0];
    eingabe.value = ''; // dieselbe Datei nach dem Korrigieren erneut wählen können
    if (!datei) return;
    try {
      const ergebnis = leseWissensbasis(await datei.text());
      if (!ergebnis.ok) return setzeZustand({ art: 'fehler', fehler: ergebnis.fehler });
      const plan = await planeWissensbasisImport(ergebnis.daten);
      const aenderungen = Object.values(plan.schreiben).flat().length;
      setzeZustand(aenderungen ? { art: 'vorschau', plan } : { art: 'ruhe', meldung: 'nichts_neu' });
    } catch (fehler) {
      console.error('Wissensbasis-Datei nicht lesbar', fehler);
      setzeZustand({ art: 'ruhe', meldung: 'fehler_lesen' });
    }
  };

  const importieren = async (plan: ImportPlan) => {
    try {
      await fuehreWissensbasisImportAus(plan);
      setzeZustand({ art: 'ruhe', meldung: 'fertig' });
      aktualisiereUmfang();
      props.beiImport?.();
    } catch (fehler) {
      console.error('Wissensbasis-Import fehlgeschlagen', fehler);
      setzeZustand({ art: 'ruhe', meldung: 'fehler_speichern' });
    }
  };

  const leer = umfang && umfang.bauteile + umfang.anleitungen + umfang.symptome === 0;

  return (
    <section class="wissen">
      <h3 class="gruppe-titel">{t('wissen.titel')}</h3>
      {umfang && <p class="flyout-notiz">{leer ? t('wissen.leer') : t('wissen.umfang', { ...umfang })}</p>}

      {zustand.art === 'ruhe' && (
        <>
          {zustand.meldung && <p class="wissen-meldung" role="status">{t(`wissen.${zustand.meldung}`)}</p>}
          <label class="rand-knopf datei-knopf">
            {t('wissen.datei_waehlen')}
            <input id="wissensbasis-datei" type="file" accept=".json,application/json" onChange={dateiGewaehlt} />
          </label>
        </>
      )}

      {zustand.art === 'vorschau' && (
        <div class="wissen-kasten">
          <p>{t('wissen.vorschau')}</p>
          <dl class="wissen-liste">
            {WISSENSBASIS_TABELLEN.map((tabelle) => {
              const z = zustand.plan.zusammenfassung[tabelle];
              if (z.neu + z.geaendert + z.entfernt + z.unveraendert === 0) return null;
              return (
                <div key={tabelle}>
                  <dt>{t(tabellenSchluessel(tabelle))}</dt>
                  <dd>{t('wissen.zeile', { ...z })}</dd>
                </div>
              );
            })}
          </dl>
          <div class="knopf-reihe">
            <button class="voll-knopf" onClick={() => importieren(zustand.plan)}>
              {t('wissen.importieren')}
            </button>
            <button class="rand-knopf" onClick={() => setzeZustand({ art: 'ruhe', meldung: null })}>
              {t('wissen.abbrechen')}
            </button>
          </div>
        </div>
      )}

      {zustand.art === 'fehler' && (
        <div class="wissen-kasten wissen-fehler" role="alert">
          <p>{t('wissen.fehler_titel')}</p>
          <ul>
            {zustand.fehler.slice(0, MAX_FEHLER).map((f, i) => (
              <li key={i}>{t(pruefSchluessel(f.code), { pfad: f.pfad })}</li>
            ))}
          </ul>
          {zustand.fehler.length > MAX_FEHLER && <p>{t('wissen.weitere_fehler', { n: zustand.fehler.length - MAX_FEHLER })}</p>}
          <button class="rand-knopf" onClick={() => setzeZustand({ art: 'ruhe', meldung: null })}>
            {t('wissen.abbrechen')}
          </button>
        </div>
      )}
    </section>
  );
}
