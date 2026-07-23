/**
 * 언어 목록과 URL 접두사 규칙.
 *
 * 언어를 늘릴 때 손대는 곳은 두 군데다 — `locales/<코드>.json` 을 넣고 아래 목록에 코드를
 * 한 줄 추가한다. 문구는 전부 그 JSON 의 `seo` 블록에 들어간다.
 *
 * 이 파일은 `vite.config.ts` 도 읽으므로 순수 데이터만 둔다.
 */

/** 지역까지 적는다. `en-gb` 를 나중에 넣어도 이미 나간 주소가 안 깨진다. */
export const SUPPORTED_LANGUAGES = ['ko-kr', 'en-us'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/** 이 언어만 접두사가 없다. `/` 와 `/ko-kr/` 이 둘 다 있으면 같은 내용이 두 주소에 걸린다. */
export const DEFAULT_LANGUAGE: SupportedLanguage = 'ko-kr';

export const PREFIXED_LANGUAGES = SUPPORTED_LANGUAGES.filter((l) => l !== DEFAULT_LANGUAGE);

/** 언어의 경로 조각. 기본 언어는 빈 문자열이다. */
export function langSegment(lang: string): string {
  return lang === DEFAULT_LANGUAGE ? '' : lang;
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
   * 포괄적인 `en` 도 같이 낸다. `en-gb` 가 생기면 그때 `en` 을 뗀다.
   */
  hreflang: string[];
  title: string;
  /** 공유 카드용 제목. `title` 에서 사이트 이름을 뺀 짧은 쪽이다. */
  shareTitle: string;
  description: string;
  /** 공유 카드용. 검색 결과용보다 한 문장 짧다. */
  shareDescription: string;
}
