import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/utils';

interface FieldProps {
  label: string;
  hint?: ReactNode;
  error?: string;
  htmlFor?: string;
  className?: string;
  children: ReactNode;
}

/** 라벨 + 입력 + 힌트/에러 한 묶음. 인증 화면이 전부 이 모양이라 따로 뺀다. */
export function Field({ label, hint, error, htmlFor, className, children }: FieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={htmlFor} className="block text-sm font-semibold text-slate-700">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-red-600">{error}</p>
      ) : hint ? (
        <div className="text-xs leading-relaxed text-slate-500">{hint}</div>
      ) : null}
    </div>
  );
}
