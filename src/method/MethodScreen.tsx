import { useTranslation } from 'react-i18next';
import { LanguageSelect } from '@/shared/ui/LanguageSelect';
import { GithubIcon } from '@/shared/ui/GithubIcon';
import { CredentialsForm } from '@/features/auth/components/CredentialsForm';
import { TrustPanel } from '@/features/auth/components/TrustPanel';
import { writeHandoff } from '@/shared/auth/handoff';
import { COPYRIGHT, SOURCE_URL, VERSION_LABEL } from '@/shared/config/app';
import { langSegment, languageFromPath } from '@/shared/i18n';
import type { ApiCredentials } from '@/shared/telegram/credentials';

/**
 * 방식 고르기 화면(`/run/`).
 *
 * 이 문서는 GA가 도는 자리다(CSP 구글-open). 그래서 여기까지 "얼마나 앱에 들어오나"가 집계되고,
 * 방식을 고르는 순간 자격증명을 텔레그램 문서로 넘긴 뒤 **진짜 페이지 이동**으로 넘어간다 —
 * 거기(`/run/session/`)부터는 CSP가 텔레그램 전용이라 전화번호·인증코드가 구글로 샐 여지가
 * 브라우저 수준에서 사라진다. 자세한 근거는 `src/shared/auth/handoff.ts` 주석 참고.
 *
 * `MainLayout` 을 재사용하지 않는 이유는 그쪽이 라우터(Outlet·useLocation)에 묶여 있어서다.
 * 여기는 라우터 없는 단일 화면이라 헤더만 같은 모양으로 직접 그린다(언어 선택은 공유 컴포넌트).
 */
export function MethodScreen() {
  const { t } = useTranslation();

  /**
   * 방식을 고르면 자격증명을 넘기고 텔레그램 문서로 이동한다. 언어 조각을 `session` 앞에 둔다
   * (`/run/<언어>/session/`) — 기본 언어는 `/run/session/`. i18n 경로 규칙과 맞춘다.
   */
  const toSession = (creds: ApiCredentials) => {
    writeHandoff(creds);
    const seg = langSegment(languageFromPath());
    window.location.assign(`${import.meta.env.BASE_URL}${seg ? `${seg}/` : ''}session/`);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="shrink-0 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-bold text-slate-900">{t('app.title')}</p>
            <p className="truncate text-xs text-slate-500">{t('app.tagline')}</p>
          </div>

          <LanguageSelect />

          {/* 이 앱을 믿을 근거가 코드 공개라, 소스 링크는 장식이 아니라 눈에 띄어야 한다. */}
          <a
            href={SOURCE_URL}
            target="_blank"
            rel="noreferrer noopener"
            title={t('common.source')}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-2.5 text-xs font-bold text-white transition-colors hover:bg-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
          >
            <GithubIcon className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">{t('common.source')}</span>
          </a>
        </div>
      </header>

      <main className="mx-auto w-full min-h-0 max-w-3xl flex-1 overflow-y-auto px-4 py-2 sm:py-4">
        <div className="space-y-4">
          <CredentialsForm busy={false} onSubmit={toSession} />
          <TrustPanel />
        </div>

        {/* 내보낸 HTML 하단에도 같은 문자열이 찍힌다. 두 줄을 대조해 그때의 코드를 짚는다. */}
        <footer className="mt-4 border-t border-slate-200 pt-2">
          <div className="flex items-center justify-between gap-3">
            <p className="truncate text-[0.65rem] text-slate-400">{COPYRIGHT}</p>
            <p className="shrink-0 font-mono text-[0.65rem] text-slate-400">{VERSION_LABEL}</p>
          </div>
        </footer>
      </main>
    </div>
  );
}
