import { render } from 'preact';
import { App } from './App';
import { lies, SCHLUESSEL } from './geraet/speicher';
import { SprachAnbieter } from './i18n/kontext';
import { ermittleSprache } from './logic/sprache';
import { gespeichertesThema, wendeThemaAn } from './ui/useThema';
import './stil.css';

// Vor dem ersten Rendern, damit nicht kurz das falsche Theme aufblitzt.
wendeThemaAn(gespeichertesThema());

const sprache = ermittleSprache(lies(SCHLUESSEL.sprache), navigator.languages);

render(
  <SprachAnbieter sprache={sprache}>
    <App />
  </SprachAnbieter>,
  document.getElementById('app')!,
);
