import { useSprache } from './i18n/kontext';

const BAUJAHR = 1974;

export function App() {
  const { t } = useSprache();
  return (
    <main class="start">
      <h1>{t('app.titel')}</h1>
      <p class="untertitel">{t('app.untertitel', { jahr: BAUJAHR })}</p>
      <p>{t('start.hinweis')}</p>
    </main>
  );
}
