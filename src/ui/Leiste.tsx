import { schreibe, SCHLUESSEL } from '../geraet/speicher';
import { useSprache } from '../i18n/kontext';
import type { Sprache } from '../logic/sprache';
import type { Thema } from '../logic/thema';

const BAUJAHR = 1974;

const SONNE = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" />
  </svg>
);
const MOND = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
  </svg>
);

const MENUE = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 7h16M4 12h11M4 17h16" />
  </svg>
);

export function Leiste(props: { thema: Thema; themaUmschalten: () => void; menueOffen: boolean; menueOeffnen: () => void }) {
  const { t, sprache, setzeSprache } = useSprache();
  const { thema, themaUmschalten: umschalten } = props;

  const wechsleSprache = () => {
    const neu: Sprache = sprache === 'de' ? 'en' : 'de';
    schreibe(SCHLUESSEL.sprache, neu);
    setzeSprache(neu);
  };

  return (
    <header class="leiste">
      <div class="leiste-links">
        <button
          class="rund-knopf"
          onClick={props.menueOeffnen}
          aria-label={t('menue.oeffnen')}
          aria-expanded={props.menueOffen}
          aria-controls="flyout"
        >
          {MENUE}
        </button>
        <div class="marke">
          <span class="marke-name">{t('app.titel')}</span>
          <span class="marke-zusatz">{t('app.untertitel', { jahr: BAUJAHR })}</span>
        </div>
      </div>
      <div class="leiste-knoepfe">
        <button class="rund-knopf sprach-knopf" onClick={wechsleSprache} aria-label={t('leiste.sprache_wechseln')}>
          {t('leiste.sprache_kurz')}
        </button>
        <button
          class="rund-knopf"
          onClick={umschalten}
          aria-label={thema === 'dunkel' ? t('leiste.thema_hell') : t('leiste.thema_dunkel')}
        >
          {thema === 'dunkel' ? SONNE : MOND}
        </button>
      </div>
    </header>
  );
}
