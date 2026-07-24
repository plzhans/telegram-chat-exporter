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
  /**
   * 제출 버튼 **바로 위**에 놓을 것. 오류 알림이 여기로 온다.
   *
   * 화면 맨 위에 두면 안 읽힌다. 이 화면은 로그인 코드 경고까지 얹혀 있어서 휴대전화에서는
   * 버튼과 알림이 한 화면에 같이 잡히지 않는다. 사용자는 방금 누른 버튼을 보고 있으므로,
   * 그 버튼이 왜 아무 일도 안 했는지는 버튼 옆에 적혀 있어야 한다.
   */
  notice?: ReactNode;
  footer?: ReactNode;
  /**
   * 요청 제한이 걸려 있는 동안 제출 버튼을 대신 채우는 문구("3분 후에 다시 시도").
   * null 이면 평소대로다 — PhoneForm 의 같은 이름과 한 짝이다.
   */
  blockedLabel?: string | null;
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
  notice,
  footer,
  blockedLabel,
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

      {notice}

      {/* 제한이 풀릴 때까지 잠근다. 이유는 PhoneForm 의 같은 자리 주석 참고. */}
      <Button type="submit" size="lg" className="w-full" loading={busy} disabled={!!blockedLabel}>
        {blockedLabel ?? submitLabel}
      </Button>

      {footer}
    </form>
  );
}
