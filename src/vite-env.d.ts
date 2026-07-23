/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * 공용 api_id / api_hash. 빌드 시점에 번들에 박힌다.
   *
   * **비워둬도 앱은 동작한다.** 값이 없으면 사용자가 직접 발급한 api_id 를 입력하는 화면만
   * 나온다. shared/telegram/credentials.ts 의 주석 참고.
   */
  readonly VITE_TELEGRAM_API_ID?: string;
  readonly VITE_TELEGRAM_API_HASH?: string;
  /** 이 도구가 올라가 있는 사이트 주소. 내보낸 문서 하단에 링크로 적는다. */
  readonly VITE_SITE_URL?: string;
  /** 소스 저장소 URL. 화면에 "이 코드를 직접 확인하세요" 링크로 노출한다. */
  readonly VITE_SOURCE_URL?: string;
  /** 구글 애널리틱스 측정 ID. 있을 때만 애널리틱스가 켜지고 CSP 도 그만큼 열린다. */
  readonly VITE_GOOGLE_ANALYTICS_ID?: string;
  /** 구글 애드센스 게시자 ID(`ca-pub-...`). 있을 때만 광고가 들어가고 CSP 가 크게 열린다. */
  readonly VITE_GOOGLE_ADSENSE_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** vite.config.ts 의 `define` 이 빌드 시점에 값으로 바꿔치기한다. */
declare const __APP_VERSION__: string;
declare const __BUILD_COMMIT__: string;
declare const __BUILD_DATE__: string;
/**
 * 단일 파일(`index.html` 하나) 배포인가. `pnpm build:standalone` 에서만 참이다.
 *
 * 웹서버가 없다는 뜻이라 주소로 할 수 있는 게 없다 — 라우터는 해시를 쓰고 언어는
 * 저장값으로 고른다.
 */
declare const __STANDALONE__: boolean;
