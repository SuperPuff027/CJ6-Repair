import { useSprache } from './i18n/kontext';
import { Leiste } from './ui/Leiste';

export function App() {
  const { t } = useSprache();
  return (
    <>
      <Leiste />
      <main class="buehne">
        <p class="hinweis">{t('start.hinweis')}</p>
      </main>
    </>
  );
}
