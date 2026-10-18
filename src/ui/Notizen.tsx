import { useEffect, useState } from 'preact/hooks';
import { db } from '../db/datenbank';
import { ladeNotizen, loescheWeich, speichere } from '../db/repo';
import { useSprache } from '../i18n/kontext';
import { neuerDatensatz } from '../logic/datensatz';
import { formatiereDatum, lokalesDatum } from '../logic/format';
import type { BezugArt, Notiz } from '../model/typen';

/** Notizen zu einem Bezug (z. B. einem Modellteil): anlegen, bearbeiten, entfernen. */
export function Notizen(props: { art: BezugArt; id: string; beiAenderung?: () => void }) {
  const { t, sprache } = useSprache();
  const [notizen, setzeNotizen] = useState<Notiz[]>([]);
  const [neu, setzeNeu] = useState('');
  const [bearbeitet, setzeBearbeitet] = useState<{ id: string; text: string } | null>(null);
  const [loeschFrage, setzeLoeschFrage] = useState<string | null>(null);
  const [fehler, setzeFehler] = useState(false);

  const laden = () => ladeNotizen(props.art, props.id).then(setzeNotizen, (e) => console.error('Notizen nicht lesbar', e));
  useEffect(() => {
    void laden();
    setzeNeu('');
    setzeBearbeitet(null);
    setzeLoeschFrage(null);
  }, [props.art, props.id]);

  /** Speichert, lädt neu und meldet die Änderung (z. B. für die Zähler in der Teileliste). */
  const ausfuehren = async (aktion: () => Promise<unknown>) => {
    setzeFehler(false);
    try {
      await aktion();
      await laden();
      props.beiAenderung?.();
      return true;
    } catch (e) {
      console.error('Notiz nicht gespeichert', e);
      setzeFehler(true);
      return false;
    }
  };

  const anlegen = async (e: Event) => {
    e.preventDefault();
    const text = neu.trim();
    if (!text) return;
    const ok = await ausfuehren(() => speichere(db.notizen, neuerDatensatz<Notiz>({ bezug_art: props.art, bezug_id: props.id, text }, new Date())));
    if (ok) setzeNeu('');
  };

  const aendern = async (notiz: Notiz) => {
    const text = bearbeitet?.text.trim();
    if (!text) return;
    if (await ausfuehren(() => speichere(db.notizen, { ...notiz, text }))) setzeBearbeitet(null);
  };

  const entfernen = (id: string) => {
    setzeLoeschFrage(null);
    void ausfuehren(() => loescheWeich(db.notizen, id));
  };

  return (
    <div class="notizen">
      {notizen.length === 0 && <p class="feld-hinweis">{t('notiz.leer')}</p>}
      <ul class="notiz-liste">
        {notizen.map((n) => (
          <li key={n.id} class="notiz">
            {bearbeitet?.id === n.id ? (
              <>
                <textarea
                  id={`notiz-bearbeiten-${n.id}`}
                  class="eingabe"
                  rows={3}
                  value={bearbeitet.text}
                  onInput={(e) => setzeBearbeitet({ id: n.id, text: e.currentTarget.value })}
                  aria-label={t('notiz.bearbeiten')}
                />
                <div class="knopf-reihe">
                  <button class="voll-knopf" disabled={!bearbeitet.text.trim()} onClick={() => aendern(n)}>
                    {t('notiz.aendern')}
                  </button>
                  <button class="rand-knopf" onClick={() => setzeBearbeitet(null)}>
                    {t('notiz.abbrechen')}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p class="notiz-text">{n.text}</p>
                <p class="notiz-info">{formatiereDatum(lokalesDatum(n.aktualisiert_am), sprache)}</p>
                {loeschFrage === n.id ? (
                  <div class="knopf-reihe">
                    <button class="voll-knopf warn" onClick={() => entfernen(n.id)}>
                      {t('notiz.wirklich')}
                    </button>
                    <button class="rand-knopf" onClick={() => setzeLoeschFrage(null)}>
                      {t('notiz.abbrechen')}
                    </button>
                  </div>
                ) : (
                  <div class="notiz-aktionen">
                    <button class="text-knopf" onClick={() => setzeBearbeitet({ id: n.id, text: n.text })}>
                      {t('notiz.bearbeiten')}
                    </button>
                    <button class="text-knopf" onClick={() => setzeLoeschFrage(n.id)}>
                      {t('notiz.entfernen')}
                    </button>
                  </div>
                )}
              </>
            )}
          </li>
        ))}
      </ul>
      <form class="notiz-neu" onSubmit={anlegen}>
        <label for={`notiz-neu-${props.art}-${props.id}`} class="feld-label">
          {t('notiz.neu')}
        </label>
        <textarea
          id={`notiz-neu-${props.art}-${props.id}`}
          class="eingabe"
          rows={2}
          value={neu}
          onInput={(e) => setzeNeu(e.currentTarget.value)}
          placeholder={t('notiz.platzhalter')}
        />
        <button type="submit" class="voll-knopf" disabled={!neu.trim()}>
          {t('notiz.speichern')}
        </button>
      </form>
      {fehler && <p class="feld-fehler">{t('notiz.fehler')}</p>}
    </div>
  );
}
