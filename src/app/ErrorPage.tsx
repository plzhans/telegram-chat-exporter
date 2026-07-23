import { useTranslation } from 'react-i18next';
import { isRouteErrorResponse, useNavigate, useRouteError } from 'react-router-dom';
import { AlertTriangle, Home, RotateCcw } from 'lucide-react';
import { Button } from '@/shared/ui/Button';

/**
 * 화면을 그리다 무너졌을 때 나오는 자리.
 *
 * 이게 없으면 react-router 의 기본 화면이 뜬다 — 흰 바탕에 영어 한 줄과 스택 트레이스다.
 * 사용자에게는 아무 의미가 없고, **무엇보다 이 앱은 전화번호와 인증코드를 받는 화면이라**
 * 낯선 영문 오류 화면 하나로 "이 사이트 뭔가 이상하다"가 된다.
 *
 * 여기서 하는 일은 셋뿐이다: 무슨 일인지 사용자 말로 알리고, 다시 시도할 길과 처음으로
 * 돌아갈 길을 준다.
 */
export function ErrorPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const error = useRouteError();

  const notFound = isRouteErrorResponse(error) && error.status === 404;

  /**
   * 개발 중에만 원인을 펼쳐 둔다.
   *
   * 배포본에서 스택을 그대로 뿌리면 읽는 사람에게 도움은 안 되면서 내부 구조만 드러난다.
   * 개발 중에는 반대로 그게 없으면 화면만 보고 원인을 짚을 수 없다.
   */
  const detail = import.meta.env.DEV ? describe(error) : null;

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700">
        <AlertTriangle className="h-6 w-6" />
      </span>

      <div className="space-y-1">
        <h1 className="text-base font-bold text-slate-900">
          {t(notFound ? 'errorPage.notFound' : 'errorPage.title')}
        </h1>
        <p className="text-sm leading-relaxed text-slate-500">
          {t(notFound ? 'errorPage.notFoundBody' : 'errorPage.body')}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        {/*
          "다시 시도" 는 문서를 다시 여는 것이다. 화면이 무너진 뒤에는 앱이 들고 있던 상태를
          믿을 수 없어서, 그 자리에서 다시 그려 봐야 같은 곳에서 또 넘어지기 쉽다.
        */}
        {!notFound && (
          <Button variant="secondary" size="sm" onClick={() => window.location.reload()}>
            <RotateCcw className="h-3.5 w-3.5" />
            {t('common.retry')}
          </Button>
        )}
        <Button size="sm" onClick={() => void navigate('/', { replace: true })}>
          <Home className="h-3.5 w-3.5" />
          {t('errorPage.home')}
        </Button>
      </div>

      {detail && (
        <details className="w-full max-w-lg text-start">
          <summary className="cursor-pointer text-xs text-slate-400">
            {t('errorPage.details')}
          </summary>
          <pre className="mt-2 overflow-x-auto rounded-xl bg-slate-100 p-3 text-[0.7rem] leading-relaxed text-slate-600">
            {detail}
          </pre>
        </details>
      )}
    </div>
  );
}

function describe(error: unknown): string {
  if (isRouteErrorResponse(error)) return `${error.status} ${error.statusText}`;
  if (error instanceof Error) return error.stack ?? error.message;
  return String(error);
}
