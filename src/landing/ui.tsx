/**
 * 섹션 여러 곳에서 되풀이되는 조각.
 *
 * 여기 있는 것들은 **모양을 한곳에서 정하기 위한** 것이다. 버튼 치수를 바꾸고 싶으면
 * `CTA` 한 줄만 고치면 랜딩 전체가 따라온다.
 */

import type { ReactNode } from 'react';
import { useLanding } from './context';
import { ArrowRight, ChevronDown, Github } from './icons';

/** 눌러서 시작하는 버튼의 치수. 앱의 `Button` 과 같다. */
const CTA =
  'inline-flex h-12 items-center justify-center gap-2 rounded-xl px-6 text-base font-semibold transition-colors';

const VARIANTS = {
  primary: 'bg-primary text-white hover:bg-primary-700',
  outline: 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50',
  dark: 'bg-slate-900 text-white hover:bg-slate-700',
} as const;

export function Cta({
  href,
  variant,
  external,
  className,
  children,
}: {
  href: string;
  variant: keyof typeof VARIANTS;
  /** 새 탭으로 열 것인가. 저장소처럼 이 사이트를 떠나는 링크에만 쓴다. */
  external?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      {...(external ? { target: '_blank', rel: 'noreferrer noopener' } : {})}
      className={`${CTA} ${VARIANTS[variant]}${className ? ` ${className}` : ''}`}
    >
      {children}
    </a>
  );
}

/** 앱으로 들어가는 버튼. 히어로와 마지막 섹션에 같은 것이 놓인다. */
export function StartButton() {
  const { env, copy } = useLanding();
  return (
    <Cta href={env.start} variant="primary">
      {copy.cta}
      <ArrowRight className="h-5 w-5 rtl:rotate-180" />
    </Cta>
  );
}

/** 저장소로 나가는 버튼. */
export function SourceButton() {
  const { env, copy } = useLanding();
  return (
    <Cta href={env.sourceUrl} variant="outline" external>
      <Github className="h-5 w-5" />
      {copy.ctaSource}
    </Cta>
  );
}

/**
 * 번역문에 섞인 `<strong>` 만 살려서 그린다.
 *
 * 로케일 JSON 은 우리가 쓰는 파일이지만 번역이 늘면서 누가 무엇을 넣을지는 모른다.
 * **전부 막아 두고 이 태그 하나만 되돌린다** - 다른 태그가 섞여 들어오면 화면에 그대로
 * 보이는데, 조용히 실행되는 것보다 눈에 띄는 편이 낫다.
 */
export function Rich({ text, className }: { text: string; className?: string }) {
  const html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/&lt;strong&gt;/g, '<strong class="font-semibold text-white">')
    .replace(/&lt;\/strong&gt;/g, '</strong>');
  return <p className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

/** 나라 코드를 국기 이모지로. `src/shared/lib/phone.ts` 의 것과 같은 계산이다. */
const flagOf = (lang: string): string => {
  const region = lang.split('-')[1]?.toUpperCase() ?? '';
  return String.fromCodePoint(...[...region].map((c) => 0x1f1a5 + c.charCodeAt(0)));
};

/**
 * 언어 전환.
 *
 * `<details>` 라서 **자바스크립트가 없어도 열린다.** 앱 헤더의 Radix 셀렉트와 달리
 * 안쪽이 진짜 `<a href>` 라, 크롤러가 각 언어판을 따라 들어간다 - 이 화면에서는 그게
 * 오히려 셀렉트보다 낫다.
 */
export function LanguageMenu() {
  const { text, env } = useLanding();
  const current = env.languages.find((l) => l.current);

  return (
    <details className="relative shrink-0">
      <summary
        className="inline-flex h-8 cursor-pointer list-none items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 [&::-webkit-details-marker]:hidden"
        title={text.common.language}
      >
        <span aria-hidden className="text-base leading-none">
          {flagOf(env.lang)}
        </span>
        <span className="hidden sm:inline">{current?.label ?? env.lang}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
      </summary>
      <div className="absolute end-0 z-50 mt-1 max-h-[70vh] w-56 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
        {env.languages.map((l) => (
          <a
            key={l.code}
            href={l.href}
            aria-current={l.current || undefined}
            className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-slate-700 hover:bg-slate-100${
              l.current ? ' font-bold text-slate-900' : ''
            }`}
          >
            <span aria-hidden className="text-base leading-none">
              {flagOf(l.code)}
            </span>
            <span>{l.label}</span>
          </a>
        ))}
      </div>
    </details>
  );
}
