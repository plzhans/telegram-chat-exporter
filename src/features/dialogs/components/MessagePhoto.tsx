import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useLightbox } from '../lib/useLightbox';
import { cn } from '@/shared/lib/utils';
import { getLoadedThumb, loadMediaThumb, subscribeMediaThumbs } from '../lib/mediaThumb';
import type { MessageSummary } from '../api';

/**
 * 말풍선 안의 사진.
 *
 * 프로필 사진과 같은 2단계다.
 * 1. 메시지에 딸려 온 초저해상도 미리보기(`mediaThumb`)를 **요청 없이** 즉시 깐다.
 * 2. 화면에 들어오면 선명한 썸네일을 받아 바꿔 끼운다.
 *
 * 원본은 받지 않는다. 사진 한 장에 몇 MB 씩 나가는데 말풍선 안에서는 그만한 해상도가
 * 보이지도 않는다. (원본 저장은 내보내기 쪽에서 다룰 일이다.)
 */
interface MessagePhotoProps {
  message: MessageSummary;
  dark: boolean;
  /**
   * 앨범 칸으로 그린다.
   *
   * 여러 장을 격자로 늘어놓을 때는 **원본 비율을 따르면 안 된다.** 장마다 크기가 달라
   * 격자가 들쭉날쭉해진다. 칸을 채우고 넘치는 부분은 잘라 낸다.
   */
  tile?: boolean;
  /**
   * 확대 보기에서 함께 넘겨볼 사진들.
   *
   * 앨범이면 그 묶음 전체가 온다. 안 주면 이 사진 하나만 열린다.
   */
  albumKeys?: string[];
}

export function MessagePhoto({ message, dark, tile = false, albumKeys }: MessagePhotoProps) {
  const openLightbox = useLightbox((state) => state.open);
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  const key = message.mediaKey;

  useEffect(() => {
    if (!key || visible) return;
    const element = ref.current;
    if (!element || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setVisible(true);
      },
      // 조금 미리 받아 두면 스크롤 중에 빈 칸이 덜 보인다.
      { rootMargin: '300px' },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [key, visible]);

  useEffect(() => {
    if (visible && key) void loadMediaThumb(key);
  }, [visible, key]);

  const loaded = useSyncExternalStore(
    subscribeMediaThumbs,
    () => (key ? getLoadedThumb(key) : undefined),
    () => undefined,
  );

  const src = loaded ?? message.mediaThumb;

  /**
   * 표시 크기를 **픽셀로 못 박는다.**
   *
   * 예전에는 `w-full` + 비율만 줬는데, 말풍선 너비가 내용에 따라 정해지는 구조라 이미지가
   * 오기 전에는 기준이 될 너비 자체가 없었다. 그래서 저화질 미리보기는 쪼그라든 채로
   * 나오다가, 선명한 사진이 도착하며 그 원본 너비로 갑자기 벌어졌다.
   *
   * 썸네일 치수는 메시지에 이미 실려 오므로 **받기 전에도 얼마나 클지 안다.** 그 값으로
   * 자리를 잡아 두면 사진이 언제 도착하든 화면이 흔들리지 않는다.
   *
   * 가로·세로 상한을 함께 두는 이유는 세로로 긴 사진 때문이다. 가로만 제한하면 세로 사진이
   * 화면을 뚫고 내려간다.
   */
  /** 치수를 아는가. 모르면 칸 비율이 짐작이라 사진과 어긋날 수 있다. */
  const knownRatio = Boolean(message.mediaWidth && message.mediaHeight);
  const sticker = message.mediaType === 'sticker';
  const MAX_WIDTH = 256;
  const MAX_HEIGHT = 320;
  const width = message.mediaWidth ?? 4;
  const height = message.mediaHeight ?? 3;
  const scale = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height, 1);
  const displayWidth = Math.round(width * scale);

  /**
   * 확대해 볼 수 있는가.
   *
   * **스티커는 제외한다.** 원래 작게 쓰라고 만든 그림이라 키워 봐야 뭉개지기만 하고,
   * 대화 중에 스티커를 눌렀을 때 화면을 덮는 창이 뜨면 성가시다.
   */
  const zoomable = Boolean(key) && !sticker;

  const body = (
    <>
      {src && (
        <img
          src={src}
          alt=""
          loading="lazy"
          className={cn(
            'h-full w-full transition-opacity',
            /*
              칸의 비율을 사진 비율에 맞춰 두므로(MessageAlbum 참고) 채워도 잘릴 것이 없다.
              `cover` 는 비율을 유지한 채 넘치는 부분만 자르므로 **찌그러지지는 않는다.**

              다만 치수를 모르는 사진은 칸 비율을 짐작할 수밖에 없어 어긋난다. 그때만
              `contain` 으로 물러난다 — 잘라 먹느니 남는 자리를 두는 편이 낫다.
              스티커도 여백이 곧 투명 영역이라 잘라내면 안 된다.
            */
            knownRatio && !sticker ? 'object-cover' : 'object-contain',
          )}
        />
      )}
    </>
  );

  const shared = {
    ref: ref as never,
    className: cn(
        // w-full 은 쓰지 않는다. 너비를 style 로 못 박아야 사진이 오기 전에도 자리가 잡힌다.
        'relative overflow-hidden',
        /*
          스티커는 **배경도 테두리도 없다.** 투명 그림이라 상자에 담으면 네모난 판이 생기고,
          대화 위에 그림만 얹히는 스티커의 성격이 사라진다.
        */
        sticker ? 'bg-transparent' : dark ? 'bg-primary-700' : 'bg-slate-200',
        tile ? 'h-full w-full rounded-none' : 'rounded-2xl',
        !sticker && !tile && 'cursor-zoom-in',
        /*
          테두리를 **사진 위에 덮어 그린다**(`::after`).

          바깥에 두르는 방식(`ring`)은 저화질 미리보기일 때는 잘 보이다가, 선명한 사진이
          도착해 화면을 꽉 채우면 사라진 것처럼 보인다. 밝은 사진 · 연한 선 · 흰 배경이
          전부 비슷한 밝기라 선이 묻히기 때문이다. 사진 위에 반투명 검정을 얹으면 사진이
          밝든 어둡든 항상 경계가 드러난다.

          **캡션이 있을 때도 두른다.** 말풍선이 경계를 잡아 준다고 생략했더니, 밝은 사진이
          말풍선 위쪽을 꽉 채우면서 사진과 말풍선의 경계가 사라졌다. 다만 글과 맞닿는
          아래쪽만은 선을 긋지 않는다 — 거기는 이어져 보이는 편이 자연스럽다.
        */
        'after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:border-slate-900/15',
        // 앨범 칸은 바깥 테두리를 앨범 전체가 한 번만 두른다. 칸마다 두르면 격자가 지저분해진다.
        tile || sticker ? 'after:border-0' : 'after:border',
    ),
    style: (tile
      ? undefined
      : sticker
        ? {
            /*
              스티커만 **화면 폭에 따라** 큰다. 픽셀로 못 박아 두면 넓은 화면에서
              우표만 하게 보이고, 좁은 화면에서는 자리를 다 잡아먹는다.
              대화 영역이 최대 48rem 이라 220px 이 대략 그 30% 다. 아래로는 120px 에서
              멈춰 세운다 — 더 작아지면 무엇을 그린 스티커인지 안 보인다.
            */
            width: 'clamp(120px, 30vw, 220px)',
            aspectRatio: `${width} / ${height}`,
          }
        : { width: displayWidth, maxWidth: '100%', aspectRatio: `${width} / ${height}` }) as
      | React.CSSProperties
      | undefined,
  };

  // 누를 일이 없는 그림은 버튼으로 두지 않는다. 키보드 순회에 끼어들 이유가 없다.
  if (!zoomable) return <div {...shared}>{body}</div>;

  return (
    <button
      type="button"
      {...shared}
      // 사진을 누르면 크게 본다. 목록에서는 줄여 보여주므로 세부가 안 보인다.
      onClick={() => {
        if (!key) return;
        const keys = albumKeys ?? [key];
        openLightbox(keys, Math.max(keys.indexOf(key), 0));
      }}
    >
      {body}
    </button>
  );
}
