/**
 * 구글 애널리틱스.
 *
 * `VITE_GOOGLE_ANALYTICS_ID` 가 있을 때만 켜진다. 로컬은 `.env.local` 에 넣지 않으므로 꺼져 있고,
 * CSP 도 같은 값으로 갈라져서 **로컬 빌드에는 구글 도메인이 아예 열리지 않는다**
 * (`vite.config.ts` 참고).
 *
 * 단일 파일 배포(`build:standalone`)는 값이 있어도 끈다. 내려받아 자기 컴퓨터에서 여는
 * 사람에게 추적을 딸려 보내지 않는다 — 릴리스로 받은 파일은 CSP 도 텔레그램만 열고 나간다.
 *
 * ## 붙여 준 스니펫을 그대로 쓰지 않은 이유
 *
 * 원본은 `<script>` 안에 설정 코드가 들어 있는 형태인데, 그러면 CSP 에
 * `script-src 'unsafe-inline'` 을 열어야 한다. 그건 이 앱에서 제일 내주면 안 되는 것이다 —
 * 인라인 스크립트가 허용되는 순간 XSS 한 방이 곧 인증코드 탈취가 된다. 같은 일을 우리
 * 번들 코드가 하면 `script-src 'self'` 로 덮이고, 바깥에서 받아 오는 건 gtag.js 하나뿐이라
 * 그 호스트만 열면 된다.
 *
 * ## 경로를 그대로 보내지 않는다
 *
 * `/dialogs/123456789` 의 숫자는 **텔레그램 대화방 id** 다. 기본 설정의 gtag 는 주소를
 * 통째로 보내므로, 그대로 두면 사용자가 어떤 대화방을 열었는지가 구글에 쌓인다. 로그인 뒤
 * 화면은 애초에 유입 분석 대상도 아니라서, 첫 화면 한 번만 언어와 함께 보낸다.
 */

/**
 * `pnpm dev` 에서는 값이 있어도 보내지 않는다.
 *
 * 개발 중 새로고침이 그대로 방문 수로 잡히면 통계가 개발자 트래픽으로 오염된다. 값을
 * `.env.local` 에 두는 건 배포본과 같은 화면(고지 문구 포함)을 빌드해서 확인하기 위해서지,
 * 개발 중에 이벤트를 쏘려는 게 아니다.
 */
const ID =
  import.meta.env.PROD && !__STANDALONE__ ? import.meta.env.VITE_GOOGLE_ANALYTICS_ID : undefined;

/**
 * 애널리틱스가 켜진 빌드인가.
 *
 * 화면이 이 값을 보고 **외부 연결이 있다는 사실을 고지**한다. 켜 놓고 알리지 않으면,
 * "다른 곳으로 연결하지 못한다"를 근거로 삼는 이 앱의 설명이 개발자도구를 열어 본
 * 사용자에게 거짓말이 된다.
 */
export const ANALYTICS_ENABLED = Boolean(ID);

declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}

/** 보낼 수 있는 경로인지. 첫 화면(언어 접두사까지)만 허용한다. */
function safePath(): string | null {
  const base = import.meta.env.BASE_URL;
  const { pathname } = window.location;
  const rest = pathname.startsWith(base) ? pathname.slice(base.length) : pathname.replace(/^\//, '');
  const parts = rest.split('/').filter(Boolean);

  if (parts.length === 0) return base;
  // 언어 조각 하나뿐이면 그것도 첫 화면이다. 그 외에는 보내지 않는다.
  if (parts.length === 1 && /^[a-z]{2}(-[a-z]{2})?$/.test(parts[0])) return `${base}${parts[0]}/`;
  return null;
}

/**
 * **웹 배포에서는 더 이상 여기서 방문이 잡히지 않는다.**
 *
 * 보낼 수 있는 경로가 첫 화면뿐인데(`safePath`), 그 첫 화면은 이제 앱 번들을 받지 않는
 * 정적 HTML 이다(`build/landing.ts`). 그래서 이 함수가 도는 시점의 경로는 항상 `/start`
 * 이하이고 `safePath()` 가 `null` 을 준다. 랜딩 쪽 집계는 빌드가 따로 내보내는 작은
 * 자기 파일이 맡는다(`vite.config.ts` 의 `landingAnalytics`).
 *
 * 그래도 지우지 않는 이유는 두 가지다. `ANALYTICS_ENABLED` 는 화면이 외부 연결을 고지할
 * 근거로 계속 쓰이고(CSP 가 실제로 구글 쪽에 열려 있으므로 그 고지는 여전히 참이어야
 * 한다), 단일 파일 배포처럼 랜딩이 없는 형태가 생기면 이 경로가 다시 유일한 집계 지점이
 * 된다.
 */
export function initAnalytics(): void {
  if (!ID) return;

  const path = safePath();
  if (!path) return;

  const tag = document.createElement('script');
  tag.async = true;
  tag.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ID)}`;
  document.head.appendChild(tag);

  window.dataLayer = window.dataLayer ?? [];
  const gtag = (...args: unknown[]) => {
    window.dataLayer?.push(args);
  };

  gtag('js', new Date());
  gtag('config', ID, {
    // 자동 수집을 끄고 우리가 고른 경로만 보낸다. 위 주석 참고.
    send_page_view: false,
    page_path: path,
    anonymize_ip: true,
  });
  gtag('event', 'page_view', { page_path: path });
}

const ADSENSE =
  import.meta.env.PROD && !__STANDALONE__ ? import.meta.env.VITE_GOOGLE_ADSENSE_ID : undefined;

/**
 * 광고가 들어간 빌드인가. 화면이 이 값을 보고 고지한다.
 *
 * 애널리틱스와 별개로 둔다. 통계만 켜고 광고는 안 켜는 조합이 기본이고, 광고는 여는
 * 범위가 훨씬 넓어서 사용자에게 알려야 할 내용도 다르다.
 */
export const ADS_ENABLED = Boolean(ADSENSE);

/**
 * 애드센스 로더.
 *
 * 광고 자리(`<ins class="adsbygoogle">`)는 아직 없다. 이 함수는 스크립트만 올려 두고,
 * 어디에 어떤 광고를 넣을지는 화면을 만들 때 정한다. **로그인 화면에는 넣지 않는 것을
 * 전제로 한다** - 전화번호와 인증코드를 받는 자리에 남의 iframe 을 띄우는 것은
 * 이 도구가 사용자에게 요구하는 신뢰와 정면으로 어긋난다.
 */
export function initAds(): void {
  if (!ADSENSE) return;

  const tag = document.createElement('script');
  tag.async = true;
  tag.crossOrigin = 'anonymous';
  tag.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(ADSENSE)}`;
  document.head.appendChild(tag);
}
