/**
 * 랜딩이 받는 값과, 그것을 섹션들이 꺼내 쓰는 통로.
 *
 * 섹션마다 props 를 줄줄이 넘기면 섹션 하나를 옮기거나 지울 때마다 위쪽을 같이 고쳐야
 * 한다. 여기 한 번 담아 두고 각 섹션이 `useLanding()` 으로 필요한 것만 꺼내면, 섹션
 * 파일이 스스로 완결된다 - 새 섹션은 파일 하나 만들고 `Landing.tsx` 에 한 줄 넣으면 끝.
 */

import { createContext, useContext, type ReactNode } from 'react';
import type { SupportedLanguage } from '../shared/i18n/languages';

/**
 * 로케일 JSON 의 `landing` 블록. **여기 적힌 모양이 곧 번역이 채워야 할 모양이다.**
 *
 * 문구를 고치려면 이 파일이 아니라 `src/shared/i18n/locales/<언어>.json` 을 연다.
 * 키를 새로 만들 때만 여기에 타입을 한 줄 더한다 - 그래야 섹션에서 오타를 내면 빌드가
 * 멈춘다(예전에는 없는 키가 조용히 빈 문자열로 렌더됐다).
 */
export interface LandingCopy {
  badge: string;
  title: string;
  lede: string;
  cta: string;
  ctaSource: string;
  /** `{{languages}}` 자리에 지원 언어 수가 들어간다. */
  note: string;
  /** 실제 화면 스크린샷 캐러셀. 이미지는 언어와 무관하게 한 벌만 두므로 문구가 둘뿐이다. */
  screenshots: { title: string; body: string };
  why: { title: string } & Record<'install' | 'server' | 'output', Card>;
  zip: {
    title: string;
    /** 내보내기 결과물의 파일명 예시. 릴리스 에셋 이름과는 무관하다. */
    file: string;
  } & Record<'html' | 'jsonl' | 'txt' | 'meta', string>;
  steps: { title: string } & Record<'one' | 'two' | 'three', Card>;
  verify: {
    title: string;
    body: string;
    /** 애널리틱스가 켜진 빌드에서 `body` 대신 쓰인다. */
    bodyAnalytics: string;
    devtools: string;
    source: string;
  };
  download: { title: string; body: string; cta: string; note: string };
  final: { title: string; body: string };
}

/** 제목 + 설명 한 쌍. 카드와 단계가 같은 모양을 쓴다. */
export interface Card {
  title: string;
  body: string;
}

/** 앱 화면과 함께 쓰는 문구. 헤더·푸터가 앱과 같아 보여야 하므로 같은 키에서 온다. */
export interface LandingText {
  app: { title: string; tagline: string };
  common: { source: string; language: string };
  landing: LandingCopy;
}

/** 빌드가 아는 값들. 문구가 아니라 이 문서가 놓인 자리에 대한 사실이다. */
export interface LandingEnv {
  lang: SupportedLanguage;
  /** 이 언어판의 첫 화면 주소. `base` 가 반영된 값이다. */
  home: string;
  /**
   * 정적 자산(`public/`)이 놓이는 주소 앞부분. 배포 위치(`base`)가 반영된 값이다.
   *
   * 스크린샷 같은 이미지를 `${assetBase}landing/shot-01.png` 로 가리킬 때 쓴다. 하위
   * 경로 배포에서도 `--base` 를 그대로 따라가므로 손으로 `/` 를 적으면 안 된다.
   */
  assetBase: string;
  /** 앱 진입 주소. 랜딩에는 앱 코드가 없으므로 여기서부터 React 가 뜬다. */
  start: string;
  languages: { code: SupportedLanguage; href: string; label: string; current: boolean }[];
  /**
   * 이 문서에 **실제로 걸린** `connect-src`.
   *
   * 손으로 적지 않고 방금 만든 CSP 에서 뽑아 온다. 애널리틱스를 켜면 구글 호스트가 붙고
   * 단일 파일 배포는 텔레그램만 남는데, 화면에 한 벌 더 적어 두면 그중 어느 경우에선가
   * 조용히 거짓말이 된다. 하필 그 문장이 이 앱의 신뢰 근거다.
   */
  connectSrc: string;
  /** 애널리틱스가 켜진 빌드인가. 켜졌으면 "텔레그램 말고는 아무 데도" 가 참이 아니다. */
  analytics: boolean;
  sourceUrl: string;
  /**
   * 내려받기 버튼이 걸 주소. **이미 완성된 주소이고, 화면은 조립하지 않는다.**
   *
   * 기본값은 이 저장소의 GitHub 릴리스지만 다른 곳일 수도 있다 - 어디인지는
   * `vite.config.ts` 가 정해서 넘긴다(`config.ts` 주석). `import.meta.env` 로 직접
   * 읽지 않는 이유도 거기 있다: 랜딩은 빌드 도중 Node 에서 그려져서 그게 없다.
   */
  downloadUrl: string;
  copyright: string;
  version: string;
}

export interface LandingValue {
  text: LandingText;
  env: LandingEnv;
}

const Ctx = createContext<LandingValue | null>(null);

export function LandingProvider({ value, children }: { value: LandingValue; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/**
 * 섹션이 문구와 환경을 꺼내는 곳.
 *
 * `copy` 는 `text.landing` 의 지름길이다 - 섹션은 대부분 그것만 쓴다.
 */
export function useLanding(): LandingValue & { copy: LandingCopy } {
  const value = useContext(Ctx);
  if (!value) throw new Error('랜딩 섹션은 <LandingProvider> 안에서만 그릴 수 있다.');
  return { ...value, copy: value.text.landing };
}
