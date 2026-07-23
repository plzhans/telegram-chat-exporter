import type { InputHTMLAttributes, ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/shared/ui/Button';
import { Field } from '@/shared/ui/Field';
import { Input } from '@/shared/ui/Input';

interface AuthStepFormProps {
  label: string;
  hint?: ReactNode;
  submitLabel: string;
  busy: boolean;
  onSubmit: (value: string) => void;
  footer?: ReactNode;
  inputProps?: InputHTMLAttributes<HTMLInputElement>;
}

/**
 * 전화번호·인증코드·2FA 비밀번호는 전부 "한 칸 입력하고 제출"이라 한 컴포넌트로 묶는다.
 *
 * 검증은 "비어 있지 않음"만 본다. 형식 검사(번호가 유효한가, 코드가 맞는가)는 어차피
 * 텔레그램이 하고, 우리가 앞질러 막으면 국가별 번호 형식 같은 걸 잘못 판단해서 멀쩡한
 * 사용자를 막게 된다.
 */
export function AuthStepForm({
  label,
  hint,
  submitLabel,
  busy,
  onSubmit,
  footer,
  inputProps,
}: AuthStepFormProps) {
  const { register, handleSubmit } = useForm<{ value: string }>({
    defaultValues: { value: '' },
  });

  const submit = handleSubmit(({ value }) => onSubmit(value.trim()));

  return (
    <form className="space-y-4" onSubmit={(e) => void submit(e)}>
      <Field label={label} hint={hint} htmlFor="auth-step-value">
        <Input
          id="auth-step-value"
          autoFocus
          disabled={busy}
          {...inputProps}
          {...register('value', { required: true })}
        />
      </Field>

      <Button type="submit" size="lg" className="w-full" loading={busy}>
        {submitLabel}
      </Button>

      {footer}
    </form>
  );
}
