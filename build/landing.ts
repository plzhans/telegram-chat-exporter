/**
 * 첫 화면을 **정적 HTML 로 찍어낸다.**
 *
 * 앱의 나머지 화면과 달리 여기는 React 가 아니다. 이유는 둘이다.
 *
 * 1. **검색엔진.** 구글은 JS 를 실행하지만 크롤과 렌더가 다른 큐라 며칠씩 밀리고,
 *    네이버·다음·GPTBot 같은 크롤러는 사실상 못 읽는다. 검색으로 사람을 데려오는 것이
 *    이 화면의 존재 이유이므로, 본문이 HTML 안에 그대로 있어야 한다.
 *
 * 2. **무게.** 앱 번들에는 MTProto 라이브러리(GramJS)가 들어 있어 gzip 530KB 다. 홍보
 *    한 장 보여주려고 그걸 받게 하면 LCP·INP 가 나빠지는데, 그 둘은 검색 순위에 직접
 *    들어가는 신호다. 이 문서는 CSS 하나만 받는다.
 *
 * 그래서 이 파일은 문자열만 다룬다. React 컴포넌트로 두고 `renderToStaticMarkup` 하는
 * 방법도 있지만, 그러면 i18n·라우터·zustand 를 Node 에서 돌릴 준비를 해야 한다 —
 * 얻는 것에 비해 딸려 오는 게 너무 많다.
 *
 * **문구는 로케일 JSON 이 그대로 들고 있다.** 앱 화면과 같은 파일, 같은 키다. 여기에
 * 한국어나 영어를 적어 두면 언어를 늘릴 때 두 곳을 고쳐야 하고, 곧 어긋난다.
 */

import { dirOf, langSegment, type SupportedLanguage } from '../src/shared/i18n/languages';

/** 로케일 JSON 에서 이 화면이 쓰는 부분. 없는 언어는 영어판이 대신 들어온다. */
export interface LandingText {
  app: { title: string; tagline: string };
  common: { source: string; language: string };
  landing: Record<string, never> & Record<string, unknown>;
}

/**
 * 릴리스에 올라가는, **버전이 안 붙는** 에셋 이름.
 *
 * 릴리스 워크플로는 같은 zip 을 `telegram-exporter-v1.2.3.zip` 과 이 이름으로 두 번
 * 올린다. 버전이 붙은 쪽은 받아 둔 사람이 파일만 보고 버전을 알기 위한 것이고, 이쪽은
 * 여기서 거는 고정 주소용이다 - 에셋 이름이 릴리스마다 바뀌면 사이트에 적어 둘 문자열이
 * 없다.
 *
 * **`.github/workflows/release.yml` 의 `ASSET_LATEST` 와 같아야 한다.** 한쪽만 고치면
 * 빌드도 릴리스도 통과하는데 아래 버튼만 404 가 된다.
 */
export const RELEASE_ASSET = 'telegram-exporter.zip';

/**
 * 그 에셋의 영구 주소.
 *
 * `latest` 는 태그 이름이 아니라 GitHub 가 "Latest 배지가 붙은 릴리스" 로 풀어 주는
 * 예약어다. 그래서 버전을 박지 않아도 늘 최신 릴리스를 가리킨다. 저장소 주소는 빌드가
 * 아는 값(`VITE_SOURCE_URL`)에서 오므로 포크해도 따라간다.
 */
export const releaseDownloadUrl = (sourceUrl: string): string =>
  `${sourceUrl.replace(/\/$/, '')}/releases/latest/download/${RELEASE_ASSET}`;

export interface LandingContext {
  lang: SupportedLanguage;
  /** 이 언어판의 첫 화면 주소. `base` 가 반영된 값이다. */
  home: string;
  /** 앱 진입 주소. 랜딩에는 앱 코드가 없으므로 여기서부터 React 가 뜬다. */
  start: string;
  languages: { code: SupportedLanguage; href: string; label: string; current: boolean }[];
  /**
   * 이 문서에 **실제로 걸린** `connect-src`.
   *
   * 손으로 적지 않고 방금 만든 CSP 에서 뽑아 온다. 애널리틱스를 켜면 구글 호스트가 붙고
   * 단일 파일 배포는 텔레그램만 남는데, 화면에 한 벌 더 적어 두면 그중 어느 경우에선가
   * 조용히 거짓말이 된다. 하필 그 문장이 이 앱의 신뢰 근거다.
   */
  connectSrc: string;
  /** 애널리틱스가 켜진 빌드인가. 켜졌으면 "텔레그램 말고는 아무 데도" 가 참이 아니다. */
  analytics: boolean;
  sourceUrl: string;
  copyright: string;
  version: string;
}

/**
 * HTML 특수문자를 막는다.
 *
 * 로케일 JSON 은 우리가 쓰는 파일이지만, 번역이 늘면서 누가 무엇을 넣을지는 모른다.
 * 전부 막아 두고 필요한 곳만 아래 `rich` 로 되돌린다.
 */
const esc = (v: unknown): string =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * `<strong>` 하나만 살려 둔다.
 *
 * 앱 화면에서 `<Trans>` 가 받는 키들이 이 태그를 쓴다. 전부 막고 필요한 것만 되돌리는
 * 순서라, 번역에 다른 태그가 섞여 들어오면 **화면에 그대로 보인다** — 조용히 실행되는
 * 것보다 눈에 띄는 편이 낫다.
 */
const rich = (v: unknown): string =>
  esc(v)
    .replace(/&lt;strong&gt;/g, '<strong class="font-semibold text-white">')
    .replace(/&lt;\/strong&gt;/g, '</strong>');

/** 나라 코드를 국기 이모지로. `src/shared/lib/phone.ts` 의 것과 같은 계산이다. */
const flagOf = (lang: string): string => {
  const region = lang.split('-')[1]?.toUpperCase() ?? '';
  return String.fromCodePoint(...[...region].map((c) => 0x1f1a5 + c.charCodeAt(0)));
};

/** 아이콘. lucide 원본 path 를 그대로 옮겨 인라인 SVG 로 둔다(외부 요청 없음). */
const icon = (paths: string, cls: string): string =>
  `<svg class="${cls}" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

const ICONS = {
  arrowRight: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  github:
    '<path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/>',
  shield:
    '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
  monitor:
    '<path d="M18 8V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h8"/><path d="M10 19v-3.96 3.15"/><path d="M7 19h5"/><rect width="6" height="10" x="16" y="12" rx="2"/>',
  serverOff:
    '<path d="M7 2h13a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-5"/><path d="M10 10 2.5 2.5C2 2 2 2.5 2 5v3a2 2 0 0 0 2 2h6z"/><path d="M22 17v-1a2 2 0 0 0-2-2h-1"/><path d="M4 14a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h16.5l1-.5.5.5-8-8H4z"/><path d="M6 18h.01"/><path d="m2 2 20 20"/>',
  fileText:
    '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
  fileCode:
    '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="m5 12-3 3 3 3"/><path d="m9 18 3-3-3-3"/>',
  fileJson:
    '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 12a1 1 0 0 0-1 1v1a1 1 0 0 1-1 1 1 1 0 0 1 1 1v1a1 1 0 0 0 1 1"/><path d="M14 18a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1 1 1 0 0 1-1-1v-1a1 1 0 0 0-1-1"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  download:
    '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
} as const;

/** 눌러서 시작하는 버튼. 앱의 `Button` 과 같은 치수다. */
const CTA =
  'inline-flex h-12 items-center justify-center gap-2 rounded-xl px-6 text-base font-semibold transition-colors';

/**
 * 언어 전환.
 *
 * `<details>` 라서 **자바스크립트가 없어도 열린다.** 앱 헤더의 Radix 셀렉트와 달리
 * 안쪽이 진짜 `<a href>` 라, 크롤러가 각 언어판을 따라 들어간다 — 이 화면에서는 그게
 * 오히려 셀렉트보다 낫다.
 */
function languageMenu(text: LandingText, ctx: LandingContext): string {
  const current = ctx.languages.find((l) => l.current);
  const items = ctx.languages
    .map(
      (l) => `
            <a href="${esc(l.href)}"${l.current ? ' aria-current="true"' : ''} class="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-slate-700 hover:bg-slate-100${l.current ? ' font-bold text-slate-900' : ''}">
              <span aria-hidden class="text-base leading-none">${flagOf(l.code)}</span>
              <span>${esc(l.label)}</span>
            </a>`,
    )
    .join('');

  return `
      <details class="relative shrink-0">
        <summary class="inline-flex h-8 cursor-pointer list-none items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 [&::-webkit-details-marker]:hidden" title="${esc(text.common.language)}">
          <span aria-hidden class="text-base leading-none">${flagOf(ctx.lang)}</span>
          <span class="hidden sm:inline">${esc(current?.label ?? ctx.lang)}</span>
          ${icon(ICONS.chevronDown, 'h-3.5 w-3.5 shrink-0 text-slate-400')}
        </summary>
        <div class="absolute end-0 z-50 mt-1 max-h-[70vh] w-56 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg">${items}
        </div>
      </details>`;
}

/**
 * 문서의 `<body>` 안쪽 전체.
 *
 * 앱 화면(`MainLayout`)과 같은 헤더·푸터를 쓴다. 검색에서 들어온 사람이 "시작하기" 를
 * 눌러 앱으로 넘어갔을 때 다른 사이트로 넘어온 것처럼 보이면 안 된다.
 */
export function landingBody(text: LandingText, ctx: LandingContext): string {
  const t = (path: string): string => {
    const value = path.split('.').reduce<unknown>((acc, key) => (acc as never)?.[key], text.landing);
    return String(value ?? '');
  };

  const startButton = `<a href="${esc(ctx.start)}" class="${CTA} bg-primary text-white hover:bg-primary-700">${esc(t('cta'))}${icon(ICONS.arrowRight, 'h-5 w-5 rtl:rotate-180')}</a>`;

  const why = (['install', 'server', 'output'] as const)
    .map(
      (key, i) => `
          <div class="rounded-2xl border border-slate-200 bg-white p-5">
            ${icon([ICONS.monitor, ICONS.serverOff, ICONS.fileText][i], 'h-6 w-6 text-primary')}
            <h3 class="mt-3 text-sm font-bold text-slate-900">${esc(t(`why.${key}.title`))}</h3>
            <p class="mt-1.5 text-sm leading-relaxed text-slate-600">${esc(t(`why.${key}.body`))}</p>
          </div>`,
    )
    .join('');

  const files = (
    [
      ['html', ICONS.fileCode, 'index.html', true],
      ['jsonl', ICONS.fileJson, 'messages.jsonl', false],
      ['txt', ICONS.fileText, 'messages.txt', false],
      ['meta', ICONS.info, 'meta.json', false],
    ] as const
  )
    .map(
      ([key, glyph, name, accent]) => `
            <li class="flex items-start gap-3 px-4 py-3">
              ${icon(glyph, `mt-0.5 h-5 w-5 shrink-0 ${accent ? 'text-primary' : 'text-slate-400'}`)}
              <div class="min-w-0">
                <p class="font-mono text-sm font-semibold text-slate-900">${name}</p>
                <p class="mt-0.5 text-sm leading-relaxed text-slate-600">${esc(t(`zip.${key}`))}</p>
              </div>
            </li>`,
    )
    .join('');

  const steps = (['one', 'two', 'three'] as const)
    .map(
      (key, i) => `
            <li>
              <span aria-hidden class="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">${i + 1}</span>
              <h3 class="mt-3 text-sm font-bold text-slate-900">${esc(t(`steps.${key}.title`))}</h3>
              <p class="mt-1.5 text-sm leading-relaxed text-slate-600">${esc(t(`steps.${key}.body`))}</p>
            </li>`,
    )
    .join('');

  return `
    <header class="border-b border-slate-200 bg-white">
      <div class="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
        <div class="min-w-0 flex-1">
          <p class="truncate text-base font-bold text-slate-900">${esc(text.app.title)}</p>
          <p class="truncate text-xs text-slate-500">${esc(text.app.tagline)}</p>
        </div>
${languageMenu(text, ctx)}
        <a href="${esc(ctx.sourceUrl)}" target="_blank" rel="noreferrer noopener" title="${esc(text.common.source)}" class="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-2.5 text-xs font-bold text-white hover:bg-slate-700">
          ${icon(ICONS.github, 'h-4 w-4 shrink-0')}
          <span class="hidden sm:inline">${esc(text.common.source)}</span>
        </a>
      </div>
    </header>

    <main>
      <section class="border-b border-slate-200 bg-white">
        <div class="mx-auto max-w-4xl px-4 py-14 text-center sm:py-20">
          <p class="inline-flex items-center rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-700">${esc(t('badge'))}</p>
          <h1 class="mt-5 text-balance text-3xl font-black leading-tight tracking-tight text-slate-900 sm:text-5xl">${esc(t('title'))}</h1>
          <p class="mx-auto mt-5 max-w-2xl text-pretty text-base leading-relaxed text-slate-600 sm:text-lg">${esc(t('lede'))}</p>
          <div class="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            ${startButton}
            <a href="${esc(ctx.sourceUrl)}" target="_blank" rel="noreferrer noopener" class="${CTA} border border-slate-300 bg-white text-slate-800 hover:bg-slate-50">
              ${icon(ICONS.github, 'h-5 w-5')}${esc(t('ctaSource'))}
            </a>
          </div>
          <p class="mt-5 text-xs text-slate-400">${esc(t('note').replace('{{languages}}', String(ctx.languages.length)))}</p>
        </div>
      </section>

      <section class="mx-auto max-w-5xl px-4 py-12 sm:py-16">
        <h2 class="text-center text-xl font-bold text-slate-900 sm:text-2xl">${esc(t('why.title'))}</h2>
        <div class="mt-8 grid gap-4 sm:grid-cols-3">${why}
        </div>
      </section>

      <section class="border-y border-slate-200 bg-white">
        <div class="mx-auto max-w-3xl px-4 py-12 sm:py-16">
          <h2 class="text-center text-xl font-bold text-slate-900 sm:text-2xl">${esc(t('zip.title'))}</h2>
          <p class="mt-6 truncate rounded-t-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-center font-mono text-xs text-slate-500">${esc(t('zip.file'))}</p>
          <ul class="divide-y divide-slate-100 rounded-b-2xl border border-t-0 border-slate-200">${files}
          </ul>
        </div>
      </section>

      <section class="mx-auto max-w-4xl px-4 py-12 sm:py-16">
        <h2 class="text-center text-xl font-bold text-slate-900 sm:text-2xl">${esc(t('steps.title'))}</h2>
        <ol class="mt-8 grid gap-6 sm:grid-cols-3">${steps}
        </ol>
      </section>

      <section class="bg-slate-900">
        <div class="mx-auto max-w-3xl px-4 py-12 sm:py-16">
          <div class="flex gap-3">
            ${icon(ICONS.shield, 'mt-0.5 h-6 w-6 shrink-0 text-primary-400')}
            <div>
              <h2 class="text-xl font-bold text-white sm:text-2xl">${esc(t('verify.title'))}</h2>
              <p class="mt-3 text-sm leading-relaxed text-slate-300">${rich(t(ctx.analytics ? 'verify.bodyAnalytics' : 'verify.body'))}</p>
              <p class="mt-4 rounded-xl bg-slate-800 px-4 py-3 font-mono text-xs leading-relaxed text-slate-300"><code dir="ltr" class="break-words">${esc(ctx.connectSrc)}</code></p>
              <p class="mt-4 text-sm leading-relaxed text-slate-300">${rich(t('verify.devtools'))}</p>
              <p class="mt-3 text-sm leading-relaxed text-slate-300">${esc(t('verify.source'))}
                <a href="${esc(ctx.sourceUrl)}" target="_blank" rel="noreferrer noopener" class="font-semibold text-primary-300 underline underline-offset-2 hover:text-primary-200">${esc(text.common.source)}</a>
              </p>
            </div>
          </div>
        </div>
      </section>

      <!--
        내려받기는 히어로가 아니라 **여기**에 둔다.

        히어로의 lede 가 "깔 것이 없습니다" 라서, 그 옆에 내려받기 버튼을 붙이면 첫 화면이
        스스로와 싸운다. 바로 위 "믿어 달라고 하지 않습니다" 다음에 오면 "그럼 받아서 직접
        열어 보라" 로 읽혀, 같은 버튼이 오히려 그 논지를 잇는다.
      -->
      <section class="border-b border-slate-200 bg-white">
        <div class="mx-auto max-w-3xl px-4 py-12 sm:py-16">
          <div class="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-8">
            <div class="min-w-0 flex-1">
              <h2 class="text-xl font-bold text-slate-900 sm:text-2xl">${esc(t('download.title'))}</h2>
              <p class="mt-3 text-sm leading-relaxed text-slate-600">${esc(t('download.body'))}</p>
            </div>
            <a href="${esc(releaseDownloadUrl(ctx.sourceUrl))}" class="${CTA} shrink-0 bg-slate-900 text-white hover:bg-slate-700">
              ${icon(ICONS.download, 'h-5 w-5')}${esc(t('download.cta'))}
            </a>
          </div>
          <p class="mt-5 text-xs leading-relaxed text-slate-400">${esc(t('download.note'))}</p>
        </div>
      </section>

      <section class="mx-auto max-w-3xl px-4 pb-10 pt-14 text-center sm:pb-14 sm:pt-20">
        <h2 class="text-2xl font-bold text-slate-900 sm:text-3xl">${esc(t('final.title'))}</h2>
        <p class="mt-3 text-sm text-slate-600">${esc(t('final.body'))}</p>
        <div class="mt-7 flex justify-center">${startButton}</div>
      </section>
    </main>

    <footer class="mx-auto max-w-5xl px-4 pb-6">
      <div class="flex items-center justify-between gap-3 border-t border-slate-200 pt-2">
        <p class="truncate text-[0.65rem] text-slate-400">${esc(ctx.copyright)}</p>
        <p class="shrink-0 font-mono text-[0.65rem] text-slate-400">${esc(ctx.version)}</p>
      </div>
    </footer>`;
}

/** 이 언어판 랜딩의 주소. `dirOf` 를 여기서도 쓰므로 함께 내보낸다. */
export const landingHref = (base: string, lang: SupportedLanguage): string =>
  `${base}${langSegment(lang) ? `${langSegment(lang)}/` : ''}`;

export { dirOf };
