/**
 * 단일 파일 배포의 로케일 출처.
 *
 * 웹 빌드는 로케일을 번들에 인라인하지만(`resources.ts`), 배포본은 여기서 읽는다. 각
 * 언어가 `i18n/<코드>.js` 로 따로 나가 앱 스크립트보다 먼저 실행되며 이 전역을 채운다
 * (`vite.config.ts` 의 `standaloneLocales`). `file://` 은 `fetch` 는 CORS 로 막아도
 * `<script src>` 는 상대경로로 읽어 주기 때문에 이 방식만 더블클릭 실행에서 동작한다.
 *
 * 이렇게 떼어 두는 값어치는 **받은 사람이 리빌드 없이 `i18n/ko-kr.js` 한 파일만 고쳐
 * 번역을 손볼 수 있다**는 것이다. 그래서 로케일이 앱 번들에 인라인되면 안 된다 — 인라인된
 * 사본이 이겨서 편집이 먹히지 않는다.
 */
declare global {
  interface Window {
    __I18N__?: Record<string, Record<string, unknown>>;
  }
}

const registry = window.__I18N__ ?? {};

export const resources = Object.fromEntries(
  Object.entries(registry).map(([lang, translation]) => [lang, { translation }]),
);
