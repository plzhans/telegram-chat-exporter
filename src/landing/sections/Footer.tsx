import { useLanding } from '../context';

export function Footer() {
  const { env } = useLanding();

  return (
    <footer className="mx-auto max-w-5xl px-4 pb-6">
      <div className="border-t border-slate-200 pt-2">
        <p className="truncate text-[0.65rem] text-slate-400">{env.copyright}</p>
      </div>
    </footer>
  );
}
