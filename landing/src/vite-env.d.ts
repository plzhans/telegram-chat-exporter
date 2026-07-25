/// <reference types="vite/client" />

/**
 * SPA(개발·미리보기)인지 SSG(프로덕션 프리렌더)인지 알려 주는 빌드 상수.
 *
 * `vite.config.ts` 가 `define` 으로 박는다. SSG 에서는 `false` 라, `main.tsx` 의
 * 클라이언트 마운트 블록이 통째로 트리셰이킹된다.
 */
declare const __LANDING_SPA__: boolean;

interface ImportMetaEnv {
  /** exporter 진입 주소(끝에 `/`). 배포가 정한다. 기본 `/run/`. */
  readonly VITE_APP_URL?: string;
  readonly VITE_GITHUB_REPO_URL?: string;
  readonly VITE_RELEASE_DOWNLOAD_URL?: string;
  readonly VITE_RELEASE_ASSET_FILE_NAME?: string;
  readonly VITE_GOOGLE_ANALYTICS_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
