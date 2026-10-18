import { useEffect, useMemo, useState } from 'preact/hooks';
import { db } from '../db/datenbank';
import { ladeFotos, loescheFoto, speichere } from '../db/repo';
import { useSprache } from '../i18n/kontext';
import { neuerDatensatz } from '../logic/datensatz';
import { zielGroesse } from '../logic/foto';
import type { BezugArt, Foto } from '../model/typen';

const JPEG_QUALITAET = 0.85;

/** Verkleinert ein Handyfoto; klappt das nicht (altes Format, kein Canvas), wird das Original gespeichert. */
async function verkleinere(datei: File): Promise<Blob> {
  try {
    const bild = await createImageBitmap(datei);
    const ziel = zielGroesse(bild.width, bild.height);
    if (ziel.breite === bild.width && ziel.hoehe === bild.height) return datei;
    const leinwand = document.createElement('canvas');
    leinwand.width = ziel.breite;
    leinwand.height = ziel.hoehe;
    leinwand.getContext('2d')!.drawImage(bild, 0, 0, ziel.breite, ziel.hoehe);
    bild.close();
    return await new Promise<Blob>((fertig, fehler) =>
      leinwand.toBlob((b) => (b ? fertig(b) : fehler(new Error('toBlob'))), 'image/jpeg', JPEG_QUALITAET),
    );
  } catch {
    return datei;
  }
}

export function FotoAblage(props: { art: BezugArt; id: string; hinweis?: string }) {
  const { t } = useSprache();
  const [fotos, setzeFotos] = useState<Foto[]>([]);
  const [gross, setzeGross] = useState<string | null>(null);
  const [loeschFrage, setzeLoeschFrage] = useState<string | null>(null);
  const [fehler, setzeFehler] = useState(false);

  const laden = () => ladeFotos(props.art, props.id).then(setzeFotos, (e) => console.error('Fotos nicht lesbar', e));
  useEffect(() => {
    void laden();
  }, [props.art, props.id]);

  // Vorschau-Adressen für die Blobs; beim Wechsel wieder freigeben.
  const adressen = useMemo(() => new Map(fotos.map((f) => [f.id, URL.createObjectURL(f.blob)])), [fotos]);
  useEffect(() => () => adressen.forEach((a) => URL.revokeObjectURL(a)), [adressen]);

  const hinzufuegen = async (e: Event) => {
    const eingabe = e.currentTarget as HTMLInputElement;
    const dateien = [...(eingabe.files ?? [])];
    eingabe.value = '';
    setzeFehler(false);
    try {
      for (const datei of dateien) {
        const jetzt = new Date();
        await speichere(
          db.fotos,
          neuerDatensatz<Foto>(
            { bezug_art: props.art, bezug_id: props.id, blob: await verkleinere(datei), aufgenommen_am: jetzt.toISOString(), notiz: null },
            jetzt,
          ),
        );
      }
    } catch (fehler) {
      console.error('Foto nicht gespeichert', fehler);
      setzeFehler(true);
    }
    await laden();
  };

  const entfernen = async (id: string) => {
    setzeLoeschFrage(null);
    setzeGross(null);
    await loescheFoto(id);
    await laden();
  };

  const eingabeId = `foto-${props.art}-${props.id}`;

  return (
    <div class="foto-ablage">
      {props.hinweis && <p class="feld-hinweis">{props.hinweis}</p>}
      {fotos.length > 0 && (
        <ul class="foto-raster">
          {fotos.map((f, i) => (
            <li key={f.id}>
              <button class={gross === f.id ? 'foto-knopf offen' : 'foto-knopf'} onClick={() => setzeGross(gross === f.id ? null : f.id)}>
                <img src={adressen.get(f.id)} alt={t('foto.bild', { nr: i + 1 })} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {gross && adressen.get(gross) && (
        <figure class="foto-gross">
          <img src={adressen.get(gross)} alt="" />
          <figcaption class="knopf-reihe">
            {loeschFrage === gross ? (
              <>
                <button class="voll-knopf warn" onClick={() => entfernen(gross)}>
                  {t('foto.wirklich')}
                </button>
                <button class="rand-knopf" onClick={() => setzeLoeschFrage(null)}>
                  {t('foto.abbrechen')}
                </button>
              </>
            ) : (
              <button class="text-knopf" onClick={() => setzeLoeschFrage(gross)}>
                {t('foto.entfernen')}
              </button>
            )}
          </figcaption>
        </figure>
      )}
      {fehler && <p class="feld-fehler">{t('foto.fehler')}</p>}
      <label class="rand-knopf datei-knopf">
        {t('foto.hinzufuegen')}
        {/* Ohne capture: Android bietet Kamera und Galerie an (auch Fotos, die schon auf dem Handy sind). */}
        <input id={eingabeId} type="file" accept="image/*" multiple onChange={hinzufuegen} />
      </label>
    </div>
  );
}
