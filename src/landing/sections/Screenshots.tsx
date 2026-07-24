import { useLanding } from '../context';
import { ChevronLeft, ChevronRight, Pause, Play } from '../icons';

/**
 * `public/landing/` 에 있는 스크린샷 장수.
 *
 * 파일 이름은 `shot-01.png` … 로 두 자리를 맞춘다. 사전순 정렬이 곧 화면 순서가 되도록
 * 하기 위해서다(`shot-1`, `shot-10`, `shot-2` 로 섞이지 않는다). 장수를 바꾸면 이 숫자만
 * 고치면 된다.
 */
const COUNT = 16;

/**
 * 자리를 미리 잡아 두기 위한 치수. 이미지가 도착하기 전에도 높이가 정해져 화면이 안 흔들린다.
 *
 * **한 장 한 장의 실제 치수가 아니라 대표값이다.** 몇 장은 조금 다르지만(예: 702×1524)
 * 비율이 사실상 같아서 눈에 띄지 않고, 그림이 도착하면 브라우저가 각자의 진짜 비율로
 * 바꿔 그린다 - `width`/`height` 는 도착 전까지만 쓰이는 값이다.
 */
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
      {/*
        `data-embla` 안쪽을 `slider.ts` 가 찾아 붙는다. 스크립트가 없거나 늦게 와도
        뷰포트는 그냥 가로 스크롤 상자라 손가락으로 밀어 볼 수 있고, Embla 가 붙는 순간
        `is-embla` 가 스크롤을 넘겨받는다. 화살표와 점은 그때 함께 드러난다(`is-ready`).

        섹션을 화면 끝까지 흘리지 않고 본문 폭 안에 가둔다 - 다른 섹션과 같은 자리에서
        시작하고 끝나야 페이지가 한 덩어리로 읽힌다.
      */}
      <div data-embla className="group/embla relative mx-auto mt-6 max-w-5xl px-4">
        <div
          data-embla-viewport
          className="overflow-x-auto [scrollbar-width:none] [&.is-embla]:overflow-hidden [&::-webkit-scrollbar]:hidden"
        >
          <div className="flex snap-x snap-mandatory gap-5 pb-4 sm:gap-8">
            {shots.map((n, i) => (
              /*
                휴대전화 테두리를 둘러 준다. 스크린샷이 흰 화면이라 맨몸으로 두면 그냥 흰
                네모가 되어 어디까지가 그림인지 흐려진다. 검은 베젤을 두르면 한눈에
                "휴대전화 화면"으로 읽히고, 흰 배경 위에서 경계도 또렷해진다.
              */
              <div
                key={n}
                className="shrink-0 snap-center rounded-[1.75rem] bg-slate-900 p-1.5 shadow-lg ring-1 ring-slate-900/5"
              >
                <img
                  src={`${env.assetBase}landing/shot-${n}.png`}
                  width={WIDTH}
                  height={HEIGHT}
                  /*
                    첫 장만 곧바로 받는다. 나머지는 다가올 때 받게 두지 않으면 이 한 섹션이
                    수 MB 를 끌고 와서, 정작 첫 화면이 늦게 뜬다.
                  */
                  loading={i === 0 ? 'eager' : 'lazy'}
                  decoding="async"
                  alt={`${copy.screenshots.title} ${i + 1}`}
                  className="block w-56 rounded-[1.4rem] sm:w-64"
                />
              </div>
            ))}
          </div>
        </div>

        {/*
          조작부는 **그림 아래 한 줄로 모은다.** 화살표를 그림 위에 겹쳐 두면 화면을 가리고,
          어느 장을 보고 있는지 알려 주는 점과도 떨어져 있어 눈이 두 군데를 오간다.

          기본은 숨김이고 `is-ready`(스크립트가 붙음)여야 드러난다 - 눌러도 아무 일 없는
          버튼을 보여 주는 것보다 낫다.
        */}
        <div className="mt-2 hidden items-center justify-center gap-2 group-[.is-ready]/embla:flex">
          <button
            type="button"
            data-embla-prev
            aria-label="Previous"
            className="rounded-full border border-slate-200 bg-white p-1.5 text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          {/*
            지금 몇 번째인지 알려 주는 자리. **폭에 따라 다른 것을 쓴다.**

            점은 장수만큼 늘어나서, 16장이면 휴대전화 폭을 넘겨 조작부가 깨진다. 좁은
            화면에서는 자리를 일정하게 먹는 숫자로 바꾼다 - 장수가 더 늘어도 안 넘친다.
          */}
          <div data-embla-dots className="hidden items-center gap-2 px-1 sm:flex" />
          <span
            data-embla-counter
            className="px-1 font-mono text-xs tabular-nums text-slate-500 sm:hidden"
          />

          <button
            type="button"
            data-embla-next
            aria-label="Next"
            className="rounded-full border border-slate-200 bg-white p-1.5 text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          {/*
            자동 넘김을 세우는 버튼. 움직임을 줄여 달라고 설정한 사람에게는 자동 넘김 자체를
            안 걸므로(`slider.ts`) 이 버튼도 나오지 않는다.
          */}
          <button
            type="button"
            data-embla-toggle
            data-label-pause={copy.screenshots.pause}
            data-label-play={copy.screenshots.play}
            aria-label={copy.screenshots.pause}
            className="ms-1 hidden rounded-full border border-slate-200 bg-white p-1.5 text-slate-600 transition-colors hover:bg-slate-50 group-[.is-autoplay]/embla:block"
          >
            <Pause className="h-4 w-4 [.is-paused_&]:hidden" />
            <Play className="hidden h-4 w-4 [.is-paused_&]:block" />
          </button>
        </div>
      </div>
    </section>
  );
}
