// Dateiformat der Wissensbasis (Handbuch- und Katalogdaten) und seine Prüfung.
// Beschreibung für Menschen: docs/wissensbasis-format.md
import type {
  Anleitung,
  AnleitungsSchritt,
  Baugruppe,
  Bauteil,
  Material,
  MitId,
  MotorVariante,
  Quelle,
  Sollwert,
  SymptomAntwort,
  SymptomKnoten,
  Teilenummer,
} from '../model/typen';
import { MODELL_TEIL_IDS, type ModellTeilId } from '../szene/modell';

export const WISSENSBASIS_FORMAT = 'cj6-wissensbasis';
export const WISSENSBASIS_VERSION = 1;

export const WISSENSBASIS_TABELLEN = ['motor_varianten', 'baugruppen', 'bauteile', 'anleitungen', 'symptom_knoten'] as const;
export type WissensbasisTabelle = (typeof WISSENSBASIS_TABELLEN)[number];

type OhneSync<T> = Omit<T, 'aktualisiert_am' | 'geloescht'>;

export interface Wissensbasis {
  /** Listen, die in der Datei stehen; nur diese werden ersetzt. */
  enthalten: WissensbasisTabelle[];
  motor_varianten: OhneSync<MotorVariante>[];
  baugruppen: OhneSync<Baugruppe>[];
  bauteile: OhneSync<Bauteil>[];
  anleitungen: OhneSync<Anleitung>[];
  symptom_knoten: OhneSync<SymptomKnoten>[];
}

export const FEHLER_CODES = [
  'kein_json',
  'falsches_format',
  'pflichtfeld',
  'falscher_typ',
  'id_doppelt',
  'verweis_fehlt',
  'quelle_fehlt',
  'modellteil_unbekannt',
  'zyklus',
  'antwort_ohne_ziel',
] as const;
export type FehlerCode = (typeof FEHLER_CODES)[number];

export interface PruefFehler {
  code: FehlerCode;
  /** Stelle in der Datei, z. B. „bauteile[3].teilenummern[0].quelle“ */
  pfad: string;
}

export type PruefErgebnis = { ok: true; daten: Wissensbasis } | { ok: false; fehler: PruefFehler[] };

// ---------- Hilfen zum Lesen ----------

type Objekt = Record<string, unknown>;

class Leser {
  fehler: PruefFehler[] = [];

  melde(code: FehlerCode, pfad: string) {
    this.fehler.push({ code, pfad });
  }

  objekt(wert: unknown, pfad: string): Objekt | null {
    if (typeof wert === 'object' && wert !== null && !Array.isArray(wert)) return wert as Objekt;
    this.melde(wert === undefined ? 'pflichtfeld' : 'falscher_typ', pfad);
    return null;
  }

  liste(o: Objekt, feld: string, pfad: string, pflicht = true): unknown[] {
    const wert = o[feld];
    if (wert === undefined && !pflicht) return [];
    if (Array.isArray(wert)) return wert;
    this.melde(wert === undefined ? 'pflichtfeld' : 'falscher_typ', `${pfad}.${feld}`);
    return [];
  }

  text(o: Objekt, feld: string, pfad: string): string {
    const wert = o[feld];
    if (typeof wert === 'string' && wert.trim() !== '') return wert.trim();
    this.melde(wert === undefined || wert === '' ? 'pflichtfeld' : 'falscher_typ', `${pfad}.${feld}`);
    return '';
  }

  textOderNull(o: Objekt, feld: string, pfad: string): string | null {
    const wert = o[feld];
    if (wert === undefined || wert === null || wert === '') return null;
    if (typeof wert === 'string') return wert.trim();
    this.melde('falscher_typ', `${pfad}.${feld}`);
    return null;
  }

  zahl(o: Objekt, feld: string, pfad: string): number {
    const wert = o[feld];
    if (typeof wert === 'number' && Number.isFinite(wert)) return wert;
    this.melde(wert === undefined ? 'pflichtfeld' : 'falscher_typ', `${pfad}.${feld}`);
    return 0;
  }

  zahlOderNull(o: Objekt, feld: string, pfad: string): number | null {
    const wert = o[feld];
    if (wert === undefined || wert === null) return null;
    if (typeof wert === 'number' && Number.isFinite(wert)) return wert;
    this.melde('falscher_typ', `${pfad}.${feld}`);
    return null;
  }

  /** Liste einzelner Großbuchstaben, z. B. Kennbuchstaben von Motorcodes. */
  buchstaben(o: Objekt, feld: string, pfad: string): string[] {
    return this.texte(o, feld, pfad).flatMap((b, i) => {
      if (/^[A-Z]$/.test(b)) return [b];
      this.melde('falscher_typ', `${pfad}.${feld}[${i}]`);
      return [];
    });
  }

  wahrheitswert(o: Objekt, feld: string, pfad: string): boolean {
    const wert = o[feld];
    if (typeof wert === 'boolean') return wert;
    this.melde(wert === undefined ? 'pflichtfeld' : 'falscher_typ', `${pfad}.${feld}`);
    return false;
  }

  texte(o: Objekt, feld: string, pfad: string): string[] {
    return this.liste(o, feld, pfad, false).flatMap((w, i) => {
      if (typeof w === 'string' && w.trim() !== '') return [w.trim()];
      this.melde('falscher_typ', `${pfad}.${feld}[${i}]`);
      return [];
    });
  }

  /** Quelle ist Pflicht, wo `pflicht` gesetzt ist; ohne Dokument gilt sie als fehlend. */
  quelle(o: Objekt, feld: string, pfad: string, pflicht: boolean): Quelle | null {
    const wert = o[feld];
    if (wert === undefined || wert === null) {
      if (pflicht) this.melde('quelle_fehlt', `${pfad}.${feld}`);
      return null;
    }
    const q = this.objekt(wert, `${pfad}.${feld}`);
    if (!q) return null;
    if (typeof q.dokument !== 'string' || q.dokument.trim() === '') {
      this.melde('quelle_fehlt', `${pfad}.${feld}.dokument`);
      return null;
    }
    return { dokument: q.dokument.trim(), stelle: this.textOderNull(q, 'stelle', `${pfad}.${feld}`) };
  }

  modellTeil(o: Objekt, pfad: string): ModellTeilId | null {
    const wert = this.textOderNull(o, 'modell_teil_id', pfad);
    if (wert === null) return null;
    if ((MODELL_TEIL_IDS as readonly string[]).includes(wert)) return wert as ModellTeilId;
    this.melde('modellteil_unbekannt', `${pfad}.modell_teil_id`);
    return null;
  }
}

// ---------- Prüfung ----------

export function pruefeWissensbasis(roh: unknown): PruefErgebnis {
  const l = new Leser();
  const wurzel = typeof roh === 'object' && roh !== null && !Array.isArray(roh) ? (roh as Objekt) : null;
  if (!wurzel || wurzel.format !== WISSENSBASIS_FORMAT || wurzel.version !== WISSENSBASIS_VERSION) {
    return { ok: false, fehler: [{ code: 'falsches_format', pfad: '' }] };
  }

  const motor_varianten = l.liste(wurzel, 'motor_varianten', '', false).flatMap((w, i) => {
    const p = `motor_varianten[${i}]`;
    const o = l.objekt(w, p);
    if (!o) return [];
    const motor = {
      id: l.text(o, 'id', p),
      name: l.text(o, 'name', p),
      zylinder: l.zahl(o, 'zylinder', p),
      hubraum_l: l.zahl(o, 'hubraum_l', p),
      bauart: l.text(o, 'bauart', p),
      baujahr_von: l.zahlOderNull(o, 'baujahr_von', p),
      baujahr_bis: l.zahlOderNull(o, 'baujahr_bis', p),
      motorcode_buchstaben: l.buchstaben(o, 'motorcode_buchstaben', p),
      vin_buchstaben: l.buchstaben(o, 'vin_buchstaben', p),
      erkennungsmerkmale: l.texte(o, 'erkennungsmerkmale', p),
    };
    // Motordaten sind technische Angaben und brauchen eine Quelle.
    const quelle = l.quelle(o, 'quelle', p, true);
    return quelle ? [{ ...motor, quelle }] : [];
  });

  const baugruppen = l.liste(wurzel, 'baugruppen', '', false).flatMap((w, i) => {
    const p = `baugruppen[${i}]`;
    const o = l.objekt(w, p);
    if (!o) return [];
    return [{ id: l.text(o, 'id', p), name: l.text(o, 'name', p), eltern_id: l.textOderNull(o, 'eltern_id', p), modell_teil_id: l.modellTeil(o, p) }];
  });

  const bauteile = l.liste(wurzel, 'bauteile', '', false).flatMap((w, i) => {
    const p = `bauteile[${i}]`;
    const o = l.objekt(w, p);
    if (!o) return [];
    const teilenummern = l.liste(o, 'teilenummern', p, false).flatMap((tw, j): Teilenummer[] => {
      const tp = `${p}.teilenummern[${j}]`;
      const t = l.objekt(tw, tp);
      if (!t) return [];
      const quelle = l.quelle(t, 'quelle', tp, true);
      const nummer = l.text(t, 'nummer', tp);
      return quelle ? [{ nummer, quelle }] : [];
    });
    return [
      {
        id: l.text(o, 'id', p),
        baugruppe_id: l.text(o, 'baugruppe_id', p),
        name: l.text(o, 'name', p),
        modell_teil_id: l.modellTeil(o, p),
        teilenummern,
        motor_varianten: l.texte(o, 'motor_varianten', p),
        stichwoerter: l.texte(o, 'stichwoerter', p),
      },
    ];
  });

  const anleitungen = l.liste(wurzel, 'anleitungen', '', false).flatMap((w, i) => {
    const p = `anleitungen[${i}]`;
    const o = l.objekt(w, p);
    if (!o) return [];
    const geprueft = l.wahrheitswert(o, 'geprueft', p);
    const schritte = l.liste(o, 'schritte', p).flatMap((sw, j): AnleitungsSchritt[] => {
      const sp = `${p}.schritte[${j}]`;
      const s = l.objekt(sw, sp);
      if (!s) return [];
      const sollwerte = l.liste(s, 'sollwerte', sp, false).flatMap((vw, k): Sollwert[] => {
        const vp = `${sp}.sollwerte[${k}]`;
        const v = l.objekt(vw, vp);
        if (!v) return [];
        const quelle = l.quelle(v, 'quelle', vp, true);
        const sollwert = { groesse: l.text(v, 'groesse', vp), wert: l.zahl(v, 'wert', vp), einheit: l.text(v, 'einheit', vp) };
        return quelle ? [{ ...sollwert, quelle }] : [];
      });
      return [
        {
          text: l.text(s, 'text', sp),
          bild: l.textOderNull(s, 'bild', sp),
          werkzeug: l.texte(s, 'werkzeug', sp),
          sollwerte,
          warnung: l.textOderNull(s, 'warnung', sp),
        },
      ];
    });
    const material = l.liste(o, 'material', p, false).flatMap((mw, j): Material[] => {
      const mp = `${p}.material[${j}]`;
      const m = l.objekt(mw, mp);
      if (!m) return [];
      const art = m.art === 'teil' || m.art === 'verbrauch' ? m.art : null;
      if (!art) l.melde(m.art === undefined ? 'pflichtfeld' : 'falscher_typ', `${mp}.art`);
      const teilenummer = l.textOderNull(m, 'teilenummer', mp);
      // Wie bei Bauteilen: eine Teilenummer braucht eine Quelle.
      const quelle = l.quelle(m, 'quelle', mp, teilenummer !== null);
      const menge = l.zahl(m, 'menge', mp);
      if (menge <= 0 && m.menge !== undefined) l.melde('falscher_typ', `${mp}.menge`);
      const eintrag = { bezeichnung: l.text(m, 'bezeichnung', mp), menge, einheit: l.text(m, 'einheit', mp), teilenummer, quelle };
      return art ? [{ art, ...eintrag }] : [];
    });
    return [
      {
        id: l.text(o, 'id', p),
        bauteil_id: l.text(o, 'bauteil_id', p),
        titel: l.text(o, 'titel', p),
        schritte,
        material,
        geprueft,
        // Eine als geprüft markierte Anleitung braucht eine Quelle.
        quelle: l.quelle(o, 'quelle', p, geprueft),
      },
    ];
  });

  const symptom_knoten = l.liste(wurzel, 'symptom_knoten', '', false).flatMap((w, i) => {
    const p = `symptom_knoten[${i}]`;
    const o = l.objekt(w, p);
    if (!o) return [];
    const antworten = l.liste(o, 'antworten', p).flatMap((aw, j): SymptomAntwort[] => {
      const ap = `${p}.antworten[${j}]`;
      const a = l.objekt(aw, ap);
      if (!a) return [];
      const antwort = {
        text: l.text(a, 'text', ap),
        naechster_id: l.textOderNull(a, 'naechster_id', ap),
        befund_bauteil_id: l.textOderNull(a, 'befund_bauteil_id', ap),
        pruefschritt: l.textOderNull(a, 'pruefschritt', ap),
      };
      if (!antwort.naechster_id && !antwort.befund_bauteil_id && !antwort.pruefschritt) l.melde('antwort_ohne_ziel', ap);
      return [antwort];
    });
    return [{ id: l.text(o, 'id', p), frage: l.text(o, 'frage', p), antworten }];
  });

  const enthalten = WISSENSBASIS_TABELLEN.filter((t) => wurzel[t] !== undefined);
  const daten: Wissensbasis = { enthalten, motor_varianten, baugruppen, bauteile, anleitungen, symptom_knoten };
  pruefeVerweise(daten, l);
  return l.fehler.length ? { ok: false, fehler: l.fehler } : { ok: true, daten };
}

function ids<T extends { id: string }>(liste: readonly T[], tabelle: string, l: Leser): Set<string> {
  const gesehen = new Set<string>();
  liste.forEach((e, i) => {
    if (e.id && gesehen.has(e.id)) l.melde('id_doppelt', `${tabelle}[${i}].id`);
    gesehen.add(e.id);
  });
  return gesehen;
}

function pruefeVerweise(d: Wissensbasis, l: Leser) {
  const motoren = ids(d.motor_varianten, 'motor_varianten', l);
  const gruppen = ids(d.baugruppen, 'baugruppen', l);
  const teile = ids(d.bauteile, 'bauteile', l);
  ids(d.anleitungen, 'anleitungen', l);
  const knoten = ids(d.symptom_knoten, 'symptom_knoten', l);

  d.baugruppen.forEach((g, i) => {
    if (g.eltern_id && !gruppen.has(g.eltern_id)) l.melde('verweis_fehlt', `baugruppen[${i}].eltern_id`);
  });
  // Baugruppen dürfen nicht im Kreis aufeinander verweisen.
  const eltern = new Map(d.baugruppen.map((g) => [g.id, g.eltern_id]));
  d.baugruppen.forEach((g, i) => {
    const besucht = new Set<string>();
    let aktuell: string | null | undefined = g.id;
    while (aktuell) {
      if (besucht.has(aktuell)) {
        l.melde('zyklus', `baugruppen[${i}].eltern_id`);
        break;
      }
      besucht.add(aktuell);
      aktuell = eltern.get(aktuell);
    }
  });
  d.bauteile.forEach((t, i) => {
    if (t.baugruppe_id && !gruppen.has(t.baugruppe_id)) l.melde('verweis_fehlt', `bauteile[${i}].baugruppe_id`);
    t.motor_varianten.forEach((m, j) => {
      if (!motoren.has(m)) l.melde('verweis_fehlt', `bauteile[${i}].motor_varianten[${j}]`);
    });
  });
  d.anleitungen.forEach((a, i) => {
    if (a.bauteil_id && !teile.has(a.bauteil_id)) l.melde('verweis_fehlt', `anleitungen[${i}].bauteil_id`);
  });
  d.symptom_knoten.forEach((k, i) =>
    k.antworten.forEach((a, j) => {
      if (a.naechster_id && !knoten.has(a.naechster_id)) l.melde('verweis_fehlt', `symptom_knoten[${i}].antworten[${j}].naechster_id`);
      if (a.befund_bauteil_id && !teile.has(a.befund_bauteil_id))
        l.melde('verweis_fehlt', `symptom_knoten[${i}].antworten[${j}].befund_bauteil_id`);
    }),
  );
}

// ---------- Abgleich mit dem Bestand ----------

export interface TabellenAenderung {
  neu: number;
  geaendert: number;
  entfernt: number;
  unveraendert: number;
}

export type ImportZusammenfassung = Record<WissensbasisTabelle, TabellenAenderung>;

export interface ImportPlan {
  /** Zu schreibende Datensätze je Tabelle (neue, geänderte und weich gelöschte) */
  schreiben: Record<WissensbasisTabelle, MitId[]>;
  zusammenfassung: ImportZusammenfassung;
}

/** JSON mit sortierten Schlüsseln auf allen Ebenen, damit die Reihenfolge den Vergleich nicht stört. */
function stabil(wert: unknown): string {
  if (Array.isArray(wert)) return `[${wert.map(stabil).join(',')}]`;
  if (typeof wert === 'object' && wert !== null) {
    const o = wert as Objekt;
    return `{${Object.keys(o)
      .filter((k) => o[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stabil(o[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(wert);
}

/** Inhalt ohne Abgleichsfelder zum Vergleichen. */
function inhalt(datensatz: MitId): string {
  const kopie: Objekt = { ...datensatz };
  delete kopie.aktualisiert_am;
  delete kopie.geloescht;
  return stabil(kopie);
}

/**
 * Jede Liste der Datei ersetzt die gleichnamige Liste der Wissensbasis: neue und geänderte Einträge
 * werden geschrieben, unveränderte behalten ihren Zeitstempel, fehlende werden weich gelöscht.
 * Listen, die in der Datei gar nicht vorkommen, bleiben unverändert.
 */
export function planeImport(bestand: Record<WissensbasisTabelle, readonly MitId[]>, daten: Wissensbasis, jetzt: Date): ImportPlan {
  const zeit = jetzt.toISOString();
  const schreiben = {} as Record<WissensbasisTabelle, MitId[]>;
  const zusammenfassung = {} as ImportZusammenfassung;

  for (const tabelle of WISSENSBASIS_TABELLEN) {
    const vorhanden = new Map(bestand[tabelle].map((d) => [d.id, d]));
    const aenderung: TabellenAenderung = { neu: 0, geaendert: 0, entfernt: 0, unveraendert: 0 };
    const liste: MitId[] = [];
    if (!daten.enthalten.includes(tabelle)) {
      schreiben[tabelle] = liste;
      zusammenfassung[tabelle] = aenderung;
      continue;
    }
    const inDatei = new Set<string>();

    for (const eintrag of daten[tabelle] as { id: string }[]) {
      inDatei.add(eintrag.id);
      const alt = vorhanden.get(eintrag.id);
      const neu = { ...eintrag, aktualisiert_am: zeit, geloescht: false } as MitId;
      if (!alt || alt.geloescht) {
        aenderung.neu++;
        liste.push(neu);
      } else if (inhalt(alt) !== inhalt(neu)) {
        aenderung.geaendert++;
        liste.push(neu);
      } else {
        aenderung.unveraendert++;
      }
    }
    for (const alt of vorhanden.values()) {
      if (!inDatei.has(alt.id) && !alt.geloescht) {
        aenderung.entfernt++;
        liste.push({ ...alt, geloescht: true, aktualisiert_am: zeit });
      }
    }
    schreiben[tabelle] = liste;
    zusammenfassung[tabelle] = aenderung;
  }
  return { schreiben, zusammenfassung };
}

/** Liest Dateitext als JSON und prüft ihn. */
export function leseWissensbasis(text: string): PruefErgebnis {
  let roh: unknown;
  try {
    roh = JSON.parse(text);
  } catch {
    return { ok: false, fehler: [{ code: 'kein_json', pfad: '' }] };
  }
  return pruefeWissensbasis(roh);
}
