import { useLanding } from '../context';
import { FileCode, FileJson, FileText, Info, type IconComponent } from '../icons';

/**
 * 내보내기 결과물 zip 에 들어 있는 파일들. 릴리스 배포본과는 다른 물건이다.
 *
 * `name` 은 실제 파일명이라 번역하지 않는다 - 압축을 푼 사람이 보게 될 글자 그대로다.
 */
const FILES: {
  key: 'html' | 'jsonl' | 'txt' | 'meta';
  Icon: IconComponent;
  name: string;
  /** 먼저 열어야 할 파일 하나만 강조한다. */
  accent?: boolean;
}[] = [
  { key: 'html', Icon: FileCode, name: 'index.html', accent: true },
  { key: 'jsonl', Icon: FileJson, name: 'messages.jsonl' },
  { key: 'txt', Icon: FileText, name: 'messages.txt' },
  { key: 'meta', Icon: Info, name: 'meta.json' },
];

export function Zip() {
  const { copy } = useLanding();

  return (
    <section className="border-y border-slate-200 bg-white">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
        <h2 className="text-center text-xl font-bold text-slate-900 sm:text-2xl">
          {copy.zip.title}
        </h2>
        <p className="mt-6 truncate rounded-t-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-center font-mono text-xs text-slate-500">
          {copy.zip.file}
        </p>
        <ul className="divide-y divide-slate-100 rounded-b-2xl border border-t-0 border-slate-200">
          {FILES.map(({ key, Icon, name, accent }) => (
            <li key={key} className="flex items-start gap-3 px-4 py-3">
              <Icon
                className={`mt-0.5 h-5 w-5 shrink-0 ${accent ? 'text-primary' : 'text-slate-400'}`}
              />
              <div className="min-w-0">
                <p className="font-mono text-sm font-semibold text-slate-900">{name}</p>
                <p className="mt-0.5 text-sm leading-relaxed text-slate-600">{copy.zip[key]}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
