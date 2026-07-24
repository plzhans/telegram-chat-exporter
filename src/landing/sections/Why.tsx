import { useLanding, type Card } from '../context';
import { FileText, Monitor, ServerOff, type IconComponent } from '../icons';

/** 카드 순서 = 화면에 놓이는 순서. 카드를 더하려면 여기와 로케일 JSON 에 한 줄씩. */
const CARDS: { key: 'install' | 'server' | 'output'; Icon: IconComponent }[] = [
  { key: 'install', Icon: Monitor },
  { key: 'server', Icon: ServerOff },
  { key: 'output', Icon: FileText },
];

/** 설치형 도구와 무엇이 다른가. */
export function Why() {
  const { copy } = useLanding();

  return (
    <section className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
      <h2 className="text-center text-xl font-bold text-slate-900 sm:text-2xl">{copy.why.title}</h2>
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {CARDS.map(({ key, Icon }) => {
          const card: Card = copy.why[key];
          return (
            <div key={key} className="rounded-2xl border border-slate-200 bg-white p-5">
              <Icon className="h-6 w-6 text-primary" />
              <h3 className="mt-3 text-sm font-bold text-slate-900">{card.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{card.body}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
