import { useEffect, useState } from 'preact/hooks';
import { useSprache } from '../i18n/kontext';
import { einheitenVon, KATEGORIE_LISTE, leseZahlOderBruch, rechne, SAE_WEITEN, schluesselweite, type Kategorie } from '../logic/einheiten';
import { formatiereZahl } from '../logic/format';

const KREUZ = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);
const TAUSCH = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M7 4v16M7 20l-3-3M7 20l3-3M17 20V4M17 4l-3 3M17 4l3 3" />
  </svg>
);

/** Rechner für US/SAE ↔ metrisch und Schlüsselweiten; über den ganzen Bildschirm. */
export function Umrechner(props: { schliessen: () => void }) {
  const { t, sprache } = useSprache();
  const [kategorie, setzeKategorie] = useState<Kategorie>('drehmoment');
  const [von, setzeVon] = useState('ft-lb');
  const [nach, setzeNach] = useState('Nm');
  const [eingabe, setzeEingabe] = useState('');
  const [zoll, setzeZoll] = useState('');

  useEffect(() => {
    const beiTaste = (e: KeyboardEvent) => {
      if (e.key === 'Escape') props.schliessen();
    };
    addEventListener('keydown', beiTaste);
    return () => removeEventListener('keydown', beiTaste);
  }, []);

  const waehleKategorie = (k: Kategorie) => {
    const [a, b] = einheitenVon(k);
    setzeKategorie(k);
    // Standard: US-Einheit → metrisch, wenn die Kategorie eine hat
    const us = einheitenVon(k).find((e) => ['ft-lb', 'psi', 'in', '°F', 'gal', 'ci', 'lb', 'mph', 'mpg'].includes(e));
    setzeVon(us ?? a!);
    setzeNach(us === a ? b! : a!);
  };

  const wert = leseZahlOderBruch(eingabe);
  const ergebnis = wert === null ? null : rechne(wert, kategorie, von, nach);
  const zollWert = leseZahlOderBruch(zoll);
  const weite = zollWert !== null && zollWert > 0 ? schluesselweite(zollWert) : null;
  const zahl = (x: number, stellen = 2) => formatiereZahl(x, sprache, stellen);

  return (
    <div class="anleitung rechner" role="dialog" aria-modal="true" aria-labelledby="rechner-titel">
      <header class="anleitung-kopf">
        <h2 id="rechner-titel" class="anleitung-titel">
          {t('rechner.titel')}
        </h2>
        <button class="rund-knopf" onClick={props.schliessen} aria-label={t('rechner.schliessen')}>
          {KREUZ}
        </button>
      </header>

      <div class="anleitung-inhalt">
        <section>
          <div class="kategorien" role="group" aria-label={t('rechner.kategorie')}>
            {KATEGORIE_LISTE.map((k) => (
              <button key={k} class={k === kategorie ? 'chip-knopf gewaehlt' : 'chip-knopf'} aria-pressed={k === kategorie} onClick={() => waehleKategorie(k)}>
                {t(`kategorie.${k}`)}
              </button>
            ))}
          </div>

          <div class="rechner-zeile">
            <div class="feld">
              <label for="rechner-wert">{t('rechner.wert')}</label>
              <input
                id="rechner-wert"
                class="eingabe rechner-eingabe"
                type="text"
                inputMode="decimal"
                value={eingabe}
                onInput={(e) => setzeEingabe(e.currentTarget.value)}
                aria-invalid={eingabe.trim() !== '' && wert === null ? true : undefined}
              />
            </div>
            <div class="feld">
              <label for="rechner-von">{t('rechner.von')}</label>
              <select id="rechner-von" class="eingabe" value={von} onChange={(e) => setzeVon(e.currentTarget.value)}>
                {einheitenVon(kategorie).map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
            <button
              class="rund-knopf rechner-tausch"
              onClick={() => {
                setzeVon(nach);
                setzeNach(von);
              }}
              aria-label={t('rechner.tauschen')}
            >
              {TAUSCH}
            </button>
            <div class="feld">
              <label for="rechner-nach">{t('rechner.nach')}</label>
              <select id="rechner-nach" class="eingabe" value={nach} onChange={(e) => setzeNach(e.currentTarget.value)}>
                {einheitenVon(kategorie).map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <p class="rechner-ergebnis" aria-live="polite">
            {ergebnis !== null ? (
              <>
                {zahl(wert!, 4)} {von} = <strong>{zahl(ergebnis)}</strong> {nach}
              </>
            ) : eingabe.trim() ? (
              <span class="feld-fehler">{t('rechner.ungueltig')}</span>
            ) : (
              <span class="feld-hinweis">{t('rechner.hinweis')}</span>
            )}
          </p>
        </section>

        <section>
          <h3 class="gruppe-titel">{t('schluessel.titel')}</h3>
          <div class="feld">
            <label for="schluessel-zoll">{t('schluessel.eingabe')}</label>
            <input
              id="schluessel-zoll"
              class="eingabe rechner-eingabe"
              type="text"
              inputMode="text"
              value={zoll}
              onInput={(e) => setzeZoll(e.currentTarget.value)}
              placeholder="9/16"
            />
          </div>
          {weite && (
            <div class="rechner-ergebnis" aria-live="polite">
              <p>
                {zoll.trim()}" = <strong>{zahl(weite.mm)} mm</strong>
              </p>
              {weite.darunter && <p class="feld-hinweis">{t('schluessel.darunter', { mm: weite.darunter.mm, d: zahl(weite.darunter.differenz) })}</p>}
              {weite.darueber && <p class="feld-hinweis">{t('schluessel.darueber', { mm: weite.darueber.mm, d: zahl(weite.darueber.differenz) })}</p>}
            </div>
          )}
          <table class="schluessel-tabelle">
            <caption>{t('schluessel.tabelle')}</caption>
            <thead>
              <tr>
                <th scope="col">{t('schluessel.zoll')}</th>
                <th scope="col">mm</th>
                <th scope="col">{t('schluessel.naechster')}</th>
              </tr>
            </thead>
            <tbody>
              {SAE_WEITEN.map((w) => {
                const s = schluesselweite(leseZahlOderBruch(w)!);
                const naechster =
                  s.darunter && (!s.darueber || s.darunter.differenz <= s.darueber.differenz) ? s.darunter.mm : (s.darueber?.mm ?? null);
                return (
                  <tr key={w} onClick={() => setzeZoll(w)}>
                    <td>{w}"</td>
                    <td>{zahl(s.mm)}</td>
                    <td>{naechster ?? '–'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
