import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Download } from 'lucide-react';
import { Button } from '@/shared/ui/Button';
import { Field } from '@/shared/ui/Field';
import { Input } from '@/shared/ui/Input';
import { cn } from '@/shared/lib/utils';
import { DOWNLOAD_URL } from '@/shared/config/app';
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

/** 세 번째는 텔레그램에 연결하지 않는다 - 배포본을 받아 자기 컴퓨터에서 여는 길이다. */
type Mode = 'shared' | 'custom' | 'download';

/** 타일에 적히는 문구. 순서·조건은 아래 `modes` 가 정한다. */
const LABELS: Record<Mode, { title: string; hint: string }> = {
  shared: { title: 'credentials.modeShared', hint: 'credentials.modeSharedHint' },
  custom: { title: 'credentials.modeCustom', hint: 'credentials.modeCustomHint' },
  download: { title: 'auth.download.title', hint: 'auth.download.hint' },
};

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
  onSubmit: (credentials: ApiCredentials) => void;
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
   * 고를 수 있는 길. **화면에 놓이는 순서 그대로다.**
   *
   * - 공용 키가 없으면 "바로 시작" 자체가 성립하지 않는다.
   * - 단일 파일 배포에는 "받아서 실행" 을 넣지 않는다 - 이미 받아서 연 사람이다.
   *   `__STANDALONE__` 은 빌드가 박는 상수라 그쪽 번들에서는 이 가지가 통째로 사라진다.
   *
   * 하나만 남으면 고를 것이 없으므로 아래에서 토글을 통째로 숨긴다.
   */
  const modes: Mode[] = [
    ...(hasSharedCredentials ? (['shared'] as const) : []),
    'custom',
    ...(__STANDALONE__ ? [] : (['download'] as const)),
  ];

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CredentialsFormValues>({
    defaultValues: stored ?? { apiId: '', apiHash: '' },
  });

  const submitCustom = handleSubmit((values) => {
    storeCredentials(values);
    onSubmit(toApiCredentials(values));
  });

  /** `connect-src wss://a wss://b` → 지시어 하나와 주소 목록. */
  const [directive, ...sources] = __STANDALONE_CONNECT_SRC__.split(/\s+/).filter(Boolean);

  return (
    <div className="space-y-4 edge-card bg-white p-4">
      <h2 className="text-lg font-bold text-slate-900">{t('credentials.title')}</h2>

      {modes.length > 1 && (
        <div
          className={cn(
            'grid gap-2',
            // 타일 셋을 좁은 폭에서 가로로 늘어놓으면 "바로 시작 (권장)" 라벨이 칸을
            // 벗어난다. 셋일 때는 모바일에선 세로로 쌓고 sm(640px) 부터 가로로 편다.
            modes.length === 3 ? 'sm:grid-cols-3' : 'mobile:grid-cols-2',
          )}
        >
          {modes.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              className={cn(
                // flex-col 로 내용을 위에서부터 쌓는다. 안 그러면 타일이 같은 높이로
                // 늘어날 때 button 기본 동작이 글자를 세로 가운데로 밀어, hint 줄 수가
                // 다른 타일끼리 제목 높이가 어긋난다.
                'flex flex-col rounded-xl border p-3 text-start transition-colors',
                mode === value
                  ? 'border-primary bg-primary-50'
                  : 'border-slate-200 hover:bg-slate-50',
              )}
            >
              <p className="text-sm font-semibold text-slate-900">{t(LABELS[value].title)}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                {t(LABELS[value].hint)}
              </p>
            </button>
          ))}
        </div>
      )}

      {mode === 'download' ? (
        /*
          텔레그램에 연결하지 않는 유일한 선택지다.
          여기서 망설이는 이유는 대개 "처음 보는 웹사이트에 전화번호를 넣으라"는 요구
          자체인데(TrustPanel 주석), 그 사람에게 가장 강한 답은 설명이 아니라 이 사이트를
          안 거치는 길이다. 받은 파일은 우리가 나중에 무엇을 바꾸든 영향을 받지 않는다.
        */
        <div className="space-y-3">
          <p className="text-sm leading-relaxed text-slate-600">{t('auth.download.body')}</p>

          {/*
            **받을 파일이** 여는 연결 주소를 그대로 보여 준다. 지금 이 문서의 것이 아니다 -
            웹 배포에는 애널리틱스가 켜져 있을 수 있고, 받는 사람이 알아야 하는 것은 받을
            파일 쪽이다. 값은 빌드가 실제 정책에서 뽑아 넘긴다(`__STANDALONE_CONNECT_SRC__`).

            한 줄로 늘어놓으면 어디서 끊기는지가 화면 폭에 달려 주소가 두 줄에 걸쳐 잘린다.
            대조하라고 보여 주는 것이므로 한 줄에 하나씩 놓는다(랜딩의 같은 문단과 같다).
          */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs leading-relaxed text-slate-500">{t('auth.download.csp')}</p>
            <code dir="ltr" className="mt-2 block break-words font-mono text-xs leading-relaxed text-slate-600">
              {directive}
              {sources.map((source) => (
                <span key={source} className="block ps-4">
                  {source}
                </span>
              ))}
            </code>
          </div>

          {/*
            새 탭으로 열지 않는다. 누르면 내려받기가 시작될 뿐 화면이 바뀌지 않아서 빈 탭만
            하나 남는다.

            치수·색은 옆 선택지의 "텔레그램에 연결"(`Button` primary/lg)과 같다. 고른 길에
            따라 버튼 생김새가 달라지면 한쪽이 덜 중요한 선택처럼 보인다.
          */}
          <a
            href={DOWNLOAD_URL}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 text-base font-semibold text-white transition-colors hover:bg-primary-700"
          >
            <Download className="h-5 w-5 shrink-0" />
            {t('auth.download.cta')}
          </a>
        </div>
      ) : mode === 'shared' && shared ? (
        <Button size="lg" className="w-full" loading={busy} onClick={() => onSubmit(shared)}>
          {t('credentials.submit')}
        </Button>
      ) : (
        <form className="space-y-3" onSubmit={(e) => void submitCustom(e)}>
          {/*
            발급 안내를 입력칸 **위**로 올린다.

            전에는 아래에 뒀다. "이미 키를 가진 사람에게 긴 안내가 먼저 나올 이유가 없다"는
            생각이었는데, 순서가 실제와 반대였다. 이 화면에서 막히는 사람은 대부분 **키가
            없어서** 막힌다. 빈 칸 두 개를 먼저 보여주고 안내를 아래에 숨겨 두면, 무엇을
            넣어야 하는지 모르는 사람이 스스로 찾아 내려가야 한다.

            안내 자체가 접혀 있어서(ApiIdGuide 참고) 이미 키가 있는 사람에게는 한 줄이다.
          */}
          <ApiIdGuide />

          <Field
            inline
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
            inline
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
        </form>
      )}
    </div>
  );
}
