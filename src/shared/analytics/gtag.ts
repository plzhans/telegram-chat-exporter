/**
 * 구글 애널리틱스·애드센스 **스위치 상수**.
 *
 * 여기엔 boolean 뿐이다 — gtag.js/adsbygoogle 를 실제로 붙이는 **네트워크 로더 코드는
 * `init.ts` 로 갈랐다.** 그래야 텔레그램 동작 문서(`/run/session/`)가 그 코드를 **아예 안
 * 싣는다**: 그 문서는 이 파일(상수)만 import 하므로 gtag 로더가 번들에 들어올 통로가 없다.
 * 방식 고르기 문서(`/run/`)만 `init.ts` 를 불러 GA를 켠다.
 *
 * 상수를 두 문서가 함께 import 해도 안전한 이유는, 이게 **화면이 외부 연결을 고지할 근거**로만
 * 쓰이는 boolean 이기 때문이다. 켜 놓고 알리지 않으면 "다른 곳으로 연결하지 못한다"는 이 앱의
 * 설명이 개발자도구를 열어 본 사용자에게 거짓말이 된다.
 *
 * `.env.local` 에 값이 없으면(로컬·standalone) 둘 다 `false` 다. `import.meta.env.PROD` 로 dev 도
 * 제외한다 — 개발 중 새로고침이 방문 수로 잡히면 통계가 오염된다.
 */
export const ANALYTICS_ENABLED = Boolean(
  import.meta.env.PROD && !__STANDALONE__ && import.meta.env.VITE_GOOGLE_ANALYTICS_ID,
);

export const ADS_ENABLED = Boolean(
  import.meta.env.PROD && !__STANDALONE__ && import.meta.env.VITE_GOOGLE_ADSENSE_ID,
);
