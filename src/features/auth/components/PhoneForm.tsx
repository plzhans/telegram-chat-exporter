import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/shared/ui/Button';
import { Field } from '@/shared/ui/Field';
import { Input } from '@/shared/ui/Input';
import {
  countryFromLanguage,
  examplePhone,
  normalizePhone,
  type CountryCode,
} from '@/shared/lib/phone';
import { CountrySelect } from './CountrySelect';

interface PhoneFormProps {
  busy: boolean;
  onSubmit: (phoneNumber: string) => void;
  footer?: ReactNode;
}

/**
 * 전화번호 입력.
 *
 * 나라를 고르고 번호를 적는다. 예전에는 한 칸만 받고 `+` 가 없으면 무조건 한국 번호로
 * 봤는데, 그러면 **미국 번호를 적은 사람에게 존재하지 않는 한국 번호로 코드가 발송된다.**
 * 화면이 한국어뿐일 때는 넘어갈 수 있었지만 지금은 아니다.
 *
 * 기본 나라는 화면 언어에서 유추한다. 한국어 화면이면 대한민국이 이미 골라져 있어서
 * 한국 사용자가 하던 대로 번호만 적으면 된다.
 *
 * **`+` 로 시작하면 고른 나라를 무시한다.** 목록에 자기 나라가 없거나 형식이 특이한
 * 사람이 국가번호째로 적어 넣을 수 있는 탈출구다.
 *
 * **형식이 어긋나도 막지 않는다.** 번호 대역은 계속 새로 생기는데 메타데이터는 늦게
 * 따라온다. 막으면 방금 개통한 번호를 쓰는 사람이 도구를 아예 못 쓴다. 알려만 준다.
 */
export function PhoneForm({ busy, onSubmit, footer }: PhoneFormProps) {
  const { t, i18n } = useTranslation();
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState<CountryCode | undefined>(() =>
    countryFromLanguage(i18n.resolvedLanguage ?? ''),
  );
  const { value, valid, detectedCountry, formatted } = normalizePhone(phone, country);

  // `+82...` 처럼 국가번호를 직접 적으면 선택 상자를 거기에 맞춰 준다.
  useEffect(() => {
    if (detectedCountry && detectedCountry !== country) setCountry(detectedCountry);
  }, [detectedCountry, country]);

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
        <div className="flex gap-2">
          <CountrySelect value={country} onChange={setCountry} disabled={busy} />
          <Input
            id="phone-number"
            autoFocus
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            disabled={busy}
            placeholder={examplePhone(country) || t('auth.phone.placeholder')}
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
        </div>
      </Field>

      {/* 보낼 번호를 늘 되짚어 준다. 말없이 고쳐 보내면 코드가 안 왔을 때 짚을 곳이 없다. */}
      {value && (
        <p className="text-xs leading-relaxed text-slate-500">
          {t('auth.phone.willSend')}{' '}
          <span className="font-mono font-semibold text-slate-900">{formatted || value}</span>
        </p>
      )}

      {/* 막지는 않는다. 위 주석 참고. */}
      {value && !valid && (
        <p className="text-xs leading-relaxed text-amber-700">{t('auth.phone.unverified')}</p>
      )}

      <Button type="submit" size="lg" className="w-full" loading={busy} disabled={!value}>
        {t('auth.phone.submit')}
      </Button>

      {footer}
    </form>
  );
}
