import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Megaphone, User, Users } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import type { DialogKind } from '../api';
import { getLoadedPhoto, loadProfilePhoto, subscribeProfilePhotos } from '../lib/profilePhoto';

const icons: Record<DialogKind, typeof User> = {
  user: User,
  group: Users,
  channel: Megaphone,
};

/**
 * 사진이 없는 대화방용 배경색.
 *
 * 텔레그램도 같은 방식으로 이름 첫 글자 + 고정 색을 쓴다. **id 로 색을 정하는 게 중요하다** —
 * 이름으로 정하면 상대가 이름을 바꿀 때마다 색이 바뀌어서, 목록에서 색으로 방을 찾던
 * 사람의 기억이 매번 어긋난다.
 */
const COLORS = [
  'bg-rose-500',
  'bg-orange-500',
  'bg-amber-500',
  'bg-emerald-500',
  'bg-teal-500',
  'bg-sky-500',
  'bg-indigo-500',
  'bg-violet-500',
];

function colorFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

/**
 * 이름 첫 글자.
 *
 * `Array.from` 을 쓰는 이유는 `title[0]` 이 **서로게이트 페어를 반으로 자르기** 때문이다.
 * 이모지로 시작하는 대화방 이름이 드물지 않은데, 그러면 깨진 문자가 나온다.
 */
function initialOf(title: string): string {
  const first = Array.from(title.trim())[0];
  return first ? first.toUpperCase() : '';
}

/**
 * 화면에 들어오면 선명한 사진을 받아온다.
 *
 * 목록에 딸려 오는 `strippedThumb` 은 가로세로 수십 px 짜리라 확대하면 뿌옇다. 진짜 사진은
 * `downloadProfilePhoto` 로 받아야 하는데 **대화방 하나당 요청 하나**라 전부 한꺼번에
 * 받으면 FLOOD_WAIT 을 맞는다. 그래서 **보이는 것만** 받고, 그마저도 큐로 동시 실행 수를
 * 제한한다(lib/profilePhoto.ts).
 *
 * IntersectionObserver 가 없는 환경에서는 그냥 즉시 받는다 — 지금 브라우저에는 다 있지만,
 * 없다고 아바타가 영영 안 나오는 것보다는 낫다.
 */
function useSharpPhoto(id: string, enabled: boolean, ref: React.RefObject<HTMLElement | null>) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!enabled || visible) return;
    const element = ref.current;
    if (!element || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setVisible(true);
      },
      // 조금 미리 받아두면 스크롤 중에 빈 칸이 덜 보인다.
      { rootMargin: '200px' },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [enabled, visible, ref]);

  useEffect(() => {
    if (visible && enabled) void loadProfilePhoto(id);
  }, [visible, enabled, id]);

  return useSyncExternalStore(
    subscribeProfilePhotos,
    () => getLoadedPhoto(id),
    () => undefined,
  );
}

interface AvatarProps {
  id: string;
  title: string;
  kind: DialogKind;
  /** 목록 응답에 딸려 온 저해상도 썸네일. 선명한 사진이 도착하기 전까지 이걸 보여준다. */
  photo?: string;
  /** 선명한 사진을 추가로 받아올지. 메시지 목록처럼 같은 사람이 많이 반복되는 곳은 끈다. */
  sharp?: boolean;
  className?: string;
}

export function Avatar({ id, title, kind, photo, sharp = false, className }: AvatarProps) {
  const ref = useRef<HTMLElement>(null);
  const loaded = useSharpPhoto(id, sharp, ref);
  const src = loaded ?? photo;

  const base = cn(
    'flex shrink-0 items-center justify-center overflow-hidden rounded-full',
    className,
  );

  if (src) {
    return (
      <img
        ref={ref as React.RefObject<HTMLImageElement>}
        src={src}
        alt=""
        className={cn(base, 'bg-slate-100 object-cover')}
      />
    );
  }

  const initial = initialOf(title);
  if (!initial) {
    const Icon = icons[kind];
    return (
      <span ref={ref as React.RefObject<HTMLSpanElement>} className={cn(base, 'bg-slate-100 text-slate-500')}>
        <Icon className="h-1/2 w-1/2" />
      </span>
    );
  }

  return (
    <span
      ref={ref as React.RefObject<HTMLSpanElement>}
      className={cn(base, colorFor(id), 'font-semibold text-white')}
    >
      {initial}
    </span>
  );
}
