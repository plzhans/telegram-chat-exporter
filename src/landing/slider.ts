/**
 * 랜딩 스크린샷 슬라이더.
 *
 * **랜딩에서 유일하게 도는 스크립트다.** 나머지 랜딩은 빌드 때 HTML 로 찍혀 나오고
 * 자바스크립트를 쓰지 않는다(`Landing.tsx` 주석). 그래서 여기는 React 가 아니라 평범한
 * DOM 코드이고, 앱 번들과도 완전히 분리된 조각으로 빌드된다 - 랜딩을 열었다고 앱의
 * MTProto 라이브러리까지 받는 일은 없어야 한다.
 *
 * ## 스크립트가 없어도 넘어간다
 *
 * 마크업은 기본적으로 **가로 스크롤 + scroll-snap** 으로 되어 있어서, 이 파일이 실패하거나
 * 늦게 도착해도 손가락으로 밀어 볼 수 있다. Embla 를 붙일 때만 `is-embla` 를 달아 스크롤을
 * 넘겨받는다. 화살표와 점은 스크립트가 살아 있을 때만 의미가 있으므로 그때 드러낸다.
 */

import EmblaCarousel, { type EmblaCarouselType } from 'embla-carousel';
import Autoplay from 'embla-carousel-autoplay';

/** 한 장이 머무는 시간(ms). 읽을 틈은 주되 지루하지 않을 만큼. */
const AUTOPLAY_DELAY = 4000;

/**
 * 움직임을 줄여 달라고 설정한 사람인가.
 *
 * 어지럼증·전정 장애가 있는 사람에게 저절로 움직이는 화면은 실제로 불편하다. 운영체제에
 * 그렇게 설정해 둔 사람에게는 **자동 넘김을 아예 걸지 않는다** - 버튼으로 직접 넘기는 것은
 * 그대로 된다.
 */
const prefersReducedMotion = (): boolean =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/** 점 하나. 지금 보고 있는 장에는 `is-active` 가 붙는다. */
function makeDot(index: number, onClick: () => void): HTMLButtonElement {
  const dot = document.createElement('button');
  dot.type = 'button';
  /*
    누르는 자리라 너무 작으면 안 된다. 보이는 점은 작게 두되 버튼 자체에 여백을 줘서
    손가락으로도 짚을 수 있는 크기를 만든다.
  */
  dot.className =
    'h-2.5 w-2.5 rounded-full bg-slate-300 transition-colors hover:bg-slate-400 [&.is-active]:bg-primary';
  dot.setAttribute('aria-label', String(index + 1));
  dot.addEventListener('click', onClick);
  return dot;
}

function setupDots(embla: EmblaCarouselType, host: HTMLElement): void {
  const dots = embla.scrollSnapList().map((_, i) =>
    makeDot(i, () => {
      embla.scrollTo(i);
    }),
  );
  host.replaceChildren(...dots);

  const paint = () => {
    const selected = embla.selectedScrollSnap();
    dots.forEach((dot, i) => dot.classList.toggle('is-active', i === selected));
  };
  embla.on('select', paint);
  embla.on('reInit', paint);
  paint();
}

/** 끝에 닿으면 그 방향 버튼을 잠근다. 눌러도 안 움직이는 버튼은 고장으로 읽힌다. */
function setupArrows(embla: EmblaCarouselType, root: HTMLElement): void {
  const prev = root.querySelector<HTMLButtonElement>('[data-embla-prev]');
  const next = root.querySelector<HTMLButtonElement>('[data-embla-next]');

  prev?.addEventListener('click', () => embla.scrollPrev());
  next?.addEventListener('click', () => embla.scrollNext());

  const paint = () => {
    if (prev) prev.disabled = !embla.canScrollPrev();
    if (next) next.disabled = !embla.canScrollNext();
  };
  embla.on('select', paint);
  embla.on('reInit', paint);
  paint();
}

/**
 * 자동 넘김을 세우고 다시 돌리는 버튼.
 *
 * **저절로 움직이는 화면에는 멈추는 방법이 반드시 있어야 한다.** 읽는 속도는 사람마다
 * 다르고, 글을 따라가는 중에 장이 넘어가면 다시 찾아와야 한다(WCAG 2.2.2 도 같은 요구다).
 */
function setupToggle(autoplay: ReturnType<typeof Autoplay>, root: HTMLElement): void {
  const button = root.querySelector<HTMLButtonElement>('[data-embla-toggle]');
  if (!button) return;

  const paint = (paused: boolean) => {
    button.classList.toggle('is-paused', paused);
    // 버튼의 이름은 "지금 상태"가 아니라 "누르면 일어날 일"이어야 한다.
    const label = paused ? button.dataset.labelPlay : button.dataset.labelPause;
    if (label) button.setAttribute('aria-label', label);
  };

  button.addEventListener('click', () => {
    const playing = autoplay.isPlaying();
    if (playing) autoplay.stop();
    else autoplay.play();
    paint(playing);
  });

  paint(false);
}

function start(root: HTMLElement): void {
  const viewport = root.querySelector<HTMLElement>('[data-embla-viewport]');
  if (!viewport) return;

  /*
    `is-embla` 가 붙는 순간 CSS 가 가로 스크롤을 끄고 Embla 에게 자리를 넘긴다. 붙이기
    전까지는 스크롤 스냅으로 동작하므로, 이 줄에 닿기 전에도 슬라이더는 쓸 수 있다.
  */
  viewport.classList.add('is-embla');

  /*
    자동 넘김은 움직임을 줄여 달라고 한 사람에게는 걸지 않는다. 그 경우 아래 토글 버튼도
    할 일이 없으므로 함께 숨긴다(`is-autoplay` 가 안 붙는다).
  */
  const autoplaying = !prefersReducedMotion();
  const autoplay = Autoplay({
    delay: AUTOPLAY_DELAY,
    /*
      손을 대면 멈추되 **영영 멈추지는 않는다.** 한 번 넘겨 봤다고 자동 넘김이 죽어 버리면
      "왜 멈췄지" 하게 된다. 마우스를 올린 동안에만 선다 - 읽고 있다는 뜻이니까.
    */
    stopOnInteraction: false,
    stopOnMouseEnter: true,
    playOnInit: autoplaying,
  });

  const embla = EmblaCarousel(
    viewport,
    {
      align: 'center',
      // 끝에 닿으면 처음으로 돌아간다. 자동으로 도는 동안 마지막 장에서 멈춰 서면 안 된다.
      loop: true,
      dragFree: false,
    },
    autoplaying ? [autoplay] : [],
  );

  setupArrows(embla, root);
  if (autoplaying) {
    root.classList.add('is-autoplay');
    setupToggle(autoplay, root);
  }

  const dotsHost = root.querySelector<HTMLElement>('[data-embla-dots]');
  if (dotsHost) setupDots(embla, dotsHost);

  // 화살표·점은 스크립트가 살아 있을 때만 뜻이 있다. 여기까지 왔으면 드러낸다.
  root.classList.add('is-ready');
}

document.querySelectorAll<HTMLElement>('[data-embla]').forEach(start);
