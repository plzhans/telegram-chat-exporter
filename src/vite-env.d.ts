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
  /** 소스 저장소 URL. 화면에 "이 코드를 직접 확인하세요" 링크로 노출한다. */
  readonly VITE_SOURCE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
