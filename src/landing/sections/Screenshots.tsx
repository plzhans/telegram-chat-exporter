import { useLanding } from '../context';

/**
 * `public/landing/` 에 있는 스크린샷 장수.
 *
 * 파일 이름은 `shot-01.png` … 로 두 자리를 맞춘다. 사전순 정렬이 곧 화면 순서가 되도록
 * 하기 위해서다(`shot-1`, `shot-10`, `shot-2` 로 섞이지 않는다). 장수를 바꾸면 이 숫자만
 * 고치면 된다.
 */
const COUNT = 15;

/** 원본 치수. 폭·높이를 적어 두면 이미지가 도착하기 전에도 자리가 잡혀 화면이 안 흔들린다. */
const WIDTH = 778;
const HEIGHT = 1690;

/**
 * 실제 화면을 손가락으로 넘겨 보는 자리.
 *
 * **자바스크립트를 쓰지 않는다.** 랜딩에는 스크립트가 한 줄도 실리지 않으므로(`Landing.tsx`
 * 주석) 화살표 버튼이나 점 표시를 달아도 눌리지 않는다. 대신 브라우저가 스스로 하는
 * 가로 스크롤에 `scroll-snap` 만 얹었다 - 손가락으로 밀면 한 장씩 딱 걸리고, 데스크톱에서는
 * 트랙패드·휠로 넘어간다. 키보드 접근성도 브라우저가 알아서 준다.
 *
 * 슬라이드 폭을 화면보다 좁게 잡아 **다음 장이 옆에 걸쳐 보이게** 한다. 이게 "옆으로 넘길
 * 수 있다"는 유일한 신호다 - 점이나 화살표를 못 쓰는 대신이다.
 *
 * 캡션은 달지 않는다. 스크린샷은 언어와 무관하게 한 벌만 두는데, 캡션을 달면 15장 × 언어
 * 수만큼 번역이 따라붙는다. 화면 자체가 이미 무엇을 하는지 보여 준다.
 */
export function Screenshots() {
  const { env, copy } = useLanding();
  const shots = Array.from({ length: COUNT }, (_, i) => String(i + 1).padStart(2, '0'));

  return (
    <section className="border-b border-slate-200 bg-white py-8 sm:py-12">
      <h2 className="px-4 text-center text-xl font-bold text-slate-900 sm:text-2xl">
        {copy.screenshots.title}
      </h2>
      <p className="mx-auto mt-2 max-w-2xl px-4 text-center text-sm leading-relaxed text-slate-600">
        {copy.screenshots.body}
      </p>

      {/*
        `snap-x snap-mandatory` 로 한 장씩 걸리게 한다. 좌우 여백을 스크롤 패딩으로 함께
        줘야 첫 장과 마지막 장도 가운데에 선다.
      */}
      <div className="mt-6 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-3 sm:gap-5">
        {shots.map((n, i) => (
          <img
            key={n}
            src={`${env.assetBase}landing/shot-${n}.png`}
            width={WIDTH}
            height={HEIGHT}
            /*
              첫 장만 곧바로 받는다. 나머지는 스크롤해 다가올 때 받게 두지 않으면 이 한
              섹션이 수 MB 를 끌고 와서, 정작 첫 화면이 늦게 뜬다.
            */
            loading={i === 0 ? 'eager' : 'lazy'}
            decoding="async"
            alt={`${copy.screenshots.title} ${i + 1}`}
            className="w-60 shrink-0 snap-center rounded-2xl border border-slate-200 shadow-sm sm:w-64"
          />
        ))}
      </div>
    </section>
  );
}
