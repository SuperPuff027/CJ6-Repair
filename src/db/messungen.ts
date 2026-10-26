import { neuerDatensatz, nurAktive } from '../logic/datensatz';
import { gruppiereMessreihen, MESS_TEIL, type Messgroesse, type Messreihe } from '../logic/messwerte';
import type { Betriebsart, Messung } from '../model/typen';
import { db } from './datenbank';
import { loescheWeich } from './repo';

/** Speichert eine Messreihe (z. B. Kompression aller Zylinder) mit gemeinsamem Zeitpunkt. */
export async function speichereMessreihe(
  groesse: Messgroesse,
  werte: readonly { zylinder: number | null; wert: number }[],
  einheit: string,
  betriebsart: Betriebsart | null,
): Promise<void> {
  const jetzt = new Date();
  await db.messungen.bulkPut(
    werte.map((w) =>
      neuerDatensatz<Messung>(
        { groesse, zylinder: w.zylinder, wert: w.wert, einheit, betriebsart, gemessen_am: jetzt.toISOString(), bauteil_id: null, modell_teil_id: MESS_TEIL[groesse] },
        jetzt,
      ),
    ),
  );
}

export async function ladeMessreihen(groesse: Messgroesse): Promise<Messreihe[]> {
  return gruppiereMessreihen(nurAktive(await db.messungen.where('groesse').equals(groesse).toArray()));
}

export async function loescheMessreihe(reihe: Messreihe): Promise<void> {
  await db.transaction('rw', db.messungen, async () => {
    for (const w of reihe.werte) await loescheWeich(db.messungen, w.id);
  });
}
