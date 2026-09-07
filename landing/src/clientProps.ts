import type { LandingText, LandingEnv, LandingValue } from './context';
import {
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE,
  langSegment,
  type SupportedLanguage,
} from './i18n/languages';
import { DEFAULT_RELEASE_ASSET, githubLatestDownloadUrl } from './config/release';

/*
  브라우저에서 <Landing> 을 그릴 때 쓰는 props — **개발·미리보기(SPA) 전용**이다.

  프로덕션(SSG)은 이 값을 빌드가 Node 에서 만들어 프리렌더한다(`vite.config.ts` 의 `landingDoc`).
  여기는 그 짝으로, 같은 모양을 브라우저에서 만든다. `connect-src` 처럼 빌드에서만 정확히 알
  수 있는 값은 개발용으로 근사한다 — SPA 는 배포 아티팩트가 아니라 개발 편의다.
*/

/** `import.meta.glob` 으로 끌어온 로케일. 키가 곧 경로다. */
const locales = import.meta.glob<{ default: Record<string, unknown> }>('../locales/*.json', {
  eager: true,
});
const localeOf = (lang: string): Record<string, unknown> =>
  locales[`../locales/${lang}.json`]?.default ?? {};

const isLang = (v: string): v is SupportedLanguage =>
  (SUPPORTED_LANGUAGES as readonly string[]).includes(v);

/** 주소가 가리키는 언어. `/en-us/…` → `en-us`. 없으면 기본 언어. */
function langFromPath(): SupportedLanguage {
  const base = import.meta.env.BASE_URL;
  const rest = location.pathname.startsWith(base)
    ? location.pathname.slice(base.length)
    : location.pathname.replace(/^\//, '');
  const first = rest.split('/').filter(Boolean)[0]?.toLowerCase() ?? '';
  return isLang(first) ? first : DEFAULT_LANGUAGE;
}

/** 문구. 없는 언어는 영어로 떨어진다(빌드 쪽 `landingTextOf` 와 같은 규칙). */
function textFor(lang: SupportedLanguage): LandingText {
  const own = localeOf(lang);
  const fallback = localeOf('en-us');
  return {
    app: (own.app ?? fallback.app) as LandingText['app'],
    common: (own.common ?? fallback.common) as LandingText['common'],
    landing: (own.landing ?? fallback.landing) as LandingText['landing'],
  };
}

const TELEGRAM_CONNECT = 'connect-src wss://*.web.telegram.org wss://*.web.telegram.org:443';
const GOOGLE_CONNECT =
  ' https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com';

export function landingProps(): LandingValue {
  const env = import.meta.env;
  const base = env.BASE_URL;
  const seg = (l: SupportedLanguage) => (langSegment(l) ? `${langSegment(l)}/` : '');
  const lang = langFromPath();

  const rawApp = env.VITE_APP_URL || '/run/';
  const appUrl = rawApp.endsWith('/') ? rawApp : `${rawApp}/`;
  const repoUrl = env.VITE_GITHUB_REPO_URL || 'https://github.com/plzhans/telegram-chat-exporter';
  const analytics = Boolean(env.VITE_GOOGLE_ANALYTICS_ID);

  const value: LandingEnv = {
    lang,
    home: `${location.origin}${base}${seg(lang)}`,
    assetBase: base,
    start: `${appUrl}${seg(lang)}`,
    languages: SUPPORTED_LANGUAGES.map((l) => ({
      code: l,
      href: `${base}${seg(l)}`,
      label: String(localeOf(l).nativeName ?? l),
      current: l === lang,
      hreflang: String((localeOf(l).seo as { tag?: string })?.tag ?? l),
    })),
    // 개발용 근사값이다. SSG 는 실제 CSP 에서 뽑지만 dev 에는 CSP 가 없다.
    connectSrc: analytics ? `${TELEGRAM_CONNECT}${GOOGLE_CONNECT}` : TELEGRAM_CONNECT,
    analytics,
    sourceUrl: repoUrl,
    downloadUrl:
      env.VITE_RELEASE_DOWNLOAD_URL ||
      githubLatestDownloadUrl(repoUrl, env.VITE_RELEASE_ASSET_FILE_NAME || DEFAULT_RELEASE_ASSET),
    copyrightYear: new Date().getFullYear(),
  };

  return { text: textFor(lang), env: value };
}
