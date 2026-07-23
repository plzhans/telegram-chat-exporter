import { Navigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PageSkeleton } from '@/shared/ui/Skeleton';
import {
  getCachedPeer,
  useChatStatsQuery,
  useDialogsQuery,
  type DialogSummary,
} from '@/features/dialogs/api';
import { Avatar } from '@/features/dialogs/components/Avatar';
import { formatDisplayDate, shiftDateKey, todayKey } from '@/shared/lib/date';
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

/**
 * 문지기.
 *
 * peer 캐시가 채워질 때까지 기다린다. `peerCache` 는 메모리에만 있어서 **새로고침하면
 * 비어 있다.** 비었다고 바로 목록으로 보내면 이 화면에서 새로고침한 사람이 쫓겨난다.
 * 대화방 목록 쿼리가 끝나면 캐시가 다시 채워지므로 그때 판단한다.
 *
 * **본문을 따로 뺀 이유는 훅 순서 때문이다.** 여기서 조건부 return 을 하면서 아래 훅들을
 * 같이 두면, 기다리는 렌더와 통과한 렌더의 훅 개수가 달라져 React 가 죽는다. 목록이 이미
 * 캐시에 있으면 첫 렌더부터 통과해서 안 터지고, **새로고침했을 때만** 터진다 - 그래서
 * 눈에 잘 안 띈다. 대화 보기 화면도 같은 이유로 같은 모양이다.
 */
export default function ExportPage() {
  const { id = '' } = useParams();
  const { data: dialogs, isPending } = useDialogsQuery();

  if (isPending) return <PageSkeleton />;
  if (!getCachedPeer(id)) return <Navigate to="/dialogs" replace />;

  return <ExportBody id={id} dialog={dialogs?.find((d) => d.id === id)} />;
}

function ExportBody({ id, dialog }: { id: string; dialog?: DialogSummary }) {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const range = defaultRange(searchParams.get('date'));

  /*
    대화가 존재하는 기간. 대화 화면과 같은 캐시를 쓰므로 거기서 넘어왔으면 추가 요청이 없다.

    내보내기 화면에서 특히 값어치가 있다 - 아래에서 기간을 고르는데, 이 방이 언제부터
    있는지 모르면 있지도 않은 날짜를 잡게 된다.
  */
  const stats = useChatStatsQuery(id, dialog?.date);
  const period =
    stats.data?.firstDate && stats.data.lastDate
      ? `${formatDisplayDate(stats.data.firstDate)} ~ ${formatDisplayDate(stats.data.lastDate)}`
      : undefined;

  return (
    <div className="space-y-4">
      {/*
        대화 화면(DialogDetail)의 머리와 같은 모양이다. 내보내기는 그 화면에서 이어지는
        자리라, 넘어왔을 때 머리가 달라 보이면 다른 대화방으로 온 것처럼 읽힌다.
      */}
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {dialog && (
          <Avatar
            id={dialog.id}
            title={dialog.title}
            kind={dialog.kind}
            photo={dialog.photo}
            /* 저해상도 썸네일은 뭉개진다. 대화 화면을 거쳐 왔으면 이미 캐시에 있다. */
            sharp
            className="h-8 w-8 text-sm"
          />
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-bold leading-tight text-slate-900">
            {dialog?.title ?? id}
          </h1>
          {period && <p className="truncate text-[0.7rem] text-slate-500">{period}</p>}
        </div>

        {/*
          전체 메시지 수. 대화 화면에서 버튼이 서던 자리다.

          시작 전에 규모를 알아야 한다 - 몇 건짜리인지 모르면 몇 분이 걸릴 일인지, 아니면
          몇 시간이 걸릴 일인지 가늠하지 못한 채 시작하게 된다.
        */}
        {stats.data && (
          <div className="shrink-0 text-end">
            <p className="text-[0.7rem] leading-tight text-slate-500">{t('export.stats.total')}</p>
            <p className="text-sm font-bold leading-tight tabular-nums text-slate-900">
              {t('export.stats.messages', { count: stats.data.total })}
            </p>
          </div>
        )}
      </div>

      {dialog && <ExportPanel dialog={dialog} defaultFrom={range.from} defaultTo={range.to} />}
    </div>
  );
}
