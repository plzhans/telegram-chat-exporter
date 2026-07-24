import { useLanding } from '../context';
import { Github } from '../icons';
import { LanguageMenu } from '../ui';

/** 앱 화면(`MainLayout`)과 같은 헤더. 넘어갔을 때 다른 사이트처럼 보이면 안 된다. */
export function Header() {
  const { text, env } = useLanding();

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold text-slate-900">{text.app.title}</p>
          <p className="truncate text-xs text-slate-500">{text.app.tagline}</p>
        </div>
        <LanguageMenu />
        <a
          href={env.sourceUrl}
          target="_blank"
          rel="noreferrer noopener"
          title={text.common.source}
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-2.5 text-xs font-bold text-white hover:bg-slate-700"
        >
          <Github className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">{text.common.source}</span>
        </a>
      </div>
    </header>
  );
}
