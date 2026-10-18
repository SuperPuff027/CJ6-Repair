// Quellsprache. Die Schlüssel dieser Datei definieren den Schlüssel-Typ für alle Sprachen.
export const de = {
  'app.titel': 'CJ6-Repair',
  'app.untertitel': 'Jeep CJ-6 · Baujahr {jahr}',
  'start.hinweis': 'Das Grundgerüst steht. Als Nächstes kommen Design und 3D-Modell.',
} as const;

export type Schluessel = keyof typeof de;
export type Uebersetzung = Readonly<Record<Schluessel, string>>;
