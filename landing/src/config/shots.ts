/**
 * 랜딩 캐러셀에 걸리는 스크린샷이 어디에 몇 장 있는가.
 *
 * **읽는 쪽이 둘이라 여기 있다.**
 *
 * 1. `sections/Screenshots.tsx` - 그림을 실제로 거는 쪽.
 * 2. `vite.config.ts` - 첫 장을 `<link rel="preload">` 로 미리 받게 하는 쪽.
 *
 * 두 곳이 같은 파일을 가리켜야 preload 가 값을 한다. 폴백 규칙을 양쪽에 하나씩 적어
 * 두면 `ja/` 를 새로 채우는 날 한쪽만 고치게 되고, 그러면 preload 는 영어판을 받아
 * 두는데 화면은 일본어판을 걸어서 **첫 장을 두 번 받는다** - 고치려던 것이 되레
 * 느려진다. 조용히 어긋나므로 눈에도 안 띈다.
 */

import type { SupportedLanguage } from '../i18n/languages';

/**
 * 언어별 스크린샷이 놓이는 폴더.
 *
 * 스크린샷은 앱 UI 가 찍혀 있어서 화면 안 글자가 언어를 탄다. 그래서 판마다 한 벌씩 두되,
 * **여기 적힌 언어만** 제 폴더를 갖고 나머지는 영어판(`en/`)으로 떨어진다 - 열다섯 언어
 * 전부를 새로 찍을 수는 없으니, 있는 것만 두고 없으면 영어로 폴백한다.
 *
 * 기본 언어(`ko-kr`)는 URL 과 같은 규칙으로 접두사 없는 맨 자리(`public/` 바로 아래)를 쓴다.
 * 폴더를 새로 채우면(`ja/` 처럼) 여기에 한 줄 더한다.
 */
const SHOT_DIR: Partial<Record<SupportedLanguage, string>> = {
  'ko-kr': '', // 기본 언어 - 접두사 없는 맨 자리(public/shot-XX.png)
  'en-us': 'en/',
};

/** 이 언어의 스크린샷 폴더. 제 판이 없으면 영어판을 쓴다. */
export function shotDir(lang: SupportedLanguage): string {
  return SHOT_DIR[lang] ?? 'en/';
}

/**
 * `public/`(과 `public/en/`)에 있는 스크린샷 장수.
 *
 * 파일 이름은 `shot-01.png` … 로 두 자리를 맞춘다. 사전순 정렬이 곧 화면 순서가 되도록
 * 하기 위해서다(`shot-1`, `shot-10`, `shot-2` 로 섞이지 않는다). 장수를 바꾸면 이 숫자만
 * 고치면 된다.
 */
export const SHOT_COUNT = 18;

/** `shot-07` 처럼 두 자리로 맞춘 장 번호. 0 부터 세는 자리를 받는다. */
export const shotName = (index: number): string => String(index + 1).padStart(2, '0');

/**
 * 첫 화면에 걸려 곧바로 받아야 하는 장수.
 *
 * 슬라이드 폭을 화면보다 좁게 잡아 다음 장이 옆에 걸쳐 보이게 해 두었으므로(`Screenshots.tsx`)
 * 데스크톱에서는 **둘째 장이 화면에 들어오고, 실제로 그 장이 LCP 요소로 잡힌다.** 한 장만
 * 곧바로 받으면 정작 LCP 를 정하는 그림이 `lazy` 라 브라우저가 뒷순위로 미룬다.
 */
export const SHOT_EAGER_COUNT = 2;
