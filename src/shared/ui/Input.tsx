import { type InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/shared/lib/utils';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'h-11 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none',
        'placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary-100',
        'disabled:bg-slate-100 disabled:text-slate-500',
        className,
      )}
      {...props}
    />
  ),
);

Input.displayName = 'Input';
