import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import {
  DEFAULT_LANGUAGE,
  SUPPORTED_LANGUAGES,
  langSegment,
  type SeoMeta,
  type SupportedLanguage,
} from './languages';

export {
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE,
  PREFIXED_LANGUAGES,
  langSegment,
  type SeoMeta,
  type SupportedLanguage,
} from './languages';

/**
 * 로케일 파일을 알아서 끌어모은다. 언어를 늘릴 때 이 파일을 고칠 일이 없다.
 */
const files = import.meta.glob<{ default: Record<string, unknown> }>('./locales/*.json', {
  eager: true,
});

const resources = Object.fromEntries(
  Object.entries(files).map(([path, mod]) => [
    path.replace('./locales/', '').replace('.json', ''),
    { translation: mod.default },
  ]),
);

export function seoOf(lang: SupportedLanguage): SeoMeta {
  return (resources[lang]?.translation as { seo: SeoMeta }).seo;
}

function stripBase(pathname: string): string[] {
  const base = import.meta.env.BASE_URL;
  const rest = pathname.startsWith(base) ? pathname.slice(base.length) : pathname.replace(/^\//, '');
  return rest.split('/').filter(Boolean);
}

const isLanguage = (v: string): v is SupportedLanguage =>
  (SUPPORTED_LANGUAGES as readonly string[]).includes(v);

/**
 * 주소가 가리키는 언어. 접두사가 없으면 기본 언어다.
 *
 * 브라우저 설정보다 주소가 우선한다. `/en-us/` 링크를 받은 사람은 브라우저가 한국어여도
 * 영어를 봐야 한다 — 링크를 준 쪽이 그걸 의도했고, 검색엔진이 그 주소에 무엇이 있다고
 * 색인해 둔 것과도 맞아야 한다.
 */
export function languageFromPath(pathname: string = window.location.pathname): SupportedLanguage {
  const first = stripBase(pathname)[0]?.toLowerCase() ?? '';
  return isLanguage(first) ? first : DEFAULT_LANGUAGE;
}

/** 같은 화면의 다른 언어 주소. */
export function pathForLanguage(lang: SupportedLanguage, pathname = window.location.pathname) {
  const parts = stripBase(pathname);
  if (isLanguage(parts[0]?.toLowerCase() ?? '')) parts.shift();
  return import.meta.env.BASE_URL + [langSegment(lang), ...parts].filter(Boolean).join('/');
}

const active = languageFromPath();

void i18n.use(initReactI18next).init({
  resources,
  lng: active,
  fallbackLng: DEFAULT_LANGUAGE,
  supportedLngs: SUPPORTED_LANGUAGES,
  /**
   * 없으면 번역이 통째로 안 나온다.
   *
   * i18next 는 `ko-kr` 을 `ko-KR` 로 고쳐 잡는데(지역 부분을 대문자로), 리소스 키와
   * `supportedLngs` 는 소문자라 그 이름으로는 아무것도 못 찾는다. 해석 후보가 빈 배열이
   * 되어 폴백조차 걸리지 않고 키 문자열이 그대로 화면에 나온다.
   */
  lowerCaseLng: true,
  interpolation: { escapeValue: false },
});

/**
 * 문서의 언어를 실제로 보고 있는 언어에 맞춘다.
 *
 * 정적 셸은 언어마다 따로 나가지만, SPA 폴백으로 다른 언어의 셸이 올 수 있다
 * (`/en-us/dialogs` 새로고침). 그때 `<html lang>` 이 틀린 채로 남으면 화면 낭독기와
 * 브라우저 번역이 잘못된 언어로 읽는다.
 */
document.documentElement.lang = seoOf(active).tag;

export default i18n;
