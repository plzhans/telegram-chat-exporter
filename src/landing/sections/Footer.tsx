import { useLanding } from '../context';

export function Footer() {
  const { env } = useLanding();

  return (
    <footer className="mx-auto max-w-5xl px-4 pb-6">
      <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-2">
        <p className="truncate text-[0.65rem] text-slate-400">{env.copyright}</p>
        <p className="shrink-0 font-mono text-[0.65rem] text-slate-400">{env.version}</p>
      </div>
    </footer>
  );
}
