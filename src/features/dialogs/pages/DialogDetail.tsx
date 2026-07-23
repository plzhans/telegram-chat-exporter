import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, CalendarDays, ChevronDown, Download } from 'lucide-react';
import { Alert } from '@/shared/ui/Alert';
import { Button } from '@/shared/ui/Button';
import { ErrorNotice } from '@/shared/ui/ErrorNotice';
import { Modal } from '@/shared/ui/Modal';
import { MessageListSkeleton, Skeleton } from '@/shared/ui/Skeleton';
import { cn } from '@/shared/lib/utils';
import { dateKeyOf, formatDisplayDate, isSameLocalDay, startOfDayUnix } from '@/shared/lib/date';
import {
  getCachedPeer,
  useDialogsQuery,
  useChatStatsQuery,
  useMessagesQuery,
  type DialogSummary,
  type MessageAnchor,
  type MessageSummary,
} from '../api';
import { Avatar } from '../components/Avatar';
import { MessageAlbum } from '../components/MessageAlbum';
import { MessageCalendar } from '../components/MessageCalendar';
import { PhotoViewer } from '../components/PhotoViewer';
import { DateDivider, MessageRow } from '../components/MessageRow';

/**
 * peer 캐시가 채워질 때까지 기다렸다가 본문을 띄운다.
 *
 * `peerCache` 는 메모리에만 있어서 **새로고침하면 비어 있다.** 세션은 sessionStorage 로
 * 살아나므로 로그인 상태는 유지되는데, 캐시만 없다고 곧바로 목록으로 튕기면 "대화방에서
 * 새로고침하면 쫓겨나는" 동작이 된다.
 *
 * 대화방 목록 쿼리가 끝나면 캐시가 다시 채워진다. 그러니 **끝날 때까지 기다린 뒤에** 판단한다.
 * 본문을 별도 컴포넌트로 뺀 이유는 훅 순서 때문이다 — 여기서 조건부 return 을 하면서 아래
 * 메시지 훅들을 같이 두면, peer 가 없는 렌더에서 훅이 먼저 돌아 PEER_NOT_CACHED 에러가 굳는다.
 */
export default function DialogDetail() {
  const { id = '' } = useParams();
  const { data: dialogs, isPending } = useDialogsQuery();

  if (isPending) return <MessageListSkeleton />;

  if (!getCachedPeer(id)) return <Navigate to="/dialogs" replace />;

  return <DialogView id={id} dialog={dialogs?.find((d) => d.id === id)} />;
}

function DialogView({ id, dialog }: { id: string; dialog?: DialogSummary }) {
  const { t } = useTranslation();
  const [calendarOpen, setCalendarOpen] = useState(false);
  /** 달력에서 고른 날짜(`yyyy-mm-dd`). 고른 적 없으면 최신 메시지부터 본다. */
  const [selectedDate, setSelectedDate] = useState<string | undefined>();

  const anchor: MessageAnchor = useMemo(
    // 로컬 자정을 Unix 초로 바꿔 보낸다. 변환은 shared/lib/date 가 전담한다.
    () => (selectedDate ? { type: 'date', unix: startOfDayUnix(selectedDate) } : { type: 'latest' }),
    [selectedDate],
  );

  const {
    data,
    error,
    isPending,
    hasNextPage,
    hasPreviousPage,
    isFetchingNextPage,
    isFetchingPreviousPage,
    fetchNextPage,
    fetchPreviousPage,
  } = useMessagesQuery(id, anchor);

  /** 각 페이지가 이미 시간순이고 페이지 순서도 과거→미래라, 이어 붙이기만 하면 된다. */
  const messages = useMemo(
    () => (data ? data.pages.flatMap((page) => page.messages) : []),
    [data],
  );

  /**
   * 이미 화면에 그린 메시지에서 뽑은 날짜별 개수.
   *
   * 달력을 열었을 때 **요청 하나 없이** 바로 점을 찍어 줄 수 있는 정보다. 스크롤해서 본
   * 범위만큼이라 실제보다 적지만, "있다"는 사실만큼은 확정이라 그것만 쓴다.
   */
  const seedDays = useMemo(() => {
    const map = new Map<string, number>();
    for (const message of messages) {
      const key = dateKeyOf(message.date);
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [messages]);

  /**
   * 골랐더니 그 날에 대화가 없었던 날들.
   *
   * `offsetDate` 로 점프하면 텔레그램은 **그 시각 이후의 첫 메시지**부터 준다. 그러니 받아온
   * 첫 메시지의 날짜가 고른 날과 다르면 그 날은 비어 있었다는 뜻이다 — 추가 요청 없이
   * 결과만 보고 알 수 있다. 그 사실을 모아 두면 달력에서 다시 고르지 않게 막을 수 있다.
   */
  const [emptyDays, setEmptyDays] = useState<Set<string>>(() => new Set());
  const landedOn = messages[0] ? dateKeyOf(messages[0].date) : undefined;
  const missedSelectedDay = Boolean(selectedDate && landedOn && landedOn !== selectedDate);

  useEffect(() => {
    if (!selectedDate || !missedSelectedDay) return;
    setEmptyDays((previous) =>
      previous.has(selectedDate) ? previous : new Set(previous).add(selectedDate),
    );
  }, [selectedDate, missedSelectedDay]);

  /**
   * 같은 `groupedId` 를 가진 연속 메시지를 한 덩어리로 묶는다.
   *
   * 텔레그램은 한 번에 올린 사진들을 각각의 메시지로 저장하되 같은 묶음 id 를 달아 준다.
   * 풀어 놓으면 사진 한 장짜리 말풍선이 줄줄이 늘어서서 "한 번에 보낸 것"이라는 사실이
   * 사라진다. **연속인 경우에만** 묶는다 — 사이에 다른 메시지가 끼면 그건 이미 시간상
   * 떨어진 것이라 붙이면 순서가 뒤틀린다.
   */
  const groups = useMemo(() => {
    const result: MessageSummary[][] = [];
    for (const message of messages) {
      const previous = result[result.length - 1];
      const sameAlbum =
        message.groupedId && previous && previous[0].groupedId === message.groupedId;
      if (sameAlbum) previous.push(message);
      else result.push([message]);
    }
    return result;
  }, [messages]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const anchorKey = selectedDate ?? 'latest';
  /** 이 앵커에 대해 초기 스크롤 위치를 이미 잡았는지. 렌더링에 안 쓰이므로 ref 로 둔다. */
  const positionedFor = useRef<string | null>(null);

  /**
   * 첫 로드 위치를 잡는다.
   *
   * 최신부터 보는 중이면 **맨 아래** — 메신저를 열면 마지막 대화가 보이는 게 당연하다.
   * 날짜로 점프한 경우에는 그 날이 목록 맨 위에 오므로 맨 위에 둔다.
   */
  useEffect(() => {
    if (isPending || messages.length === 0) return;
    if (positionedFor.current === anchorKey) return;
    const element = scrollRef.current;
    if (!element) return;
    element.scrollTop = selectedDate ? 0 : element.scrollHeight;
    positionedFor.current = anchorKey;
  }, [anchorKey, isPending, messages.length, selectedDate]);

  /**
   * 이전 메시지를 불러오면 목록 **위쪽**에 내용이 붙어서 보던 자리가 아래로 밀려난다.
   * 아래 끝에서의 거리를 기억했다가 되돌려 놓으면 화면이 그대로 멈춰 있는 것처럼 보인다.
   */
  const loadOlder = useCallback(async () => {
    const element = scrollRef.current;
    const distanceFromBottom = element ? element.scrollHeight - element.scrollTop : 0;
    await fetchPreviousPage();
    requestAnimationFrame(() => {
      if (element) element.scrollTop = element.scrollHeight - distanceFromBottom;
    });
  }, [fetchPreviousPage]);

  /**
   * 위쪽 끝에 닿으면 이전 메시지를 알아서 불러온다.
   *
   * 버튼을 누르는 대신 스크롤이 신호가 된다. 위치 보정(`loadOlder`)이 이미 있어서 내용이
   * 붙어도 보던 자리가 그대로다 — 그 덕에 자동으로 이어져도 화면이 튀지 않는다.
   *
   * 끝에 정확히 닿기 전에 시작한다(여유 200px). 정확히 0 이 됐을 때 시작하면 사용자가
   * 빈 위쪽을 잠깐 마주하게 된다.
   */
  useEffect(() => {
    const element = scrollRef.current;
    if (!element || !hasPreviousPage || isFetchingPreviousPage) return;

    const onScroll = () => {
      if (element.scrollTop <= 200) void loadOlder();
    };
    element.addEventListener('scroll', onScroll, { passive: true });
    return () => element.removeEventListener('scroll', onScroll);
  }, [hasPreviousPage, isFetchingPreviousPage, loadOlder]);

  /**
   * 아래쪽 끝 근처에 있는지.
   *
   * 과거로 한참 올라간 뒤 최신으로 돌아올 길이 없어서 둔다. 스크롤을 굴려 되돌아가려면
   * 대화방이 클수록 한참 걸린다.
   */
  const [nearBottom, setNearBottom] = useState(true);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const update = () => {
      const distance = element.scrollHeight - element.scrollTop - element.clientHeight;
      setNearBottom(distance < 80);
    };
    update();
    element.addEventListener('scroll', update, { passive: true });
    return () => element.removeEventListener('scroll', update);
  }, [messages.length]);

  /**
   * 최신 대화로 돌아간다.
   *
   * 날짜로 점프해 둔 상태면 **앵커부터 되돌린다** — 그냥 아래로 스크롤해 봐야 그 날짜
   * 언저리의 끝일 뿐 최신이 아니다. 앵커가 바뀌면 초기 위치 잡기가 맨 아래로 보낸다.
   */
  const goToLatest = useCallback(() => {
    if (selectedDate) {
      setSelectedDate(undefined);
      return;
    }
    /*
      한 번에 내려간다.

      `behavior: 'smooth'` 는 거리에 비례해 오래 걸린다. 며칠치를 이어 받아 둔 대화방은
      스크롤이 수만 픽셀이라, 부드럽게 내려가는 동안 화면이 몇 초씩 흘러가고 그 사이
      "위쪽에 닿으면 더 불러온다" 규칙까지 스쳐 지나간다. 이 버튼을 누른 사람은 과정을
      보려는 게 아니라 끝에 있고 싶은 것이다.
    */
    const element = scrollRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [selectedDate]);

  /**
   * 이 대화방의 기간. 첫 메시지 시각은 요청 한 번이지만, 달력·내보내기와 같은 캐시를 쓰므로
   * 어느 화면에서든 한 번만 나간다.
   */
  const stats = useChatStatsQuery(id, dialog?.date);
  const period =
    stats.data?.firstDate && stats.data.lastDate
      ? `${formatDisplayDate(stats.data.firstDate)} ~ ${formatDisplayDate(stats.data.lastDate)}`
      : undefined;

  const exportHref = selectedDate
    ? `/dialogs/${id}/export?date=${selectedDate}`
    : `/dialogs/${id}/export`;

  return (
    // 남은 높이를 다 쓰는 세로 배치. 아래 메시지 상자만 스크롤된다.
    <div className="flex h-full flex-col gap-3">
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Link
          to="/dialogs"
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
            /*
              여기도 선명한 판을 쓴다. 메시지에 딸려 오는 strippedThumb 은 수십 px 이라
              뭉개져 보인다.

              요청이 느는 걸 걱정할 자리가 아니다 - 대화방 하나뿐이고, 목록을 거쳐 들어온
              경우에는 그때 받아 둔 것이 캐시에 있어 추가 요청이 아예 없다.
            */
            sharp
            className="h-8 w-8 text-sm"
          />
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-bold leading-tight text-slate-900">
            {dialog?.title ?? id}
          </h1>
          {/*
            대화가 존재하는 기간. 어디까지 거슬러 올라갈 수 있는지 알려 준다 — 날짜를 고르기
            전에 "이 방은 언제부터 언제까지인가"가 보이면 헛짚을 일이 없다.
          */}
          {period && <p className="truncate text-[0.7rem] text-slate-500">{period}</p>}
        </div>

        {/*
          좁은 화면에서는 아이콘만 남긴다. 이 줄에는 대화방 이름과 기간이 먼저 서야 하는데,
          글자가 붙은 버튼 두 개가 그 자리를 먹고 이름을 줄바꿈시킨다.

          글자를 지우는 대신 `title`·`aria-label` 로 남긴다 — 눈으로 못 읽어도 길게 누르면
          뜨고, 화면 낭독기는 그대로 읽는다.
        */}
        <Link to={exportHref} className="shrink-0">
          <Button
            variant="secondary"
            size="sm"
            className="px-2 sm:px-3"
            title={t('messages.export')}
            aria-label={t('messages.export')}
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t('messages.export')}</span>
          </Button>
        </Link>

        <Button
          variant={calendarOpen ? 'primary' : 'secondary'}
          size="sm"
          className="shrink-0 px-2 sm:px-3"
          title={t('messages.jumpToDate')}
          aria-label={t('messages.jumpToDate')}
          onClick={() => setCalendarOpen((open) => !open)}
        >
          <CalendarDays className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{selectedDate ?? t('messages.jumpToDate')}</span>
        </Button>

      </div>

      {/*
        열렸을 때만 마운트한다. 항상 띄워 두면 닫혀 있는 동안에도 달력 조회 요청이 나간다.
      */}
      {calendarOpen && (
        <Modal
          open
          onClose={() => setCalendarOpen(false)}
          title={t('messages.jumpToDate')}
          footer={
            <Button variant="secondary" size="sm" onClick={() => setCalendarOpen(false)}>
              {t('common.cancel')}
            </Button>
          }
        >
          <MessageCalendar
            dialogId={id}
            selected={selectedDate}
            seedDays={seedDays}
            // 대화방 목록에 이미 있는 값이라 요청이 들지 않는다.
            lastMessageUnix={dialog?.date}
            emptyDays={emptyDays}
            onEmptyDay={(key) =>
              setEmptyDays((previous) =>
                previous.has(key) ? previous : new Set(previous).add(key),
              )
            }
            onSelect={(dateKey) => {
              setSelectedDate(dateKey);
              setCalendarOpen(false);
            }}
          />
        </Modal>
      )}

      <PhotoViewer />

      <ErrorNotice error={error} />

      {/*
        고른 날에 대화가 없었다는 사실을 알려 준다. 이게 없으면 사용자는 엉뚱한 날짜의
        대화를 보면서 "왜 내가 고른 날이 아니지"라고 생각하게 된다.
      */}
      {missedSelectedDay && landedOn && (
        <Alert tone="info" className="shrink-0">
          {t('messages.dayEmpty', { date: selectedDate, landed: landedOn })}
        </Alert>
      )}

      {isPending ? (
        <div className="edge-card min-h-0 flex-1 space-y-3 bg-white p-1.5 sm:p-3">
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className={cn('flex items-end gap-2', i % 3 === 2 && 'flex-row-reverse')}>
              {i % 3 !== 2 && <Skeleton className="h-7 w-7 shrink-0 rounded-full" />}
              <Skeleton className={cn('h-10 rounded-2xl', ['w-40', 'w-56', 'w-32', 'w-48'][i % 4])} />
            </div>
          ))}
        </div>
      ) : messages.length === 0 ? (
        !error && (
          <p className="edge-card bg-white p-8 text-center text-sm text-slate-500">
            {t('messages.empty')}
          </p>
        )
      ) : (
        // min-h-0 이 있어야 flex 아이템이 콘텐츠만큼 부풀지 않고 안에서 스크롤된다.
        <div className="relative flex min-h-0 flex-1 flex-col">
        <div
          ref={scrollRef}
          /*
            좁은 화면에서는 대화가 화면 끝까지 차지한다.

            `-mx-4` 로 부모(main)의 좌우 여백을 되돌린다. 여백을 부모에서 아예 빼는 대신
            여기서 되돌리는 이유는, 그 여백이 로그인·목록 화면에는 그대로 필요하기 때문이다.
            테두리와 둥근 모서리도 같이 없앤다 - 화면 끝에 닿는 선은 테두리로 보이지 않고
            잘린 것처럼 보인다. sm 이상에서는 전부 원래대로 돌아온다.
          */
          className="scroll-area edge-card min-h-0 flex-1 space-y-3 overflow-y-auto bg-white p-1.5 sm:p-3"
        >
          {/*
            날짜로 점프하면 대화 중간에 서게 된다. 그래서 위(이전)와 아래(이후) 양쪽에
            더보기가 있어야 한다. 최신부터 보는 중이면 아래쪽은 이미 끝이라 안 뜬다.
          */}
          <LoadMore
            show={hasPreviousPage}
            loading={isFetchingPreviousPage}
            label={t('messages.loadOlder')}
            onClick={() => void loadOlder()}
          />

          <ul className="space-y-2">
            {groups.map((group, index) => {
              const message = group[0];
              const previous = groups[index - 1]?.[0];
              const newDay = !previous || !isSameLocalDay(previous.date, message.date);
              /**
               * 같은 사람이 연달아 말하면 아바타·이름을 한 번만 그린다. 날짜가 바뀌면
               * 구분선 뒤로 문맥이 끊기므로 그때는 다시 그린다.
               */
              const showSender = newDay || previous?.senderId !== message.senderId;

              return (
                <Fragment key={message.id}>
                  {newDay && <DateDivider unixSeconds={message.date} />}
                  {group.length > 1 ? (
                    <MessageAlbum messages={group} showSender={showSender} />
                  ) : (
                    <MessageRow message={message} showSender={showSender} />
                  )}
                </Fragment>
              );
            })}
          </ul>

          <LoadMore
            show={hasNextPage}
            loading={isFetchingNextPage}
            label={t('messages.loadNewer')}
            onClick={() => void fetchNextPage()}
          />
        </div>

        {/*
          아래쪽에서 멀어졌을 때만 뜬다. 늘 떠 있으면 마지막 말풍선을 가린다.
        */}
        {(!nearBottom || selectedDate) && (
          <button
            type="button"
            onClick={goToLatest}
            aria-label={t('messages.backToLatest')}
            className="absolute bottom-3 end-3 flex h-9 w-9 items-center justify-center rounded-full bg-slate-900/70 text-white shadow-lg transition-colors hover:bg-slate-900"
          >
            <ChevronDown className="h-5 w-5" />
          </button>
        )}
        </div>
      )}
    </div>
  );
}

function LoadMore({
  show,
  loading,
  label,
  onClick,
  className,
}: {
  show: boolean;
  loading: boolean;
  label: string;
  onClick: () => void;
  className?: string;
}) {
  if (!show) return null;
  return (
    <Button
      variant="secondary"
      size="sm"
      className={cn('w-full', className)}
      loading={loading}
      onClick={onClick}
    >
      {label}
    </Button>
  );
}
