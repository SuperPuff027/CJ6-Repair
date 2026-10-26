import { useEffect, useState } from 'preact/hooks';
import { db } from '../db/datenbank';
import { ladeMessreihen, loescheMessreihe, speichereMessreihe } from '../db/messungen';
import { ladeAktive, ladeFahrzeug } from '../db/repo';
import { useSprache } from '../i18n/kontext';
import { quellenText } from '../logic/anleitung';
import { formatiereDatum, formatiereZahl, lokalesDatum } from '../logic/format';
import {
  bewerte,
  bewerteKompression,
  EINHEITEN,
  MESSGROESSEN,
  messwertEingabe,
  passendeVorgaben,
  type Messgroesse,
  type Messreihe,
  type Urteil,
} from '../logic/messwerte';
import type { Betriebsart, Fahrzeug, Messvorgabe, MotorVariante } from '../model/typen';

const ZYLINDER_WAHL = [4, 6, 8] as const;
const STANDARD_ZYLINDER = 6;

interface Grundlage {
  fahrzeug: Fahrzeug;
  vorgaben: Messvorgabe[];
  motoren: MotorVariante[];
}

function UrteilChip(props: { urteil: Urteil }) {
  const { t } = useSprache();
  if (props.urteil === 'ohne_sollwert') return null;
  return <span class={`urteil ${props.urteil}`}>{t(`urteil.${props.urteil}`)}</span>;
}

export function Messwerte() {
  const { t, sprache } = useSprache();
  const [grundlage, setzeGrundlage] = useState<Grundlage | null>(null);
  const [groesse, setzeGroesse] = useState<Messgroesse>('kompression');
  const [betriebsart, setzeBetriebsart] = useState<Betriebsart>('benzin');
  const [einheit, setzeEinheit] = useState<string>(EINHEITEN.kompression[0]!);
  const [zylinder, setzeZylinder] = useState<number>(STANDARD_ZYLINDER);
  const [eingaben, setzeEingaben] = useState<string[]>([]);
  const [reihen, setzeReihen] = useState<Messreihe[]>([]);
  const [loeschFrage, setzeLoeschFrage] = useState<string | null>(null);
  const [meldung, setzeMeldung] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const [fahrzeug, vorgaben, motoren] = await Promise.all([ladeFahrzeug(), ladeAktive(db.messvorgaben), ladeAktive(db.motor_varianten)]);
      setzeGrundlage({ fahrzeug, vorgaben, motoren });
      // Zylinderzahl vom bestätigten, sonst vom ersten vorgemerkten Motor
      const motorId = fahrzeug.motor_variante_id ?? fahrzeug.motor_vorgemerkt[0];
      const motor = motoren.find((m) => m.id === motorId);
      if (motor) setzeZylinder(motor.zylinder);
    })().catch((e) => console.error('Messgrundlagen nicht lesbar', e));
  }, []);

  const motorIds = grundlage ? (grundlage.fahrzeug.motor_variante_id ? [grundlage.fahrzeug.motor_variante_id] : grundlage.fahrzeug.motor_vorgemerkt) : [];
  const vorgaben = grundlage ? passendeVorgaben(grundlage.vorgaben, groesse, motorIds, betriebsart) : [];
  // Nur eine eindeutige Vorgabe bewertet; bei mehreren vorgemerkten Motoren erst nach der Bestätigung.
  const vorgabe = vorgaben.length === 1 ? vorgaben[0]! : null;
  const jeZylinder = groesse === 'kompression';
  const felder = jeZylinder ? zylinder : 1;
  const werte = Array.from({ length: felder }, (_, i) => messwertEingabe(eingaben[i] ?? ''));
  const vollstaendig = werte.every((w) => w !== null);
  const kompression = jeZylinder && vollstaendig ? bewerteKompression(werte as number[], einheit, vorgabe) : null;
  const bivalent = grundlage?.fahrzeug.kraftstoff === 'bivalent_lpg';

  const laden = () => ladeMessreihen(groesse).then(setzeReihen, (e) => console.error('Messungen nicht lesbar', e));
  useEffect(() => {
    void laden();
    setzeEingaben([]);
    setzeMeldung(null);
    // Einheit der Vorgabe vorschlagen, sonst die Standardeinheit
    setzeEinheit(EINHEITEN[groesse][0]!);
  }, [groesse]);
  useEffect(() => {
    if (vorgabe && EINHEITEN[groesse].includes(vorgabe.einheit)) setzeEinheit(vorgabe.einheit);
  }, [vorgabe?.id]);

  const speichern = async (e: Event) => {
    e.preventDefault();
    if (!vollstaendig) return;
    await speichereMessreihe(
      groesse,
      werte.map((wert, i) => ({ zylinder: jeZylinder ? i + 1 : null, wert: wert! })),
      einheit,
      bivalent ? betriebsart : null,
    );
    setzeEingaben([]);
    setzeMeldung(t('messung.gespeichert'));
    await laden();
  };

  const motorName = (id: string | null) => (id ? (grundlage?.motoren.find((m) => m.id === id)?.name ?? id) : t('messung.alle_motoren'));
  const bereich = (v: Messvorgabe) =>
    v.min !== null && v.max !== null
      ? `${formatiereZahl(v.min, sprache)}–${formatiereZahl(v.max, sprache)} ${v.einheit}`
      : v.min !== null
        ? `≥ ${formatiereZahl(v.min, sprache)} ${v.einheit}`
        : v.max !== null
          ? `≤ ${formatiereZahl(v.max, sprache)} ${v.einheit}`
          : '';

  return (
    <section class="messwerte">
      <form onSubmit={speichern}>
        <div class="feld-reihe">
          <div class="feld">
            <label for="mess-groesse">{t('messung.groesse')}</label>
            <select id="mess-groesse" class="eingabe" value={groesse} onChange={(e) => setzeGroesse(e.currentTarget.value as Messgroesse)}>
              {MESSGROESSEN.map((g) => (
                <option key={g} value={g}>
                  {t(`messgroesse.${g}`)}
                </option>
              ))}
            </select>
          </div>
          {EINHEITEN[groesse].length > 1 ? (
            <div class="feld">
              <label for="mess-einheit">{t('messung.einheit')}</label>
              <select id="mess-einheit" class="eingabe" value={einheit} onChange={(e) => setzeEinheit(e.currentTarget.value)}>
                {EINHEITEN[groesse].map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            (
              <div class="feld">
                <span class="feld-label">{t('messung.einheit')}</span>
                <span class="einheit-fest">{einheit}</span>
              </div>
            )
          )}
        </div>

        {bivalent && (
          <fieldset class="feld prio-wahl">
            <legend>{t('messung.betriebsart')}</legend>
            <div class="segmente">
              {(['benzin', 'gas'] as const).map((b) => (
                <label key={b} class={betriebsart === b ? 'segment gewaehlt' : 'segment'}>
                  <input type="radio" name="mess-betriebsart" value={b} checked={betriebsart === b} onChange={() => setzeBetriebsart(b)} />
                  {t(`betriebsart.${b}`)}
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <div class="sollwert-box">
          {vorgaben.length === 0 ? (
            <p class="feld-hinweis">{t('messung.ohne_vorgabe')}</p>
          ) : (
            <>
              {vorgaben.length > 1 && <p class="feld-hinweis">{t('messung.mehrere_vorgaben')}</p>}
              {vorgaben.map((v) => (
                <p key={v.id} class="vorgabe">
                  <strong>{t('messung.soll')}:</strong> {bereich(v)}
                  {v.max_abweichung_prozent !== null && ` · ${t('messung.max_abweichung', { p: formatiereZahl(v.max_abweichung_prozent, sprache) })}`}
                  {' · '}
                  {motorName(v.motor_variante_id)}
                  {v.hinweis && <span class="vorgabe-hinweis"> · {v.hinweis}</span>}
                  <span class="quelle">
                    {' '}
                    ({t('motor.quelle')}: {quellenText(v.quelle)})
                  </span>
                </p>
              ))}
            </>
          )}
        </div>

        {jeZylinder && (
          <div class="feld">
            <label for="mess-zylinder">{t('messung.zylinderzahl')}</label>
            <select id="mess-zylinder" class="eingabe schmal" value={zylinder} onChange={(e) => setzeZylinder(Number(e.currentTarget.value))}>
              {ZYLINDER_WAHL.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
          </div>
        )}

        <div class={jeZylinder ? 'mess-raster' : 'mess-einzeln'}>
          {Array.from({ length: felder }, (_, i) => {
            const wert = werte[i] ?? null;
            const urteil = wert === null ? null : jeZylinder ? (kompression?.urteile[i] ?? bewerte(wert, einheit, vorgabe)) : bewerte(wert, einheit, vorgabe);
            const schwach = kompression && kompression.schwaechster === i && felder > 1;
            return (
              <div key={i} class={`feld mess-feld${urteil ? ` ${urteil}` : ''}${schwach ? ' schwach' : ''}`}>
                <label for={`mess-wert-${i}`}>{jeZylinder ? t('messung.zylinder_nr', { nr: i + 1 }) : t(`messgroesse.${groesse}`)}</label>
                <input
                  id={`mess-wert-${i}`}
                  class="eingabe"
                  type="text"
                  inputMode="decimal"
                  value={eingaben[i] ?? ''}
                  onInput={(e) => {
                    const neu = [...eingaben];
                    neu[i] = e.currentTarget.value;
                    setzeEingaben(neu);
                    setzeMeldung(null);
                  }}
                  placeholder={einheit}
                />
                {urteil && <UrteilChip urteil={urteil} />}
              </div>
            );
          })}
        </div>

        {kompression && felder > 1 && (
          <p class={kompression.streuungZuGross ? 'feld-fehler' : 'feld-hinweis'}>
            {t('messung.streuung', {
              p: formatiereZahl(kompression.streuungProzent, sprache, 1),
              nr: kompression.schwaechster + 1,
            })}
            {kompression.streuungZuGross && ` ${t('messung.streuung_zu_gross')}`}
          </p>
        )}

        <button type="submit" class="voll-knopf" disabled={!vollstaendig}>
          {t('messung.speichern')}
        </button>
        {meldung && (
          <p class="profil-meldung" role="status">
            {meldung}
          </p>
        )}
      </form>

      <h4 class="detail-titel">{t('messung.verlauf', { groesse: t(`messgroesse.${groesse}`) })}</h4>
      {reihen.length === 0 && <p class="feld-hinweis">{t('messung.kein_verlauf')}</p>}
      <ul class="messreihen">
        {reihen.map((r) => {
          const schluessel = `${r.gemessen_am}|${r.betriebsart}`;
          return (
            <li key={schluessel} class="messreihe">
              <div class="messreihe-kopf">
                <span>{formatiereDatum(lokalesDatum(r.gemessen_am), sprache)}</span>
                {r.betriebsart && <span class="chip">{t(`betriebsart.${r.betriebsart}`)}</span>}
              </div>
              <p class="messreihe-werte">
                {r.werte
                  .map((w) => (w.zylinder ? `${t('messung.zyl_kurz', { nr: w.zylinder })} ${formatiereZahl(w.wert, sprache)}` : formatiereZahl(w.wert, sprache)))
                  .join(' · ')}{' '}
                {r.einheit}
              </p>
              {loeschFrage === schluessel ? (
                <div class="knopf-reihe">
                  <button
                    class="voll-knopf warn"
                    onClick={async () => {
                      setzeLoeschFrage(null);
                      await loescheMessreihe(r);
                      await laden();
                    }}
                  >
                    {t('notiz.wirklich')}
                  </button>
                  <button class="rand-knopf" onClick={() => setzeLoeschFrage(null)}>
                    {t('notiz.abbrechen')}
                  </button>
                </div>
              ) : (
                <button class="text-knopf" onClick={() => setzeLoeschFrage(schluessel)}>
                  {t('notiz.entfernen')}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
