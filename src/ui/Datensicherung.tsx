import { useEffect, useState } from 'preact/hooks';
import { bereiteWiederherstellungVor, erstelleSicherung, stelleWiederHer, type Vorbereitung } from '../db/sicherung';
import { lies, schreibe, SCHLUESSEL } from '../geraet/speicher';
import { useSprache } from '../i18n/kontext';
import { formatiereDatum, formatiereGroesse, lokalesDatum } from '../logic/format';
import { sicherungsDateiname, type WiederherstellungsPlan } from '../logic/sicherung';

type Bereit = { datei: File; adresse: string };

function summe(plan: WiederherstellungsPlan) {
  const z = { neu: 0, aktualisiert: 0, unveraendert: 0, lokalNeuer: 0 };
  for (const t of Object.values(plan.zusammenfassung)) {
    z.neu += t.neu;
    z.aktualisiert += t.aktualisiert;
    z.unveraendert += t.unveraendert;
    z.lokalNeuer += t.lokalNeuer;
  }
  return z;
}

export function Datensicherung() {
  const { t, sprache } = useSprache();
  const [letzte, setzeLetzte] = useState(() => lies(SCHLUESSEL.letzteSicherung));
  const [speicher, setzeSpeicher] = useState<{ dauerhaft: boolean | null; bytes: number | null }>({ dauerhaft: null, bytes: null });
  const [bereit, setzeBereit] = useState<Bereit | null>(null);
  const [arbeitet, setzeArbeitet] = useState(false);
  const [vorbereitung, setzeVorbereitung] = useState<Vorbereitung | null>(null);
  const [fehler, setzeFehler] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const s = navigator.storage;
      const dauerhaft = s?.persisted ? await s.persisted().catch(() => null) : null;
      const schaetzung = s?.estimate ? await s.estimate().catch(() => null) : null;
      setzeSpeicher({ dauerhaft, bytes: schaetzung?.usage ?? null });
    })();
  }, []);
  // Vorschau-Adresse der Datei wieder freigeben
  useEffect(() => () => bereit && URL.revokeObjectURL(bereit.adresse), [bereit]);

  const gesichert = () => {
    const jetzt = new Date().toISOString();
    schreibe(SCHLUESSEL.letzteSicherung, jetzt);
    setzeLetzte(jetzt);
  };

  const erstellen = async () => {
    setzeFehler(null);
    setzeArbeitet(true);
    try {
      const datei = new File([await erstelleSicherung()], sicherungsDateiname(new Date()), { type: 'application/json' });
      setzeBereit({ datei, adresse: URL.createObjectURL(datei) });
    } catch (e) {
      console.error('Sicherung fehlgeschlagen', e);
      setzeFehler(t('sicherung.fehler_erstellen'));
    } finally {
      setzeArbeitet(false);
    }
  };

  // Teilen muss direkt auf einen Tipp folgen (Browser-Regel); deshalb erst vorbereiten, dann teilen.
  const kannTeilen = bereit !== null && typeof navigator.canShare === 'function' && navigator.canShare({ files: [bereit.datei] });
  const teilen = async () => {
    if (!bereit) return;
    try {
      await navigator.share({ files: [bereit.datei], title: bereit.datei.name });
      gesichert();
    } catch (e) {
      if ((e as DOMException).name !== 'AbortError') setzeFehler(t('sicherung.fehler_teilen'));
    }
  };

  const dateiGewaehlt = async (e: Event) => {
    const eingabe = e.currentTarget as HTMLInputElement;
    const datei = eingabe.files?.[0];
    eingabe.value = '';
    if (!datei) return;
    setzeFehler(null);
    setzeArbeitet(true);
    try {
      setzeVorbereitung(await bereiteWiederherstellungVor(await datei.text()));
    } catch (fehler) {
      console.error('Sicherung nicht lesbar', fehler);
      setzeVorbereitung({ ok: false, fehler: 'beschaedigt' });
    } finally {
      setzeArbeitet(false);
    }
  };

  const einspielen = async (plan: WiederherstellungsPlan) => {
    setzeArbeitet(true);
    try {
      await stelleWiederHer(plan);
      // Alle Ansichten mit den eingespielten Daten neu aufbauen
      location.reload();
    } catch (e) {
      console.error('Wiederherstellung fehlgeschlagen', e);
      setzeFehler(t('sicherung.fehler_einspielen'));
      setzeArbeitet(false);
    }
  };


  return (
    <section class="profil-abschnitt sicherung">
      <h3 class="gruppe-titel">{t('sicherung.titel')}</h3>
      <p class="feld-hinweis">
        {letzte ? t('sicherung.letzte', { datum: formatiereDatum(lokalesDatum(letzte), sprache) }) : t('sicherung.noch_keine')}
      </p>
      {speicher.dauerhaft === false && <p class="feld-hinweis">{t('sicherung.nicht_dauerhaft')}</p>}
      {speicher.bytes !== null && <p class="feld-hinweis">{t('sicherung.belegt', { groesse: formatiereGroesse(speicher.bytes, sprache) })}</p>}

      {bereit ? (
        <div class="wissen-kasten">
          <p>{t('sicherung.bereit', { name: bereit.datei.name, groesse: formatiereGroesse(bereit.datei.size, sprache) })}</p>
          <div class="knopf-reihe">
            {kannTeilen && (
              <button class="voll-knopf" onClick={teilen}>
                {t('sicherung.teilen')}
              </button>
            )}
            <a class={kannTeilen ? 'rand-knopf link-knopf' : 'voll-knopf link-knopf'} href={bereit.adresse} download={bereit.datei.name} onClick={gesichert}>
              {t('sicherung.herunterladen')}
            </a>
            <button class="text-knopf" onClick={() => setzeBereit(null)}>
              {t('sicherung.fertig')}
            </button>
          </div>
        </div>
      ) : (
        <button class="voll-knopf" onClick={erstellen} disabled={arbeitet}>
          {t('sicherung.erstellen')}
        </button>
      )}

      <h4 class="detail-titel">{t('sicherung.einspielen_titel')}</h4>
      {vorbereitung?.ok ? (
        (() => {
          const z = summe(vorbereitung.plan);
          return (
            <div class="wissen-kasten">
              <p>{t('sicherung.vom', { datum: vorbereitung.erstellt_am ? formatiereDatum(lokalesDatum(vorbereitung.erstellt_am), sprache) : '?' })}</p>
              <p class="feld-hinweis">{t('sicherung.zusammenfassung', z)}</p>
              {z.lokalNeuer > 0 && <p class="feld-hinweis">{t('sicherung.lokal_neuer', { n: z.lokalNeuer })}</p>}
              <div class="knopf-reihe">
                <button class="voll-knopf" disabled={arbeitet || z.neu + z.aktualisiert === 0} onClick={() => einspielen(vorbereitung.plan)}>
                  {t('sicherung.einspielen')}
                </button>
                <button class="rand-knopf" onClick={() => setzeVorbereitung(null)}>
                  {t('sicherung.abbrechen')}
                </button>
              </div>
            </div>
          );
        })()
      ) : (
        <>
          {vorbereitung && !vorbereitung.ok && <p class="feld-fehler">{t(`sicherung.datei.${vorbereitung.fehler}`)}</p>}
          <p class="feld-hinweis">{t('sicherung.einspielen_hinweis')}</p>
          <label class="rand-knopf datei-knopf">
            {t('sicherung.datei_waehlen')}
            <input id="sicherung-datei" type="file" accept=".json,application/json" onChange={dateiGewaehlt} disabled={arbeitet} />
          </label>
        </>
      )}
      {fehler && <p class="feld-fehler">{fehler}</p>}
    </section>
  );
}
