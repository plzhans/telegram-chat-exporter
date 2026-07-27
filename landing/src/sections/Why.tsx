/**
 * 공식 텔레그램 내보내기와 나란히 세우는 표.
 *
 * 전에는 "설치형 도구와 무엇이 다른가" 카드 세 장이었다. 그건 이름 없는 가상의 경쟁자를
 * 상대하는 말이라, 정작 이 화면에 오는 사람의 첫 물음 - **"텔레그램에 내보내기 있잖아,
 * 이건 뭐야?"** - 에는 답하지 않았다. 그래서 그 물음을 제목으로 올리고 줄마다 둘을 붙여
 * 놨다.
 *
 * 문구는 `landing/locales/<언어>.json` 의 `landing.why` 에 있다. 특히 `official` 칸을
 * 고칠 때는 공식이 실제로 하는 일을 확인하고 적는다(`context.tsx` 의 주석).
 */

import { useLanding, type CompareRow } from '../context';
import { Check, Minus } from '../icons';

/** 줄 순서 = 화면에 놓이는 순서. 제일 크게 갈리는 것부터다. */
const ROWS = ['where', 'chats', 'dates', 'anon', 'layout'] as const;

/** 라벨 · 공식 · 이 도구. 넓은 화면에서만 열이 되고 좁으면 그냥 쌓인다. */
const GRID = 'sm:grid sm:grid-cols-[9rem_1fr_1fr] sm:gap-5';

export function Why() {
  const { copy } = useLanding();
  const { why } = copy;

  return (
    <section className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
      <h2 className="text-center text-xl font-bold text-slate-900 sm:text-2xl">{why.title}</h2>
      <p className="mx-auto mt-3 max-w-2xl text-center text-sm leading-relaxed text-slate-600">
        {why.lede}
      </p>

      <ul className="mt-8 space-y-3">
        {/* 열 이름. 좁은 화면에서는 각 칸이 스스로 이름을 달므로 여기서는 숨긴다. */}
        <li aria-hidden className={`hidden px-5 ${GRID}`}>
          <span />
          <span className="text-xs font-bold text-slate-400">{why.official}</span>
          <span className="text-xs font-bold text-primary">{why.ours}</span>
        </li>

        {ROWS.map((key) => {
          const row: CompareRow = why.rows[key];
          return (
            <li
              key={key}
              className={`rounded-2xl border border-slate-200 bg-white p-5 sm:items-start ${GRID}`}
            >
              <h3 className="text-sm font-bold text-slate-900">{row.label}</h3>

              <div className="mt-3 sm:mt-0">
                <p className="text-xs font-bold text-slate-400 sm:hidden">{why.official}</p>
                <p className="mt-1 flex gap-2 text-sm leading-relaxed text-slate-500 sm:mt-0">
                  <Minus className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" />
                  <span>{row.official}</span>
                </p>
              </div>

              <div className="mt-3 sm:mt-0">
                <p className="text-xs font-bold text-primary sm:hidden">{why.ours}</p>
                <p className="mt-1 flex gap-2 text-sm font-medium leading-relaxed text-slate-900 sm:mt-0">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>{row.ours}</span>
                </p>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="mx-auto mt-6 max-w-2xl text-center text-sm leading-relaxed text-slate-600">
        {why.note}
      </p>
    </section>
  );
}
