import { useEffect, useState } from 'preact/hooks';
import { db } from '../db/datenbank';
import { planeReparaturpaket } from '../db/reparaturpaket';
import { ladeAktive, ladeFahrzeug, speichere } from '../db/repo';
import { teilSchluessel } from '../i18n';
import { useSprache } from '../i18n/kontext';
import { vorgeschlagenePrioritaet } from '../logic/aufgaben';
import { neuerDatensatz } from '../logic/datensatz';
import type { Reparaturpaket } from '../logic/reparaturpaket';
import { folge, startKnoten, wegAlsText, type PfadSchritt } from '../logic/symptome';
import type { Aufgabe, Bauteil, SymptomAntwort, SymptomKnoten } from '../model/typen';
import type { ModellTeilId } from '../szene/modell';
import { PaketVorschau } from './Reparaturpaket';

type Phase =
  | { art: 'auswahl' }
  | { art: 'gascheck'; start: SymptomKnoten }
  | { art: 'frage'; knoten: SymptomKnoten }
  | { art: 'ende'; antwort: SymptomAntwort }
  | { art: 'gasgeruch' }
  | { art: 'sackgasse' };

export function SymptomBaum(props: { waehle: (id: ModellTeilId) => void; beiNeuerAufgabe: () => void }) {
  const { t } = useSprache();
  const [knoten, setzeKnoten] = useState<SymptomKnoten[] | null>(null);
  const [bauteile, setzeBauteile] = useState<Bauteil[]>([]);
  const [mitGas, setzeMitGas] = useState(false);
  const [phase, setzePhase] = useState<Phase>({ art: 'auswahl' });
  const [pfad, setzePfad] = useState<PfadSchritt[]>([]);
  const [paket, setzePaket] = useState<Reparaturpaket | null>(null);
  const [angelegt, setzeAngelegt] = useState(false);

  useEffect(() => {
    Promise.all([ladeAktive(db.symptom_knoten), ladeAktive(db.bauteile), ladeFahrzeug()]).then(
      ([k, b, f]) => {
        setzeKnoten(k);
        setzeBauteile(b);
        setzeMitGas(f.kraftstoff === 'bivalent_lpg');
      },
      (e) => console.error('Symptom-Baum nicht lesbar', e),
    );
  }, []);

  const neu = () => {
    setzePhase({ art: 'auswahl' });
    setzePfad([]);
    setzePaket(null);
    setzeAngelegt(false);
  };

  const beginne = (start: SymptomKnoten) => {
    setzePfad([]);
    // Mit Gasanlage zuerst die Sicherheitsfrage (CLAUDE.md: Gasgeruch = Abbruch).
    setzePhase(mitGas ? { art: 'gascheck', start } : { art: 'frage', knoten: start });
  };

  const antworte = (frage: SymptomKnoten, antwort: SymptomAntwort) => {
    const ergebnis = folge(antwort, pfad, knoten ?? []);
    setzePfad([...pfad, { knoten: frage, antwort }]);
    setzePhase(ergebnis.art === 'frage' ? { art: 'frage', knoten: ergebnis.knoten } : ergebnis);
  };

  const zurueck = () => {
    const letzter = pfad[pfad.length - 1];
    if (!letzter) return neu();
    setzePfad(pfad.slice(0, -1));
    setzePaket(null);
    setzePhase({ art: 'frage', knoten: letzter.knoten });
  };

  if (!knoten) return null;
  if (knoten.length === 0) return <p class="feld-hinweis">{t('symptom.leer')}</p>;

  const weg = pfad.length > 0 && (
    <ol class="symptom-weg" aria-label={t('symptom.weg')}>
      {pfad.map((s, i) => (
        <li key={i}>
          {s.knoten.frage} <strong>{s.antwort.text}</strong>
        </li>
      ))}
    </ol>
  );

  const steuerung = (
    <div class="knopf-reihe symptom-steuerung">
      {pfad.length > 0 && (
        <button class="rand-knopf" onClick={zurueck}>
          {t('symptom.zurueck')}
        </button>
      )}
      <button class="text-knopf" onClick={neu}>
        {t('symptom.neu')}
      </button>
    </div>
  );

  if (phase.art === 'auswahl') {
    return (
      <div class="symptom">
        <p class="feld-hinweis">{t('symptom.start_waehlen')}</p>
        <div class="antworten">
          {startKnoten(knoten).map((k) => (
            <button key={k.id} class="antwort-knopf" onClick={() => beginne(k)}>
              {k.frage}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (phase.art === 'gascheck') {
    return (
      <div class="symptom">
        <p class="symptom-frage">{t('symptom.gas_frage')}</p>
        <div class="antworten">
          <button class="antwort-knopf" onClick={() => setzePhase({ art: 'gasgeruch' })}>
            {t('symptom.ja')}
          </button>
          <button class="antwort-knopf" onClick={() => setzePhase({ art: 'frage', knoten: phase.start })}>
            {t('symptom.nein')}
          </button>
        </div>
        {steuerung}
      </div>
    );
  }

  if (phase.art === 'gasgeruch') {
    return (
      <div class="symptom">
        {weg}
        <div class="gefahr" role="alert">
          <p class="gefahr-titel">{t('mangel.gas_titel')}</p>
          <p>{t('mangel.gas_text')}</p>
        </div>
        {steuerung}
      </div>
    );
  }

  if (phase.art === 'frage') {
    return (
      <div class="symptom">
        {weg}
        <p class="symptom-frage" aria-live="polite">
          {phase.knoten.frage}
        </p>
        <div class="antworten">
          {phase.knoten.antworten.map((a, i) => (
            <button key={i} class="antwort-knopf" onClick={() => antworte(phase.knoten, a)}>
              {a.text}
            </button>
          ))}
        </div>
        {steuerung}
      </div>
    );
  }

  if (phase.art === 'sackgasse') {
    return (
      <div class="symptom">
        {weg}
        <p class="feld-fehler">{t('symptom.sackgasse')}</p>
        {steuerung}
      </div>
    );
  }

  // Ende: Befund und/oder Prüfschritt
  const { antwort } = phase;
  const bauteil = bauteile.find((b) => b.id === antwort.befund_bauteil_id) ?? null;
  const teil = bauteil?.modell_teil_id ?? null;
  const wegText = wegAlsText(pfad);

  const paketErstellen = async () => {
    if (!teil) return;
    const letzter = pfad[pfad.length - 1];
    const titel = letzter ? `${letzter.knoten.frage} ${letzter.antwort.text}` : wegText;
    setzePaket(await planeReparaturpaket([{ text: wegText, titel, teil, gasgeruch: false }]));
  };

  const pruefschrittAlsAufgabe = async () => {
    await speichere(
      db.aufgaben,
      neuerDatensatz<Aufgabe>(
        {
          titel: antwort.pruefschritt!,
          bauteil_id: bauteil?.id ?? null,
          modell_teil_id: teil,
          anleitung_id: null,
          mangel_text: wegText,
          prioritaet: vorgeschlagenePrioritaet(teil),
          geschaetzt_min: null,
          status: 'offen',
          erledigt_am: null,
        },
        new Date(),
      ),
    );
    setzeAngelegt(true);
    props.beiNeuerAufgabe();
  };

  return (
    <div class="symptom">
      {weg}
      {!bauteil && !antwort.pruefschritt && <p class="feld-hinweis">{t('symptom.kein_befund')}</p>}
      {bauteil && (
        <div class="befund">
          <p class="detail-titel">{t('symptom.befund')}</p>
          <p class="befund-name">
            {bauteil.name}{' '}
            {teil && (
              <button class="chip teil-link" onClick={() => props.waehle(teil)}>
                {t(teilSchluessel(teil))}
              </button>
            )}
          </p>
        </div>
      )}
      {antwort.pruefschritt && (
        <div class="befund">
          <p class="detail-titel">{t('symptom.pruefen')}</p>
          <p class="befund-name">{antwort.pruefschritt}</p>
        </div>
      )}
      {angelegt ? (
        <p class="mangel-fertig">{t('symptom.aufgabe_angelegt')}</p>
      ) : paket ? (
        <PaketVorschau
          paket={paket}
          angelegt={() => {
            setzePaket(null);
            setzeAngelegt(true);
            props.beiNeuerAufgabe();
          }}
          verwerfen={() => setzePaket(null)}
        />
      ) : (
        <div class="knopf-reihe">
          {teil && (
            <button class="voll-knopf" onClick={paketErstellen}>
              {t('paket.erstellen', { n: 1 })}
            </button>
          )}
          {antwort.pruefschritt && (
            <button class="rand-knopf" onClick={pruefschrittAlsAufgabe}>
              {t('symptom.als_aufgabe')}
            </button>
          )}
        </div>
      )}
      {steuerung}
    </div>
  );
}
