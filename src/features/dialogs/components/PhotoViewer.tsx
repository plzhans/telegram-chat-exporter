import { useEffect, useRef, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Spinner } from '@/shared/ui/Spinner';
import { cn } from '@/shared/lib/utils';
import {
  getLoadedFull,
  getLoadedThumb,
  loadFullPhoto,
  subscribeMediaThumbs,
} from '../lib/mediaThumb';
import { useLightbox } from '../lib/useLightbox';

/**
 * 사진 확대 보기.
 *
 * 라이브러리(PhotoSwipe 등) 대신 직접 만든 이유는, 이 앱의 사진이 URL 이 아니라 **MTProto 로
 * 받아 만든 data URL** 이기 때문이다. 어떤 라이브러리를 써도 로딩·캐시·동시성은 우리가 붙여야
 * 하고, 라이브러리가 대신 해 주는 건 확대 제스처와 슬라이드 UI 뿐이다. 그 둘만 필요하다면
 * 네이티브 `<dialog>` 로 충분하다.
 *
 * 큰 판은 **열었을 때만** 받는다(`loadFullPhoto`). 목록을 훑는 동안에는 요청이 나가지 않는다.
 */
export function PhotoViewer() {
  const { t } = useTranslation();
  const keys = useLightbox((state) => state.keys);
  const index = useLightbox((state) => state.index);
  const close = useLightbox((state) => state.close);
  const next = useLightbox((state) => state.next);
  const previous = useLightbox((state) => state.previous);

  const ref = useRef<HTMLDialogElement>(null);
  const open = keys.length > 0;
  const key = keys[index];

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // Esc 로 닫으면 DOM 이 먼저 닫히고 상태는 그대로다. 그걸 잡아 상태도 맞춘다.
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const onClose = () => close();
    dialog.addEventListener('close', onClose);
    return () => dialog.removeEventListener('close', onClose);
  }, [close]);

  useEffect(() => {
    if (open && key) void loadFullPhoto(key);
  }, [open, key]);

  // 좌우 키로 넘긴다. 사진이 여러 장일 때 마우스로만 넘기게 두면 답답하다.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') next();
      if (event.key === 'ArrowLeft') previous();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, next, previous]);

  const loaded = useSyncExternalStore(
    subscribeMediaThumbs,
    () => (key ? getLoadedFull(key) : undefined),
    () => undefined,
  );

  // 큰 판이 오기 전에는 이미 받아 둔 목록용 썸네일을 늘려 보여준다. 빈 화면보다 낫다.
  const preview = key ? getLoadedThumb(key) : undefined;
  const src = loaded ?? preview ?? undefined;

  return (
    <dialog
      ref={ref}
      aria-label={t('messages.photoViewer')}
      className="m-0 h-full max-h-none w-full max-w-none bg-transparent p-0 backdrop:bg-slate-900/85"
      // 사진 바깥을 누르면 닫힌다. 확대 보기에서 가장 기대되는 동작이다.
      onClick={(event) => {
        if (event.target === ref.current) close();
      }}
    >
      <div className="flex h-full w-full flex-col">
        <div className="flex shrink-0 items-center gap-2 p-3">
          <span className="flex-1 text-sm font-semibold text-white/80">
            {keys.length > 1 && `${index + 1} / ${keys.length}`}
          </span>
          <button
            type="button"
            onClick={close}
            aria-label={t('common.cancel')}
            className="rounded-full p-2 text-white/80 transition-colors hover:bg-white/10"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 items-center gap-2 px-2 pb-4">
          <ViewerArrow
            side="left"
            show={keys.length > 1}
            disabled={index === 0}
            onClick={previous}
            label={t('messages.previousPhoto')}
          />

          <div className="flex min-h-0 flex-1 items-center justify-center">
            {src ? (
              <img
                src={src}
                alt=""
                className={cn(
                  'max-h-full max-w-full object-contain',
                  // 큰 판이 오기 전 미리보기는 늘려 놓은 것이라 흐리다. 그 사실을 감추지 않는다.
                  !loaded && 'opacity-70',
                )}
              />
            ) : (
              <Spinner className="border-white/70 border-t-transparent" />
            )}
          </div>

          <ViewerArrow
            side="right"
            show={keys.length > 1}
            disabled={index === keys.length - 1}
            onClick={next}
            label={t('messages.nextPhoto')}
          />
        </div>
      </div>
    </dialog>
  );
}

function ViewerArrow({
  side,
  show,
  disabled,
  onClick,
  label,
}: {
  side: 'left' | 'right';
  show: boolean;
  disabled: boolean;
  onClick: () => void;
  label: string;
}) {
  // 낱장일 때도 자리는 남긴다. 안 그러면 앨범과 낱장에서 사진 위치가 달라져 눈이 흔들린다.
  if (!show) return <span className="w-10 shrink-0" />;
  const Icon = side === 'left' ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="shrink-0 rounded-full p-2 text-white/80 transition-colors hover:bg-white/10 disabled:opacity-25"
    >
      <Icon className="h-6 w-6" />
    </button>
  );
}
