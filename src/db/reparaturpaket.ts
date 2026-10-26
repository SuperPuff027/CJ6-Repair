import { geaendert, neuerDatensatz, nurAktive } from '../logic/datensatz';
import { erstellePaket, fasseZusammen, postenSchluessel, type PaketMangel, type PaketPosten, type Reparaturpaket } from '../logic/reparaturpaket';
import type { Aufgabe, Listenposten } from '../model/typen';
import { db } from './datenbank';
import { ladeAktive, ladeFahrzeug } from './repo';

/** Baut das Paket aus Wissensbasis, Inventar und Motorstand (noch ohne zu speichern). */
export async function planeReparaturpaket(maengel: readonly PaketMangel[]): Promise<Reparaturpaket> {
  const [bauteile, anleitungen, inventar, fahrzeug] = await Promise.all([
    ladeAktive(db.bauteile),
    ladeAktive(db.anleitungen),
    ladeAktive(db.inventar),
    ladeFahrzeug(),
  ]);
  return erstellePaket(maengel, { bauteile, anleitungen }, inventar, {
    bestaetigt: fahrzeug.motor_variante_id,
    vorgemerkt: fahrzeug.motor_vorgemerkt,
  });
}

/** Legt je Mangel eine Aufgabe mit ihren Listenposten an – alles oder nichts. */
export async function legeReparaturpaketAn(paket: Reparaturpaket): Promise<void> {
  const jetzt = new Date();
  await db.transaction('rw', db.aufgaben, db.listenposten, async () => {
    for (const p of paket.pakete) {
      const aufgabe = neuerDatensatz<Aufgabe>(
        {
          titel: p.mangel.titel ?? p.mangel.text,
          bauteil_id: p.bauteile[0]?.id ?? null,
          modell_teil_id: p.mangel.teil,
          anleitung_id: p.anleitung?.id ?? null,
          mangel_text: p.mangel.text,
          prioritaet: p.prioritaet,
          geschaetzt_min: null,
          status: 'offen',
          erledigt_am: null,
        },
        jetzt,
      );
      await db.aufgaben.put(aufgabe);
      await db.listenposten.bulkPut(
        p.posten.map((x) =>
          neuerDatensatz<Listenposten>(
            { aufgabe_id: aufgabe.id, art: x.art, bezeichnung: x.bezeichnung, teilenummer: x.teilenummer, menge: x.menge, einheit: x.einheit, vorhanden: x.vorhanden },
            jetzt,
          ),
        ),
      );
    }
  });
}

export interface EinkaufsPosten extends PaketPosten {
  /** Zugrunde liegende Listenposten (aus mehreren Aufgaben zusammengefasst) */
  ids: string[];
}

/** Was für offene Aufgaben noch fehlt, zusammengefasst über alle Aufgaben. */
export async function ladeEinkaufsliste(): Promise<EinkaufsPosten[]> {
  const offen = new Set((await ladeAktive(db.aufgaben)).filter((a) => a.status !== 'erledigt').map((a) => a.id));
  const fehlt = nurAktive(await db.listenposten.toArray()).filter((l) => offen.has(l.aufgabe_id) && !l.vorhanden);
  const zusammen = fasseZusammen(
    fehlt.map((l) => ({ art: l.art, bezeichnung: l.bezeichnung, teilenummer: l.teilenummer, menge: l.menge, einheit: l.einheit, vorhanden: false, quelle: null })),
    [],
  );
  return zusammen.map((z) => ({ ...z, ids: fehlt.filter((l) => postenSchluessel(l) === postenSchluessel(z)).map((l) => l.id) }));
}

/** Markiert Listenposten als besorgt (vorhanden). */
export async function markiereBesorgt(ids: readonly string[]): Promise<void> {
  const jetzt = new Date();
  await db.transaction('rw', db.listenposten, async () => {
    for (const id of ids) {
      const posten = await db.listenposten.get(id);
      if (posten && !posten.vorhanden) await db.listenposten.put(geaendert({ ...posten, vorhanden: true }, jetzt));
    }
  });
}
