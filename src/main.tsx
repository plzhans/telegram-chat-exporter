import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/shared/i18n';
import App from '@/app/App';
import './globals.css';

/*
  **여기에는 애널리틱스가 없다.** 이 엔트리는 텔레그램 동작 문서(`/run/session/`)다 — 전화번호·
  인증코드·대화를 만지는 자리라, 그 문서의 CSP는 텔레그램 외 아무 데도 열지 않는다. GA 집계는
  그 앞 "방식 고르기" 문서(`/run/`, `src/method/main.tsx`)에서만 돈다. 자세한 근거는
  `src/shared/auth/handoff.ts` 주석 참고.
*/

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      /**
       * MTProto 요청은 실패하면 대개 FLOOD_WAIT 이다. 자동 재시도는 그 제한을 더 키우기만
       * 하므로 끈다. 재시도 여부는 사용자가 버튼으로 정한다.
       */
      retry: false,
      refetchOnWindowFocus: false,
      staleTime: 60_000,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </I18nextProvider>
  </StrictMode>,
);
