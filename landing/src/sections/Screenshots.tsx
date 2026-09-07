import { useLanding } from '../context';
import { ChevronLeft, ChevronRight, Pause, Play } from '../icons';
import { SHOT_COUNT, SHOT_EAGER_COUNT, shotDir, shotName, shotStage } from '../config/shots';

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
 * 캡션은 달지 않는다. 스크린샷 그림 자체는 판마다 갈리지만(앱 UI 가 언어를 탄다) 캡션까지
 * 달면 16장 × 언어 수만큼 번역이 따라붙는다. 화면 자체가 이미 무엇을 하는지 보여 준다.
 */
export function Screenshots() {
  const { env, copy } = useLanding();
  const dir = shotDir(env.lang);
  const shots = Array.from({ length: SHOT_COUNT }, (_, i) => shotName(i));

  return (
    <section className="border-b border-slate-200 bg-white py-8 sm:py-12">
      <h2 className="px-4 text-center text-xl font-bold text-slate-900 sm:text-2xl">
        {copy.screenshots.title}
      </h2>
      <p className="mx-auto mt-2 max-w-2xl px-4 text-center text-sm leading-relaxed text-slate-600">
        {copy.screenshots.body}
      </p>

      {/*
        `snap-x snap-mandatory` 로 한 장씩 걸리게 한다. 장 사이 간격은 flex `gap` 이 아니라
        각 장의 뒤쪽 여백(`pe-*`)으로 준다 - Embla 루프는 마지막 장 뒤에 첫 장을 바로 잇는데,
        flex `gap` 은 이 이음매에만 간격을 안 넣어 두 장이 붙어 버린다. 여백을 장이 직접 안고
        있으면 그 이음매에도 똑같이 간격이 남는다.
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
          <div className="flex snap-x snap-mandatory pb-4">
            {shots.map((n, i) => (
              /*
                간격을 안는 바깥 래퍼. 장 사이 간격은 flex `gap` 이 아니라 이 래퍼의 뒤쪽
                여백(`pe-*`)으로 준다 - 위 컨테이너 주석 참고. 베젤에 배경색이 있어 여백을
                베젤에 직접 주면 검은 띠가 생기므로, 래퍼가 간격을 안고 베젤은 안쪽에 둔다.
              */
              <div key={n} className="shrink-0 snap-start pe-5 sm:pe-8">
                {/*
                  휴대전화 테두리를 둘러 준다. 스크린샷이 흰 화면이라 맨몸으로 두면 그냥 흰
                  네모가 되어 어디까지가 그림인지 흐려진다. 검은 베젤을 두르면 한눈에
                  "휴대전화 화면"으로 읽히고, 흰 배경 위에서 경계도 또렷해진다.
                */}
                <div className="rounded-[1.75rem] bg-slate-900 p-1.5 shadow-lg ring-1 ring-slate-900/5">
                  {/*
                    WebP 를 먼저 걸고 PNG 를 폴백으로 남긴다. 스크린샷은 UI 캡처라 평탄한
                    색면이 많아 WebP 손실 압축에서 열화가 눈에 안 띄면서 용량은 7.1MB → 1.9MB
                    (73%)로 줄어든다. PNG 를 지우지 않는 건 git 히스토리가 이미 들고 있어서
                    지워도 클론 용량이 안 줄기 때문이다 - 위험만 지고 얻는 게 없다.
                  */}
                  <picture>
                    <source srcSet={`${env.assetBase}${dir}shot-${n}.webp`} type="image/webp" />
                    <img
                      src={`${env.assetBase}${dir}shot-${n}.png`}
                      width={WIDTH}
                      height={HEIGHT}
                      /*
                        첫 화면에 걸리는 몇 장만 곧바로 받는다(`SHOT_EAGER_COUNT` 에 이유를
                        적어 두었다). 나머지를 다가올 때 받게 두지 않으면 이 한 섹션이 수 MB 를
                        끌고 와서, 정작 첫 화면이 늦게 뜬다.
                      */
                      loading={i < SHOT_EAGER_COUNT ? 'eager' : 'lazy'}
                      fetchPriority={i < SHOT_EAGER_COUNT ? 'high' : undefined}
                      decoding="async"
                      /*
                        번호만 붙이면(`실제 화면 보기 7`) 있으나 마나 한 대체 텍스트다.
                        화면 낭독기로 듣는 사람에게도, 이미지 검색에도 알려 주는 것이 없다.
                        어느 단계 화면인지 함께 읽어 준다 - 단계 이름은 `shotStage` 주석대로
                        이미 열다섯 언어에 번역되어 있어 새로 만들 문구가 없다.
                      */
                      alt={`${copy.screenshots.title} — ${copy.steps[shotStage(i)].title} (${i + 1}/${SHOT_COUNT})`}
                      /*
                        데스크톱에서 이미지를 마우스로 눌러 끌면 브라우저가 "이미지 드래그"(고스트)를
                        시작해 캐러셀 드래그를 가로챈다. 기본 드래그를 꺼서 마우스 조작이 Embla 로
                        가게 한다. 터치에는 이 기본 동작이 없어 원래도 잘 넘어갔다.
                      */
                      draggable={false}
                      className="block w-56 select-none rounded-[1.4rem] sm:w-64"
                    />
                  </picture>
                </div>
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
