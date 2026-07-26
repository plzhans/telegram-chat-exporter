import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import path from 'path';
import { execSync } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import {
  PREFIXED_LANGUAGES,
  SUPPORTED_LANGUAGES,
  dirOf,
  langSegment,
  type SeoMeta,
  type SupportedLanguage,
} from './src/shared/i18n/languages';

/** 언어별 문구(로케일 JSON). 앱 셸의 `<html lang>` 태그를 만들 때 seo 블록만 읽는다. */
const localeOf = (lang: SupportedLanguage): Record<string, never> & Record<string, unknown> =>
  JSON.parse(readFileSync(path.resolve(__dirname, `src/shared/i18n/locales/${lang}.json`), 'utf8'));

const seoOf = (lang: SupportedLanguage): SeoMeta => localeOf(lang).seo as SeoMeta;

const pkg = JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf8')) as {
  version: string;
};

/** git 이 없거나 저장소가 아니면 `unknown`. 버전 표시 때문에 빌드가 죽으면 안 된다. */
function gitCommit(): string {
  try {
    return execSync('git rev-parse --short=7 HEAD', {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
  } catch {
    return 'unknown';
  }
}

const BUILD_INFO = {
  version: pkg.version,
  commit: gitCommit(),
  // 날짜까지만 쓴다. 시각까지 적으면 같은 코드의 재빌드가 매번 달라 보인다.
  date: new Date().toISOString().slice(0, 10),
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
 * 단일 파일 배포본의 `connect-src` 만 뽑아 온다.
 *
 * 애널리틱스·광고를 끈 채로 정책을 만든다 - 릴리스 워크플로가 그 값들을 넘기지 않고,
 * standalone 빌드는 넘어와도 무시한다(`switches` 를 안 부른다). 즉 배포본에서는 늘
 * 텔레그램만 열린다.
 */
function standaloneConnectSrc(): string {
  return (
    policyOf({ ga: '', ads: '' }, "'self' file:")
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith('connect-src')) ?? ''
  );
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
  /**
   * **문서마다 CSP가 갈린다.**
   *
   * - 방식 고르기(`method.html` → `/run/`): GA가 돌아 구글 호스트를 연다(`policyOf(on)`).
   * - 텔레그램(`index.html` → `/run/session/`): 전화번호·인증코드를 만지는 자리라 **텔레그램
   *   외엔 아무 데도 안 연다**(`policyOf({ga:'',ads:''})`). 이 앱의 핵심 약속이 여기서 강제된다.
   */
  const methodPolicy = policyOf(on, "'self'");
  const appPolicy = policyOf({ ga: '', ads: '' }, "'self'");

  return {
    name: 'telegram-chat-exporter:csp',
    transformIndexHtml(html, ctx) {
      if (!isBuild) return html;
      const policy = ctx.path.endsWith('method.html') ? methodPolicy : appPolicy;
      return html.replace(
        '<head>',
        `<head>\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`,
      );
    },
    /**
     * `_headers` 에는 **CSP를 넣지 않는다.**
     *
     * 실제 배포는 GitHub Pages 라 이 파일을 무시하고, 실효 CSP는 문서별 `<meta>` 가 맡는다
     * (두 구역이 정책이 다르다). 여기에 `/*` 로 CSP를 한 벌 더 적으면 Cloudflare/Netlify 로
     * 옮겼을 때 방식 문서가 앱 정책과 겹쳐 두 CSP의 교집합이 걸려 구글이 조용히 막힌다.
     * 그래서 하드닝 헤더만 남긴다.
     */
    generateBundle() {
      if (!isBuild) return;
      const headers = [
        '/*',
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
 * `file://` 에서 그대로 열리는 문서를 만든다. 받아서 압축을 풀고 `index.html` 을
 * 더블클릭하면 실행되는 배포용이다.
 *
 * 손댈 곳은 딱 하나, **스크립트 태그** 다. `file://` 은 `<script type="module">` 을
 * CORS 로 막는다(크롬·파이어폭스 공통, 실행 플래그 없이는 예외가 없다) — 반면 예전부터
 * 있던 일반 스크립트는 상대경로로 잘 읽는다. 그래서 번들을 모듈이 아닌 한 덩어리로 뽑고
 * (`build.rollupOptions.output`) 태그에서 `type="module"` 과 `crossorigin` 을 떼어낸다.
 * `crossorigin` 이 붙어 있으면 그것만으로 CORS 검사가 걸려서 또 막힌다.
 *
 * CSS·아이콘은 손댈 게 없다. 링크 태그는 원래 CORS 대상이 아니고, 경로는 `base: './'`
 * 로 이미 상대경로다.
 */
function fileProtocolPage(on: { ga: string; ads: string }): Plugin {
  /**
   * `file://` 문서의 출처는 이름 없는(opaque) 출처라 `'self'` 가 아무것도 가리키지 못한다.
   * 그래서 우리 파일을 읽으려면 `file:` 스킴을 열어야 한다 — "이 컴퓨터에 있는 파일"까지가
   * 범위다. **정작 중요한 `connect-src` 는 그대로다** — 이 배포본도 텔레그램 말고는 아무
   * 데도 연결하지 못한다.
   *
   * `frame-ancestors` 는 `<meta>` 로 주면 브라우저가 무시하면서 경고만 찍는다. 헤더를
   * 붙여 줄 서버가 없는 배포라 빼 둔다.
   */
  const local = ['style-src', 'img-src', 'font-src'];
  const policy = policyOf(on, "'self' file:")
    .split('; ')
    .filter((d) => !d.startsWith('frame-ancestors'))
    .map((d) => (local.some((k) => d.startsWith(k)) ? `${d} file:` : d))
    .join('; ');

  return {
    name: 'telegram-chat-exporter:file-protocol',
    apply: 'build',
    /**
     * `_redirects` 는 Cloudflare Pages 가 읽는 파일이다. 받아 가는 폴더에 끼어 있으면
     * 무슨 파일인지 설명할 길이 없다. `public/` 에서 같이 복사되므로 여기서 걷어낸다.
     */
    writeBundle(options) {
      rmSync(path.resolve(options.dir ?? 'dist-standalone', '_redirects'), { force: true });
    },
    transformIndexHtml(html) {
      return (
        html
          .replace(/<script type="module"/g, '<script defer')
          /**
           * `crossorigin` 은 스크립트든 스타일이든 **그것만으로 CORS 검사를 켠다.**
           * `file://` 은 그 검사를 통과할 수가 없어서(출처가 이름 없는 출처다) 붙어 있으면
           * 그대로 막힌다. 웹 배포에서 얻는 이점(오류 상세, 캐시 공유)은 여기서 의미가 없다.
           */
          .replace(/ crossorigin(?=[ />])/g, '')
          /**
           * 정식 주소라는 게 없는 사본이다. 누가 이 파일을 그대로 웹에 올려도 배포본과
           * 색인을 다투지 않도록 canonical 을 떼고 색인을 막는다.
           */
          .replace(/\s*<link rel="canonical"[^>]*>/, '')
          .replace(/(<meta name="robots" content=")[^"]*(")/, (_m, open: string, close: string) =>
            [open, 'noindex, nofollow', close].join(''),
          )
          .replace(
            '<head>',
            () => `<head>\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`,
          )
      );
    },
  };
}

/**
 * 로케일을 앱 번들에서 떼어 `i18n/<코드>.js` 로 따로 내보내고, `index.html` 이 앱보다
 * 먼저 불러오게 한다.
 *
 * `file://` 은 `fetch` 를 CORS 로 막지만 `<script src>` 로딩은 막지 않는다. 그래서
 * 로케일을 JSON 이 아니라 **자기를 전역에 등록하는 스크립트**로 내보낸다 — 받은 사람이
 * 리빌드 없이 `i18n/ko-kr.js` 한 파일만 고쳐 번역을 손볼 수 있다. 앱은 이 전역에서
 * 리소스를 읽는다(`resources.standalone.ts`).
 *
 * 스크립트 태그는 `head-prepend` 로 앱 스크립트보다 앞에 둔다. 로케일과 앱 모두 `defer`
 * (`fileProtocolPage` 가 `type="module"` 을 `defer` 로 바꾼다)라 문서 순서대로 실행되므로,
 * 앞에 두면 앱이 `window.__I18N__` 을 읽을 때 이미 채워져 있다.
 */
function standaloneLocales(): Plugin {
  return {
    name: 'telegram-chat-exporter:standalone-locales',
    apply: 'build',
    generateBundle() {
      for (const lang of SUPPORTED_LANGUAGES) {
        /*
          별도 `.js` 파일이라 HTML 안이 아니고, 그래서 `</script>` 이스케이프는 필요 없다.
          `||{}` 로 어느 파일이 먼저 실행돼도 같은 전역에 얹힌다.
        */
        const source = `window.__I18N__=window.__I18N__||{};window.__I18N__[${JSON.stringify(
          lang,
        )}]=${JSON.stringify(localeOf(lang))};\n`;
        this.emitFile({ type: 'asset', fileName: `i18n/${lang}.js`, source });
      }
    },
    transformIndexHtml() {
      return SUPPORTED_LANGUAGES.map((lang) => ({
        tag: 'script',
        attrs: { defer: true, src: `./i18n/${lang}.js` },
        injectTo: 'head-prepend' as const,
      }));
    },
  };
}

/**
 * exporter의 두 문서를 언어마다 찍어 자리에 배치한다.
 *
 * exporter는 CSP·GA가 갈리는 **두 문서**로 나뉜다(`contentSecurityPolicy` 주석):
 * - **방식 고르기**(`method.html`) → dist 루트 `index.html`(=`/run/`). GA·구글 open.
 * - **텔레그램 동작**(`index.html`, App) → `session/`(=`/run/session/`). 텔레그램 전용, GA 없음.
 *
 * 색인 대상이 아니라(SEO는 별도 랜딩) og·sitemap은 없고, 각 언어 셸이 하는 일은 둘이다 —
 * `<언어>/index.html`(직접 들어와도 200)과 `404.html`(SPA 폴백). `<html lang>`/`dir`만 맞춘다.
 */
function appShells(): Plugin {
  return {
    name: 'telegram-chat-exporter:app-shells',
    apply: 'build',
    /*
      `post` 여야 한다. html 을 번들에 넣는 건 Vite 코어의 `vite:build-html` 이고 일반 플러그인의
      `generateBundle` 은 그보다 먼저 돌아서, 복사할 원본이 아직 없다.
    */
    enforce: 'post',
    generateBundle(_options, bundle) {
      const index = bundle['index.html']; // App = 텔레그램 문서
      const method = bundle['method.html']; // 방식 고르기 문서
      if (!index || index.type !== 'asset') return;

      const sessionShell = String(index.source);
      // 방식 문서가 없으면(있을 리 없지만 방어) 세션 셸로 대체해 빌드는 죽지 않게 둔다.
      const methodShell = method && method.type === 'asset' ? String(method.source) : sessionShell;

      /** `<html ...>` 여는 태그를 그 언어의 태그·방향으로 다시 쓴다. */
      const forLang = (shell: string, lang: SupportedLanguage) =>
        shell.replace(/<html[^>]*>/, `<html lang="${seoOf(lang).tag}" dir="${dirOf(lang)}">`);

      // 방식 고르기 → 루트 `index.html`(=/run/) + 언어별 + 404 폴백.
      index.source = methodShell;
      this.emitFile({ type: 'asset', fileName: '404.html', source: methodShell });
      for (const lang of PREFIXED_LANGUAGES) {
        const html = forLang(methodShell, lang);
        this.emitFile({ type: 'asset', fileName: `${langSegment(lang)}/index.html`, source: html });
        this.emitFile({ type: 'asset', fileName: `${langSegment(lang)}/404.html`, source: html });
      }

      /*
        텔레그램 동작 → `session/`. **언어 조각을 `session` 앞에 둔다**(`/run/<언어>/session/`).
        그래야 기본 언어는 `/run/session/`(사용자가 정한 이름)이고, 언어판은 첫 세그먼트가 언어라
        i18n 경로 헬퍼(`languageFromPath`·`pathForLanguage`)가 수정 없이 그대로 맞는다.
      */
      this.emitFile({ type: 'asset', fileName: 'session/index.html', source: sessionShell });
      this.emitFile({ type: 'asset', fileName: 'session/404.html', source: sessionShell });
      for (const lang of PREFIXED_LANGUAGES) {
        const html = forLang(sessionShell, lang);
        this.emitFile({ type: 'asset', fileName: `${langSegment(lang)}/session/index.html`, source: html });
        this.emitFile({ type: 'asset', fileName: `${langSegment(lang)}/session/404.html`, source: html });
      }

      // 원본 `method.html` 은 루트에 남기지 않는다 — 방식 문서는 이제 `index.html` 이다.
      if (method) delete bundle['method.html'];
    },
  };
}

/**
 * `vite preview` 가 언어 디렉터리를 알게 한다.
 *
 * preview 의 SPA 폴백은 없는 경로를 전부 루트 `index.html` 로 보낸다. 그래서
 * `/en-us/dialogs` 를 열면 한국어 셸이 뜬다 — 배포본은 언어별 `404.html` 이 있어 영어
 * 셸이 나가므로, 이게 없으면 **로컬에서만 다르게 동작한다.**
 */
function localizedPreview(): Plugin {
  let base = '/';

  return {
    name: 'telegram-chat-exporter:localized-preview',
    configResolved(config) {
      base = config.base;
    },
    configurePreviewServer(server) {
      const segments = PREFIXED_LANGUAGES.map(langSegment);

      server.middlewares.use((req, _res, next) => {
        const pathname = (req.url ?? '/').split('?')[0];
        if (path.extname(pathname)) return next();

        const rest = pathname.startsWith(base)
          ? pathname.slice(base.length)
          : pathname.replace(/^\//, '');
        const parts = rest.split('/').filter(Boolean);

        // **언어를 먼저, 그다음 `session` 구역을 벗긴다** — 배치가 `/run/<언어>/session/…` 라서다.
        // 각 구역·언어가 자기 `404.html` 로 폴백해야 deep route 새로고침에서 맞는 문서가 나온다.
        const lang = parts[0] && segments.includes(parts[0]) ? parts.shift() : '';
        const zone = parts[0] === 'session' ? (parts.shift(), 'session/') : '';
        const dir = `${base}${lang ? `${lang}/` : ''}${zone}`;

        /*
          구역 진입(빈 경로: `/run/`·`/run/<언어>/`·`/run/session/`·`/run/<언어>/session/`)은
          실제 파일(`index.html`)이라 그대로 둔다. 나머지 라우트(`session/dialogs` 등)는
          배포본과 똑같이 **그 언어·구역의 `404.html`** 로 돌린다 — 라우터가 주소를 읽어 렌더한다.
        */
        if (parts.length === 0) return next();
        req.url = `${dir}404.html`;
        next();
      });
    },
  };
}

export default defineConfig(({ command, mode }) => {
  /**
   * 단일 파일 배포(`--mode standalone`).
   *
   * 웹서버 없이 `index.html` 을 더블클릭해서 쓰는 형태다. 릴리스에 zip 으로 올려서
   * 받아 가는 쪽이 이걸 쓴다. 애널리틱스·광고는 값이 있어도 넣지 않는다 — 내려받아
   * 자기 컴퓨터에서 여는 사람에게까지 추적을 딸려 보낼 이유가 없고, 그게 "직접 받아서
   * 실행하면 둘 다 꺼진다"는 안내(DEVELOP.ko.md)를 참말로 만든다.
   */
  const standalone = mode === 'standalone';
  const on = standalone ? { ga: '', ads: '' } : switches(mode);

  return {
    /**
     * 루트 배포를 기본으로 둔다. 그래서 dev·preview 주소가 깨끗하고, 로컬에서는 이 값을
     * 건드릴 일이 없다.
     *
     * 하위 경로에 올리는 쪽에서만 `--base` 로 넘긴다. 그 경로가 무엇인지는 배포 설정이
     * 아는 사실이라 여기 적지 않는다.
     *
     * 상대경로(`'./'`)로 한 방에 해결할 수는 없다. `/dialogs/:id` 처럼 두 단계 이상 들어간
     * 경로에서 새로고침하면 `./assets/...` 가 그 하위로 풀려서 404 가 난다.
     * `<base href>` 로 보정하는 방법도 CSP 의 `base-uri 'none'` 에 막힌다.
     * 단일 파일 배포는 참조할 파일 자체가 없어서 이 문제가 없다.
     *
     * 라우터는 이 값을 `import.meta.env.BASE_URL` 로 읽으므로 따로 맞출 게 없다
     * (`src/app/App.tsx`).
     */
    base: standalone ? './' : '/',
    plugins: [
      react(),
      /**
       * GramJS 브라우저 빌드도 `Buffer` 는 전역으로 있다고 가정하고 쓴다(`buffer/` 패키지를
       * 직접 import 하는 곳도 있지만 전부는 아니다). 딱 그것만 채워 준다.
       *
       * 예전에는 crypto·zlib·os·path 까지 폴리필했는데, GramJS `latest`(Node 빌드)를 쓰던
       * 시절의 잔재였다. 브라우저 빌드는 zlib 대신 pako 를, node crypto 대신 WebCrypto 를
       * 쓰므로 필요 없다. crypto 폴리필은 특히 해로웠다 — crypto-browserify 가 asn1.js →
       * `vm` → **eval** 을 끌고 들어와 CSP(`script-src 'self'`)에 걸린다.
       */
      nodePolyfills({
        include: ['buffer'],
        globals: { Buffer: true, process: true, global: true },
      }),
      /**
       * `file://` 배포는 이쪽 셋을 쓰지 않는다. 언어별 주소(`/en-us/`)는 서버가 없으니
       * 성립하지 않는다 — 그쪽 언어 전환은 고른 값을 저장해서 다시 여는 방식이다
       * (`src/shared/i18n/index.ts`).
       */
      ...(standalone
        ? [fileProtocolPage(on), standaloneLocales()]
        : [contentSecurityPolicy(command === 'build', on), appShells(), localizedPreview()]),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        /**
         * Node 전용 모듈을 직접 껍데기로 갈아끼우던 별칭들은 전부 걷어냈다.
         * GramJS 브라우저 빌드(2.26.21)가 `fs`·`os`·`path`·`net`·`socks`·`crypto` 를
         * 이미 자기 껍데기로 바꿔서 배포한다. package.json 의 버전 고정 주석 참고.
         */
        /**
         * 로케일 리소스의 출처를 빌드 형태에 맞춰 갈아끼운다.
         *
         * 웹은 번들에 인라인하고(`resources.ts`), 단일 파일 배포는 `i18n/<코드>.js` 로 따로
         * 나간 값을 전역에서 읽는다(`resources.standalone.ts`). 소비하는 쪽(`shared/i18n/index.ts`)은
         * 어느 쪽인지 몰라도 되도록 별칭 하나로 가린다. 인라인 사본이 배포본에 섞여 들어가면
         * 떼어낸 `i18n/*.js` 편집이 먹히지 않으므로, 아예 다른 모듈로 스왑한다.
         */
        '@i18n-resources': path.resolve(
          __dirname,
          standalone
            ? './src/shared/i18n/resources.standalone.ts'
            : './src/shared/i18n/resources.ts',
        ),
      },
    },
    server: {
      host: true,
      /**
       * medifinder-web 이 5173(고정), 그 옆 5174 도 이미 쓰이고 있어서 비켜 둔다.
       * strictPort 로 못 박는 이유는 포트가 밀려서 뜨면 어느 프로젝트를 보고 있는지
       * 헷갈리기 때문이다 — 조용히 다른 포트로 도망가지 말고 그냥 실패해라.
       */
      port: 5175,
      strictPort: true,
    },
    define: {
      __APP_VERSION__: JSON.stringify(BUILD_INFO.version),
      __BUILD_COMMIT__: JSON.stringify(BUILD_INFO.commit),
      __BUILD_DATE__: JSON.stringify(BUILD_INFO.date),
      /**
       * 앱 코드가 배포 형태를 알아야 하는 자리가 둘 있다 — 라우터(주소 vs 해시)와
       * 언어 선택(주소 vs 저장값). 상수라 웹 빌드에서는 관련 코드가 통째로 지워진다.
       */
      __STANDALONE__: JSON.stringify(standalone),
      /**
       * **배포본이** 여는 연결 주소. 지금 이 문서의 것이 아니다.
       *
       * 첫 화면의 "받아서 직접 실행" 이 이걸 그대로 보여 준다. 웹 배포에는 애널리틱스가
       * 켜져 있을 수 있어서 이 문서의 정책과는 다르고, 받는 사람이 알아야 하는 것은
       * **받을 파일** 쪽이다.
       *
       * 손으로 적지 않고 실제 정책을 만드는 함수에서 뽑는다. 한 벌 더 적어 두면 정책을
       * 고쳤을 때 화면만 옛말을 하게 되는데, 하필 그 문장이 이 앱의 신뢰 근거다.
       */
      __STANDALONE_CONNECT_SRC__: JSON.stringify(standaloneConnectSrc()),
    },
    build: {
      // 웹 배포본과 섞이면 어느 쪽을 올리는지 헷갈린다. 나가는 형태가 다르니 폴더도 나눈다.
      outDir: standalone ? 'dist-standalone' : 'dist',
      // MTProto 라이브러리 하나가 수백 KB 라 기본 경고(500KB)는 계속 뜬다. 기준을 올려둔다.
      chunkSizeWarningLimit: 1500,
      /**
       * 스타일을 별도 파일로 뽑는다. 이 형식(iife)에서는 기본값이 CSS 를 JS 안에 넣고
       * 실행 중에 `<style>` 로 붙이는 쪽이라, 첫 화면이 한 박자 민 채로 그려진다.
       */
      cssCodeSplit: standalone ? false : undefined,
      /**
       * `modulepreload` 링크는 모듈 전용이다. 모듈로 안 나가는 빌드에 붙어 있으면
       * 브라우저가 받아 놓고 쓰지 않거나 `file://` 에서 그대로 막힌다.
       */
      modulePreload: standalone ? false : undefined,
      rollupOptions: standalone
        ? {
            output: {
              /**
               * 받아서 압축을 푸는 폴더라 캐시 무효화가 필요 없다. 해시 없는 이름이
               * "이게 뭔지" 알아보기 쉽다.
               */
              entryFileNames: 'assets/app.js',
              assetFileNames: 'assets/app[extname]',
              /**
               * `file://` 은 모듈 스크립트를 못 읽는다. 그래서 모듈이 아닌 한 덩어리로 뽑는다.
               *
               * `inlineDynamicImports` 가 짝이다. 화면들이 `lazy(() => import(...))` 로
               * 갈라져 있는데(`src/app/App.tsx`), IIFE 는 코드 분할과 같이 못 쓴다.
               * 켜 두면 갈라진 청크가 같은 덩어리 안으로 들어오고 `import()` 는 즉시
               * 해결되는 Promise 가 된다 — 화면 코드는 그대로 두고 동작만 맞춰진다.
               */
              format: 'iife' as const,
              inlineDynamicImports: true,
            },
          }
        : {
            /**
             * 웹은 두 진입점이다 — `index.html`(App = 텔레그램 문서)과 `method.html`(방식 고르기).
             *
             * 방식 화면을 별도 문서로 두어야 **문서별 CSP**가 성립한다(방식=구글 open, 텔레그램=
             * 텔레그램 전용). `appShells` 가 이 둘을 각각 `/run/`·`/run/session/` 아래로 재배치한다.
             * 방식 번들은 GramJS·라우터를 안 끌어와 가볍다.
             */
            input: {
              main: path.resolve(__dirname, 'index.html'),
              method: path.resolve(__dirname, 'method.html'),
            },
          },
    },
  };
});
