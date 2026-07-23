import type { ReactNode } from 'react';
import { AlertTriangle, Info, ShieldCheck } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

type Tone = 'info' | 'warning' | 'trust';

const tones: Record<Tone, { box: string; icon: typeof Info }> = {
  info: { box: 'bg-slate-100 text-slate-700', icon: Info },
  warning: { box: 'bg-amber-50 text-amber-900 ring-1 ring-amber-200', icon: AlertTriangle },
  trust: { box: 'bg-primary-50 text-primary-900 ring-1 ring-primary-200', icon: ShieldCheck },
};

export function Alert({
  tone = 'info',
  title,
  children,
  className,
}: {
  tone?: Tone;
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  const { box, icon: Icon } = tones[tone];
  return (
    <div className={cn('flex gap-3 rounded-xl px-4 py-3 text-sm', box, className)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="space-y-1 leading-relaxed">
        {/*
          제목은 본문 크기를 따라가지 않는다. 호출부가 본문을 줄이더라도(className 으로
          text-xs 를 주는 식) **무엇에 대한 알림인지는 그대로 눈에 띄어야** 한다.
        */}
        {title && <p className="text-sm font-semibold">{title}</p>}
        <div>{children}</div>
      </div>
    </div>
  );
}
