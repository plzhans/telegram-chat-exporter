import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Hourglass } from 'lucide-react';
import { Alert } from '@/shared/ui/Alert';
import { Button } from '@/shared/ui/Button';
import { Checkbox } from '@/shared/ui/Checkbox';
import { ErrorNotice } from '@/shared/ui/ErrorNotice';
import { Modal } from '@/shared/ui/Modal';
import { isMobileDevice, prefersReducedData } from '@/shared/lib/device';
import { useDuration } from '@/shared/lib/duration';
import { Field } from '@/shared/ui/Field';
import { Input } from '@/shared/ui/Input';
import type { TelegramErrorInfo } from '@/shared/telegram/errors';
import { dateKeyOf, shiftDateKey, todayKey } from '@/shared/lib/date';
import { useAuth } from '@/shared/auth/useAuth';
import { getCachedPeer, useChatStatsQuery, type DialogSummary } from '@/features/dialogs/api';
import { createFileSink, createMemorySink } from '../lib/zipWriter';
import { exportChat, exportFilename, type ExportProgress } from '../lib/exportChat';

type Phase = 'idle' | 'running' | 'done';


function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * 마지막 진행 갱신 이후 이만큼 지나면 "대기 중"으로 본다.
 *
 * 텔레그램이 FLOOD_WAIT 을 걸면 GramJS 가 조용히 자면서 기다린다(수백 초일 수도 있다).
 * 그동안 숫자가 안 움직이면 사용자는 **멈췄다고 판단하고 탭을 닫는다.** 실제로는 정상
 * 동작이라는 걸 알려줘야 한다.
 */
const STALL_THRESHOLD_MS = 8_000;

interface ExportPanelProps {
  dialog: DialogSummary;
  /** 기간 기본값. 대화 보기에서 고른 날짜가 있으면 그걸 반영해 넘어온다(ExportPage 참고). */
  defaultFrom: string;
  defaultTo: string;
}

export function ExportPanel({ dialog, defaultFrom, defaultTo }: ExportPanelProps) {
  const { t } = useTranslation();
  // 마지막 메시지 시각은 목록에 이미 있다. 요청을 하나 아끼려고 넘겨준다.
  const stats = useChatStatsQuery(dialog.id, dialog.date);
  // "누가 받은 백업인지"를 meta.json 에 남기려고 들고 있는다.
  const me = useAuth((s) => s.me);

  /** 고를 수 있는 날짜의 바깥 한계. 이 밖은 빈 결과가 확정이라 막는다. */
  const firstKey = stats.data?.firstDate ? dateKeyOf(stats.data.firstDate) : undefined;
  const lastKey = stats.data?.lastDate ? dateKeyOf(stats.data.lastDate) : undefined;

  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState<ExportProgress>({ count: 0, bytes: 0 });
  const [error, setError] = useState<TelegramErrorInfo | null>(null);
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  /**
   * 켜면 날짜를 아예 무시하고 처음부터 끝까지 받는다.
   *
   * 기본값이 최근 30일이라, 전체를 받고 싶은 사람이 시작 날짜를 대화방 개설일까지
   * 거슬러 올라가 맞춰야 했다. 그건 첫 메시지 날짜를 알아야만 가능한 일이고, 그 값을
   * 못 가져오는 대화방도 있다. 명시적인 스위치가 있는 편이 확실하다.
   */
  const [wholeHistory, setWholeHistory] = useState(false);
  /**
   * 사진을 함께 담을지.
   *
   * **기본은 끔이다.** 켜면 사진 한 장마다 요청이 하나씩 더 나가서, 메시지만 받을 때와는
   * 걸리는 시간이 아예 다른 작업이 된다.
   */
  /**
   * 사진을 함께 담을지.
   *
   * **기본은 켬이다.** 처음에는 껐다 — 사진 한 장마다 요청이 하나씩 더 나가서 걸리는 시간이
   * 아예 다른 작업이 되기 때문이었다. 하지만 그 판단은 순서가 틀렸다. 이 도구는 근거로 쓸
   * 자료를 만드는 곳이고, **사진이 빠진 백업은 나중에 다시 만들 수 없다** — 그때는 대화가
   * 이미 지워졌을 수 있다. 오래 걸리는 건 기다리면 되지만 빠진 건 되찾을 수 없다.
   */
  const [includePhotos, setIncludePhotos] = useState(true);
  /**
   * 스티커도 담을지.
   *
   * 사진과 따로 두는 이유는 성격이 달라서다. 사진은 그 대화에서만 오간 것이라 무거운
   * 대신 값이 있고, 스티커는 텔레그램 누구에게나 같은 그림이라 가벼운 대신 근거로서의
   * 값은 적다. 한 스위치로 묶으면 둘 중 하나를 원치 않게 끌려 오게 된다.
   *
   * 기본이 켬인 이유는 사진과 같다. 게다가 스티커는 같은 그림을 한 벌만 담으므로
   * 켜 두는 값이 거의 공짜다.
   */
  const [includeStickers, setIncludeStickers] = useState(true);
  /**
   * `index.html` 의 배치.
   *
   * 기본은 메신저 그대로다. 대부분은 자기가 보려고 백업하고, 그때는 익숙한 모양이 읽기 편하다.
   * 제3자에게 내밀 때만 평평하게 바꾸면 된다.
   */
  const [layout, setLayout] = useState<'chat' | 'flat'>('chat');
  /** 어디에 저장했는지. 완료 안내에 파일 이름을 적어 주려고 들고 있는다. */
  const [saved, setSaved] = useState<{ name: string; kind: 'picked' | 'download' } | null>(null);
  /**
   * 무엇을 내보냈는지.
   *
   * 완료 화면에서 설정 칸을 감추기 때문에, **그때 무엇을 골랐었는지 화면에 남지 않는다.**
   * 결과만 덩그러니 있으면 "이게 어느 기간 것이더라"를 되짚을 수가 없어서 따로 붙잡아 둔다.
   */
  const [done, setDone] = useState<{
    from: string;
    to: string;
    wholeHistory: boolean;
    photos: boolean;
    stickers: boolean;
  } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  /** 마지막으로 진행률이 움직인 시각. 정체 감지용이라 렌더링과 무관해 ref 로 둔다. */
  const lastTickRef = useRef(Date.now());
  const [stalled, setStalled] = useState(false);

  /**
   * 화면을 벗어나면 진행 중인 내보내기를 끊는다. 안 끊으면 사용자가 떠난 뒤에도 MTProto
   * 요청이 계속 나가서 FLOOD_WAIT 만 쌓인다.
   */
  useEffect(() => () => abortRef.current?.abort(), []);

  /**
   * 남은 대기 시간(초). 대기 중이 아니면 null.
   *
   * 진행 정보는 **끝나는 시각**만 실어 온다(ExportProgress.floodWaitUntil). 그동안 다른
   * 숫자는 하나도 안 바뀌므로, 여기서 1초마다 다시 계산해야 세어 내려가는 것으로 보인다.
   */
  const [remainSeconds, setRemainSeconds] = useState<number | null>(null);

  /**
   * 되돌릴 수 없는 동작 앞에 한 번 더 묻는 자리.
   *
   * 세 가지가 여기 걸린다 - 전체 기간, 실제 내려받기 시작, 중단. 셋 다 누른 뒤에 "아차"
   * 해도 되돌릴 방법이 없다. 전체 기간은 몇 시간을 잡아먹고, 내려받기는 데이터 요금을
   * 쓰고, 중단은 여태 받은 것을 버린다.
   */
  const [confirm, setConfirm] = useState<'whole' | 'data' | 'abort' | null>(null);
  const formatDuration = useDuration();

  useEffect(() => {
    if (phase !== 'running') {
      setStalled(false);
      setRemainSeconds(null);
      return;
    }
    const tick = () => {
      setStalled(Date.now() - lastTickRef.current > STALL_THRESHOLD_MS);
      const until = progress.floodWaitUntil;
      setRemainSeconds(until ? Math.max(0, Math.ceil((until - Date.now()) / 1000)) : null);
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [phase, progress.floodWaitUntil]);

  /**
   * 오늘을 끝으로 두고 `back` 일 만큼 거슬러 올라간 기간을 넣는다.
   *
   * **대화가 있는 구간 안으로 접어 넣는다.** 날짜 칸에 min/max 를 걸어 둔 것과 같은
   * 이유다 — 밖을 고르면 빈 결과가 나오고, 사용자는 그걸 고장으로 읽는다. 마지막 메시지가
   * 작년이면 "오늘"은 그 날짜로 내려앉는다.
   */
  const applyPreset = useCallback(
    (back: number) => {
      const end = lastKey && lastKey < todayKey() ? lastKey : todayKey();
      const begin = shiftDateKey(end, -back);
      setFrom(firstKey && begin < firstKey ? firstKey : begin);
      setTo(end);
    },
    [firstKey, lastKey],
  );

  /**
   * 시작 버튼이 부르는 자리.
   *
   * 휴대전화에서는 데이터 안내를 한 번 거친다. **셀룰러인지 와이파이인지는 알 수 없어서**
   * 기기 종류로 판단한다(`shared/lib/device.ts`). 와이파이로 붙은 휴대전화에도 뜨지만,
   * 요금이 나가는 상황을 놓치는 것보다 한 번 더 묻는 편이 낫다.
   *
   * 데이터 절약 모드를 켜 둔 사람은 기기와 무관하게 묻는다 - 요금을 신경 쓴다는 뜻이다.
   */
  const start = useCallback(async () => {
    const peer = getCachedPeer(dialog.id);
    if (!peer) {
      setError({ code: 'PEER_NOT_CACHED', raw: 'PEER_NOT_CACHED' });
      return;
    }

    /**
     * **저장 위치를 먼저 묻는다.** `showSaveFilePicker` 는 사용자 제스처를 요구하는데,
     * 내보내기를 시작한 뒤(await 를 여러 번 건넌 뒤)에 부르면 제스처가 소진돼 거절당한다.
     * 지원하지 않는 브라우저나 사용자가 대화상자를 닫으면 메모리 방식으로 떨어진다.
     */
    const filename = exportFilename(dialog);
    const picked = await createFileSink(filename);
    // 저장 대화상자에서 취소를 눌렀다. 시작하지 않는다.
    if (picked.status === 'cancelled') return;

    const sink = picked.status === 'ok' ? picked.sink : createMemorySink(filename);
    setSaved({ name: sink.name, kind: sink.kind });

    const controller = new AbortController();
    abortRef.current = controller;
    lastTickRef.current = Date.now();
    setPhase('running');
    setError(null);
    setProgress({ count: 0, bytes: 0 });
    setDone({ from, to, wholeHistory, photos: includePhotos, stickers: includeStickers });

    try {
      await exportChat({
        dialog,
        // 파일 이름에서 뺐으므로 meta.json 에는 반드시 남긴다.
        account: me ? { id: me.id, name: me.name } : undefined,
        peer,
        sink,
        // 날짜 키를 그대로 넘긴다. 로컬 자정/하루 끝으로 바꾸는 건 exportChat 이 맡는다.
        range: wholeHistory ? {} : { from: from || undefined, to: to || undefined },
        include: { photos: includePhotos, stickers: includeStickers },
        layout,
        signal: controller.signal,
        onProgress: (next) => {
          lastTickRef.current = Date.now();
          setProgress(next);
        },
      });
      setPhase('done');
    } catch (err) {
      // 사용자가 취소한 건 에러가 아니다. 조용히 처음 상태로 되돌린다.
      if (err instanceof Error && err.message === 'EXPORT_CANCELLED') {
        setPhase('idle');
        return;
      }
      setError(err as TelegramErrorInfo);
      setPhase('idle');
    } finally {
      abortRef.current = null;
    }
  }, [dialog, from, to, wholeHistory, includePhotos, includeStickers, layout, me]);

  /**
   * 시작 버튼이 부르는 자리.
   *
   * 휴대전화에서는 데이터 안내를 한 번 거친다. 셀룰러인지 와이파이인지는 알 수 없어서
   * 기기 종류로 판단한다(`shared/lib/device.ts`).
   *
   * **`useCallback` 으로 감싸지 않는다.** 한때 의존성을 비운 채 감쌌다가 첫 렌더의 `start`
   * 가 그대로 굳었고, 그 `start` 는 첫 렌더의 설정값(전체 기간 꺼짐·기본 날짜·첨부 미포함)
   * 을 붙들고 있었다. 그래서 데스크톱에서는 무엇을 바꾸든 초기 설정으로 내보내졌다.
   * 클릭 한 번에 쓰는 함수라 새로 만드는 비용이 문제가 될 자리가 아니다.
   */
  const requestStart = () => {
    if (isMobileDevice() || prefersReducedData()) {
      setConfirm('data');
      return;
    }
    void start();
  };

  const running = phase === 'running';

  /**
   * 무엇이 담기고 있는지 숫자로 보여 준다.
   *
   * **진행 중과 완료 후에 같은 것을 쓴다.** 받는 동안 숫자가 자라는 것을 보다가 끝나면 그
   * 자리에 최종값이 남으므로, 사용자는 "지금 몇 개까지 왔나" 와 "결국 몇 개였나" 를 같은
   * 자리에서 읽는다. 완료 화면에만 두면 진행 중에는 진행률 막대 말고 볼 것이 없고, 끝나는
   * 순간 처음 보는 표가 튀어나온다.
   *
   * 근거로 쓸 자료라면 나중에 파일을 열었을 때 개수가 맞는지 대조할 값이 있어야 한다.
   */
  const ExportSummary = () => (
    <dl className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-xl bg-slate-50 p-3 text-xs">
      <div className="col-span-2">
        <dt className="text-slate-500">{t('export.doneRange')}</dt>
        <dd className="font-semibold text-slate-900">
          {done?.wholeHistory ? t('export.doneWhole') : `${done?.from} ~ ${done?.to}`}
        </dd>
      </div>
      <div>
        <dt className="text-slate-500">{t('export.doneMessages')}</dt>
        <dd className="font-semibold tabular-nums text-slate-900">
          {t('export.doneCount', { count: progress.count })}
        </dd>
      </div>
      {/* 사진을 담지 않기로 했으면 0 이 아니라 아예 안 보여준다. 0 은 실패로 읽힌다. */}
      {(done?.photos || done?.stickers) && (
        <div>
          <dt className="text-slate-500">{t('export.doneFiles')}</dt>
          <dd className="font-semibold tabular-nums text-slate-900">
            {t('export.doneCount', { count: progress.files ?? 0 })}
          </dd>
        </div>
      )}
      <div>
        <dt className="text-slate-500">{t('export.doneSize')}</dt>
        <dd className="font-semibold tabular-nums text-slate-900">{formatBytes(progress.bytes)}</dd>
      </div>
    </dl>
  );

  return (
    <section className="space-y-3 edge-card bg-white p-4">
      <div className="flex items-start gap-3">
        <h2 className="min-w-0 flex-1 text-sm font-bold text-slate-900">{t('export.title')}</h2>

        {running && (
          <Button variant="secondary" size="sm" onClick={() => setConfirm('abort')}>
            {t('export.cancel')}
          </Button>
        )}
      </div>

      {/*
        이 화면이 무엇을 하는지 한 줄로 말하는 자리다. 회색 잔글씨로 두면 제목 아래 딸린
        부연으로 읽혀 그냥 지나친다. 상자에 담아 두면 설정을 만지기 전에 한 번은 눈이 멎는다.
      */}
      <p className="rounded-xl border border-primary-100 bg-primary-50 p-3 text-xs leading-relaxed text-slate-700">
        {t('export.description')}
      </p>

      {/*
        **크로뮴 계열이 아닐 때만** 뜬다. 브라우저 이름이 아니라 기능이 있는지로 가른다 -
        `showSaveFilePicker` 는 파일에 바로 쓰는 API 라, 있으면 크롬·엣지·오페라이고
        없으면 사파리·파이어폭스다.

        **맨 위에 둔다.** 이건 기간이나 첨부를 고르기 전에, 아예 브라우저를 바꿀지 말지를
        판단하라고 있는 글이다. 아래에 두면 다 설정하고 누르기 직전에야 읽게 되는데,
        그때는 이미 여기서 하기로 마음먹은 뒤다.
      */}
      {phase === 'idle' && !window.showSaveFilePicker && (
        <Alert tone="warning">
          {t('export.memoryFallback')}
        </Alert>
      )}


      {/*
        완료하면 설정 칸을 **되돌려 놓지 않는다.**

        예전에는 끝나자마자 날짜와 체크박스가 그대로 다시 나타나고 완료 안내는 그 아래에
        붙었다. 그러면 방금 끝난 작업의 결과와, 다음 작업을 위한 입력이 한 화면에 섞여서
        **어느 쪽을 읽어야 하는지 알 수 없다.** 끝났으면 결과만 보여주고 멈춘다.
      */}
      {phase === 'idle' && (
        <div className="space-y-3">
          {/*
            **기간에 관한 것끼리 붙여 둔다.** 빠른 선택 → 날짜 칸 → 전체 기간 스위치가
            한 덩어리고, 첨부 선택은 그 다음이다.

            전체 기간 스위치를 **아래에 둔다.** 위에 있으면 날짜를 보기도 전에 눈에 먼저
            들어와서, 얼마나 큰 작업인지 모르는 채로 켜게 된다. 오래된 대화방은 몇 시간이
            걸리고 중간에 끊기면 처음부터다. 날짜를 먼저 보고 나서 "그래도 전부" 라고
            판단하는 순서가 맞다.
          */}
          {!wholeHistory && (
            <div className="space-y-2">

              {/*
                라벨 하나에 두 칸을 붙여 둔다.

                "시작 날짜" / "끝 날짜" 로 나눠 적으면 라벨 두 줄이 칸보다 눈에 먼저 들어와
                한 덩어리로 안 읽힌다. 사이의 `~` 가 그 관계를 이미 말해 주므로 라벨은
                "기간" 하나면 된다.

                대화가 존재하는 구간 밖은 아예 못 고르게 막는다. 첫 메시지 이전이나 마지막
                메시지 이후를 골라 봐야 빈 파일만 나오고, 사용자는 "왜 아무것도 안 나오지"로
                읽는다. 달력 화면과 같은 근거(useChatStatsQuery)를 쓴다.
              */}
              <Field label={t('export.range')} htmlFor="export-from" hint={t('export.rangeHint')}>
                {/*
                  자주 쓰는 기간은 눌러서 넣는다.

                  날짜 칸은 두 개를 각각 맞춰야 해서, "오늘 것만" 같은 흔한 요구에도 손이
                  네 번 간다. 특히 **오늘**은 증거를 남기려는 사람이 방금 오간 대화를 바로
                  떠 가는 경우라 가장 자주 쓰인다.
                */}
                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-slate-500">{t('export.presets')}</span>
                  {(
                    [
                      ['export.presetToday', 0],
                      ['export.presetWeek', 6],
                      ['export.presetMonth', 29],
                    ] as const
                  ).map(([label, back]) => (
                    <button
                      key={label}
                      type="button"
                      className="rounded-full border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:border-primary hover:text-primary"
                      onClick={() => applyPreset(back)}
                    >
                      {t(label)}
                    </button>
                  ))}
                </div>

                {/*
                  라벨 하나에 두 칸을 붙여 둔다. 사이의 `~` 가 관계를 말해 주므로 "시작 날짜"
                  "끝 날짜" 로 나눠 적을 필요가 없다 - 라벨 두 줄이 칸보다 눈에 먼저 들어와
                  한 덩어리로 안 읽힌다. 화면 낭독기에는 aria-label 로 남긴다.

                  대화가 존재하는 구간 밖은 아예 못 고르게 막는다. 첫 메시지 이전이나 마지막
                  메시지 이후를 골라 봐야 빈 파일만 나오고, 사용자는 "왜 아무것도 안 나오지"로
                  읽는다. 달력 화면과 같은 근거(useChatStatsQuery)를 쓴다.
                */}
                <div className="flex items-center gap-2">
                  <Input
                    id="export-from"
                    type="date"
                    aria-label={t('export.from')}
                    className="min-w-0 flex-1"
                    value={from}
                    min={firstKey}
                    max={to || lastKey}
                    onChange={(e) => setFrom(e.target.value)}
                  />
                  <span aria-hidden className="shrink-0 text-sm text-slate-400">
                    ~
                  </span>
                  <Input
                    id="export-to"
                    type="date"
                    aria-label={t('export.to')}
                    className="min-w-0 flex-1"
                    value={to}
                    min={from || firstKey}
                    max={lastKey}
                    onChange={(e) => setTo(e.target.value)}
                  />
                </div>
              </Field>
            </div>
          )}

          {/* 켤 때만 묻는다. 끄는 것은 되돌릴 수 있는 동작이라 물을 이유가 없다. */}
          <Checkbox
            checked={wholeHistory}
            onChange={(e) => (e.target.checked ? setConfirm('whole') : setWholeHistory(false))}
            label={t('export.wholeHistory')}
            hint={t('export.wholeHistoryHint')}
          />

          {/*
            첨부를 담을지 고르는 자리.

            **기본은 끔이다.** 사진까지 받으면 걸리는 시간과 용량이 자릿수 단위로 달라진다.
            켜는 건 한 번의 클릭이지만, 몇십 분을 기다린 뒤에야 "이렇게 오래 걸릴 줄 몰랐다"를
            깨닫는 건 되돌릴 수 없다.
          */}
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-900">{t('export.includeTitle')}</p>
            <div className="mt-1.5 space-y-2">
              <Checkbox
                checked={includePhotos}
                onChange={(e) => setIncludePhotos(e.target.checked)}
                label={t('export.includePhotos')}
                hint={t('export.includePhotosHint')}
              />
              <Checkbox
                checked={includeStickers}
                onChange={(e) => setIncludeStickers(e.target.checked)}
                label={t('export.includeStickers')}
                hint={t('export.includeStickersHint')}
              />
            </div>
            {/*
              **담기지 않는 것을 이름으로 적는다.**

              "사진"이라는 선택지 하나만 두면, 켜 놓고 나서 동영상도 들었으려니 한다.
              증거로 쓸 자료에서 그 착각은 위험하다 — 나중에 파일을 열어 봐야 없다는 걸
              알게 되고, 그때는 이미 대화가 지워졌을 수도 있다.

              그리고 **없는 것과 기록되지 않은 것은 다르다**는 점을 같이 말한다. 파일은
              안 담겨도 무엇이 오갔는지는 목록에 남는다.
            */}
            <p className="mt-2 text-xs text-slate-500">
              <span className="font-semibold text-slate-700">
                {t('export.includeExcludedTitle')}
              </span>{' '}
              {t('export.includeExcluded')}
            </p>
            <p className="mt-1 text-xs text-slate-500">{t('export.includeNote')}</p>
          </div>

          {/*
            대화 화면의 배치.

            **어느 쪽이 옳다고 정해 줄 수 없는 선택**이라 사용자에게 넘긴다. 오른쪽 정렬은
            읽기 편하지만 그 배치 자체가 "이쪽이 나다"라는 주장이고, 평평하게 두면 중립적인
            대신 눈으로 따라가기가 조금 불편하다. 쓰임새를 아는 건 사용자다.
          */}
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-900">{t('export.layoutTitle')}</p>
            <div className="mt-1.5 space-y-1">
              {(
                [
                  ['chat', 'export.layoutChat'],
                  ['flat', 'export.layoutFlat'],
                ] as const
              ).map(([value, label]) => (
                <label key={value} className="flex cursor-pointer items-center gap-2 text-xs">
                  <input
                    type="radio"
                    name="export-layout"
                    className="h-3.5 w-3.5 accent-primary"
                    checked={layout === value}
                    onChange={() => setLayout(value)}
                  />
                  <span className="text-slate-700">{t(label)}</span>
                </label>
              ))}
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
              {t('export.layoutHint')}
            </p>
          </div>
        </div>
      )}

      {running && (
        <div className="space-y-1.5">
          {/*
            사진을 받는 동안에는 메시지 수가 멈춰 있다. 같은 문구를 쓰면 사용자는 그걸
            고장으로 읽는다. 단계가 바뀌면 세는 대상도 바꿔서 보여준다.
          */}
          {(() => {
            const files = progress.phase === 'files';
            const at = files ? (progress.files ?? 0) : progress.count;
            const total = files ? progress.totalFiles : progress.totalCount;
            /*
              **끝을 아는 경우에만 비율을 말한다.**

              개수 세기가 실패했거나 아직 안 끝났으면 total 이 없다. 그때 0 을 넣어 "0%" 를
              띄우면 진행이 멈춘 것처럼 보인다 - 모르는 것은 모른다고 두고, 지금까지 센
              개수만 보여주는 편이 정직하다.
            */
            const known = typeof total === 'number' && total > 0;
            const ratio = known ? Math.min(at / total, 1) : 0;

            return (
              <>
                <p className="flex items-baseline gap-2 text-xs font-semibold text-primary">
                  <span>
                    {known
                      ? files
                        ? t('export.progressFiles', { files: at, totalFiles: total })
                        : t('export.progress', { count: at, total })
                      : t('export.progressCounting', { count: at })}
                  </span>
                  {known && <span className="tabular-nums">{Math.floor(ratio * 100)}%</span>}
                  <span className="ms-auto font-normal text-slate-500">
                    {formatBytes(progress.bytes)}
                    {!files && progress.lastDate && ` · ~${dateKeyOf(progress.lastDate)}`}
                  </span>
                </p>

                {/*
                  막대는 숫자가 못 하는 일을 한다 - **얼마나 남았는지를 보지 않고 느끼게**
                  한다. 끝을 모를 때는 막대 자체를 감춘다. 채워지지 않는 빈 막대는 고장으로
                  읽힌다.
                */}
                {known && (
                  <div
                    className="h-1.5 overflow-hidden rounded-full bg-slate-200"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={total}
                    aria-valuenow={at}
                  >
                    <div
                      className="h-full rounded-full bg-primary transition-[width] duration-300"
                      style={{ width: `${ratio * 100}%` }}
                    />
                  </div>
                )}
              </>
            );
          })()}
          {/*
            얼마나 기다려야 하는지 적는다. 제한이 걸렸다는 사실만 알려 주면 사용자는 이게
            10초짜리인지 10분짜리인지 몰라 창을 닫을지 말지 판단할 수 없다.

            남은 시간을 못 알아낸 경우(제한이 아니라 그냥 느린 경우)에는 예전 문구로 떨어진다.
          */}
          {(remainSeconds !== null || stalled) && (
            /*
              **눈에 띄어야 한다.** 이 안내가 흐린 잔글씨면 사용자는 못 읽고, 숫자가 멈춘
              화면만 보고 고장으로 판단해 창을 닫는다. 그러면 여태 받은 것이 다 날아간다.
              한 줄짜리 글이 아니라 상자로 세우고 아이콘을 붙여 시선을 잡는다.
            */
            <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3">
              <Hourglass className="mt-0.5 h-4 w-4 shrink-0 animate-pulse text-amber-600" />
              <p className="text-xs font-medium leading-relaxed text-amber-800">
                {remainSeconds !== null
                  ? t('export.waitingFor', { remain: formatDuration(remainSeconds) })
                  : t('export.waiting')}
              </p>
            </div>
          )}

          {/* 완료 화면과 같은 표. 받는 동안 숫자가 자라고, 끝나면 그 자리에 최종값이 남는다. */}
          <ExportSummary />
        </div>
      )}

      {phase === 'done' && (
        <div className="space-y-3">
          <Alert tone="trust" title={t('export.doneTitle')}>
            {saved && (
              <p>
                {/*
                  `break-all` 이어야 한다. 파일명에는 띄어쓰기가 없어서 `break-words`
                  (overflow-wrap)로는 끊을 자리를 못 찾는다 - 사파리에서 특히 그대로
                  삐져나간다.
                */}
                <span className="block break-all font-mono font-semibold">{saved.name}</span>
                {/*
                  전체 경로는 알려줄 수 없다. File System Access API 가 보안상 파일 이름만
                  주기 때문이다. 그래서 "어디로 갔는지"는 저장 방식으로 대신 설명한다.
                */}
                <span className="mt-0.5 block">
                  {t(saved.kind === 'picked' ? 'export.savedPicked' : 'export.savedDownload')}
                </span>
              </p>
            )}
          </Alert>

          <ExportSummary />

          {/*
            다음 내보내기로 돌아가는 건 **누른 사람만** 간다. 저절로 돌아가면 방금 받은
            결과를 읽던 눈앞에서 화면이 바뀐다.
          */}
          <Button variant="secondary" size="sm" onClick={() => setPhase('idle')}>
            {t('export.again')}
          </Button>
        </div>
      )}

      {/*
        첫 페이지에도 적어 둔 사실이지만 **여기서 한 번 더 말한다.**

        실제로 기다리게 되는 곳이 이 화면이다. 첫 페이지에서 읽은 설명은 그때는 남의 일처럼
        읽히고, 몇십 분째 진행률을 보고 있을 때에야 "왜 이렇게 느리지"가 된다. 그 질문이
        생기는 자리에 답이 있어야 한다.
      */}
      <Alert tone="info" title={t('export.deviceTitle')}>
        {t('export.deviceBody')}
      </Alert>


      <ErrorNotice error={error ?? stats.error} />

      <Modal
        open={confirm === 'whole'}
        onClose={() => setConfirm(null)}
        title={t('export.confirmWholeTitle')}
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setConfirm(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setWholeHistory(true);
                setConfirm(null);
              }}
            >
              {t('export.confirmWholeOk')}
            </Button>
          </>
        }
      >
        {t('export.confirmWholeBody')}
      </Modal>

      <Modal
        open={confirm === 'data'}
        onClose={() => setConfirm(null)}
        title={t('export.confirmDataTitle')}
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setConfirm(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setConfirm(null);
                void start();
              }}
            >
              {t('export.confirmDataOk')}
            </Button>
          </>
        }
      >
        {t('export.confirmDataBody')}
      </Modal>

      <Modal
        open={confirm === 'abort'}
        onClose={() => setConfirm(null)}
        title={t('export.confirmAbortTitle')}
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setConfirm(null)}>
              {t('export.confirmKeep')}
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setConfirm(null);
                abortRef.current?.abort();
              }}
            >
              {t('export.confirmAbortOk')}
            </Button>
          </>
        }
      >
        {t('export.confirmAbortBody')}
      </Modal>

      {/*
        **설정을 다 본 뒤에 누른다.**

        머리에 있을 때는 기간·첨부 설정을 지나치기 전에 눈에 먼저 들어와서, 기본값 그대로
        시작해 놓고 뒤늦게 "전체 기간이 아니었네" 를 알게 된다. 읽는 순서와 누르는 순서가
        같아야 한다.

        폭을 꽉 채우는 이유는 이 화면에서 유일하게 되돌릴 수 없는 동작이기 때문이다 -
        다른 것들과 같은 크기로 서 있으면 어느 것이 그 동작인지 한 번 더 짚어야 한다.
      */}
      {phase === 'idle' && (
        <Button size="lg" className="w-full" onClick={() => requestStart()}>
          <Download className="h-4 w-4" />
          {t('export.start')}
        </Button>
      )}
    </section>
  );
}
