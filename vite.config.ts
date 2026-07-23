import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import path from 'path';

/**
 * 배포본에만 CSP 를 심는다.
 *
 * 이 앱의 신뢰 근거는 "코드를 읽어보세요"가 아니라 **브라우저가 강제하는 CSP** 다.
 * `connect-src` 를 텔레그램 WebSocket 으로만 열어두면, 설령 이 코드가 악의적이어도
 * 전화번호·인증코드·대화 내용을 다른 서버로 내보낼 수 없다. 사용자가 개발자도구
 * Network 탭만 열어봐도 검증된다.
 *
 * 개발 모드에는 넣지 않는다. Vite HMR 이 `ws://localhost` 로 붙고 React Fast Refresh 가
 * 인라인 스크립트를 끼워넣어서, 같은 정책을 적용하면 dev 서버가 아예 안 뜬다.
 */
function contentSecurityPolicy(isBuild: boolean): Plugin {
  const policy = [
    // 기본은 전부 차단. 아래에서 필요한 것만 연다.
    "default-src 'none'",
    "script-src 'self'",
    // Tailwind 가 만든 CSS 는 파일로 나가지만, 일부 라이브러리가 인라인 style 속성을 쓴다.
    "style-src 'self' 'unsafe-inline'",
    // blob: 는 다운로드한 미디어 미리보기, data: 는 인라인 SVG 아이콘용.
    "img-src 'self' data: blob:",
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
    'connect-src wss://*.web.telegram.org wss://*.web.telegram.org:443',
    // 내보내기 파일 저장용 blob: URL.
    "form-action 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
  ].join('; ');

  return {
    name: 'telegram-chat-exporter:csp',
    transformIndexHtml(html) {
      if (!isBuild) return html;
      return html.replace(
        '<head>',
        `<head>\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`,
      );
    },
  };
}

export default defineConfig(({ command }) => ({
  /**
   * 배포 위치의 하위 경로. 기본은 루트(`/`)고, GitHub Pages 처럼 저장소 이름이 경로에
   * 끼는 곳에서만 `BASE_PATH=/telegram-chat-exporter/` 로 넘긴다
   * (`.github/workflows/deploy.yml` 참고).
   *
   * 이 값이 틀리면 빌드는 성공하는데 브라우저에서 JS·CSS 가 404 로 죽는다 — 자산 경로가
   * 절대경로로 박히기 때문이다. 라우터도 같은 값을 `basename` 으로 받아야 하므로
   * `src/app/App.tsx` 는 `import.meta.env.BASE_URL` 을 읽는다.
   */
  base: process.env.BASE_PATH ?? '/',
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
    contentSecurityPolicy(command === 'build'),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      /**
       * Node 전용 모듈을 직접 껍데기로 갈아끼우던 별칭들은 전부 걷어냈다.
       * GramJS 브라우저 빌드(2.26.21)가 `fs`·`os`·`path`·`net`·`socks`·`crypto` 를
       * 이미 자기 껍데기로 바꿔서 배포한다. package.json 의 버전 고정 주석 참고.
       */
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
  build: {
    outDir: 'dist',
    // MTProto 라이브러리 하나가 수백 KB 라 기본 경고(500KB)는 계속 뜬다. 기준을 올려둔다.
    chunkSizeWarningLimit: 1500,
  },
}));
