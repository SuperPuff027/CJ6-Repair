// Quellsprache. Die Schlüssel dieser Datei definieren den Schlüssel-Typ für alle Sprachen.
export const de = {
  'app.titel': 'CJ6-Repair',
  'app.untertitel': 'Jeep CJ-6 · Baujahr {jahr}',
  'start.hinweis': 'Hier erscheint bald das 3D-Modell deines CJ-6.',

  'leiste.thema_hell': 'Hellen Modus einschalten',
  'leiste.thema_dunkel': 'Dunklen Modus einschalten',
  'leiste.sprache_wechseln': 'Auf Englisch umschalten',
  'leiste.sprache_kurz': 'EN',
} as const;

export type Schluessel = keyof typeof de;
export type Uebersetzung = Readonly<Record<Schluessel, string>>;
