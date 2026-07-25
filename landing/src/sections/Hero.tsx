import { useLanding } from '../context';
import { DownloadButton, SourceButton, StartButton } from '../ui';

/** 첫 화면. 검색에서 들어온 사람이 처음 읽는 문단이다. */
export function Hero() {
  const { env, copy } = useLanding();

  return (
    <section className="border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-4xl px-4 py-10 text-center sm:py-14">
        <p className="inline-flex items-center rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-700">
          {copy.badge}
        </p>
        <h1 className="mt-5 text-balance text-3xl font-black leading-tight tracking-tight text-slate-900 sm:text-5xl">
          {copy.title}
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-pretty text-base leading-relaxed text-slate-600 sm:text-lg">
          {copy.lede}
        </p>
        <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
          <StartButton />
          <DownloadButton />
          <SourceButton />
        </div>
        <p className="mt-5 text-xs text-slate-400">
          {copy.note.replace('{{languages}}', String(env.languages.length))}
        </p>
      </div>
    </section>
  );
}
