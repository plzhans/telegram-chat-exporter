import { useTranslation } from 'react-i18next';
import { Download } from 'lucide-react';
import { DOWNLOAD_URL } from '@/shared/config/app';

/**
 * 받아서 직접 실행하는 길을 알려 준다.
 *
 * 이 화면에서 망설이는 이유는 대개 "처음 보는 웹사이트에 전화번호를 넣으라"는 요구
 * 자체다(`TrustPanel` 주석). 그 사람에게 가장 강한 답은 설명이 아니라 **이 사이트를 안
 * 거치는 선택지**다 - 받은 파일은 우리가 나중에 무엇을 바꾸든 영향을 받지 않는다.
 *
 * **단일 파일 배포에는 뜨지 않는다.** 이미 받아서 열어 본 사람에게 내려받기를 권하는 꼴이
 * 된다(`SignIn.tsx` 의 렌더 조건).
 */
export function DownloadPanel() {
  const { t } = useTranslation();

  return (
    <section className="edge-card bg-white p-4">
      <h2 className="text-sm font-bold text-slate-900">{t('auth.download.title')}</h2>
      <p className="mt-1.5 text-xs leading-relaxed text-slate-600">{t('auth.download.body')}</p>
      {/*
        새 탭으로 열지 않는다. 누르면 파일 내려받기가 시작될 뿐 화면이 바뀌지 않아서,
        빈 탭만 하나 남는다.
      */}
      <a
        href={DOWNLOAD_URL}
        className="mt-3 inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50"
      >
        <Download className="h-4 w-4 shrink-0" />
        {t('auth.download.cta')}
      </a>
    </section>
  );
}
