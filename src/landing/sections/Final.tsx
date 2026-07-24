import { useLanding } from '../context';
import { StartButton } from '../ui';

/** 마지막으로 한 번 더 권한다. 여기까지 읽은 사람에게는 설명이 아니라 버튼이 필요하다. */
export function Final() {
  const { copy } = useLanding();

  return (
    <section className="mx-auto max-w-3xl px-4 pb-10 pt-14 text-center sm:pb-14 sm:pt-20">
      <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">{copy.final.title}</h2>
      <p className="mt-3 text-sm text-slate-600">{copy.final.body}</p>
      <div className="mt-7 flex justify-center">
        <StartButton />
      </div>
    </section>
  );
}
