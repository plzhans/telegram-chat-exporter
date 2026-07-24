import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/shared/ui/Button';
import { Checkbox } from '@/shared/ui/Checkbox';
import { Field } from '@/shared/ui/Field';
import { Input } from '@/shared/ui/Input';
import { IDLE_TTL_MINUTES } from '@/shared/telegram/session';
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
  /** "이 탭에서 로그인 유지". 값은 스토어가 들고 있다 — useAuth 의 `remember` 주석 참고. */
  remember: boolean;
  onRememberChange: (value: boolean) => void;
  /**
   * 요청 제한이 걸려 있는 동안 제출 버튼을 대신 채우는 문구("3분 후에 다시 시도").
   * null 이면 평소대로다. 문구를 만드는 자리는 SignIn 하나뿐이다.
   */
  blockedLabel?: string | null;
  /** 제출 버튼 바로 위에 놓을 것. 오류 알림이 여기로 온다 — AuthStepForm 의 같은 이름 참고. */
  notice?: ReactNode;
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
export function PhoneForm({
  busy,
  onSubmit,
  remember,
  onRememberChange,
  blockedLabel,
  notice,
  footer,
}: PhoneFormProps) {
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

      {/*
        **로그인 유지를 묻는 자리는 여기다.**

        전에는 첫 화면(시작하기)에 있었다. 그런데 그 화면에서는 아직 로그인이 시작되지도
        않아서 무엇을 유지한다는 건지가 와닿지 않고, "공용 PC 라면 꺼 두세요" 도 아직 내
        계정이 안 걸린 남의 얘기라 그냥 지나친다. 로그인 코드 경고를 첫 화면에서 내린 것과
        똑같은 이유다(SignIn 의 같은 주석 참고) — 그 말이 무게를 갖는 순간은 자기 전화번호를
        적으려고 손이 멈추는 지금이다.

        요청 제한 안내와 버튼 **사이에는 끼우지 않는다.** 그 문단은 다시 누르려는 손이 가는
        자리에 있어야 해서 버튼에 붙어 있어야 한다.
      */}
      <Checkbox
        checked={remember}
        disabled={busy}
        onChange={(event) => onRememberChange(event.target.checked)}
        label={t('auth.keepSignedIn')}
        hint={t('auth.keepSignedInHint', { minutes: IDLE_TTL_MINUTES })}
      />

      {/*
        **누르기 전에 알려준다.**

        같은 번호로 인증코드를 거듭 요청하면 텔레그램이 길게는 하루까지 제한을 건다. 걸린
        뒤에 알려주는 건 늦다 — 그때는 이미 기다리는 것 말고 할 수 있는 일이 없다. 코드가
        안 왔을 때 사람이 가장 먼저 하는 행동이 이 버튼을 다시 누르는 것이라, 그 손이 가는
        자리에 미리 적어 둔다.

        경고 상자로 세우지 않는다. 바로 위에 로그인 코드 경고가 이미 서 있어서, 상자를
        하나 더 놓으면 둘 다 배경으로 물러난다.
      */}
      <p className="text-xs leading-relaxed text-slate-500">{t('auth.rateLimit')}</p>

      {notice}

      {/*
        제한이 걸려 있는 동안은 버튼 자체를 잠근다. 위 문단이 "기다렸다가 다시 요청하세요"
        라고만 말해서는 부족했다 - 코드가 안 오면 사람은 그래도 누르고, FLOOD_WAIT 은
        누를수록 대기가 늘어난다. 남은 시간을 버튼에 적어 두면 왜 안 눌리는지도 같이 답한다.
      */}
      <Button
        type="submit"
        size="lg"
        className="w-full"
        loading={busy}
        disabled={!value || !!blockedLabel}
      >
        {blockedLabel ?? t('auth.phone.submit')}
      </Button>

      {footer}
    </form>
  );
}
