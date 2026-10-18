import { useEffect, useRef, useState } from 'preact/hooks';
import { db } from '../db/datenbank';
import { aendereFahrzeug, ladeFahrzeug, ladeUmbauten, loescheWeich, speichere, type FahrzeugAenderung } from '../db/repo';
import { teilSchluessel } from '../i18n';
import { useSprache } from '../i18n/kontext';
import { neuerDatensatz } from '../logic/datensatz';
import { GAS_TEXTFELDER, jahrFeld, leereGasanlage, textFeld, vinFeld } from '../logic/fahrzeug';
import { formatiereDatum } from '../logic/format';
import type { Fahrzeug, Gasanlage, Kraftstoff, Umbau } from '../model/typen';
import { MODELL_TEIL_IDS, type ModellTeilId } from '../szene/modell';

const MELDUNG_DAUER_MS = 2500;

type Art = 'text' | 'mehrzeilig' | 'jahr' | 'vin';

/**
 * Ein Eingabefeld, das beim Verlassen speichert. Ungültige Jahre werden nicht gespeichert,
 * sondern unter dem Feld erklärt.
 */
function Feld(props: {
  id: string;
  label: string;
  hinweis?: string;
  art?: Art;
  wert: string | number | null;
  speichern: (wert: string | number | null) => void;
}) {
  const { t } = useSprache();
  const [fehler, setzeFehler] = useState<string | null>(null);
  const art = props.art ?? 'text';

  const geaendert = (e: Event) => {
    const element = e.currentTarget as HTMLInputElement | HTMLTextAreaElement;
    if (art === 'jahr') {
      const jahr = jahrFeld(element.value, new Date());
      if (!jahr.ok) return setzeFehler(t('profil.fehler_jahr', { von: jahr.von, bis: jahr.bis }));
      setzeFehler(null);
      return props.speichern(jahr.wert);
    }
    setzeFehler(null);
    const wert = art === 'vin' ? vinFeld(element.value) : textFeld(element.value);
    // Im Feld steht danach, was gespeichert wurde (z. B. VIN in Großbuchstaben).
    if (art !== 'mehrzeilig') element.value = wert ?? '';
    props.speichern(wert);
  };

  const gemeinsam = {
    id: props.id,
    class: 'eingabe',
    defaultValue: props.wert === null ? '' : String(props.wert),
    onChange: geaendert,
    'aria-invalid': fehler ? true : undefined,
    'aria-describedby': fehler || props.hinweis ? `${props.id}-info` : undefined,
  };

  return (
    <div class="feld">
      <label for={props.id}>{props.label}</label>
      {art === 'mehrzeilig' ? (
        <textarea {...gemeinsam} rows={3} />
      ) : (
        <input
          {...gemeinsam}
          type="text"
          inputMode={art === 'jahr' ? 'numeric' : undefined}
          autoCapitalize={art === 'vin' ? 'characters' : undefined}
          spellcheck={art === 'vin' ? false : undefined}
        />
      )}
      {(fehler || props.hinweis) && (
        <p id={`${props.id}-info`} class={fehler ? 'feld-fehler' : 'feld-hinweis'}>
          {fehler ?? props.hinweis}
        </p>
      )}
    </div>
  );
}

const TECHNIK_FELDER = ['getriebe', 'verteilergetriebe', 'achse_vorne', 'achse_hinten', 'vergaser', 'zuendung'] as const;

export function FahrzeugProfil() {
  const { t } = useSprache();
  const [fahrzeug, setzeFahrzeug] = useState<Fahrzeug | null>(null);
  const [umbauten, setzeUmbauten] = useState<Umbau[]>([]);
  const [meldung, setzeMeldung] = useState<string | null>(null);
  const zeitgeber = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    ladeFahrzeug().then(setzeFahrzeug, (fehler) => console.error('Fahrzeug nicht lesbar', fehler));
    ladeUmbauten().then(setzeUmbauten, (fehler) => console.error('Umbauten nicht lesbar', fehler));
    return () => clearTimeout(zeitgeber.current);
  }, []);

  const melde = (text: string) => {
    setzeMeldung(text);
    clearTimeout(zeitgeber.current);
    zeitgeber.current = setTimeout(() => setzeMeldung(null), MELDUNG_DAUER_MS);
  };

  const aendere = async (aenderung: FahrzeugAenderung) => {
    try {
      setzeFahrzeug(await aendereFahrzeug(aenderung));
      melde(t('profil.gespeichert'));
    } catch (fehler) {
      console.error('Fahrzeug nicht gespeichert', fehler);
      melde(t('profil.fehler_speichern'));
    }
  };

  const aendereGas = (feld: keyof Gasanlage, wert: string | number | null) =>
    aendere({ gasanlage: { ...(fahrzeug?.gasanlage ?? leereGasanlage()), [feld]: wert } });

  if (!fahrzeug) return null;

  return (
    <div class="profil">
      <p class="profil-meldung" role="status" aria-live="polite">
        {meldung}
      </p>

      <section class="profil-abschnitt">
        <h3 class="gruppe-titel">{t('profil.abschnitt.fahrzeug')}</h3>
        <Feld id="profil-baujahr" label={t('profil.baujahr')} art="jahr" wert={fahrzeug.baujahr} speichern={(w) => aendere({ baujahr: w as number | null })} />
        <Feld id="profil-vin" label={t('profil.vin')} art="vin" wert={fahrzeug.vin} speichern={(w) => aendere({ vin: w as string | null })} />
        <Feld
          id="profil-schein"
          label={t('profil.fahrzeugschein')}
          hinweis={t('profil.fahrzeugschein_hinweis')}
          art="mehrzeilig"
          wert={fahrzeug.fahrzeugschein_angaben}
          speichern={(w) => aendere({ fahrzeugschein_angaben: w as string | null })}
        />
        <div class="feld">
          <span class="feld-label">{t('profil.motor')}</span>
          <p class="feld-hinweis">{t('profil.motor_offen')}</p>
        </div>
      </section>

      <section class="profil-abschnitt">
        <h3 class="gruppe-titel">{t('profil.abschnitt.technik')}</h3>
        {TECHNIK_FELDER.map((feld) => (
          <Feld key={feld} id={`profil-${feld}`} label={t(`profil.${feld}`)} wert={fahrzeug[feld]} speichern={(w) => aendere({ [feld]: w as string | null })} />
        ))}
        <div class="feld">
          <label for="profil-kraftstoff">{t('profil.kraftstoff')}</label>
          <select
            id="profil-kraftstoff"
            class="eingabe"
            value={fahrzeug.kraftstoff}
            onChange={(e) => aendere({ kraftstoff: e.currentTarget.value as Kraftstoff })}
          >
            <option value="bivalent_lpg">{t('profil.kraftstoff.bivalent_lpg')}</option>
            <option value="benzin">{t('profil.kraftstoff.benzin')}</option>
          </select>
        </div>
      </section>

      {fahrzeug.kraftstoff === 'bivalent_lpg' && (
        <section class="profil-abschnitt">
          <h3 class="gruppe-titel">{t('profil.abschnitt.gas')}</h3>
          {GAS_TEXTFELDER.map((feld) => (
            <Feld key={feld} id={`gas-${feld}`} label={t(`gas.${feld}`)} wert={fahrzeug.gasanlage?.[feld] ?? null} speichern={(w) => aendereGas(feld, w)} />
          ))}
          <Feld
            id="gas-tank_baujahr"
            label={t('gas.tank_baujahr')}
            hinweis={t('gas.tank_baujahr_hinweis')}
            art="jahr"
            wert={fahrzeug.gasanlage?.tank_baujahr ?? null}
            speichern={(w) => aendereGas('tank_baujahr', w)}
          />
        </section>
      )}

      <Umbauten umbauten={umbauten} neuLaden={() => ladeUmbauten().then(setzeUmbauten)} melde={melde} />
    </div>
  );
}

function Umbauten(props: { umbauten: Umbau[]; neuLaden: () => Promise<void>; melde: (text: string) => void }) {
  const { t, sprache } = useSprache();
  const [formularOffen, setzeFormularOffen] = useState(false);
  const [beschreibung, setzeBeschreibung] = useState('');
  const [datum, setzeDatum] = useState('');
  const [teil, setzeTeil] = useState<ModellTeilId | ''>('');
  const [handbuch, setzeHandbuch] = useState(false);
  const [loeschFrage, setzeLoeschFrage] = useState<string | null>(null);

  const zuruecksetzen = () => {
    setzeFormularOffen(false);
    setzeBeschreibung('');
    setzeDatum('');
    setzeTeil('');
    setzeHandbuch(false);
  };

  const anlegen = async (e: Event) => {
    e.preventDefault();
    const text = textFeld(beschreibung);
    if (!text) return;
    try {
      await speichere(
        db.umbauten,
        neuerDatensatz<Umbau>(
          { beschreibung: text, datum: datum || null, bauteil_id: null, modell_teil_id: teil || null, ersetzt_handbuchwert: handbuch },
          new Date(),
        ),
      );
      zuruecksetzen();
      await props.neuLaden();
      props.melde(t('profil.gespeichert'));
    } catch (fehler) {
      console.error('Umbau nicht gespeichert', fehler);
      props.melde(t('profil.fehler_speichern'));
    }
  };

  const entfernen = async (id: string) => {
    setzeLoeschFrage(null);
    await loescheWeich(db.umbauten, id);
    await props.neuLaden();
  };

  return (
    <section class="profil-abschnitt">
      <h3 class="gruppe-titel">{t('profil.abschnitt.umbauten')}</h3>
      {props.umbauten.length === 0 && !formularOffen && <p class="flyout-notiz">{t('umbau.leer')}</p>}

      <ul class="umbau-liste">
        {props.umbauten.map((u) => (
          <li key={u.id} class="umbau">
            <p class="umbau-text">{u.beschreibung}</p>
            <p class="umbau-info">
              {[u.datum ? formatiereDatum(u.datum, sprache) : null, u.modell_teil_id ? t(teilSchluessel(u.modell_teil_id)) : null, u.ersetzt_handbuchwert ? t('umbau.handbuch_kurz') : null]
                .filter(Boolean)
                .join(' · ')}
            </p>
            {loeschFrage === u.id ? (
              <div class="knopf-reihe">
                <button class="voll-knopf warn" onClick={() => entfernen(u.id)}>
                  {t('umbau.wirklich')}
                </button>
                <button class="rand-knopf" onClick={() => setzeLoeschFrage(null)}>
                  {t('umbau.abbrechen')}
                </button>
              </div>
            ) : (
              <button class="text-knopf" onClick={() => setzeLoeschFrage(u.id)}>
                {t('umbau.entfernen')}
              </button>
            )}
          </li>
        ))}
      </ul>

      {formularOffen ? (
        <form class="umbau-formular" onSubmit={anlegen}>
          <div class="feld">
            <label for="umbau-beschreibung">{t('umbau.beschreibung')}</label>
            <textarea
              id="umbau-beschreibung"
              class="eingabe"
              rows={2}
              value={beschreibung}
              onInput={(e) => setzeBeschreibung(e.currentTarget.value)}
              required
            />
          </div>
          <div class="feld">
            <label for="umbau-datum">{t('umbau.datum')}</label>
            <input id="umbau-datum" class="eingabe" type="date" value={datum} onInput={(e) => setzeDatum(e.currentTarget.value)} />
          </div>
          <div class="feld">
            <label for="umbau-teil">{t('umbau.bauteil')}</label>
            <select id="umbau-teil" class="eingabe" value={teil} onChange={(e) => setzeTeil(e.currentTarget.value as ModellTeilId | '')}>
              <option value="">{t('umbau.kein_bauteil')}</option>
              {MODELL_TEIL_IDS.map((id) => (
                <option key={id} value={id}>
                  {t(teilSchluessel(id))}
                </option>
              ))}
            </select>
          </div>
          <label class="haken">
            <input id="umbau-handbuch" type="checkbox" checked={handbuch} onChange={(e) => setzeHandbuch(e.currentTarget.checked)} />
            {t('umbau.handbuch')}
          </label>
          <div class="knopf-reihe">
            <button type="submit" class="voll-knopf" disabled={!textFeld(beschreibung)}>
              {t('umbau.speichern')}
            </button>
            <button type="button" class="rand-knopf" onClick={zuruecksetzen}>
              {t('umbau.abbrechen')}
            </button>
          </div>
        </form>
      ) : (
        <button class="rand-knopf" onClick={() => setzeFormularOffen(true)}>
          {t('umbau.hinzufuegen')}
        </button>
      )}
    </section>
  );
}

