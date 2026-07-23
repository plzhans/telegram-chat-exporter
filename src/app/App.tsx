import { lazy, useEffect } from 'react';
import {
  createBrowserRouter,
  createHashRouter,
  Navigate,
  Outlet,
  RouterProvider,
  useLocation,
  type RouteObject,
} from 'react-router-dom';
import { MainLayout } from './layouts/MainLayout';
import { ErrorPage } from './ErrorPage';
import { DialogListSkeleton, MessageListSkeleton } from '@/shared/ui/Skeleton';
import { useAuth } from '@/shared/auth/useAuth';
import { touchStoredSession } from '@/shared/telegram/session';
import { langSegment, languageFromPath } from '@/shared/i18n';

const SignIn = lazy(() => import('@/features/auth/pages/SignIn'));
const Dialogs = lazy(() => import('@/features/dialogs/pages/Dialogs'));
const DialogDetail = lazy(() => import('@/features/dialogs/pages/DialogDetail'));
const ExportPage = lazy(() => import('@/features/export/pages/ExportPage'));

/** 세션 복원을 기다리는 동안. Suspense 폴백과 같은 것을 그려야 화면이 안 갈아치워진다. */
function BootSkeleton() {
  const { pathname } = useLocation();
  return /\/dialogs\/[^/]+/.test(pathname) ? <MessageListSkeleton /> : <DialogListSkeleton />;
}

/**
 * 로그인 뒤에만 볼 수 있는 화면들.
 *
 * 세션 복원(`bootstrap`)이 끝나기 전에 판단하면 안 된다. 복원은 MTProto 재연결이라 한
 * 박자 걸리는데, 그 사이에 리다이렉트를 걸면 **새로고침할 때마다 로그인 화면이 번쩍하고
 * 지나가거나** 아예 첫 화면에 갇힌다.
 */
function RequireAuth() {
  const step = useAuth((s) => s.step);
  const booted = useAuth((s) => s.booted);
  if (!booted) return <BootSkeleton />;
  if (step !== 'authorized') return <Navigate to="/" replace />;
  return <Outlet />;
}

const pages: RouteObject[] = [
  { index: true, element: <SignIn /> },
  {
    element: <RequireAuth />,
    children: [
      { path: 'dialogs', element: <Dialogs /> },
      { path: 'dialogs/:id', element: <DialogDetail /> },
      { path: 'dialogs/:id/export', element: <ExportPage /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
];

/**
  * `base`(배포 위치) + 언어 조각. 기본 언어는 조각이 비어 있다.
  *
  * 언어를 라우트 트리가 아니라 basename 에 넣었다. 그래서 화면 코드의 `to="/dialogs"` 를
  * 하나도 안 고쳐도 라우터가 앞에 붙여 준다.
  */
const basename = import.meta.env.BASE_URL + langSegment(languageFromPath());

/*
  Suspense 는 MainLayout **안**에 있다(레이아웃의 Outlet 을 감싼다).

  여기서 감싸면 lazy 페이지가 도착하기를 기다리는 동안 MainLayout 까지 통째로 대체돼서,
  새로고침할 때마다 헤더가 나왔다 사라졌다 다시 나온다. 껍데기는 그대로 두고 본문만
  갈아 끼워야 한다.
*/
const tree = [
  {
    element: <MainLayout />,
    /*
      레이아웃 자체가 무너진 경우. 헤더도 못 그리는 상황이라 화면 전체를 대신한다.
    */
    errorElement: <ErrorPage />,
    children: [
      {
        /*
          경로 없는 껍데기 하나를 끼워 두는 이유는 **헤더를 남기기 위해서**다.

          errorElement 는 그것이 달린 라우트의 element 를 대신한다. 위 레이아웃 라우트에만
          두면 페이지 하나가 넘어져도 헤더까지 같이 사라져, 사용자는 앱이 통째로 죽은 것으로
          본다. 자식 쪽에 두면 Outlet 자리만 바뀐다.
        */
        errorElement: <ErrorPage />,
        children: pages,
      },
    ],
  },
];

/**
 * 단일 파일 배포는 해시 라우터여야 한다.
 *
 * 주소가 `file:///.../index.html` 이라 경로를 바꿀 대상이 없다. 히스토리 API 로
 * `/dialogs` 를 밀어 넣으면 브라우저가 **파일시스템 경로**를 고치려 드는 셈이라 막히고,
 * 설령 됐다 해도 새로고침하면 없는 파일을 열게 된다. 해시(`#/dialogs`)는 문서가 그대로라
 * 서버 없이도 성립한다.
 *
 * 웹 배포는 그대로 둔다. 해시는 검색엔진이 별개 주소로 보지 않아서 언어별 색인이 깨진다.
 */
const router = __STANDALONE__ ? createHashRouter(tree) : createBrowserRouter(tree, { basename });

/** 저장된 세션의 유휴 만료 시각을 밀어 주는 주기. TTL 보다 충분히 짧기만 하면 된다. */
const TOUCH_INTERVAL_MS = 60_000;

export default function App() {
  const bootstrap = useAuth((s) => s.bootstrap);
  const authorized = useAuth((s) => s.step === 'authorized');

  /**
   * 라우터보다 먼저 한 번만 돈다. StrictMode 가 이 이펙트를 두 번 부르지만, bootstrap 은
   * 저장본이 없으면 즉시 끝나고 있으면 createClient 가 이전 클라이언트를 정리하고 다시
   * 만들기 때문에 두 번 돌아도 결과가 같다.
   */
  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  /**
   * 탭이 살아 있는 동안 만료 시각을 밀어 준다. 이게 있어야 유휴 만료가 "작업 중에 갑자기
   * 로그아웃"이 아니라 "손 놓은 지 오래되면 만료"로 동작한다.
   *
   * 탭이 배경으로 가면 브라우저가 타이머를 크게 늦추므로, 다시 보이는 순간에도 한 번 민다.
   * 저장본이 없으면(로그인 유지를 끈 경우) touchStoredSession 은 아무것도 하지 않는다.
   */
  useEffect(() => {
    if (!authorized) return;
    touchStoredSession();
    const timer = setInterval(touchStoredSession, TOUCH_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') touchStoredSession();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [authorized]);

  return <RouterProvider router={router} />;
}
