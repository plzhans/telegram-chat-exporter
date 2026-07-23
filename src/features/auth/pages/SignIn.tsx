import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/shared/ui/Button';
import { ErrorNotice } from '@/shared/ui/ErrorNotice';
import { Spinner } from '@/shared/ui/Spinner';
import { useAuth } from '@/shared/auth/useAuth';
import { AuthStepForm } from '../components/AuthStepForm';
import { CredentialsForm } from '../components/CredentialsForm';
import { PhoneForm } from '../components/PhoneForm';
import { SessionNotice } from '../components/SessionNotice';
import { TrustPanel } from '../components/TrustPanel';

export default function SignIn() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const step = useAuth((s) => s.step);
  const busy = useAuth((s) => s.busy);
  const error = useAuth((s) => s.error);
  const codeViaApp = useAuth((s) => s.codeViaApp);
  const passwordHint = useAuth((s) => s.passwordHint);
  const start = useAuth((s) => s.start);
  const submitPhone = useAuth((s) => s.submitPhone);
  const submitCode = useAuth((s) => s.submitCode);
  const submitPassword = useAuth((s) => s.submitPassword);
  const restart = useAuth((s) => s.restart);
  const cancel = useAuth((s) => s.cancel);

  useEffect(() => {
    if (step === 'authorized') void navigate('/dialogs', { replace: true });
  }, [step, navigate]);

  const cancelButton = (
    <Button type="button" variant="ghost" size="sm" className="w-full" onClick={() => void cancel()}>
      {t('common.cancel')}
    </Button>
  );

  return (
    <div className="space-y-4">
      <SessionNotice />

      <TrustPanel />

      <ErrorNotice error={error} />

      {step === 'idle' && (
        <CredentialsForm busy={busy} onSubmit={(c, remember) => void start(c, remember)} />
      )}

      {step === 'connecting' && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white p-8">
          <Spinner />
          <p className="text-sm text-slate-500">{t('auth.connecting')}</p>
        </div>
      )}

      {step === 'phone' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <PhoneForm busy={busy} onSubmit={submitPhone} footer={cancelButton} />
        </div>
      )}

      {step === 'code' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <AuthStepForm
            key="code"
            label={t(codeViaApp ? 'auth.code.titleApp' : 'auth.code.titleSms')}
            hint={t('auth.code.hint')}
            submitLabel={t('auth.code.submit')}
            busy={busy}
            onSubmit={submitCode}
            footer={
              <div className="space-y-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={restart}
                >
                  {t('auth.code.changeNumber')}
                </Button>
                {cancelButton}
              </div>
            }
            inputProps={{
              inputMode: 'numeric',
              // 코드 입력칸은 자동완성이 붙으면 오히려 방해된다.
              autoComplete: 'one-time-code',
              placeholder: '12345',
            }}
          />
        </div>
      )}

      {step === 'password' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <AuthStepForm
            key="password"
            label={t('auth.password.title')}
            hint={
              passwordHint
                ? t('auth.password.hintLabel', { hint: passwordHint })
                : t('auth.password.hint')
            }
            submitLabel={t('auth.password.submit')}
            busy={busy}
            onSubmit={submitPassword}
            footer={cancelButton}
            inputProps={{
              type: 'password',
              autoComplete: 'current-password',
            }}
          />
        </div>
      )}
    </div>
  );
}
