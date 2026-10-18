import { useEffect, useState } from 'preact/hooks';
import { db } from '../db/datenbank';
import { ladeAktive, type FahrzeugAenderung } from '../db/repo';
import { importiereMotorStartdaten } from '../db/wissensbasis';
import type { Schluessel } from '../i18n';
import { useSprache } from '../i18n/kontext';
import { hubraumLiter, textFeld } from '../logic/fahrzeug';
import { formatiereZahl } from '../logic/format';
import { baugleicheMoeglich, bewerteMotoren, kannBestaetigen, vormerkenUmschalten, type Bewertung } from '../logic/motorerkennung';
import type { Fahrzeug, MotorBestaetigung, MotorVariante } from '../model/typen';
import { FotoAblage } from './FotoAblage';

const NACHWEISE: readonly MotorBestaetigung[] = ['motorcode', 'vin', 'gussnummer'];
const ZYLINDER = [4, 6, 8] as const;

/** Mehrere Adressen in einer Quellenangabe sind durch Kommas getrennt. */
function quellenLinks(stelle: string | null): string[] {
  return (stelle ?? '').split(',').map((s) => s.trim()).filter((s) => /^https:\/\//.test(s));
}

export function MotorErkennung(props: { fahrzeug: Fahrzeug; aendere: (aenderung: FahrzeugAenderung) => Promise<void> }) {
  const { t, sprache } = useSprache();
  const { fahrzeug } = props;
  const [offen, setzeOffen] = useState(false);
  const [varianten, setzeVarianten] = useState<MotorVariante[] | null>(null);
  const [ladeFehler, setzeLadeFehler] = useState(false);
  const [zylinder, setzeZylinder] = useState<number | null>(null);
  const [hubraum, setzeHubraum] = useState('');

  const ladeVarianten = () => ladeAktive(db.motor_varianten).then(setzeVarianten, (e) => console.error('Motoren nicht lesbar', e));
  useEffect(() => {
    void ladeVarianten();
  }, []);

  const bestaetigt = varianten?.find((v) => v.id === fahrzeug.motor_variante_id);
  const vorgemerkt = (varianten ?? []).filter((v) => fahrzeug.motor_vorgemerkt.includes(v.id));

  const startdatenLaden = async () => {
    setzeLadeFehler(false);
    try {
      await importiereMotorStartdaten();
      await ladeVarianten();
    } catch (fehler) {
      console.error('Motordaten nicht geladen', fehler);
      setzeLadeFehler(true);
    }
  };

  const bewertungen = varianten
    ? bewerteMotoren(varianten, {
        zylinder,
        hubraum_l: hubraumLiter(hubraum),
        baujahr: fahrzeug.baujahr,
        motorcode: fahrzeug.motorcode,
        vin: fahrzeug.vin,
      })
    : [];
  const moeglich = bewertungen.filter((b) => !b.ausgeschlossen);
  const ausgeschlossen = bewertungen.filter((b) => b.ausgeschlossen);

  const bestaetige = async (b: Bewertung, durch: MotorBestaetigung) => {
    await props.aendere({ motor_variante_id: b.variante.id, motor_bestaetigt_durch: durch });
    setzeOffen(false);
  };

  return (
    <div class="feld motor">
      <span class="feld-label">{t('profil.motor')}</span>
      <p class={bestaetigt ? 'motor-status bestaetigt' : 'feld-hinweis'}>
        {bestaetigt && fahrzeug.motor_bestaetigt_durch
          ? t('motor.bestaetigt', { name: bestaetigt.name, nachweis: t(`nachweis.${fahrzeug.motor_bestaetigt_durch}`) })
          : vorgemerkt.length > 0
            ? t('motor.vorgemerkt', { namen: vorgemerkt.map((v) => v.name).join(', ') })
            : t('motor.nicht_bestaetigt')}
      </p>
      {!offen && (
        <button class="rand-knopf" onClick={() => setzeOffen(true)}>
          {bestaetigt ? t('motor.aendern') : t('motor.erkennen')}
        </button>
      )}

      {offen && (
        <div class="motor-panel">
          {varianten && varianten.length === 0 ? (
            <>
              <p class="flyout-notiz">{t('motor.keine_daten')}</p>
              {ladeFehler && <p class="feld-fehler">{t('motor.daten_fehler')}</p>}
              <button class="voll-knopf" onClick={startdatenLaden}>
                {t('motor.daten_laden')}
              </button>
            </>
          ) : (
            <>
              <div class="feld">
                <label for="motor-code">{t('motor.motorcode')}</label>
                <input
                  id="motor-code"
                  class="eingabe"
                  type="text"
                  autoCapitalize="characters"
                  spellcheck={false}
                  defaultValue={fahrzeug.motorcode ?? ''}
                  onChange={(e) => {
                    const wert = textFeld(e.currentTarget.value)?.toUpperCase().replace(/\s/g, '') ?? null;
                    e.currentTarget.value = wert ?? '';
                    void props.aendere({ motorcode: wert });
                  }}
                  aria-describedby="motor-code-info"
                />
                <p id="motor-code-info" class="feld-hinweis">
                  {t('motor.motorcode_hinweis')}
                </p>
              </div>
              <div class="feld-reihe">
                <div class="feld">
                  <label for="motor-zylinder">{t('motor.zylinder')}</label>
                  <select
                    id="motor-zylinder"
                    class="eingabe"
                    value={zylinder ?? ''}
                    onChange={(e) => setzeZylinder(e.currentTarget.value ? Number(e.currentTarget.value) : null)}
                  >
                    <option value="">{t('motor.unbekannt')}</option>
                    {ZYLINDER.map((z) => (
                      <option key={z} value={z}>
                        {z}
                      </option>
                    ))}
                  </select>
                </div>
                <div class="feld">
                  <label for="motor-hubraum">{t('motor.hubraum')}</label>
                  <input
                    id="motor-hubraum"
                    class="eingabe"
                    type="text"
                    inputMode="decimal"
                    value={hubraum}
                    onInput={(e) => setzeHubraum(e.currentTarget.value)}
                    placeholder={t('motor.hubraum_hinweis')}
                  />
                </div>
              </div>
              <p class="feld-hinweis">
                {t('motor.aus_profil', { baujahr: fahrzeug.baujahr ?? t('motor.fehlt'), vin: fahrzeug.vin ?? t('motor.fehlt') })}
              </p>

              <h4 class="motor-titel">{t('motor.fotos')}</h4>
              <FotoAblage art="fahrzeug" id="motor" hinweis={t('motor.fotos_hinweis')} />

              <h4 class="motor-titel">{t('motor.kandidaten')}</h4>
              <p class="feld-hinweis">{t('motor.grenze')}</p>
              {moeglich.length === 0 && <p class="flyout-notiz">{t('motor.keine_kandidaten')}</p>}
              <ul class="kandidaten">
                {moeglich.map((b) => (
                  <li key={b.variante.id} class="kandidat">
                    <div class="kandidat-kopf">
                      <span class="kandidat-name">{b.variante.name}</span>
                      <span class={`sicherheit ${b.sicherheit}`}>{t(`sicherheit.${b.sicherheit}`)}</span>
                    </div>
                    <p class="feld-hinweis">
                      {t('motor.daten', {
                        bauart: b.variante.bauart,
                        hubraum: formatiereZahl(b.variante.hubraum_l, sprache),
                        zylinder: b.variante.zylinder,
                      })}
                    </p>
                    <ul class="gruende">
                      {b.gruende.map((g) => (
                        <li key={g.code} class={`grund ${g.art}`}>
                          {t(`grund.${g.code}` as Schluessel)}
                        </li>
                      ))}
                    </ul>
                    {b.variante.erkennungsmerkmale.length > 0 && (
                      <ul class="merkmale">
                        {b.variante.erkennungsmerkmale.map((m) => (
                          <li key={m}>{m}</li>
                        ))}
                      </ul>
                    )}
                    <p class="quelle">
                      {t('motor.quelle')}: {b.variante.quelle.dokument}{' '}
                      {quellenLinks(b.variante.quelle.stelle).map((url, i) => (
                        <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                          [{i + 1}]
                        </a>
                      ))}
                    </p>
                    <label class="haken">
                      <input
                        id={`vormerken-${b.variante.id}`}
                        type="checkbox"
                        checked={fahrzeug.motor_vorgemerkt.includes(b.variante.id)}
                        onChange={() => props.aendere({ motor_vorgemerkt: vormerkenUmschalten(fahrzeug.motor_vorgemerkt, b.variante.id) })}
                      />
                      {t('motor.vormerken')}
                    </label>
                    <p class="feld-hinweis">{t('motor.bestaetigen_per')}</p>
                    <div class="knopf-reihe">
                      {NACHWEISE.map((n) => (
                        <button key={n} class="rand-knopf" disabled={!kannBestaetigen(b, n, bewertungen)} onClick={() => bestaetige(b, n)}>
                          {t(`nachweis.${n}`)}
                        </button>
                      ))}
                    </div>
                    {baugleicheMoeglich(b, bewertungen) && <p class="feld-hinweis">{t('motor.guss_gesperrt')}</p>}
                  </li>
                ))}
              </ul>
              {ausgeschlossen.length > 0 && (
                <p class="feld-hinweis">{t('motor.ausgeschlossen', { namen: ausgeschlossen.map((b) => b.variante.name).join(', ') })}</p>
              )}
            </>
          )}
          <button class="text-knopf" onClick={() => setzeOffen(false)}>
            {t('motor.schliessen')}
          </button>
        </div>
      )}
    </div>
  );
}
