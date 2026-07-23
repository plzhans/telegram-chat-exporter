import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, Search, X } from 'lucide-react';
import { ErrorNotice } from '@/shared/ui/ErrorNotice';
import { Input } from '@/shared/ui/Input';
import { cn } from '@/shared/lib/utils';
import { DialogListSkeleton } from '@/shared/ui/Skeleton';
import { useDialogsQuery } from '../api';
import { DialogRow } from '../components/DialogRow';

/**
 * 검색 비교용으로 문자열을 눕힌다.
 *
 * 대소문자는 물론이고 한글 자모 정규화(NFC/NFD)까지 맞춘다. macOS 파일명이나 일부 IME 는
 * 조합형(NFD)으로 흘려보내서, 정규화 없이 비교하면 눈에 똑같이 보이는 "홍길동"이 안 잡힌다.
 */
function normalize(value: string): string {
  return value.normalize('NFC').toLowerCase();
}

export default function Dialogs() {
  const { t } = useTranslation();
  const { data, error, isPending, isFetching, refetch } = useDialogsQuery();
  const [query, setQuery] = useState('');

  /**
   * 검색은 **이미 받아 둔 목록 안에서만** 한다. 서버 검색(`contacts.search`)을 쓰지 않는 이유는
   * 요청이 늘어 FLOOD_WAIT 위험이 커지는 데다, 어차피 내보낼 수 있는 대상은 여기 있는
   * 대화방뿐이기 때문이다.
   */
  const filtered = useMemo(() => {
    if (!data) return [];
    const needle = normalize(query.trim());
    if (!needle) return data;
    return data.filter((dialog) => normalize(dialog.title).includes(needle));
  }, [data, query]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          {/* 개수는 제목 옆에 붙인다. 아래 줄은 검색 중일 때만 쓰인다. */}
          <h1 className="flex items-baseline gap-2 text-xl font-bold text-slate-900">
            {t('dialogs.title')}
            {data && (
              <span className="text-base font-semibold tabular-nums text-slate-400">
                {data.length}
              </span>
            )}
          </h1>
          {(!data || query) && (
            <p className="text-sm text-slate-500">
              {data
                ? t('dialogs.filtered', { shown: filtered.length, total: data.length })
                : t('dialogs.subtitle')}
            </p>
          )}
        </div>

        {/*
          "다시 시도" 가 아니라 새로고침이다. 실패했을 때만 누르는 버튼처럼 보이면,
          평소에 목록을 갱신하고 싶은 사람이 누를 곳을 못 찾는다.
        */}
        <button
          type="button"
          onClick={() => void refetch()}
          disabled={isFetching}
          title={t('common.refresh')}
          aria-label={t('common.refresh')}
          className="shrink-0 rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:text-slate-300"
        >
          <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
        </button>
      </div>

      {data && data.length > 0 && (
        <div className="relative">
          <Search className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('dialogs.searchPlaceholder')}
            className="ps-10 pe-10"
            // 검색 결과가 하나면 엔터로 바로 들어갈 수 있어야 하지만, 그건 다음 단계다.
            autoComplete="off"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label={t('dialogs.searchClear')}
              className="absolute end-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      <ErrorNotice error={error} />

      {isPending ? (
        // 앞선 두 단계(코드 묶음·세션 복원)와 같은 것을 그린다. 그래야 한 번의 기다림으로 보인다.
        <DialogListSkeleton />
      ) : filtered.length > 0 ? (
        // 대화 화면과 같은 규칙 — 좁은 화면에서는 부모 여백을 되돌리고 테두리를 위아래만 남긴다.
        <ul className="edge-card divide-y divide-slate-100 overflow-hidden bg-white">
          {filtered.map((dialog) => (
            <DialogRow key={dialog.id} dialog={dialog} />
          ))}
        </ul>
      ) : (
        !error && (
          <p className="edge-card bg-white p-8 text-center text-sm text-slate-500">
            {t(query ? 'dialogs.noMatch' : 'dialogs.empty')}
          </p>
        )
      )}
    </div>
  );
}
