import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/shared/i18n';
import { initAnalytics } from '@/shared/analytics/init';
import { MethodScreen } from './MethodScreen';
import '../globals.css';

/*
  방식 고르기 문서(`/run/`)의 진입점.

  **GA는 여기에만 있다.** 이 화면까지가 "얼마나 앱에 들어오나"를 재는 자리라서 `initAnalytics()`
  가 첫 화면 방문 하나를 보낸다. 방식을 고르면 텔레그램 문서(`/run/session/`)로 진짜 페이지
  이동하는데, 그쪽 엔트리(`src/main.tsx`)에는 GA 코드가 아예 없다. 라우터·QueryClient·GramJS 도
  여기선 필요 없다(단일 화면 + CredentialsForm 뿐).
*/
initAnalytics();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nextProvider i18n={i18n}>
      <MethodScreen />
    </I18nextProvider>
  </StrictMode>,
);
