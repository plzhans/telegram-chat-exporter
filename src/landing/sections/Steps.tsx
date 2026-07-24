import { useLanding } from '../context';

/** 번호가 붙는 순서 그대로. 단계를 늘리면 여기와 로케일 JSON 에 한 줄씩. */
const STEPS = ['one', 'two', 'three'] as const;

export function Steps() {
  const { copy } = useLanding();

  return (
    <section className="mx-auto max-w-4xl px-4 py-12 sm:py-16">
      <h2 className="text-center text-xl font-bold text-slate-900 sm:text-2xl">
        {copy.steps.title}
      </h2>
      <ol className="mt-8 grid gap-6 sm:grid-cols-3">
        {STEPS.map((key, i) => (
          <li key={key}>
            <span
              aria-hidden
              className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-white"
            >
              {i + 1}
            </span>
            <h3 className="mt-3 text-sm font-bold text-slate-900">{copy.steps[key].title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{copy.steps[key].body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
