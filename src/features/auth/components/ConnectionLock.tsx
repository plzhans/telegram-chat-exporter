import { useTranslation } from 'react-i18next';
import { Lock } from 'lucide-react';

/**
 * **이 문서에 실제로 걸린** `connect-src` 지시어를 그대로 뽑아 온다.
 *
 * 상수를 믿지 않고 브라우저가 강제하는 `<meta http-equiv="Content-Security-Policy">` 를 직접
 * 읽는 이유는, 이 상자가 주장하는 것이 "지금 이 화면에 실제로 걸린 잠금"이기 때문이다. 코드가
 * 무엇을 적어 두었든 화면에는 브라우저가 읽은 값만 나와야 "직접 확인하라"는 약속과 어긋나지
 * 않는다.
 *
 * dev 에는 이 meta 가 없다 — CSP 는 빌드에서만 심긴다(`vite.config.ts` 의 `contentSecurityPolicy`).
 * 그때만 배포본 값(`__STANDALONE_CONNECT_SRC__`)으로 갈음한다. 세션 문서의 `connect-src` 는
 * 배포본과 같은 "텔레그램만"이라 대조에는 지장이 없다.
 */
function liveConnectSrc(): string {
  const meta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
  const directive = (meta?.getAttribute('content') ?? '')
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('connect-src'));
  return directive || __STANDALONE_CONNECT_SRC__;
}

/**
 * 이 화면의 보안 아이덴티티.
 *
 * 전화번호·로그인 코드를 실제로 만지는 자리(연결 중부터 비밀번호까지)에 붙어, **브라우저가
 * 강제하는 연결 잠금**을 눈으로 보여 준다. "믿어 달라"가 아니라 "여기 걸린 규칙을 직접 보라"는
 * 쪽이라, 값은 상수가 아니라 이 문서의 CSP 에서 실시간으로 읽는다(`liveConnectSrc`).
 *
 * 지시어를 한 줄로 늘어놓으면 화면 폭에 따라 주소가 두 줄에 걸쳐 잘린다. 대조하라고 보여 주는
 * 것이므로 한 줄에 하나씩 놓는다(받아서 실행 화면의 같은 상자와 같다).
 */
export function ConnectionLock() {
  const { t } = useTranslation();

  /** `connect-src wss://a wss://b` → 지시어 하나와 주소 목록. */
  const [directive, ...sources] = liveConnectSrc().split(/\s+/).filter(Boolean);

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
      <p className="flex items-start gap-1.5 text-xs leading-relaxed text-slate-600">
        <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
        <span>{t('trust.lock.body')}</span>
      </p>
      <code
        dir="ltr"
        className="mt-1.5 block break-words ps-5 font-mono text-[0.7rem] leading-relaxed text-slate-500"
      >
        {directive}
        {sources.map((source) => (
          <span key={source} className="block ps-3">
            {source}
          </span>
        ))}
      </code>
    </div>
  );
}
