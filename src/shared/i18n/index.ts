import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import {
  DEFAULT_LANGUAGE,
  SUPPORTED_LANGUAGES,
  dirOf,
  langSegment,
  type SeoMeta,
  type SupportedLanguage,
} from './languages';

export {
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE,
  PREFIXED_LANGUAGES,
  dirOf,
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

/**
 * 그 언어가 스스로 밝힌 자기 이름.
 *
 * `Intl.DisplayNames` 는 브라우저에 그 언어의 데이터가 없으면 **조용히 기본 로케일로
 * 떨어져서** 엉뚱한 언어로 답한다(카자흐어를 물었는데 한국어로 "카자흐어" 라고 답하는 식).
 * 그때 쓸 근거를 로케일 파일이 직접 들고 있게 한다.
 */
export function nativeNameOf(lang: SupportedLanguage): string {
  return (resources[lang]?.translation as { nativeName?: string })?.nativeName ?? lang.toUpperCase();
}

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

/**
 * 같은 화면의 다른 언어 주소.
 *
 * **끝에 `/` 를 반드시 붙인다.** 이 사이트가 내보내는 실제 파일은 `start/index.html`
 * 처럼 디렉터리 아래에 있어서, 슬래시가 없는 `/en-us/start` 는 그 파일이 아니라 언어판
 * 첫 화면(랜딩)으로 풀린다 - 시작 화면에서 언어를 바꾸면 랜딩으로 튕기던 원인이 이것이다.
 * 랜딩의 언어 메뉴는 처음부터 슬래시를 붙이고 있었으므로, 이제 양쪽이 같은 주소를 만든다.
 */
export function pathForLanguage(lang: SupportedLanguage, pathname = window.location.pathname) {
  const parts = stripBase(pathname);
  if (isLanguage(parts[0]?.toLowerCase() ?? '')) parts.shift();
  const joined = [langSegment(lang), ...parts].filter(Boolean).join('/');
  // BASE_URL 은 이미 `/` 로 끝난다. 그래서 기본 언어의 첫 화면은 그대로 base 가 된다.
  return import.meta.env.BASE_URL + (joined ? `${joined}/` : '');
}

/**
 * 단일 파일 배포에서 고른 언어를 적어 두는 자리.
 *
 * 주소가 파일 경로라 언어를 담을 수 없어서 브라우저에 남긴다. 언어 취향은 비밀이 아니고
 * 다음에 열 때도 유지되어야 하므로 sessionStorage 가 아니라 localStorage 다
 * (세션 문자열을 왜 반대로 두는지는 shared/telegram/session.ts 참고).
 */
const LANGUAGE_KEY = 'tce.language';

function storedLanguage(): SupportedLanguage | null {
  try {
    const v = localStorage.getItem(LANGUAGE_KEY)?.toLowerCase() ?? '';
    return isLanguage(v) ? v : null;
  } catch {
    // 사생활 보호 모드 등에서 막혀 있을 수 있다. 그때는 브라우저 설정으로 떨어진다.
    return null;
  }
}

/**
 * 같은 언어를 가리키는 옛 코드.
 *
 * 브라우저가 어느 쪽으로 알려 줄지는 기기와 판올림 시기에 달렸다. `tl` 은 타갈로그의
 * 옛 코드이고 안드로이드가 아직도 이 이름으로 보내는 경우가 있다. `in` 과 `iw` 는
 * 자바가 굳혀 놓은 인도네시아어·히브리어의 옛 코드다.
 */
const LEGACY_BASE: Record<string, string> = { tl: 'fil', in: 'id', iw: 'he', ji: 'yi' };

const baseOf = (tag: string) => {
  const base = tag.split('-')[0];
  return LEGACY_BASE[base] ?? base;
};

/** 브라우저 설정에서 고른다. 지역까지 맞는 게 없으면 언어만 같은 것도 받는다. */
function browserLanguage(): SupportedLanguage | null {
  for (const tag of navigator.languages?.length ? navigator.languages : [navigator.language]) {
    const lower = (tag ?? '').toLowerCase();
    const hit = SUPPORTED_LANGUAGES.find((l) => l === lower || baseOf(l) === baseOf(lower));
    if (hit) return hit;
  }
  return null;
}

/**
 * 지금 보여 줄 언어.
 *
 * 웹 배포는 주소가 정한다(`languageFromPath` 주석). 단일 파일 배포는 주소가 아무것도 말해
 * 주지 않으므로 **고른 값 → 브라우저 설정 → 기본 언어** 순으로 잡는다.
 */
export function activeLanguage(): SupportedLanguage {
  if (!__STANDALONE__) return languageFromPath();
  return storedLanguage() ?? browserLanguage() ?? DEFAULT_LANGUAGE;
}

/**
 * 문서의 언어와 읽기 방향을 실제로 보고 있는 언어에 맞춘다.
 *
 * 정적 셸은 언어마다 따로 나가지만, SPA 폴백으로 다른 언어의 셸이 올 수 있다
 * (`/en-us/dialogs` 새로고침). 그때 `<html lang>` 이 틀린 채로 남으면 화면 낭독기와
 * 브라우저 번역이 잘못된 언어로 읽는다.
 *
 * `dir` 은 한 걸음 더 나간다 — 아랍어판 셸에 `dir="rtl"` 이 없으면 글자만 아랍어이고
 * 정렬·여백·문장 부호 위치는 전부 왼쪽에서 오른쪽인 화면이 나온다.
 */
function applyDocumentLanguage(lang: SupportedLanguage): void {
  document.documentElement.lang = seoOf(lang).tag;
  document.documentElement.dir = dirOf(lang);
}

/**
 * 언어를 바꾼다.
 *
 * 글자만 갈아 끼우지 않고 문서를 다시 연다. 그래야 주소와 `<html lang>`, 그리고 화면이
 * 이미 그려 둔 문구까지 한 언어로 맞는다.
 */
export function switchLanguage(next: SupportedLanguage): void {
  if (!__STANDALONE__) {
    window.location.assign(pathForLanguage(next) + window.location.search);
    return;
  }

  try {
    localStorage.setItem(LANGUAGE_KEY, next);
  } catch {
    // 저장이 막혔으면 다음에 열 때 되돌아가겠지만, 지금 화면만이라도 바꿔 준다.
    void i18n.changeLanguage(next);
    applyDocumentLanguage(next);
    return;
  }
  window.location.reload();
}

const active = activeLanguage();

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

applyDocumentLanguage(active);

export default i18n;
