import { type InputHTMLAttributes, forwardRef, useId } from 'react';
import { cn } from '@/shared/lib/utils';

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  hint?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, hint, id, ...props }, ref) => {
    const generated = useId();
    const inputId = id ?? generated;

    return (
      <div className={cn('flex gap-2.5', className)}>
        <input
          ref={ref}
          id={inputId}
          type="checkbox"
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-primary focus:ring-2 focus:ring-primary-100"
          {...props}
        />
        <label htmlFor={inputId} className="min-w-0 flex-1 cursor-pointer">
          <span className="block text-sm font-medium text-slate-700">{label}</span>
          {hint && <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">{hint}</span>}
        </label>
      </div>
    );
  },
);

Checkbox.displayName = 'Checkbox';
