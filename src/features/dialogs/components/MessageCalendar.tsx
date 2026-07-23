import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/shared/ui/Button';
import { cn } from '@/shared/lib/utils';
import {
  dateKeyOf,
  shiftDateKey,
  startOfDay,
  startOfDayUnix,
  toDateKey,
  toUnix,
  todayKey as getTodayKey,
} from '@/shared/lib/date';
import {
  countMessagesOnDay,
  fetchDayCounts,
  getCachedPeer,
  useChatStatsQuery,
  type CalendarDay,
} from '../api';

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

/**
 * 이미 확인한 달의 결과.
 *
 * react-query 대신 모듈 캐시를 쓰는 이유는, 이 작업이 **끝나기 전에도 부분 결과를 계속
 * 흘려보내야** 하기 때문이다. useQuery 는 한 번 resolve 하는 모양이라 그 흐름과 안 맞는다.
 */
const dayCountCache = new Map<string, CalendarDay[]>();

interface MessageCalendarProps {
  dialogId: string;
  /** 지금 선택된 날짜(`yyyy-mm-dd`). 없으면 아무 날도 강조되지 않는다. */
  selected?: string;
  /**
   * 이미 화면에 그려 둔 메시지에서 뽑은 날짜별 개수.
   *
   * **요청 없이 공짜로 아는 정보다.** 대화를 스크롤해서 본 만큼은 그 날에 메시지가 있다는
   * 사실이 확정이므로, 조회 버튼을 누르기 전에도 점을 찍어 준다. 다만 "본 만큼"이라 실제보다
   * 적을 수 있어서 **없다는 판단에는 쓰지 않는다** — 잠그는 건 전체 조회가 끝난 뒤에만 한다.
   */
  seedDays?: Map<string, number>;
  /** 마지막 메시지 시각(Unix 초). 대화방 목록에 이미 있는 값이라 공짜다. */
  lastMessageUnix?: number;
  /**
   * 골라 봤더니 비어 있던 날들.
   *
   * 전체 조회를 안 했어도 이 날들은 **없다는 게 확정**이다. 다시 고를 수 있게 두면 같은
   * 헛걸음을 반복하게 된다.
   */
  emptyDays?: Set<string>;
  /** 눌러 봤더니 비어 있던 날을 바깥에 알린다. 달력을 닫았다 열어도 기억되도록. */
  onEmptyDay?: (dateKey: string) => void;
  onSelect: (dateKey: string) => void;
}

/**
 * 날짜를 고르는 달력.
 *
 * 기본은 지난 날짜를 전부 고를 수 있는 상태다. 비어 있는 날을 골라도 그 뒤의 가장 가까운
 * 메시지부터 보여주므로 문제가 없다(`offsetDate` 가 원래 그렇게 동작한다).
 *
 * **어느 날에 대화가 있었는지는 버튼을 눌러야 확인한다.** 텔레그램이 그 정보를 싸게 주지
 * 않기 때문이다 — `messages.GetSearchResultsCalendar` 는 미디어 달력 전용이라 "전체 메시지"
 * 필터를 `FILTER_NOT_SUPPORTED` 로 거부하고, 남은 방법은 날짜 경계를 하나씩 재는 것뿐이다.
 * 요청 수가 그 달의 일수로 고정돼 예측은 되지만(대화량과 무관), 달을 넘길 때마다 자동으로
 * 물게 할 값은 아니다.
 */
export function MessageCalendar({
  dialogId,
  selected,
  seedDays,
  lastMessageUnix,
  emptyDays,
  onEmptyDay,
  onSelect,
}: MessageCalendarProps) {
  const { t, i18n } = useTranslation();

  /**
   * 대화가 언제 시작됐는지.
   *
   * 달력을 열 때만 조회된다(이 컴포넌트가 그때 마운트된다). 내보내기 화면과 같은 캐시를
   * 쓰므로 둘 중 먼저 연 쪽에서 한 번만 나간다.
   */
  const stats = useChatStatsQuery(dialogId, lastMessageUnix);
  const firstUnix = stats.data?.firstDate;
  const firstKey = firstUnix ? dateKeyOf(firstUnix) : undefined;
  const lastKey = lastMessageUnix ? dateKeyOf(lastMessageUnix) : undefined;
  const [month, setMonth] = useState(() =>
    startOfMonth(selected ? startOfDay(selected) : new Date()),
  );

  const monthKey = `${dialogId}:${month.getFullYear()}-${month.getMonth()}`;
  const [days, setDays] = useState<CalendarDay[] | null>(() => dayCountCache.get(monthKey) ?? null);
  const [progress, setProgress] = useState<{ done: number; total: number; at: number } | null>(
    null,
  );
  const abortRef = useRef<AbortController | null>(null);

  // 달을 넘기면 진행 중인 조회를 끊고 그 달의 캐시로 갈아탄다.
  useEffect(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setProgress(null);
    setDays(dayCountCache.get(monthKey) ?? null);
  }, [monthKey]);

  // 달력을 닫으면 남은 요청이 계속 나가지 않게 끊는다.
  useEffect(() => () => abortRef.current?.abort(), []);

  const check = useCallback(async () => {
    const peer = getCachedPeer(dialogId);
    if (!peer) return;

    const controller = new AbortController();
    abortRef.current = controller;
    setProgress({ done: 0, total: 1, at: toUnix(month) });

    try {
      const result = await fetchDayCounts(
        peer,
        month.getFullYear(),
        month.getMonth(),
        controller.signal,
        // 다 끝나기를 기다리지 않고 확정된 날부터 화면에 채운다.
        (next) => {
          setDays(next.days);
          setProgress({ done: next.done, total: next.total, at: next.at });
        },
        // 이미 아는 날은 물어보지 않는다. 조회 구간이 그만큼 짧아진다.
        seedDays && new Set(seedDays.keys()),
        // 대화가 있었을 수 없는 바깥 구간도 잘라낸다.
        firstUnix,
        lastMessageUnix,
      );
      dayCountCache.set(monthKey, result);
      setDays(result);
    } catch {
      // 중단이거나 요청 실패다. 확인 전 상태로 되돌리면 다시 누를 수 있다.
      setDays(null);
    } finally {
      setProgress(null);
      abortRef.current = null;
    }
  }, [dialogId, month, monthKey, seedDays, firstUnix, lastMessageUnix]);

  /** 오늘 이후는 누를 수 없다. 문자열 비교로 충분하다 — `yyyy-mm-dd` 는 사전순 = 시간순이다. */
  const todayKey = getTodayKey();

  /** 지금 확인 중인 날짜와, 비어 있다고 판명된 날짜. 달력을 닫지 않고 여기서 처리한다. */
  const [checking, setChecking] = useState<string | null>(null);
  const [emptyNotice, setEmptyNotice] = useState<string | null>(null);

  /**
   * 날짜를 고른다. **아직 모르는 날이면 이동하기 전에 먼저 확인한다.**
   *
   * 빈 날로 점프하면 텔레그램은 그 뒤의 아무 날이나 보여준다. 그러면 사용자는 자기가 고른
   * 날을 보고 있다고 착각한 채 엉뚱한 대화를 읽게 된다. 하루치 확인은 경계 두 개라 요청
   * 두 번이면 끝나므로, 그 값을 치르고 확실히 하는 편이 낫다.
   *
   * 이미 아는 날(개수 조회를 마쳤거나 대화창에서 본 날)은 그냥 넘어간다.
   */
  const pick = useCallback(
    async (key: string, known: number) => {
      if (known > 0) {
        onSelect(key);
        return;
      }

      const peer = getCachedPeer(dialogId);
      if (!peer) {
        onSelect(key);
        return;
      }

      setChecking(key);
      setEmptyNotice(null);
      try {
        const count = await countMessagesOnDay(
          peer,
          startOfDayUnix(key),
          startOfDayUnix(shiftDateKey(key, 1)),
        );
        if (count > 0) {
          onSelect(key);
        } else {
          // 달력을 닫지 않는다. 바로 다른 날을 고를 수 있어야 한다.
          setEmptyNotice(key);
          onEmptyDay?.(key);
        }
      } catch {
        // 확인에 실패했으면 막지 않는다. 이동해 보는 편이 아무것도 못 하는 것보다 낫다.
        onSelect(key);
      } finally {
        setChecking(null);
      }
    },
    [dialogId, onEmptyDay, onSelect],
  );

  const counts = useMemo(() => {
    if (!days) return null;
    return new Map(days.map((day) => [dateKeyOf(day.date), day.count]));
  }, [days]);

  /** 달력 격자. 그 달 1일이 무슨 요일인지에 맞춰 앞을 빈 칸으로 채운다. */
  const cells = useMemo(() => {
    const first = startOfMonth(month);
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return [
      ...Array.from({ length: first.getDay() }, () => null),
      ...Array.from(
        { length: daysInMonth },
        (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1),
      ),
    ];
  }, [month]);

  const monthLabel = new Intl.DateTimeFormat(i18n.resolvedLanguage, {
    year: 'numeric',
    month: 'long',
  }).format(month);

  const weekdays = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(i18n.resolvedLanguage, { weekday: 'short' });
    // 1970-01-04 는 일요일이다. 거기서 7일치를 뽑으면 요일 머리글이 나온다.
    return Array.from({ length: 7 }, (_, i) => formatter.format(new Date(Date.UTC(1970, 0, 4 + i))));
  }, [i18n.resolvedLanguage]);

  const running = progress !== null;
  /** 조회가 끝나서 "없는 날"을 믿을 수 있는 상태. 진행 중에는 아직 잠그면 안 된다. */
  const settled = counts !== null && !running;

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setMonth(addMonths(month, -1))}
          aria-label={t('calendar.prevMonth')}
          className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="flex-1 text-center text-sm font-semibold text-slate-900">{monthLabel}</span>
        <button
          type="button"
          onClick={() => setMonth(addMonths(month, 1))}
          aria-label={t('calendar.nextMonth')}
          className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {weekdays.map((label, index) => (
          <span
            key={label}
            className={cn(
              'py-1 text-[0.65rem] font-semibold',
              // 격자가 일요일부터 시작하므로 0 = 일, 6 = 토다. 일요일이 더 진하다.
              index === 0 && 'text-rose-500',
              index === 6 && 'text-rose-300',
              index !== 0 && index !== 6 && 'text-slate-400',
            )}
          >
            {label}
          </span>
        ))}

        {cells.map((day, index) => {
          if (!day) return <span key={`pad-${index}`} />;

          const key = toDateKey(day);
          /**
           * 대화가 존재할 수 없는 구간. 첫 메시지 이전, 마지막 메시지 이후, 그리고 미래다.
           * 조회해 볼 것도 없이 확정이라 버튼을 열어 둘 이유가 없다.
           */
          const outOfRange =
            key > todayKey || (firstKey && key < firstKey) || (lastKey && key > lastKey);
          const isFuture = Boolean(outOfRange);
          const isSelected = key === selected;
          const weekday = day.getDay();
          // 조회 결과가 있으면 그게 정확하다. 없으면 이미 본 메시지에서 아는 만큼이라도 쓴다.
          const count = counts?.get(key) ?? seedDays?.get(key) ?? 0;
          const hasMessages = count > 0;
          /**
           * 없다고 단정할 수 있는 경우는 둘이다.
           * - 전체 조회가 끝났는데 개수가 0 인 날 (진행 중에는 아직 안 온 것일 뿐이라 안 잠근다)
           * - 골라 봤더니 비어 있던 날
           */
          const empty = (settled && !hasMessages) || Boolean(emptyDays?.has(key));
          const dimmed = isFuture || empty;

          return (
            <button
              key={key}
              type="button"
              disabled={dimmed || checking !== null}
              onClick={() => void pick(key, count)}
              title={count ? t('calendar.dayCount', { count }) : undefined}
              className={cn(
                'flex aspect-square flex-col items-center justify-center rounded-lg text-xs transition-colors',
                isSelected && 'bg-primary font-bold text-white',
                /*
                  상태가 셋이라 서로 구별돼야 한다.
                  - 확인 전       : 배경 없음 + 점 없음 (아직 모른다)
                  - 대화 있음     : 옅은 파란 배경 + 진한 점
                  - 대화 없음     : 회색 배경 + 흐린 글씨 + 못 누름
                  배경 유무로 "확인했는가"를, 색으로 "있는가"를 나타낸다. 점만으로 나누면
                  확인 전과 대화 없음이 똑같아 보인다.
                */
                !isSelected && hasMessages && 'bg-primary-50 font-semibold hover:bg-primary-100',
                !isSelected && empty && 'bg-slate-50 text-slate-300',
                !isSelected && !hasMessages && !empty && !isFuture && 'hover:bg-slate-100',
                // 주말 색은 선택되지 않고 흐리지 않은 칸에만. 선택 칸은 파란 배경이라 묻힌다.
                !isSelected && !dimmed && weekday === 0 && 'text-rose-600',
                !isSelected && !dimmed && weekday === 6 && 'text-rose-400',
                !isSelected && !dimmed && weekday !== 0 && weekday !== 6 && 'text-slate-800',
                isFuture && 'text-slate-300',
              )}
            >
              {day.getDate()}
              {/* 개수까지 숫자로 적으면 칸이 빽빽해진다. 있다/없다는 점 하나로 충분하다. */}
              <span
                className={cn(
                  'mt-0.5 h-1 w-1 rounded-full',
                  count ? (isSelected ? 'bg-white' : 'bg-primary') : 'bg-transparent',
                )}
              />
            </button>
          );
        })}
      </div>

      {/* 확인 결과를 달력 안에서 알린다. 창을 닫아 버리면 다시 열어 다른 날을 골라야 한다. */}
      {checking && (
        <p className="mt-2 text-center text-[0.7rem] text-slate-500">
          {t('calendar.checkingDay', { date: checking })}
        </p>
      )}
      {emptyNotice && !checking && (
        <p className="mt-2 text-center text-[0.7rem] font-semibold text-amber-700">
          {t('calendar.dayEmpty', { date: emptyNotice })}
        </p>
      )}

      <div className="mt-3 border-t border-slate-100 pt-3 text-center">
        {running ? (
          <div className="space-y-1.5">
            <p className="text-[0.7rem] text-slate-500">
              {/* 어느 날짜를 보고 있는지까지 적는다. 숫자만 올라가면 멈춘 것처럼 보인다. */}
              {t('calendar.checking', {
                date: dateKeyOf(progress.at),
                done: progress.done,
                total: progress.total,
              })}
            </p>
            <div className="h-1 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }}
              />
            </div>
          </div>
        ) : settled ? (
          // 색이 무슨 뜻인지 적어 둔다. 세 상태를 색만으로 알아맞히게 두면 안 된다.
          <div className="flex items-center justify-center gap-3 text-[0.7rem] text-slate-500">
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded bg-primary-50 ring-1 ring-inset ring-primary-200" />
              {t('calendar.legendHas')}
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded bg-slate-100" />
              {t('calendar.legendEmpty')}
            </span>
          </div>
        ) : (
          <Button variant="secondary" size="sm" className="w-full" onClick={() => void check()}>
            {t('calendar.check')}
          </Button>
        )}
      </div>
    </div>
  );
}
