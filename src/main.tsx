import { render } from 'preact';
import { App } from './App';
import { SprachAnbieter } from './i18n/kontext';
import { ermittleSprache } from './logic/sprache';
import './stil.css';

// Die gespeicherte Sprachwahl kommt mit den Einstellungen in Schritt 2.
const sprache = ermittleSprache(null, navigator.languages);

render(
  <SprachAnbieter sprache={sprache}>
    <App />
  </SprachAnbieter>,
  document.getElementById('app')!,
);
