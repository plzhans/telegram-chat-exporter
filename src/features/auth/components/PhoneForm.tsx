import type { ReactNode } from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/shared/ui/Button';
import { Field } from '@/shared/ui/Field';
import { Input } from '@/shared/ui/Input';
import { normalizePhone } from '@/shared/lib/phone';

interface PhoneFormProps {
  busy: boolean;
  onSubmit: (phoneNumber: string) => void;
  footer?: ReactNode;
}

/**
 * 전화번호 입력.
 *
 * 한 칸만 받는다. 국가번호 선택 상자를 두지 않는 이유는 쓸 사람 대부분이 한국 번호라
 * **고르게 하는 것 자체가 비용**이기 때문이다. `010-8582-3019` 나 `01085823019` 처럼
 * 한국 휴대전화 모양이면 알아서 `+82` 를 붙이고 앞의 0 을 뗀다.
 *
 * **바꾼 결과를 반드시 보여준다.** 전화번호를 말없이 고쳐서 보내면, 사용자는 자기가 적은
 * 번호로 코드가 갔다고 믿는다. 다른 번호로 갔을 때 원인을 짚을 방법이 없어진다.
 */
export function PhoneForm({ busy, onSubmit, footer }: PhoneFormProps) {
  const { t } = useTranslation();
  const [phone, setPhone] = useState('');
  const { value, converted } = normalizePhone(phone);

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (value) onSubmit(value);
      }}
    >
      {/*
        안내 문구를 따로 두지 않는다. 기본이 한국 번호라 대부분은 적던 대로 적으면 되고,
        보정이 일어났을 때만 아래에 결과를 보여주는 편이 조용하다.
      */}
      <Field label={t('auth.phone.title')} htmlFor="phone-number">
        <Input
          id="phone-number"
          autoFocus
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          disabled={busy}
          placeholder={t('auth.phone.placeholder')}
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
        />
      </Field>

      {/* 우리가 손댄 경우에만 띄운다. 그대로 보내는 번호까지 매번 되뇌면 잔소리가 된다. */}
      {converted && (
        <p className="text-xs leading-relaxed text-slate-500">
          {t('auth.phone.willSend')}{' '}
          <span className="font-mono font-semibold text-slate-900">{value}</span>
        </p>
      )}

      <Button type="submit" size="lg" className="w-full" loading={busy} disabled={!value}>
        {t('auth.phone.submit')}
      </Button>

      {footer}
    </form>
  );
}
