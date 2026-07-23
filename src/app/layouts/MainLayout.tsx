import { Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Github, LogOut } from 'lucide-react';
import { Button } from '@/shared/ui/Button';
import { useAuth } from '@/shared/auth/useAuth';
import { SOURCE_URL } from '@/shared/config/app';
import { SUPPORTED_LANGUAGES } from '@/shared/i18n';
import { cn } from '@/shared/lib/utils';

function LanguageToggle() {
  const { i18n } = useTranslation();
  return (
    <div className="flex items-center gap-1 text-xs">
      {SUPPORTED_LANGUAGES.map((lang) => (
        <button
          key={lang}
          type="button"
          onClick={() => void i18n.changeLanguage(lang)}
          className={cn(
            'rounded-lg px-2 py-1 font-semibold uppercase transition-colors',
            i18n.resolvedLanguage === lang
              ? 'bg-slate-200 text-slate-900'
              : 'text-slate-500 hover:bg-slate-100',
          )}
        >
          {lang}
        </button>
      ))}
    </div>
  );
}

export function MainLayout() {
  const { t } = useTranslation();
  const me = useAuth((s) => s.me);
  const busy = useAuth((s) => s.busy);
  const signOut = useAuth((s) => s.signOut);

  return (
    /*
      창 자체는 스크롤되지 않는다. 높이를 화면에 못 박고 본문(main)만 스크롤시켜서, 헤더가
      항상 붙어 있고 각 페이지가 "남은 높이"를 알 수 있게 한다. 대화 보기처럼 안쪽에 자기
      스크롤 영역을 두는 화면은 이 구조가 있어야 성립한다.
    */
    <div className="flex h-full flex-col overflow-hidden">
      <header className="shrink-0 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-bold text-slate-900">{t('app.title')}</p>
            <p className="truncate text-xs text-slate-500">{t('app.tagline')}</p>
          </div>

          <LanguageToggle />

          <a
            href={SOURCE_URL}
            target="_blank"
            rel="noreferrer noopener"
            title={t('common.source')}
            className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            <Github className="h-4 w-4" />
          </a>
        </div>

        {me && (
          <div className="border-t border-slate-100 bg-slate-50">
            {/*
              이 줄의 높이는 안쪽 여백이 아니라 **버튼 높이**가 정한다. py 만 줄이면 그대로라
              버튼도 같이 낮춘다.
            */}
            <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-1">
              {/*
                누구로 접속했는지를 이름만이 아니라 **id 와 번호까지** 적는다. 백업을 근거로
                쓸 때 "어느 계정에서 받은 것인가"가 곧 출처이고, 이름은 언제든 바뀌지만
                id 는 안 그렇다. 내보내기 파일의 meta.json 에 남는 값과 같은 것이다.
              */}
              <p className="min-w-0 flex-1 truncate text-xs text-slate-600">
                {t('auth.signedInAs', { name: me.name })}
                <span className="ml-1.5 font-mono text-[0.7rem] text-slate-400">
                  {[me.username && `@${me.username}`, me.id, me.phone].filter(Boolean).join(' · ')}
                </span>
              </p>
              <Button
                variant="ghost"
                size="sm"
                loading={busy}
                onClick={() => void signOut()}
                className="h-7 px-2 text-xs"
              >
                <LogOut className="h-3.5 w-3.5" />
                {t('common.signOut')}
              </Button>
            </div>
          </div>
        )}
      </header>

      {/* min-h-0 이 없으면 flex 아이템이 콘텐츠 높이만큼 부풀어 스크롤이 창으로 새어 나간다. */}
      <main className="mx-auto w-full min-h-0 max-w-3xl flex-1 overflow-y-auto px-4 py-4">
        <Outlet />
      </main>
    </div>
  );
}
