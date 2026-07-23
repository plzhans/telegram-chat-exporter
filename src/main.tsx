import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/shared/i18n';
import App from '@/app/App';
import './globals.css';

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
