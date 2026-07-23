/** 이 도구의 소스 저장소. 화면에 그대로 노출해서 사용자가 코드를 직접 확인할 수 있게 한다. */
export const SOURCE_URL =
  import.meta.env.VITE_SOURCE_URL ?? 'https://github.com/plzhans/telegram-chat-exporter';

/** api_id 발급 페이지. 안내 문구에서 여러 번 쓰인다. */
export const MY_TELEGRAM_URL = 'https://my.telegram.org/apps';

/**
 * 이 도구가 올라가 있는 사이트 주소. 없으면 빈 문자열이다.
 *
 * 내보낸 문서에 적어 두려고 쓴다. 파일만 받은 사람이 "이게 어디서 나온 것인가"를 따라갈
 * 곳이 있어야 한다. 배포에서는 CI 가 Pages 주소로 채운다.
 */
export const SITE_URL = import.meta.env.VITE_SITE_URL ?? '';

export const APP_VERSION = __APP_VERSION__;
export const BUILD_COMMIT = __BUILD_COMMIT__;
export const BUILD_DATE = __BUILD_DATE__;

/** 화면 하단과 내보낸 HTML 에 같은 형태로 찍는다. 달라지면 대조를 못 한다. */
export const VERSION_LABEL = `v${APP_VERSION} · ${BUILD_COMMIT} · ${BUILD_DATE}`;

/** 저작권 주체. 저장소 소유 계정이다. */
export const COPYRIGHT_HOLDER = 'plzhans';

/**
 * 연도는 실행 시각이 아니라 빌드 날짜에서 잘라 쓴다. 실행 시각으로 잡으면 해가 바뀐 뒤
 * 옛 빌드를 열었을 때 고치지도 않은 코드의 연도만 올라간다.
 *
 * 도구에 대한 표시지 사용자가 내보낸 대화에 대한 것이 아니라, 내보낸 HTML 에는 안 넣는다.
 */
export const COPYRIGHT = `© ${BUILD_DATE.slice(0, 4)} ${COPYRIGHT_HOLDER}`;
