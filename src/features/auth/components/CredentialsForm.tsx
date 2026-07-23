import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Button } from '@/shared/ui/Button';
import { Checkbox } from '@/shared/ui/Checkbox';
import { Field } from '@/shared/ui/Field';
import { Input } from '@/shared/ui/Input';
import { cn } from '@/shared/lib/utils';
import { IDLE_TTL_MINUTES } from '@/shared/telegram/session';
import {
  clearStoredCredentials,
  credentialsSchema,
  hasSharedCredentials,
  loadStoredCredentials,
  SHARED_CREDENTIALS,
  storeCredentials,
  toApiCredentials,
  type ApiCredentials,
  type CredentialsForm as CredentialsFormValues,
} from '@/shared/telegram/credentials';
import { ApiIdGuide } from './ApiIdGuide';

type Mode = 'shared' | 'custom';

/**
 * zod 스키마 하나로 필드 검증을 돌린다.
 *
 * `@hookform/resolvers` 를 추가로 깔지 않은 이유는 medifinder-web 의 의존성 목록과
 * 어긋나지 않게 하기 위해서다. 필드가 둘뿐이라 react-hook-form 의 `validate` 에
 * 스키마를 직접 물리는 걸로 충분하다.
 */
function validateWith(key: keyof CredentialsFormValues) {
  return (value: string) => {
    const result = credentialsSchema.shape[key].safeParse(value);
    // 실패 시 zod 의 message 를 그대로 돌려준다. 이 값이 i18n 키가 된다.
    return result.success || result.error.issues[0].message;
  };
}

export function CredentialsForm({
  onSubmit,
  busy,
}: {
  onSubmit: (credentials: ApiCredentials, remember: boolean) => void;
  busy: boolean;
}) {
  const { t } = useTranslation();
  const stored = loadStoredCredentials();
  // 지역 상수로 받아 둔다. 모듈 import 를 JSX 안에서 바로 좁히면 TS 가 null 을 못 걷어낸다.
  const shared = SHARED_CREDENTIALS;

  /**
   * 공용 키가 있으면 그쪽을 기본으로 연다. 없으면 선택지 자체가 하나뿐이라 토글도 숨긴다.
   * 다만 이전에 직접 넣은 키가 남아 있다면 그 사람은 이미 직접 입력을 택한 사람이므로
   * 그 선택을 유지한다.
   */
  const [mode, setMode] = useState<Mode>(
    hasSharedCredentials && !stored ? 'shared' : 'custom',
  );

  /**
   * 새로고침 때마다 다시 로그인하는 게 실제로 많이 번거로워서 기본값을 켬으로 둔다.
   * 저장 위치는 sessionStorage 라 탭을 닫으면 사라진다(shared/telegram/session.ts 참고).
   * 공용 PC 처럼 그것도 부담스러운 상황을 위해 끌 수 있게 남겨 둔다.
   */
  const [remember, setRemember] = useState(true);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CredentialsFormValues>({
    defaultValues: stored ?? { apiId: '', apiHash: '' },
  });

  const submitCustom = handleSubmit((values) => {
    storeCredentials(values);
    onSubmit(toApiCredentials(values), remember);
  });

  const rememberField = (
    <Checkbox
      checked={remember}
      onChange={(e) => setRemember(e.target.checked)}
      label={t('credentials.keepSignedIn')}
      hint={t('credentials.keepSignedInHint', { minutes: IDLE_TTL_MINUTES })}
    />
  );

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
      <h2 className="text-lg font-bold text-slate-900">{t('credentials.title')}</h2>

      {hasSharedCredentials && (
        <div className="grid gap-2 mobile:grid-cols-2">
          {(['shared', 'custom'] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              className={cn(
                'rounded-xl border p-3 text-left transition-colors',
                mode === value
                  ? 'border-primary bg-primary-50'
                  : 'border-slate-200 hover:bg-slate-50',
              )}
            >
              <p className="text-sm font-semibold text-slate-900">
                {t(value === 'shared' ? 'credentials.modeShared' : 'credentials.modeCustom')}
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                {t(
                  value === 'shared'
                    ? 'credentials.modeSharedHint'
                    : 'credentials.modeCustomHint',
                )}
              </p>
            </button>
          ))}
        </div>
      )}

      {mode === 'shared' && shared ? (
        <div className="space-y-4">
          {rememberField}
          <Button
            size="lg"
            className="w-full"
            loading={busy}
            onClick={() => onSubmit(shared, remember)}
          >
            {t('credentials.submit')}
          </Button>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={(e) => void submitCustom(e)}>
          <Field
            label={t('credentials.apiId')}
            htmlFor="apiId"
            error={errors.apiId && t(`credentials.errors.${errors.apiId.message}`)}
          >
            <Input
              id="apiId"
              inputMode="numeric"
              autoComplete="off"
              placeholder="1234567"
              {...register('apiId', { validate: validateWith('apiId') })}
            />
          </Field>

          <Field
            label={t('credentials.apiHash')}
            htmlFor="apiHash"
            hint={t('credentials.remember')}
            error={errors.apiHash && t(`credentials.errors.${errors.apiHash.message}`)}
          >
            <Input
              id="apiHash"
              autoComplete="off"
              spellCheck={false}
              placeholder="0123456789abcdef0123456789abcdef"
              className="font-mono"
              {...register('apiHash', { validate: validateWith('apiHash') })}
            />
          </Field>

          {rememberField}

          <div className="flex items-center gap-2">
            <Button type="submit" size="lg" className="flex-1" loading={busy}>
              {t('credentials.submit')}
            </Button>
            {stored && (
              <Button
                type="button"
                variant="ghost"
                size="lg"
                onClick={() => {
                  clearStoredCredentials();
                  window.location.reload();
                }}
              >
                {t('credentials.forget')}
              </Button>
            )}
          </div>

          {/*
            발급 안내는 입력칸 **아래**에 둔다. 이미 키를 가진 사람에게는 긴 안내가 먼저
            나올 이유가 없고, 없는 사람은 빈 칸을 보고 자연스럽게 아래로 내려온다.
          */}
          <ApiIdGuide />
        </form>
      )}
    </div>
  );
}
