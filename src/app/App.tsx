import { lazy, Suspense, useEffect } from 'react';
import {
  createBrowserRouter,
  Navigate,
  Outlet,
  RouterProvider,
  type RouteObject,
} from 'react-router-dom';
import { MainLayout } from './layouts/MainLayout';
import { Spinner } from '@/shared/ui/Spinner';
import { useAuth } from '@/shared/auth/useAuth';
import { touchStoredSession } from '@/shared/telegram/session';
import { langSegment, languageFromPath } from '@/shared/i18n';

const SignIn = lazy(() => import('@/features/auth/pages/SignIn'));
const Dialogs = lazy(() => import('@/features/dialogs/pages/Dialogs'));
const DialogDetail = lazy(() => import('@/features/dialogs/pages/DialogDetail'));
const ExportPage = lazy(() => import('@/features/export/pages/ExportPage'));

function PageLoader() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Spinner />
    </div>
  );
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
  if (!booted) return <PageLoader />;
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

const router = createBrowserRouter(
  [
    {
      element: (
        <Suspense fallback={<PageLoader />}>
          <MainLayout />
        </Suspense>
      ),
      children: pages,
    },
  ],
  { basename },
);

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
