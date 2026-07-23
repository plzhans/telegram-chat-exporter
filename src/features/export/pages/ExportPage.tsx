import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { Spinner } from '@/shared/ui/Spinner';
import { getCachedPeer, useDialogsQuery } from '@/features/dialogs/api';
import { Avatar } from '@/features/dialogs/components/Avatar';
import { shiftDateKey, todayKey } from '@/shared/lib/date';
import { ExportPanel } from '../components/ExportPanel';

/**
 * 기본으로 잡아 주는 기간의 길이(일).
 *
 * 일주일이다. 기본값은 **되돌리기 쉬운 쪽**이어야 한다. 너무 넓게 잡아 두면 무심코 누른
 * 한 번이 몇십 분짜리 작업이 되고, 좁게 잡혀 있으면 모자란 걸 보고 늘리면 그만이다.
 */
const DEFAULT_SPAN_DAYS = 7;


/**
 * 기본 기간을 정한다.
 *
 * **대화 보기에서 날짜를 고르고 왔다면** 그 날을 시작으로 잡고 일주일 뒤를 끝으로 둔다.
 * 사용자가 이미 "여기가 궁금하다"고 표시한 지점이므로, 거기서부터 앞으로 읽어 나가는 게
 * 자연스럽다.
 *
 * 그냥 들어왔다면 최근 일주일이다.
 */
function defaultRange(dateParam: string | null): { from: string; to: string } {
  if (dateParam) {
    return { from: dateParam, to: shiftDateKey(dateParam, DEFAULT_SPAN_DAYS) };
  }
  const today = todayKey();
  return { from: shiftDateKey(today, -DEFAULT_SPAN_DAYS), to: today };
}

export default function ExportPage() {
  const { t } = useTranslation();
  const { id = '' } = useParams();
  const [searchParams] = useSearchParams();

  const { data: dialogs, isPending } = useDialogsQuery();

  /**
   * peer 캐시가 채워질 때까지 기다린다.
   *
   * `peerCache` 는 메모리에만 있어서 **새로고침하면 비어 있다.** 비었다고 바로 목록으로
   * 보내면 이 화면에서 새로고침한 사람이 쫓겨난다. 대화방 목록 쿼리가 끝나면 캐시가 다시
   * 채워지므로 그때 판단한다(대화 보기 화면도 같은 이유로 같은 처리를 한다).
   */
  if (isPending) {
    return (
      <div className="flex flex-col items-center gap-3 edge-card bg-white p-8">
        <Spinner />
      </div>
    );
  }

  if (!getCachedPeer(id)) return <Navigate to="/dialogs" replace />;

  const dialog = dialogs?.find((d) => d.id === id);
  const range = defaultRange(searchParams.get('date'));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link
          to={`/dialogs/${id}`}
          className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
        </Link>
        {dialog && (
          <Avatar
            id={dialog.id}
            title={dialog.title}
            kind={dialog.kind}
            photo={dialog.photo}
            className="h-8 w-8 text-sm"
          />
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold text-slate-900">{dialog?.title ?? id}</h1>
          <p className="text-xs text-slate-500">{t('export.title')}</p>
        </div>
      </div>

      {dialog && <ExportPanel dialog={dialog} defaultFrom={range.from} defaultTo={range.to} />}
    </div>
  );
}
