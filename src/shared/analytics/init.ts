/**
 * 구글 애널리틱스·애드센스 **로더**(gtag.js / adsbygoogle 를 실제로 붙이는 네트워크 코드).
 *
 * **이 파일은 방식 고르기 문서(`/run/`, `src/method/main.tsx`)만 import 한다.** 텔레그램 동작
 * 문서(`/run/session/`)는 여기를 안 부르므로 googletagmanager 를 향하는 코드가 그 번들에
 * 아예 들어오지 않는다 — 켜고 끄는 boolean 상수만 `gtag.ts` 에 따로 두고 갈라 놓은 이유다.
 *
 * ## 붙여 준 스니펫을 그대로 쓰지 않은 이유
 *
 * 구글 원본은 `<script>` 안에 설정 코드가 들어 있어 CSP 에 `script-src 'unsafe-inline'` 을
 * 열어야 한다. 그건 이 앱에서 제일 내주면 안 되는 것이다 — 인라인이 허용되는 순간 XSS 한
 * 방이 곧 인증코드 탈취가 된다. 같은 일을 우리 번들 코드가 하면 `script-src 'self'` 로 덮이고,
 * 바깥에서 받아 오는 건 gtag.js 하나뿐이라 그 호스트만 열면 된다.
 *
 * ## 경로를 그대로 보내지 않는다
 *
 * `/dialogs/123456789` 의 숫자는 텔레그램 대화방 id 다. 기본 gtag 는 주소를 통째로 보내므로
 * 그대로 두면 어떤 대화방을 열었는지가 구글에 쌓인다. 첫 화면(방식 고르기) 한 번만 보낸다 —
 * 애초에 이 로더는 방식 문서에서만 도니 로그인 뒤 경로가 올 일은 없지만, 규칙은 그대로 둔다.
 */

const ID =
  import.meta.env.PROD && !__STANDALONE__ ? import.meta.env.VITE_GOOGLE_ANALYTICS_ID : undefined;

const ADSENSE =
  import.meta.env.PROD && !__STANDALONE__ ? import.meta.env.VITE_GOOGLE_ADSENSE_ID : undefined;

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
 * 방식 고르기 화면(`/run/`) 방문을 한 번 집계한다.
 *
 * `VITE_GOOGLE_ANALYTICS_ID` 가 없으면(로컬·standalone) 아무것도 하지 않는다.
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

/**
 * 애드센스 로더.
 *
 * 광고 자리(`<ins class="adsbygoogle">`)는 아직 없다. 이 함수는 스크립트만 올려 두고,
 * 어디에 어떤 광고를 넣을지는 화면을 만들 때 정한다. **전화번호·인증코드를 받는 화면에는
 * 넣지 않는 것을 전제로 한다** — 애초에 그 화면(`/run/session/`)은 이 로더를 부르지도 않는다.
 */
export function initAds(): void {
  if (!ADSENSE) return;

  const tag = document.createElement('script');
  tag.async = true;
  tag.crossOrigin = 'anonymous';
  tag.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(ADSENSE)}`;
  document.head.appendChild(tag);
}
