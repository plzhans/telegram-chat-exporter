import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/shared/ui/Button';
import { ErrorNotice } from '@/shared/ui/ErrorNotice';
import { Spinner } from '@/shared/ui/Spinner';
import { useCountdown, useDuration } from '@/shared/lib/duration';
import { useAuth } from '@/shared/auth/useAuth';
import { langSegment, languageFromPath } from '@/shared/i18n';
import { AuthStepForm } from '../components/AuthStepForm';
import { ConnectionLock } from '../components/ConnectionLock';
import { CredentialsForm } from '../components/CredentialsForm';
import { LoginCodeNotice } from '../components/LoginCodeNotice';
import { MethodChoice } from '../components/MethodChoice';
import { PhoneForm } from '../components/PhoneForm';
import { QrPanel } from '../components/QrPanel';
import { SessionNotice } from '../components/SessionNotice';
import { TrustPanel } from '../components/TrustPanel';

export default function SignIn() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const step = useAuth((s) => s.step);
  const busy = useAuth((s) => s.busy);
  const error = useAuth((s) => s.error);
  const qrUrl = useAuth((s) => s.qrUrl);
  const codeViaApp = useAuth((s) => s.codeViaApp);
  const passwordHint = useAuth((s) => s.passwordHint);
  const floodUntil = useAuth((s) => s.floodUntil);
  const remember = useAuth((s) => s.remember);
  const setRemember = useAuth((s) => s.setRemember);
  const stageCredentials = useAuth((s) => s.stageCredentials);
  const chooseMethod = useAuth((s) => s.chooseMethod);
  const submitPhone = useAuth((s) => s.submitPhone);
  const submitCode = useAuth((s) => s.submitCode);
  const submitPassword = useAuth((s) => s.submitPassword);
  const backToMethod = useAuth((s) => s.backToMethod);
  const restart = useAuth((s) => s.restart);
  const cancel = useAuth((s) => s.cancel);

  useEffect(() => {
    if (step === 'authorized') void navigate('/dialogs', { replace: true });
  }, [step, navigate]);

  /**
   * **웹: 이 문서(텔레그램 동작, `/run/session/`)가 idle 이면 방식 고르기가 없다.**
   *
   * 방식 고르기(`CredentialsForm`)는 별개 문서(`/run/`)에 있다. 그러니 여기서 idle 이라는 건
   * 핸드오프 없이 세션 문서를 직접 열었거나(새 탭 등) 연결이 실패해 되돌아온 경우다 —
   * 진짜 페이지 이동으로 방식 화면으로 보낸다. 언어 조각은 그대로 이어 붙인다.
   *
   * 단일 파일 배포는 방식 고르기가 이 문서 안에 있으므로(아래 idle 분기) 되돌리지 않는다.
   */
  useEffect(() => {
    // dev 는 두 문서 재배치가 없어 App 을 루트에서 서빙하므로, 되돌리면 무한 루프다. 그때는
    // 방식 고르기를 이 문서 안(아래 idle 분기)에서 보여 준다 — 단일 문서처럼 개발한다.
    if (__STANDALONE__ || import.meta.env.DEV || step !== 'idle') return;
    const seg = langSegment(languageFromPath());
    window.location.assign(`${import.meta.env.BASE_URL}${seg ? `${seg}/` : ''}`);
  }, [step]);

  /**
   * 제한이 풀릴 때까지 제출 버튼을 잠그고, 남은 시간을 버튼에 적는다.
   *
   * **오류 알림만으로는 부족했다.** 알림은 화면을 옮길 때마다 지워진다 - 취소하거나 "다른
   * 번호로" 를 누르면 문구는 사라지지만 텔레그램이 건 제한은 그대로다. 그래서 잠금은
   * `error` 가 아니라 그와 수명이 다른 `floodUntil` 에 매단다(useAuth 의 같은 주석 참고).
   *
   * 문구를 여기 한 곳에서만 만드는 이유는 세 단계가 같은 제한 하나를 공유하기 때문이다.
   * 카운트다운을 폼마다 돌리면 화면마다 다른 초를 말하게 된다.
   */
  const remain = useCountdown(floodUntil);
  const formatDuration = useDuration();
  const blockedLabel =
    remain !== null && remain > 0 ? t('auth.retryIn', { duration: formatDuration(remain) }) : null;

  const cancelButton = (
    <Button type="button" variant="ghost" size="sm" className="w-full" onClick={() => void cancel()}>
      {t('common.cancel')}
    </Button>
  );

  /*
    입력·QR 화면에서 **한 칸 물러나 수단 고르기 화면으로** 돌아간다.

    전에는 진행 중 화면에서 반대 방식으로 바로 넘기는 버튼을 뒀는데, 그 전환이 연결을 다시
    맺어 "접속 중"이 또 떴다. 이제 수단은 연결 전 `method` 화면에서 고르므로, 바꾸려면 거기로
    되돌아가 다시 고르면 된다 — `backToMethod()` 가 진행 중 인증을 접고 그 화면으로 보낸다.
  */
  const backButton = (
    <Button type="button" variant="ghost" size="sm" className="w-full" onClick={backToMethod}>
      <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
      {t('common.back')}
    </Button>
  );

  return (
    <div className="space-y-4">
      <SessionNotice />

      {/*
        **오류는 그 오류를 낸 버튼 옆에 붙인다.**

        전에는 여기 맨 위에 한 번만 띄웠다. 그런데 이 화면은 로그인 코드 경고와 입력칸이
        차례로 쌓여서, 휴대전화에서는 버튼을 누른 자리와 알림이 한 화면에 같이 안 잡힌다.
        "인증코드 받기" 를 눌렀는데 아무 일도 안 일어난 것처럼 보이고, 이유는 스크롤을
        올려야 나온다. 실제로 FLOOD_WAIT 을 맞은 사람이 그걸 못 보고 계속 다시 눌렀다 —
        누를수록 제한이 늘어나는 오류라 가장 나쁜 방향이다.

        아래 세 단계는 폼이 버튼 바로 위에 자리를 내준다(notice). 폼이 없는 단계만 여기서
        띄운다 - 어느 쪽이든 오류가 조용히 사라지는 일은 없어야 한다.
      */}
      {(step === 'idle' || step === 'connecting') && <ErrorNotice error={error} />}

      {/*
        방식 고르기(CredentialsForm)는 **단일 파일 배포에서만** 이 화면에 있다. 웹은 별개 문서
        (`/run/`)가 맡고, 여기(텔레그램 문서)의 idle 은 위 useEffect 가 방식 화면으로 되돌린다 —
        그 사이 스피너만 잠깐 보인다.
      */}
      {step === 'idle' &&
        (__STANDALONE__ || import.meta.env.DEV ? (
          <CredentialsForm busy={busy} onSubmit={stageCredentials} />
        ) : (
          <div className="flex flex-col items-center gap-3 edge-card bg-white p-8">
            <Spinner />
          </div>
        ))}

      {/*
        **첫 화면에서만, 그리고 시작하기 아래에 둔다.**

        "어떻게 동작하나요 · 직접 확인하는 방법 · 남는 것" 은 시작할지 말지를 정하려는
        사람에게 필요한 글이다. 이미 시작하기를 누른 사람은 그 판단을 끝냈고, 지금은
        번호를 적으려고 손이 멈춘 상태다. 그 자리에 같은 글이 계속 서 있으면 정작 읽어야
        할 로그인 코드 경고가 스크롤 아래로 밀린다.

        위가 아니라 아래인 이유도 같다. 이 화면에 온 사람의 대부분은 랜딩에서 이미 읽고
        누르기로 정한 사람이라, 첫 화면을 열었을 때 먼저 보여야 하는 것은 설명이 아니라
        시작 버튼이다. 아직 망설이는 사람은 접힌 제목만 보고 펼치면 된다.
      */}
      {step === 'idle' && (__STANDALONE__ || import.meta.env.DEV) && <TrustPanel />}

      {/*
        수단 고르기 — 첫 화면 다음, 연결 전. 여기서 문자/QR 을 고르면 그 수단으로 연결을
        시작한다(`chooseMethod` → `start`). 아직 텔레그램에 안 붙었으므로 보안 잠금은 아직
        띄우지 않는다 — 잠금은 연결이 시작되는 다음 화면부터다. 뒤로가기는 첫 화면으로 돌아간다.
      */}
      {step === 'method' && (
        <div className="space-y-3">
          <MethodChoice onChoose={chooseMethod} />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => void cancel()}
          >
            <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
            {t('common.back')}
          </Button>
        </div>
      )}

      {/*
        연결하는 순간부터 잠금을 보인다. 텔레그램에 붙기 시작하는 이 화면이 곧 "전화번호를
        넣어도 되나" 를 사람이 정하는 자리라, 보안 아이덴티티는 여기서부터 계속 따라다녀야 한다.
      */}
      {step === 'connecting' && (
        <div className="space-y-3">
          <ConnectionLock />
          <div className="flex flex-col items-center gap-3 edge-card bg-white p-8">
            <Spinner />
            <p className="text-sm text-slate-500">{t('auth.connecting')}</p>
          </div>
        </div>
      )}

      {/*
        전화번호와 코드를 실제로 적는 두 단계에서만 경고를 띄운다.

        **첫 화면에 있을 때는 아무도 안 읽었다.** 그때는 아직 남의 일이라 그냥 지나친다.
        그 말이 무게를 갖는 건 입력칸에 번호를 적으려고 손이 멈추는 순간이다.
      */}
      {step === 'phone' && (
        <div className="space-y-3">
          <LoginCodeNotice />
          <div className="edge-card bg-white p-4">
            <PhoneForm
              busy={busy}
              onSubmit={submitPhone}
              remember={remember}
              onRememberChange={setRemember}
              blockedLabel={blockedLabel}
              notice={<ErrorNotice error={error} />}
              footer={backButton}
            />
          </div>
        </div>
      )}

      {/*
        QR 로그인. 전화번호·코드 흐름과 같은 텔레그램 문서에서 돌고(MTProto 호출이므로),
        승인 후 2단계 인증이 걸려 있으면 아래 password 단계로 그대로 이어진다.
      */}
      {step === 'qr' && (
        <div className="space-y-3">
          <ConnectionLock />
          <div className="edge-card bg-white p-4">
            <QrPanel url={qrUrl} />
            <div className="mt-4">{backButton}</div>
          </div>
        </div>
      )}

      {step === 'code' && (
        <div className="space-y-3">
          <LoginCodeNotice />
          <div className="edge-card bg-white p-4">
          <AuthStepForm
            key="code"
            label={t(codeViaApp ? 'auth.code.titleApp' : 'auth.code.titleSms')}
            hint={
              /*
                코드가 안 오면 사람은 "다른 번호로 로그인" 을 눌러 처음으로 돌아가 다시
                요청한다. 그 길의 입구가 이 화면이라, 여기에도 같은 말을 둔다.
              */
              <>
                {t('auth.code.hint')}
                <span className="mt-1 block">{t('auth.rateLimit')}</span>
              </>
            }
            submitLabel={t('auth.code.submit')}
            busy={busy}
            onSubmit={submitCode}
            blockedLabel={blockedLabel}
            notice={<ErrorNotice error={error} />}
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
        </div>
      )}

      {step === 'password' && (
        <div className="space-y-3">
          {/* 2단계 인증 비밀번호도 같은 잠금 안에 있음을 이어서 보인다(연결 중·QR 과 같은 자리). */}
          <ConnectionLock />
          <div className="edge-card bg-white p-4">
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
              blockedLabel={blockedLabel}
              notice={<ErrorNotice error={error} />}
              footer={cancelButton}
              inputProps={{
                type: 'password',
                autoComplete: 'current-password',
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
