import { Suspense, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Github, LogOut } from 'lucide-react';
import { Button } from '@/shared/ui/Button';
import { Modal } from '@/shared/ui/Modal';
import { DialogListSkeleton, MessageListSkeleton, PageSkeleton } from '@/shared/ui/Skeleton';
import { LanguageSelect } from '@/shared/ui/LanguageSelect';
import { useAuth } from '@/shared/auth/useAuth';
import { COPYRIGHT, SOURCE_URL, VERSION_LABEL } from '@/shared/config/app';

/** 지금 주소가 가리키는 화면의 스켈레톤. */
function RouteSkeleton() {
  const { pathname } = useLocation();
  if (/\/dialogs\/[^/]+/.test(pathname)) return <MessageListSkeleton />;
  if (pathname.endsWith('/dialogs')) return <DialogListSkeleton />;
  return <PageSkeleton />;
}

/**
 * 이 화면이 본문 높이를 스스로 꽉 채우는가.
 *
 * 대화 보기는 `h-full` 로 남은 높이를 다 쓰고 **안쪽에 자기 스크롤 영역**을 둔다. 그 아래
 * footer 를 붙이면 본문이 그만큼 넘쳐 스크롤이 생기는데, 대화 화면이 뜨면서 안쪽 스크롤을
 * 맨 아래로 보낼 때 브라우저가 조상 스크롤까지 같이 밀어 버린다. 그러면 대화방 제목 줄이
 * 위로 밀려 계정 줄 뒤로 숨는다.
 *
 * 어차피 그 화면에서는 footer 가 화면 밖에 있어 닿지도 않는다. 안 그리는 편이 맞다.
 */
/**
 * 한 단계 위 화면. 맨 위면 null.
 *
 *     /dialogs/123/export → /dialogs/123
 *     /dialogs/123        → /dialogs
 *     /dialogs            → null
 *
 * `navigate(-1)` 을 쓰지 않는 이유는 **주소로 바로 들어온 경우** 돌아갈 기록이 없어서다.
 * 링크를 받아서 연 사람이 뒤로가기를 누르면 이 앱 밖으로 나가 버린다. 경로에서 계산하면
 * 어디로 왔든 같은 곳으로 간다.
 */
function parentPath(pathname: string): string | null {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length <= 1) return null;
  return `/${parts.slice(0, -1).join('/')}`;
}

function fillsViewport(pathname: string): boolean {
  return /\/dialogs\/[^/]+$/.test(pathname);
}

export function MainLayout() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const me = useAuth((s) => s.me);
  const busy = useAuth((s) => s.busy);
  const signOut = useAuth((s) => s.signOut);
  const parent = parentPath(pathname);

  /*
    로그아웃은 되돌릴 수 없다. 화면에서 나가는 것에 그치지 않고 **텔레그램 계정의 세션까지
    끊어서**, 다시 쓰려면 인증코드를 새로 받아야 한다. 좁은 줄에 다른 것들과 나란히 서 있는
    버튼이라 스치듯 눌리기 쉽다.
  */
  const [confirmSignOut, setConfirmSignOut] = useState(false);

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

          <LanguageSelect />

          {/* 이 앱을 믿을 근거가 코드 공개라, 소스 링크는 장식이 아니라 눈에 띄어야 한다. */}
          <a
            href={SOURCE_URL}
            target="_blank"
            rel="noreferrer noopener"
            title={t('common.source')}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-2.5 text-xs font-bold text-white transition-colors hover:bg-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
          >
            <Github className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">{t('common.source')}</span>
          </a>
        </div>

        {me && (
          <div className="border-t border-slate-100 bg-slate-50">
            {/*
              이 줄의 높이는 안쪽 여백이 아니라 **버튼 높이**가 정한다. py 만 줄이면 그대로라
              버튼도 같이 낮춘다.
            */}
            <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-1">
              {/*
                뒤로가기를 **헤더에 둔다.** 페이지 안에 있으면 본문이 스크롤될 때 같이
                밀려 올라가 닿지 못하는 순간이 생긴다. 헤더는 늘 제자리에 있다.
              */}
              {parent && (
                <Link
                  to={parent}
                  aria-label={t('common.back')}
                  title={t('common.back')}
                  className="-ms-1 shrink-0 rounded-lg p-1 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-900"
                >
                  <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
                </Link>
              )}
              {/*
                이름과 사용자명까지만 적는다.

                전화번호와 회원번호는 화면에 띄울 값이 아니다 - 옆사람이 보거나 화면을
                공유하는 순간 그대로 새어 나가는데, 정작 사용자에게는 알려 주는 바가 없다.
                "어느 계정에서 받았는가"라는 출처 기록은 내보내기 파일의 meta.json 이 맡는다.
              */}
              <p className="min-w-0 flex-1 truncate text-xs text-slate-600">
                <span className="font-semibold text-slate-800">{me.name}</span>
                {me.username && (
                  <span className="ms-1.5 font-mono text-[0.7rem] text-slate-400">
                    @{me.username}
                  </span>
                )}
              </p>
              <Button
                variant="ghost"
                size="sm"
                loading={busy}
                onClick={() => setConfirmSignOut(true)}
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
      <main className="mx-auto w-full min-h-0 max-w-3xl flex-1 overflow-y-auto px-4 py-2 sm:py-4">
        {/*
          페이지 묶음이 도착하는 동안 헤더는 그대로 두고 이 자리만 채운다.

          어떤 화면이 올지 주소로 미리 알 수 있으므로 그 화면 모양의 스켈레톤을 쓴다.
          이어서 뜨는 세션 복원·목록 조회 단계도 같은 것을 그리므로, 사용자 눈에는 한 번의
          기다림으로 이어진다.
        */}
        <Suspense fallback={<RouteSkeleton />}>
          <Outlet />
        </Suspense>

        {/*
          내용 끝에 붙는다. 창 아래에 못 박아 두면 모바일 앱의 하단 탭처럼 보여서, 누르는
          곳으로 오해하게 된다. 이건 눌러야 할 것이 아니라 필요한 사람만 찾아 읽는 값이다.

          내보낸 HTML 하단에도 같은 문자열이 찍힌다. 두 줄을 대조해 그때의 코드를 짚는다.
        */}
        {!fillsViewport(pathname) && (
        <footer className="mt-4 border-t border-slate-200 pt-2">
          <div className="flex items-center justify-between gap-3">
            <p className="truncate text-[0.65rem] text-slate-400">{COPYRIGHT}</p>
            <p className="shrink-0 font-mono text-[0.65rem] text-slate-400">{VERSION_LABEL}</p>
          </div>
        </footer>
        )}
      </main>

      <Modal
        open={confirmSignOut}
        onClose={() => setConfirmSignOut(false)}
        title={t('auth.confirmSignOutTitle')}
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setConfirmSignOut(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              size="sm"
              loading={busy}
              onClick={() => {
                setConfirmSignOut(false);
                void signOut();
              }}
            >
              <LogOut className="h-3.5 w-3.5" />
              {t('common.signOut')}
            </Button>
          </>
        }
      >
        {t('auth.confirmSignOutBody')}
      </Modal>
    </div>
  );
}
