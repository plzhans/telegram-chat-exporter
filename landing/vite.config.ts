import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { readFileSync } from 'node:fs';
import {
  DEFAULT_LANGUAGE,
  PREFIXED_LANGUAGES,
  SUPPORTED_LANGUAGES,
  dirOf,
  langSegment,
  type SeoMeta,
  type SupportedLanguage,
} from './src/i18n/languages';
/*
  랜딩은 React 컴포넌트지만 **빌드할 때 한 번 그려지고 끝난다**(아래 `landingDoc`).
  `react-dom/server` 는 그 렌더에만 쓰이므로 앱 번들에는 들어가지 않는다.

  여기서 `src/landing/*.tsx` 를 직접 import 한다. 그래서 이 설정 파일을 esbuild 가
  묶을 때 JSX 를 만나는데, 루트 `tsconfig.json` 의 `jsx` 설정이 그 처리를 정한다 -
  없으면 클래식 런타임으로 떨어져 `React is not defined` 로 죽는다.

  랜딩 파일들이 `@/` 별칭 대신 상대경로를 쓰는 이유도 이것이다. 그 별칭은 Vite 가 앱을
  묶을 때만 풀어 주고, 설정 파일을 묶는 esbuild 는 모른다.
*/
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Landing } from './src/Landing';
import { DEFAULT_RELEASE_ASSET, githubLatestDownloadUrl, ownerOf } from './src/config/release';
import { SHOT_COUNT, shotDir, shotName } from './src/config/shots';
import { execFileSync } from 'node:child_process';
import type { LandingText } from './src/context';

/**
 * 게시될 도메인. 배포하는 쪽이 알려 준다.
 *
 * 비어 있으면 절대 주소를 만들지 않고 상대 경로로 둔다. 로컬 빌드는 게시되지 않으므로
 * 정식 주소라는 게 없다.
 */
const SITE_ORIGIN = (process.env.SITE_ORIGIN ?? '').replace(/\/+$/, '');

/** 언어별 문구는 로케일 JSON 이 들고 있다. 언어가 늘어도 이 파일은 그대로다. */
const localeOf = (lang: SupportedLanguage): Record<string, never> & Record<string, unknown> =>
  JSON.parse(readFileSync(path.resolve(__dirname, `locales/${lang}.json`), 'utf8'));

const seoOf = (lang: SupportedLanguage): SeoMeta => localeOf(lang).seo as SeoMeta;

/**
 * 랜딩 문구. **없으면 한국어가 아니라 영어로 떨어진다.**
 *
 * 전역 폴백은 기본 언어(한국어)지만, 랜딩만은 영어로 받는다. 랜딩은 한국어·영어부터 넣고
 * 나머지를 뒤따라 채우는데, 그동안 일본어 주소에 한국어 홍보문이 뜨는 것은 영어가 뜨는
 * 것보다 나쁘다 — 읽을 수 있는 사람이 훨씬 적다.
 *
 * 로케일 JSON 에 `landing` 블록이 생기는 순간 저절로 그 언어를 쓴다. 여기는 안 고쳐도 된다.
 */
const landingTextOf = (lang: SupportedLanguage): LandingText => {
  const own = localeOf(lang);
  const fallback = localeOf('en-us');
  return {
    app: (own.app ?? fallback.app) as LandingText['app'],
    common: (own.common ?? fallback.common) as LandingText['common'],
    landing: (own.landing ?? fallback.landing) as LandingText['landing'],
  };
};

/** 랜딩이 부르는 애널리틱스 파일. 해시를 붙이지 않아 HTML 쪽에서 이름을 알 수 있다. */
const ANALYTICS_FILE = 'assets/analytics.js';

/** 푸터 저작권 연도. 랜딩은 버전·커밋을 보여 주지 않으므로 이 한 값이면 된다. */
const COPYRIGHT_YEAR = new Date().getFullYear();

/**
 * 구조화 데이터에 적을 판 번호. **루트 `package.json` 에서 읽는다.**
 *
 * `landing/package.json` 은 0.0.0 으로 두고 쓰지 않는다 - release-please 가 올려 주는
 * 것은 루트 하나뿐이라(`.release-please-manifest.json`), 여기서 읽어야 릴리스마다
 * 저절로 맞는다. 손으로 적어 두면 반드시 낡는다.
 */
const APP_VERSION = (
  JSON.parse(readFileSync(path.resolve(__dirname, '../package.json'), 'utf8')) as {
    version?: string;
  }
).version;

/** 구조화 데이터에 몇 장까지 적을지. 열여덟 장을 다 적을 이유는 없다. */
const SCHEMA_SCREENSHOT_COUNT = 3;

/**
 * 이 언어판 문구가 마지막으로 바뀐 날(`YYYY-MM-DD`). 사이트맵의 `lastmod` 에 쓴다.
 *
 * **빌드 시각을 쓰면 안 된다.** 내용이 그대로인데 배포할 때마다 날짜가 새로 찍히면
 * 구글이 이 값을 못 믿게 되고, 결국 통째로 무시한다 - 넣느니만 못하다. 그래서 그 판의
 * 문구 파일이 실제로 고쳐진 날, 즉 git 이 아는 마지막 커밋 날짜를 쓴다.
 *
 * 날짜를 못 구하면(git 이 없는 환경, 얕은 클론, 아직 커밋 안 된 파일) `null` 을 주고
 * 사이트맵은 그 줄을 아예 빼 버린다. 지어낸 날짜를 적는 것보다 없는 편이 낫다.
 */
const localeLastmod = (lang: SupportedLanguage): string | null => {
  try {
    const out = execFileSync(
      'git',
      ['log', '-1', '--format=%cs', '--', `locales/${lang}.json`],
      { cwd: __dirname, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    ).trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(out) ? out : null;
  } catch {
    return null;
  }
};


/**
 * 애널리틱스·광고 스위치.
 *
 * `process.env` 만 보면 안 된다. `.env.local` 은 Vite 가 읽어서 `import.meta.env` 로만
 * 넣어 주므로, 설정 파일에서 `process.env` 로 확인하면 **앱 코드는 켜졌는데 CSP 는 닫힌**
 * 상태가 된다. 그러면 배포본에서 스크립트가 조용히 차단된다.
 */
function switches(mode: string) {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    ga: env.VITE_GOOGLE_ANALYTICS_ID ?? '',
    ads: env.VITE_GOOGLE_ADSENSE_ID ?? '',
  };
}

/**
 * CSP 정책 문자열.
 *
 * 이 앱의 신뢰 근거는 "코드를 읽어보세요"가 아니라 **브라우저가 강제하는 CSP** 다.
 * `connect-src` 를 텔레그램 WebSocket 으로만 열어두면, 설령 이 코드가 악의적이어도
 * 전화번호·인증코드·대화 내용을 다른 서버로 내보낼 수 없다. 사용자가 개발자도구
 * Network 탭만 열어봐도 검증된다.
 *
 * @param scriptSelf 우리 코드를 가리키는 출처. 웹 배포는 `'self'` 다. `file://` 배포는
 *   `'self'` 가 아무것도 가리키지 못해서 `file:` 스킴을 같이 연다(`fileProtocolPage()`).
 */
function policyOf(on: { ga: string; ads: string }, scriptSelf: string): string {
  /**
   * 애널리틱스를 켜면 그만큼 CSP 가 느슨해진다. gtag.js 를 받을 호스트와 수집 요청을 보낼
   * 호스트가 열린다 - 즉 "텔레그램 외에는 아무 데도 못 보낸다"가 더는 참이 아니다.
   * 그 대가를 감수하는 대신 여는 범위는 필요한 호스트로만 좁힌다.
   */
  const gaScript = on.ga ? ' https://*.googletagmanager.com' : '';
  const gaConnect = on.ga
    ? ' https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com'
    : '';
  const gaImg = on.ga ? ' https://*.google-analytics.com https://*.googletagmanager.com' : '';

  /**
   * 애드센스는 **도메인 허용목록으로 못 막는다.**
   *
   * 구글 공식 문서(support.google.com/adsense/answer/16283098)가 지원한다고 밝힌 유일한
   * 형태는 nonce 기반이고, 요구 사항이 이것이다:
   *
   *     script-src 'nonce-{매 응답마다 새 값}' 'unsafe-inline' 'unsafe-eval' 'strict-dynamic' https:
   *
   * 광고가 쓰는 도메인이 수시로 바뀌기 때문에 허용목록은 권장하지 않는다고 명시돼 있다.
   * 그리고 **이 사이트는 서버가 없어서 nonce 를 만들 수 없다** - 정적 파일은 응답마다 값을
   * 바꿔 줄 주체가 없다. 그래서 남는 선택지는 `https:` 를 통째로 여는 것뿐이다.
   *
   * 그렇게 열면 script-src 는 사실상 없는 것과 같아진다. 아무 https 출처의 스크립트가
   * 실행되고 `eval` 도 열린다. 이 앱은 전화번호와 로그인 코드를 받는 화면이라 그 대가가
   * 특히 크다 - DEVELOP.ko.md 의 "애널리틱스와 광고" 참고.
   *
   * 그래도 켜겠다면 값을 넣는 순간 이 정책이 적용된다. 숨기지 않는다.
   */
  const adScript = on.ads ? " 'unsafe-inline' 'unsafe-eval' 'strict-dynamic' https:" : '';
  const adConnect = on.ads ? ' https:' : '';
  const adImg = on.ads ? ' https:' : '';
  const adFrame = on.ads ? ['frame-src https:'] : [];

  return [
    // 기본은 전부 차단. 아래에서 필요한 것만 연다.
    "default-src 'none'",
    `script-src ${scriptSelf}${gaScript}${adScript}`,
    // Tailwind 가 만든 CSS 는 파일로 나가지만, 일부 라이브러리가 인라인 style 속성을 쓴다.
    "style-src 'self' 'unsafe-inline'",
    // blob: 는 다운로드한 미디어 미리보기, data: 는 인라인 SVG 아이콘용.
    `img-src 'self' data: blob:${gaImg}${adImg}`,
    "font-src 'self'",
    /**
     * **여기가 핵심이다.** 텔레그램 MTProto WebSocket 외의 모든 네트워크 요청이 막힌다.
     *
     * GramJS 는 브라우저에서 `wss://{pluto,venus,aurora,vesta,flora}[-1].web.telegram.org:443/apiws`
     * 로 붙는다(DC 1~5, `-1` 은 미디어 다운로드 전용 DC). 미디어도 같은 연결을 타므로
     * 추가로 열 호스트가 없다.
     *
     * 포트를 뺀 표기(`wss://*.web.telegram.org`)도 스펙상 스킴 기본 포트(443)에 매칭되지만,
     * GramJS 가 URL 에 `:443` 을 명시적으로 붙이므로 두 형태를 모두 적어 둔다.
     */
    `connect-src wss://*.web.telegram.org wss://*.web.telegram.org:443${gaConnect}${adConnect}`,
    // 내보내기 파일 저장용 blob: URL.
    "form-action 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
    ...adFrame,
  ].join('; ');
}

/**
 * 배포본에만 CSP 를 심는다.
 *
 * 개발 모드에는 넣지 않는다. Vite HMR 이 `ws://localhost` 로 붙고 React Fast Refresh 가
 * 인라인 스크립트를 끼워넣어서, 같은 정책을 적용하면 dev 서버가 아예 안 뜬다.
 *
 * `file://` 배포는 이 플러그인을 쓰지 않는다. 여는 범위가 달라서 정책이 갈리고, 응답
 * 헤더를 붙여 줄 서버도 없다 — `fileProtocolPage()` 가 자기 몫을 따로 심는다.
 */
function contentSecurityPolicy(isBuild: boolean, on: { ga: string; ads: string }): Plugin {
  const policy = policyOf(on, "'self'");

  return {
    name: 'telegram-chat-exporter:csp',
    transformIndexHtml(html) {
      if (!isBuild) return html;
      return html.replace(
        '<head>',
        `<head>\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`,
      );
    },
    /**
     * Cloudflare Pages·Netlify 용 응답 헤더를 **같은 정책에서 만든다.**
     *
     * 예전에는 `public/_headers` 에 정책을 손으로 한 벌 더 적어 뒀는데, 그러면 한쪽만
     * 고쳤을 때 조용히 어긋난다. meta 는 열려 있는데 헤더는 막혀 있으면 배포처에 따라
     * 되기도 하고 안 되기도 한다.
     */
    generateBundle() {
      if (!isBuild) return;
      const headers = [
        '/*',
        `  Content-Security-Policy: ${policy}`,
        '  X-Content-Type-Options: nosniff',
        '  Referrer-Policy: no-referrer',
        '  Cross-Origin-Opener-Policy: same-origin',
        '  Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()',
        '',
      ].join('\n');
      this.emitFile({ type: 'asset', fileName: '_headers', source: headers });
    },
  };
}

/**
 * 언어마다 진짜 HTML 파일을 하나씩 더 찍는다. `/en-us/` 면 `dist/en-us/index.html`.
 *
 * SPA 폴백(404.html)으로 때우면 그 주소는 응답 코드가 404 라 검색엔진이 색인하지 않는다.
 * 언어별 주소를 만드는 목적이 색인이므로 실제 파일이 있어야 한다.
 *
 * 기본 언어는 `index.html` 그 자체다.
 */
/**
 * 랜딩 전용 애널리틱스 로더.
 *
 * 랜딩에는 앱 번들이 없으므로 `src/shared/analytics/gtag.ts` 의 `initAnalytics()` 가 돌지
 * 않는다. 그런데 그 함수가 보내던 유일한 이벤트가 **첫 화면 방문**이었다 — 그대로 두면
 * 프리렌더로 바꾸는 순간 통계가 통째로 멎는다.
 *
 * 구글이 주는 스니펫은 `<script>` 안에 설정 코드가 들어 있어 `script-src 'unsafe-inline'`
 * 을 요구한다. **그건 내주지 않는다** — 인라인이 열리는 순간 XSS 한 방이 곧 인증코드
 * 탈취가 되고, 이 앱이 신뢰를 청하는 근거가 무너진다. 그래서 같은 일을 하는 **자기 파일**
 * 하나를 내보내고 `<script src>` 로 부른다. `script-src 'self'` 로 덮이므로 정책을 한 칸도
 * 더 열지 않는다.
 *
 * 보내는 값은 앱 쪽과 같은 규칙이다. 자동 수집을 끄고 지금 경로만 보낸다 — 랜딩 주소에는
 * 대화방 id 가 들어갈 자리가 없으므로 이 화면에서는 그대로 보내도 안전하다.
 */
function landingAnalytics(id: string): string {
  return `(function () {
  var id = ${JSON.stringify(id)};
  var tag = document.createElement('script');
  tag.async = true;
  tag.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id);
  document.head.appendChild(tag);

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  gtag('js', new Date());
  gtag('config', id, { send_page_view: false, page_path: location.pathname, anonymize_ip: true });
  gtag('event', 'page_view', { page_path: location.pathname });
})();
`;
}

function localizedPages(opts: {
  sourceUrl: string;
  /** 내려받기 버튼이 걸 주소. 이미 완성된 형태다. `src/config/release.ts` 참고. */
  downloadUrl: string;
  /** 푸터에 찍을 연도. 만든 사람 이름은 `sourceUrl` 에서 뽑으므로 여기 없다. */
  copyrightYear: number;
  /** 구글 애널리틱스 측정 ID. 비어 있으면 랜딩에 스크립트가 한 줄도 안 들어간다. */
  gaId: string;
  /**
   * "시작하기" 가 가리키는 exporter 진입 주소. **끝에 `/` 가 붙은 형태다.**
   *
   * exporter 는 별도로 배포되므로 그 위치는 배포가 정한다 — 서브패스(`/run/`)든
   * 서브도메인(`https://app.example.com/`)이든 루트(`/`)든 여기로 넘어온 값을 그대로 쓴다.
   * 언어 조각은 이 뒤에 붙는다.
   */
  appUrl: string;
}): Plugin {
  /** Vite 가 최종 결정한 `base`. `--base` 로 넘어온 값이 반영된 뒤라 이걸 써야 한다. */
  let base = '/';

  /**
   * 랜딩 스크린샷 슬라이더 스크립트.
   *
   * **앱 번들과 따로 빌드한다.** 별개의 진입점으로 emit 하므로 랜딩을 연 사람이 앱의
   * MTProto 라이브러리까지 받는 일이 없다. 이름은 Rollup 이 해시로 정하니 emit 할 때 받은
   * 표를 들고 있다가 `generateBundle` 에서 실제 파일명을 묻는다.
   */
  let sliderRef = '';
  let sliderFile = '';

  const canonicalOf = (lang: SupportedLanguage) =>
    `${SITE_ORIGIN}${base}${langSegment(lang) ? `${langSegment(lang)}/` : ''}`;

  /** `x-default` 는 어느 언어도 맞지 않을 때 보낼 곳이라 기본 언어를 가리킨다. */
  const alternates = () =>
    [
      ...SUPPORTED_LANGUAGES.flatMap((l) =>
        seoOf(l).hreflang.map(
          (tag) => `<link rel="alternate" hreflang="${tag}" href="${canonicalOf(l)}" />`,
        ),
      ),
      `<link rel="alternate" hreflang="x-default" href="${canonicalOf(DEFAULT_LANGUAGE)}" />`,
    ].join('\n    ');

  /**
   * sitemap.xml. 색인 대상은 랜딩뿐이라(`/` 와 `/<언어>/`) 앱 주소(`start/`·`404.html`)는
   * 넣지 않는다 — 그쪽은 JS 로 붙는 인증 화면이라 색인 가치가 없다.
   *
   * 각 URL 에 hreflang 대안을 `xhtml:link` 로 함께 적는다. 페이지의 `<link hreflang>`
   * 과 같은 목록을 여기서도 들고 있어야 구글이 언어판을 짝지어 준다. 목록이 `alternates()`
   * 와 같은 출처(`seoOf().hreflang`·`canonicalOf`)에서 나오므로 어긋날 수 없다.
   *
   * **절대 주소가 없으면(로컬 빌드) 만들지 않는다.** 사이트맵은 상대 경로를 허용하지
   * 않아서 `SITE_ORIGIN` 이 비면 유효한 문서가 될 수 없다.
   */
  const sitemap = () => {
    const alt = [
      ...SUPPORTED_LANGUAGES.flatMap((l) =>
        seoOf(l).hreflang.map(
          (tag) => `    <xhtml:link rel="alternate" hreflang="${tag}" href="${canonicalOf(l)}" />`,
        ),
      ),
      `    <xhtml:link rel="alternate" hreflang="x-default" href="${canonicalOf(DEFAULT_LANGUAGE)}" />`,
    ].join('\n');
    const urls = SUPPORTED_LANGUAGES.map((lang) => {
      const lastmod = localeLastmod(lang);
      return [
        '  <url>',
        `    <loc>${canonicalOf(lang)}</loc>`,
        // 날짜를 못 구하면 줄째로 뺀다(`localeLastmod` 주석 참고).
        ...(lastmod ? [`    <lastmod>${lastmod}</lastmod>`] : []),
        alt,
        '  </url>',
      ].join('\n');
    });
    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
      ...urls,
      '</urlset>',
      '',
    ].join('\n');
  };

  const attr = (v: string) => v.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

  /**
   * 태그를 찾아 **값을 덮어쓴다.** 원본 문자열을 찾아 바꾸는 방식이 아니다.
   *
   * 찾아 바꾸기로 하면 `index.html` 의 문구가 로케일 JSON 과 한 글자라도 어긋나는 순간
   * 조용히 실패한다 — 그 언어판만 다른 언어 문구를 그대로 달고 나간다. 덮어쓰면
   * `index.html` 의 값은 개발 모드용 자리표시자일 뿐이라 어긋날 수가 없다.
   */
  const setMeta = (html: string, kind: 'name' | 'property', key: string, value: string) =>
    html.replace(
      new RegExp(`(<meta\\s+${kind}="${key}"\\s+content=")[^"]*(")`),
      `$1${attr(value)}$2`,
    );

  /** 한 언어분 문구·주소를 문서에 적용한다. */
  const applySeo = (html: string, lang: SupportedLanguage) => {
    const meta = seoOf(lang);
    const url = canonicalOf(lang);

    /**
     * `dir` 은 원본 `index.html` 에 없을 수도 있어서(기본 언어가 ltr 이라 굳이 안 적는다)
     * 속성 하나를 갈아 끼우는 대신 여는 태그를 통째로 다시 쓴다.
     */
    let out = html
      .replace(/<html[^>]*>/, `<html lang="${meta.tag}" dir="${dirOf(lang)}">`)
      .replace(/<title>[^<]*<\/title>/, `<title>${meta.title}</title>`)
      .replace(/(rel="canonical" href=")[^"]*(")/, `$1${url}$2`);

    out = setMeta(out, 'name', 'description', meta.description);
    out = setMeta(out, 'property', 'og:title', meta.shareTitle);
    out = setMeta(out, 'property', 'og:description', meta.shareDescription);
    out = setMeta(out, 'property', 'og:url', url);
    out = setMeta(out, 'name', 'twitter:title', meta.shareTitle);
    out = setMeta(out, 'name', 'twitter:description', meta.shareDescription);

    /*
      공유 카드 그림은 **절대 주소여야** 한다. 상대 경로를 적으면 슬랙·트위터·카카오톡이
      풀지 못해 카드에 그림이 아예 안 뜬다 - 문서 안에서만 도는 `canonical` 과 다르다.

      정식 주소가 없는 로컬 빌드에서는 손대지 않고 `index.html` 의 `/og.png` 를 그대로
      둔다. 개발 중에는 그 편이 실제로 열리고, 어차피 그 빌드는 게시되지 않는다.
    */
    if (SITE_ORIGIN) {
      const ogImage = `${SITE_ORIGIN}${base}og.png`;
      out = setMeta(out, 'property', 'og:image', ogImage);
      out = setMeta(out, 'name', 'twitter:image', ogImage);
    }
    // 그림 안 글씨는 영어 한 벌이지만 대체 텍스트는 그 판의 말로 읽히게 둔다.
    out = setMeta(out, 'property', 'og:image:alt', meta.shareTitle);

    /*
      캐러셀 첫 장을 미리 받아 둔다. 이 그림이 데스크톱 LCP 요소인데, preload 가 없으면
      CSS 를 다 읽고 나서야 요청이 시작된다 - `<img>` 는 문서 아래쪽에 있고 브라우저는
      그때까지 이 그림이 필요한 줄 모른다.

      **`type` 을 적어야 한다.** 화면에 걸리는 것은 `<picture>` 라 WebP 를 못 읽는
      브라우저는 PNG 로 떨어지는데, 여기에 `type` 이 없으면 그런 브라우저까지 WebP 를
      받아 두고 쓰지도 않는다 - 안 쓸 파일을 최우선으로 받는 셈이라 되레 느려진다.

      주소가 언어를 탄다(`shotDir`). 판마다 제 그림을 미리 받아야지, 한 벌로 박아 두면
      영어판을 받아 놓고 화면은 다른 그림을 걸어 첫 장을 두 번 받는다.

      **넣기 전에 먼저 지운다.** 이 함수는 기본 언어를 이미 한 번 거친 문서에 다시 걸린다
      (`transformIndexHtml` 이 셸에 기본판을 찍고, `generateBundle` 이 그 셸을 받아 언어판을
      찍는다). 위 `setMeta` 들은 값을 덮어쓰니 겹칠 일이 없지만 이 줄은 새로 붙이는 것이라,
      지우지 않으면 언어판마다 preload 가 둘씩 남아 안 쓸 기본판 그림까지 최우선으로
      받아 온다 - 바로 위에서 경계한 "첫 장을 두 번 받는다"가 그대로 일어난다.
    */
    const firstShot = `${base}${shotDir(lang)}shot-${shotName(0)}.webp`;
    out = out
      .replace(/\s*<link rel="preload" as="image"[^>]*\/>/g, '')
      .replace(
        '</head>',
        `  <link rel="preload" as="image" href="${firstShot}" type="image/webp" fetchpriority="high" />\n  </head>`,
      );

    // og:locale 은 언어 수가 늘어도 맞도록 통째로 다시 만든다.
    const localeTags = [
      `<meta property="og:locale" content="${meta.ogLocale}" />`,
      ...SUPPORTED_LANGUAGES.filter((l) => l !== lang).map(
        (l) => `<meta property="og:locale:alternate" content="${seoOf(l).ogLocale}" />`,
      ),
    ].join('\n    ');

    out = out
      .replace(/\s*<meta property="og:locale(?::alternate)?" content="[^"]*" \/>/g, '')
      .replace('<meta name="twitter:card"', `${localeTags}\n    <meta name="twitter:card"`);

    /*
      구조화 데이터. 값은 **`JSON.stringify` 로 통째로** 만들어 넣는다.

      전에는 따옴표만 손으로 이스케이프했는데, 역슬래시가 든 문구가 오면 JSON 이 깨졌다.
      바꿔 넣는 쪽도 문자열이 아니라 함수다 - 문자열이면 값 안의 `$&` 같은 조각을
      치환 지시로 읽어 버린다.
    */
    /** `"key": <값>` 을 통째로 갈아 끼운다. 함수라 값 안의 `$` 가 치환 지시로 안 읽힌다. */
    /*
      갈아 끼울 수 있는 값의 모양은 셋이다 - 문자열, 납작한 배열, 납작한 객체
      (`author` 처럼 `{"@type": …, "name": …}` 한 겹). **중첩은 못 받는다.** 배열 안에
      `]` 이, 객체 안에 `}` 이 없다고 보고 거기까지를 값으로 끊기 때문이다. 자리표시자를
      더 복잡하게 쓸 일이 생기면 이 정규식이 아니라 문서 전체를 다시 만드는 쪽이 맞다.
    */
    const setJson = (source: string, key: string, value: unknown) =>
      source.replace(
        new RegExp(`"${key}": (?:"[^"]*"|\\[[^\\]]*\\]|\\{[^}]*\\}|true|false)`),
        () => `"${key}": ${JSON.stringify(value)}`,
      );

    /** 이 판이 실제로 거는 스크린샷. 언어를 타므로(`shotDir`) 판마다 다르다. */
    const screenshots = Array.from(
      { length: Math.min(SCHEMA_SCREENSHOT_COUNT, SHOT_COUNT) },
      (_, i) => `${SITE_ORIGIN}${base}${shotDir(lang)}shot-${shotName(i)}.png`,
    );

    /*
      기능 목록은 **대조표의 "이 도구" 칸을 그대로 가져온다.** 새로 쓰면 열다섯 언어를
      또 번역해야 하는데, 그 칸은 이미 열다섯 판에 다 번역되어 있고 내용도 정확히
      "이 도구가 무엇을 하는가" 다.
    */
    const rows = landingTextOf(lang).landing.why.rows;
    const featureList = Object.values(rows).map((r) => r.ours);

    let data = setJson(out, 'url', url);
    data = setJson(data, 'description', meta.shareDescription);
    data = setJson(data, 'softwareVersion', APP_VERSION);
    data = setJson(data, 'downloadUrl', opts.downloadUrl);
    data = setJson(data, 'license', `${opts.sourceUrl}/blob/main/LICENSE`);
    data = setJson(data, 'sameAs', [opts.sourceUrl]);
    data = setJson(data, 'featureList', featureList);

    const owner = ownerOf(opts.sourceUrl);
    if (owner) {
      const person = { '@type': 'Person', name: owner.name, url: owner.url };
      data = setJson(data, 'author', person);
      data = setJson(data, 'publisher', person);
    }
    // 정식 주소가 없는 로컬 빌드에서는 그림 주소를 만들 수 없으니 자리표시자를 둔다.
    if (SITE_ORIGIN) {
      data = setJson(data, 'image', `${SITE_ORIGIN}${base}og.png`);
      data = setJson(data, 'screenshot', screenshots);
    }
    return setJson(
      data,
      'inLanguage',
      SUPPORTED_LANGUAGES.map((l) => seoOf(l).tag),
    );
  };

  return {
    name: 'telegram-chat-exporter:localized-pages',
    apply: 'build',
    /**
     * `post` 여야 한다. `index.html` 을 번들에 넣는 건 Vite 코어의 `vite:build-html` 이고
     * 일반 플러그인의 `generateBundle` 은 그보다 먼저 돌아서, 복사할 원본이 아직 없다.
     */
    enforce: 'post',
    configResolved(config) {
      base = config.base;
    },
    buildStart() {
      sliderRef = this.emitFile({
        type: 'chunk',
        id: path.resolve(__dirname, 'src/slider.ts'),
        name: 'landing-slider',
      });
    },
    transformIndexHtml(html) {
      // hreflang 은 모든 언어판이 같은 목록을 들고 있어야 하므로 여기서 한 번만 심는다.
      return applySeo(html, DEFAULT_LANGUAGE).replace(
        '</head>',
        `  ${alternates()}\n  </head>`,
      );
    },
    generateBundle(_options, bundle) {
      const index = bundle['index.html'];
      if (!index || index.type !== 'asset') return;

      /** Vite 가 만든 원본. 스크립트가 붙어 있는 **앱 셸**이다. */
      const shell = String(index.source);

      // 해시가 붙은 실제 파일명은 이 시점에야 정해진다.
      sliderFile = this.getFileName(sliderRef);

      /*
        이 프로젝트는 랜딩만 찍는다 — 앱 셸(`start/index.html`·`404.html`)은 exporter 쪽
        빌드가 자기 base(`/run/`)에 따로 낸다. 여기서는 마케팅 문서와 그 부속물뿐이다.
      */
      if (opts.gaId) {
        this.emitFile({
          type: 'asset',
          fileName: ANALYTICS_FILE,
          source: landingAnalytics(opts.gaId),
        });
      }

      /**
       * 그리고 **첫 화면은 정적 HTML 로 갈아 끼운다.**
       *
       * 색인되는 주소는 `/` 와 `/<언어>/` 뿐이라, 크롤러가 실제로 읽는 문서가 이것들이다.
       * 여기에 본문이 없으면(빈 `<div id="root">` 뿐이면) 구글은 렌더 큐를 한 바퀴 더 돌아야
       * 내용을 보고, JS 를 실행하지 않는 크롤러는 영영 못 본다. 자세한 근거는
       * `src/landing/Landing.tsx` 주석 참고.
       */
      index.source = landingDoc(shell, DEFAULT_LANGUAGE);
      for (const lang of PREFIXED_LANGUAGES) {
        this.emitFile({
          type: 'asset',
          fileName: `${langSegment(lang)}/index.html`,
          source: landingDoc(applySeo(shell, lang), lang),
        });
      }

      /**
       * sitemap 과 robots 는 절대 주소가 있을 때(게시 빌드)만 찍는다. 로컬 빌드는
       * 정식 주소가 없어(`SITE_ORIGIN` 이 빔) 유효한 사이트맵을 만들 수 없다.
       */
      if (SITE_ORIGIN) {
        this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemap() });
        this.emitFile({
          type: 'asset',
          fileName: 'robots.txt',
          source: `User-agent: *\nAllow: /\nSitemap: ${SITE_ORIGIN}${base}sitemap.xml\n`,
        });
      }
    },
  };

  /**
   * 앱 셸에서 스크립트를 걷어내고 그 자리에 랜딩 본문을 넣는다.
   *
   * `<head>` 를 새로 쓰지 않고 셸의 것을 그대로 쓰는 이유는, CSP·canonical·hreflang·
   * og·구조화 데이터가 이미 그 안에서 언어별로 맞춰졌기 때문이다. 한 벌 더 만들면
   * 두 문서가 어긋난다.
   */
  function landingDoc(html: string, lang: SupportedLanguage): string {
    /**
     * 문서에 실제로 걸린 `connect-src` 를 그대로 화면에 보여 준다.
     *
     * 손으로 적으면 애널리틱스를 켜고 끌 때마다 어긋난다. 방금 심어 둔 정책에서 뽑으면
     * 어긋날 수가 없다 — 사용자가 개발자도구에서 대조하는 값과 같은 출처다.
     */
    const policy = /<meta http-equiv="Content-Security-Policy" content="([^"]*)"/.exec(html)?.[1];
    const connectSrc =
      policy
        ?.split(';')
        .map((part) => part.trim())
        .find((part) => part.startsWith('connect-src')) ?? '';

    /*
      JSX 대신 `createElement` 를 쓴다. Vite 는 설정 파일을 `vite.config.{js,ts,mts,…}`
      로만 찾아서 `.tsx` 가 될 수 없고, 그래서 이 파일에는 JSX 를 적을 수 없다. 랜딩
      컴포넌트 쪽은 `.tsx` 라 평범하게 JSX 로 쓴다 - 여기 한 줄만 이 모양이다.
    */
    const body = renderToStaticMarkup(
      createElement(Landing, {
        text: landingTextOf(lang),
        env: {
          lang,
          home: canonicalOf(lang),
          assetBase: base,
          /*
            "시작하기" 는 별도로 배포되는 exporter 로 가는 진짜 페이지 이동이다. 주소는
            배포가 정한 `opts.appUrl`(끝에 `/` 포함)에 언어 조각을 이어 붙인다 — 랜딩에서
            고른 언어가 앱에서도 유지된다.
          */
          start: `${opts.appUrl}${langSegment(lang) ? `${langSegment(lang)}/` : ''}`,
          languages: SUPPORTED_LANGUAGES.map((l) => ({
            code: l,
            href: `${base}${langSegment(l) ? `${langSegment(l)}/` : ''}`,
            label: String(localeOf(l).nativeName ?? l),
            current: l === lang,
            hreflang: seoOf(l).tag,
          })),
          connectSrc,
          analytics: Boolean(opts.gaId),
          sourceUrl: opts.sourceUrl,
          downloadUrl: opts.downloadUrl,
          copyrightYear: opts.copyrightYear,
        },
      }),
    );

    /*
      애널리틱스를 켠 빌드에만 붙는다. 앱 번들(gzip 530KB)과 달리 이건 1KB 도 안 되고
      `async` 라 렌더를 막지 않는다.
    */
    const analytics = opts.gaId
      ? `\n    <script src="${base}${ANALYTICS_FILE}" async></script>`
      : '';

    /*
      스크린샷 슬라이더. **위에서 모듈 스크립트를 걷어낸 뒤에 붙어야** 살아남는다 -
      아래 `replace` 순서가 그래서 중요하다.

      `type="module"` 이라 기본이 defer 다. 렌더를 막지 않고, 이게 늦게 와도 슬라이더는
      가로 스크롤로 이미 동작한다(`slider.ts` 주석).
    */
    const slider = `\n    <script type="module" src="${base}${sliderFile}"></script>`;

    return (
      html
        /*
          모듈 스크립트와 그 프리로드를 걷어낸다. 이 문서는 앱 코드를 한 줄도 받지 않는다 —
          랜딩의 무게를 줄이는 것이 프리렌더의 절반이다(나머지 절반이 본문 HTML).
        */
        .replace(/\s*<script\s+type="module"[^>]*><\/script>/g, '')
        .replace(/\s*<link\s+rel="modulepreload"[^>]*>/g, '')
        .replace('<div id="root"></div>', body)
        .replace('</body>', `${analytics}${slider}\n  </body>`)
    );
  }
}

export default defineConfig(({ command, mode }) => {
  const on = switches(mode);

  /**
   * 랜딩이 쓸 바깥 주소들. **랜딩은 `import.meta.env` 를 못 읽으므로 여기서 정한다** -
   * 빌드 도중 Node 에서 한 번 그려지고 끝나기 때문이다(`src/config/release.ts` 주석).
   *
   * 접두사를 비워 `loadEnv` 를 부르므로 `VITE_` 가 붙지 않은 변수도 읽힌다.
   */
  const env = loadEnv(mode, process.cwd(), '');
  const repoUrl = env.VITE_GITHUB_REPO_URL || 'https://github.com/plzhans/telegram-chat-exporter';

  /**
   * 내려받기 버튼이 걸 주소.
   *
   * **주소를 통째로 받는다.** 기본값은 이 저장소의 GitHub 릴리스지만, 배포처가 GitHub 가
   * 아닐 수도 있어서(자체 서버·CDN·S3 등) 그때는 조립할 규칙이 아예 다르다. 값이 들어오면
   * 손대지 않고 그대로 쓴다.
   */
  const downloadUrl =
    env.VITE_RELEASE_DOWNLOAD_URL ||
    githubLatestDownloadUrl(repoUrl, env.VITE_RELEASE_ASSET_FILE_NAME || DEFAULT_RELEASE_ASSET);

  /**
   * "시작하기" 가 가리키는 exporter 진입 주소. **끝에 `/` 를 붙여 둔다.**
   *
   * exporter 는 이 랜딩과 별개로 배포되므로 위치를 여기서 못 박지 않는다. 기본값은 같은
   * 도메인의 `/run/` 서브패스지만, 배포가 원하면 서브도메인(`https://app.example.com/`)이나
   * 루트(`/`)로 `VITE_APP_URL` 을 넘긴다 — 소스는 그대로다.
   */
  const rawAppUrl = env.VITE_APP_URL || '/run/';
  const appUrl = rawAppUrl.endsWith('/') ? rawAppUrl : `${rawAppUrl}/`;

  /**
   * SPA(일반 React) vs SSG(프리렌더 정적 HTML).
   *
   * - **dev 는 늘 SPA** 다(`command === 'serve'`) — 그래야 랜딩을 HMR 로 보며 만든다.
   * - **빌드는 기본이 SSG** 다. 그래서 CI·클론은 `LANDING_SPA` 가 없어 자동으로 안전한
   *   정적본을 낸다(빈 `#root` 를 배포하는 사고가 없다). `.env.local` 에 `LANDING_SPA=1`
   *   을 두면 SPA 로 빌드해 `preview` 로 확인할 수 있다.
   *
   * `spa` 면 프리렌더 플러그인(`localizedPages`)을 끄고, `main.tsx` 가 클라이언트로 그린다.
   */
  const spa = command === 'serve' || Boolean(env.LANDING_SPA);

  return {
    /**
     * 도메인 루트가 랜딩이라 기본 `base` 는 `/` 다. 하위 경로에 올리는 쪽에서만 `--base` 로
     * 넘긴다(배포 설정이 아는 사실이라 여기 적지 않는다).
     */
    base: '/',
    plugins: [
      react(),
      contentSecurityPolicy(command === 'build', on),
      /*
        SSG 일 때만 프리렌더한다. SPA(dev·`LANDING_SPA`)에서는 이 플러그인을 빼서 모듈
        스크립트를 그대로 두고, `main.tsx` 가 브라우저에서 <Landing> 을 그린다.
      */
      ...(spa
        ? []
        : [
            localizedPages({
              sourceUrl: repoUrl,
              downloadUrl,
              copyrightYear: COPYRIGHT_YEAR,
              gaId: on.ga,
              appUrl,
            }),
          ]),
    ],
    define: {
      __LANDING_SPA__: JSON.stringify(spa),
    },
    server: {
      host: true,
      /* exporter dev(5175)와 겹치지 않게 랜딩은 5180 을 쓴다. */
      port: 5180,
      strictPort: true,
    },
    preview: {
      port: 5181,
      strictPort: true,
    },
    build: {
      // 도메인 루트 산출물. 배포 합성 때 이 폴더가 그대로 `/` 에 놓인다.
      outDir: 'dist',
    },
  };
});
