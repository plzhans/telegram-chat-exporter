import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/utils';

interface FieldProps {
  label: string;
  hint?: ReactNode;
  error?: string;
  htmlFor?: string;
  className?: string;
  /**
   * 라벨을 입력칸 **왼쪽**에 둔다.
   *
   * 칸마다 두 줄씩 쓰는 대신 한 줄로 접어서 세로 자리를 아낀다. 라벨이 짧고 예측 가능한
   * 곳에서만 쓸 만하다 — 길면 줄바꿈이 생겨 오히려 들쭉날쭉해진다.
   *
   * **좁은 화면에서는 다시 위아래로 돌아간다.** 휴대폰에서 가로로 나누면 입력칸이 절반도
   * 안 남아서, 아낀 세로 자리보다 잃는 쪽이 크다.
   */
  inline?: boolean;
  children: ReactNode;
}

/** 라벨 + 입력 + 힌트/에러 한 묶음. 인증 화면이 전부 이 모양이라 따로 뺀다. */
export function Field({ label, hint, error, htmlFor, className, inline, children }: FieldProps) {
  const message = error ? (
    <p className="text-xs text-red-600">{error}</p>
  ) : hint ? (
    <div className="text-xs leading-relaxed text-slate-500">{hint}</div>
  ) : null;

  if (inline) {
    return (
      <div className={cn('space-y-1.5', className)}>
        <div className="mobile:flex mobile:items-center mobile:gap-3">
          <label
            htmlFor={htmlFor}
            // 라벨 폭을 고정한다. 글자 길이에 따라 입력칸 왼쪽 끝이 달라지면 줄이 안 맞는다.
            className="mb-1.5 block text-sm font-semibold text-slate-700 mobile:mb-0 mobile:w-24 mobile:shrink-0"
          >
            {label}
          </label>
          <div className="min-w-0 flex-1">{children}</div>
        </div>
        {/* 힌트·에러는 라벨 폭만큼 들여 써서 입력칸과 왼쪽 끝을 맞춘다. */}
        {message && <div className="mobile:ps-[6.75rem]">{message}</div>}
      </div>
    );
  }

  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={htmlFor} className="block text-sm font-semibold text-slate-700">
        {label}
      </label>
      {children}
      {message}
    </div>
  );
}
