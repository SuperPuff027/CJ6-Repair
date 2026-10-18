import { describe, expect, it } from 'vitest';
import { normalisiere, passtZurSuche } from './suche';

describe('normalisiere', () => {
  it('schreibt Umlaute aus und ignoriert Groß- und Kleinschreibung', () => {
    expect(normalisiere('Kühler')).toBe('kuehler');
    expect(normalisiere('STOSSDÄMPFER')).toBe('stossdaempfer');
    expect(normalisiere('Stoßstangen')).toBe('stossstangen');
  });
});

describe('passtZurSuche', () => {
  it('findet Teilwörter, auch ohne Umlaut getippt', () => {
    expect(passtZurSuche(['Kühler', 'Motor & Antrieb'], 'kuehl')).toBe(true);
    expect(passtZurSuche(['Kühler'], 'Kühl')).toBe(true);
    expect(passtZurSuche(['Bremsen vorne', 'Fahrwerk'], 'bremse')).toBe(true);
  });

  it('verlangt alle Wörter der Anfrage', () => {
    expect(passtZurSuche(['Bremsen vorne', 'Fahrwerk'], 'bremse vorn')).toBe(true);
    expect(passtZurSuche(['Bremsen hinten', 'Fahrwerk'], 'bremse vorn')).toBe(false);
  });

  it('findet über den Gruppennamen', () => {
    expect(passtZurSuche(['Gastank (LPG)', 'Kraftstoff & Gasanlage'], 'gasanlage')).toBe(true);
  });

  it('lässt bei leerer Anfrage alles durch', () => {
    expect(passtZurSuche(['Rahmen'], '   ')).toBe(true);
  });
});
