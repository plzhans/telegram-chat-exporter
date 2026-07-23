import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '@/shared/lib/utils';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** 닫기 버튼 자리에 들어갈 것. 안 주면 버튼 없이 Esc·바깥 클릭으로만 닫힌다. */
  footer?: ReactNode;
  className?: string;
}

/**
 * 네이티브 `<dialog>` 기반 모달.
 *
 * 라이브러리를 안 쓴 이유는 필요가 없어서다. `showModal()` 하나로 포커스 트랩, Esc 닫기,
 * 배경 비활성화, `::backdrop` 이 전부 브라우저에서 온다. 이 앱에 모달이 하나뿐인데
 * radix-dialog 를 더 얹으면 번들만 커진다.
 *
 * `close` 이벤트를 듣는 게 중요하다 — Esc 로 닫으면 React 상태를 거치지 않고 DOM 이 먼저
 * 닫히기 때문에, 그걸 안 잡으면 `open` prop 만 true 로 남아 다시 열 수 없게 된다.
 */
export function Modal({ open, onClose, title, children, footer, className }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const handleClose = () => onClose();
    dialog.addEventListener('close', handleClose);
    return () => dialog.removeEventListener('close', handleClose);
  }, [onClose]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="modal-title"
      className={cn(
        // Tailwind preflight 가 margin 을 0 으로 만들어서 기본 가운데 정렬이 풀린다. m-auto 로 되돌린다.
        'm-auto w-[min(26rem,calc(100vw-2rem))] animate-fade-in rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-xl',
        className,
      )}
    >
      <h2 id="modal-title" className="text-base font-bold">
        {title}
      </h2>
      <div className="mt-2 text-sm leading-relaxed text-slate-600">{children}</div>
      {footer && <div className="mt-5 flex justify-end gap-2">{footer}</div>}
    </dialog>
  );
}
