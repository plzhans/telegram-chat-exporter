import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, X } from 'lucide-react';
import { Alert } from '@/shared/ui/Alert';
import { Button } from '@/shared/ui/Button';
import { ErrorNotice } from '@/shared/ui/ErrorNotice';
import { Input } from '@/shared/ui/Input';
import { Spinner } from '@/shared/ui/Spinner';
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
      <div className="flex items-end gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold text-slate-900">{t('dialogs.title')}</h1>
          <p className="text-sm text-slate-500">
            {data
              ? query
                ? t('dialogs.filtered', { shown: filtered.length, total: data.length })
                : t('dialogs.count', { count: data.length })
              : t('dialogs.subtitle')}
          </p>
        </div>
        <Button variant="secondary" size="sm" loading={isFetching} onClick={() => void refetch()}>
          {t('common.retry')}
        </Button>
      </div>

      {data && data.length > 0 && (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('dialogs.searchPlaceholder')}
            className="pl-10 pr-10"
            // 검색 결과가 하나면 엔터로 바로 들어갈 수 있어야 하지만, 그건 다음 단계다.
            autoComplete="off"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label={t('dialogs.searchClear')}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      <ErrorNotice error={error} />

      {isPending ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white p-8">
          <Spinner />
          <p className="text-sm text-slate-500">{t('dialogs.loading')}</p>
        </div>
      ) : filtered.length > 0 ? (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {filtered.map((dialog) => (
            <DialogRow key={dialog.id} dialog={dialog} />
          ))}
        </ul>
      ) : (
        !error && (
          <p className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            {t(query ? 'dialogs.noMatch' : 'dialogs.empty')}
          </p>
        )
      )}

      <Alert tone="info">{t('dialogs.mediaNote')}</Alert>
    </div>
  );
}
