/**
 * 언어 목록과 URL 접두사 규칙.
 *
 * 언어를 늘릴 때 손대는 곳은 두 군데다 — `locales/<코드>.json` 을 넣고 아래 목록에 코드를
 * 한 줄 추가한다. 문구는 전부 그 JSON 의 `seo` 블록에 들어간다.
 *
 * 이 파일은 `vite.config.ts` 도 읽으므로 순수 데이터만 둔다.
 */

/**
 * 지역까지 적는다. `en-gb` 를 나중에 넣어도 이미 나간 주소가 안 깨진다.
 *
 * **이 배열의 순서가 곧 언어 선택 상자의 순서다.** 앞의 셋은 이 도구를 만든 쪽과 가장
 * 가까운 사용자들이고, 그 뒤는 텔레그램 사용자 수가 많은 순서다.
 *
 * 한 언어를 여러 나라가 쓰는 경우 판을 나누지 않는다 — 인도·필리핀·나이지리아의 영어는
 * `en-us` 한 벌이 받고, 우크라이나·카자흐스탄의 러시아어는 `ru-ru` 가 받는다. 같은 글을
 * 두 주소에 두면 번역이 갈라지고 검색 색인도 서로를 갉아먹는다. 지역별 매칭은 각
 * 로케일 JSON 의 `hreflang` 목록이 포괄 태그(`en`, `ru`)로 처리한다.
 */
export const SUPPORTED_LANGUAGES = [
  // 이 도구가 먼저 챙기는 셋.
  'ko-kr',
  'en-us',
  'ja-jp',
  // 그 뒤는 텔레그램 사용자 수 순서.
  'hi-in',
  'ru-ru',
  'id-id',
  'pt-br',
  'ar-eg',
  'vi-vn',
  'es-mx',
  'uk-ua',
  'tr-tr',
  'fil-ph',
  'kk-kz',
  'zh-hk',
] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/** 이 언어만 접두사가 없다. `/` 와 `/ko-kr/` 이 둘 다 있으면 같은 내용이 두 주소에 걸린다. */
export const DEFAULT_LANGUAGE: SupportedLanguage = 'ko-kr';

export const PREFIXED_LANGUAGES = SUPPORTED_LANGUAGES.filter((l) => l !== DEFAULT_LANGUAGE);

/** 언어의 경로 조각. 기본 언어는 빈 문자열이다. */
export function langSegment(lang: string): string {
  return lang === DEFAULT_LANGUAGE ? '' : lang;
}

/**
 * 오른쪽에서 왼쪽으로 읽는 언어의 기본 부분.
 *
 * 지금은 아랍어뿐이지만 히브리어·페르시아어·우르두어가 들어오면 여기에 한 줄씩 는다.
 */
const RTL_BASE = new Set(['ar', 'he', 'fa', 'ur']);

/**
 * 문서의 읽기 방향.
 *
 * `<html dir>` 이 맞아야 글자 정렬과 문장 부호 위치가 바로잡히고, 화면의 좌우 여백도
 * 따라 뒤집힌다 — 화면 쪽은 Tailwind 의 논리 속성(`ms-`·`ps-`·`start-`)이 이 값을 보고
 * 판단하므로, 이 함수가 틀리면 아랍어판 레이아웃이 통째로 어긋난다.
 */
export function dirOf(lang: string): 'rtl' | 'ltr' {
  return RTL_BASE.has(lang.split('-')[0]) ? 'rtl' : 'ltr';
}

/** 로케일 JSON 의 `seo` 블록. */
export interface SeoMeta {
  /** `<html lang>` 표기. */
  tag: string;
  ogLocale: string;
  /**
   * 이 언어판이 응답할 hreflang 목록.
   *
   * `en-US` 만 적으면 영국·호주 사용자에게 매칭되지 않는다. 영어판이 하나뿐인 동안은
   * 포괄적인 `en` 도 같이 낸다. `en-gb` 가 생기면 그때 `en` 을 뗀다. 같은 이유로
   * 러시아어판은 `ru` 를 내서 우크라이나·카자흐스탄의 러시아어 사용자까지 받는다.
   */
  hreflang: string[];
  title: string;
  /** 공유 카드용 제목. `title` 에서 사이트 이름을 뺀 짧은 쪽이다. */
  shareTitle: string;
  description: string;
  /** 공유 카드용. 검색 결과용보다 한 문장 짧다. */
  shareDescription: string;
}
