import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, HardDrive } from 'lucide-react';
import { Alert } from '@/shared/ui/Alert';
import { Button } from '@/shared/ui/Button';
import { Checkbox } from '@/shared/ui/Checkbox';
import { ErrorNotice } from '@/shared/ui/ErrorNotice';
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
  const [includePhotos, setIncludePhotos] = useState(false);
  /** 어디에 저장했는지. 완료 안내에 파일 이름을 적어 주려고 들고 있는다. */
  const [saved, setSaved] = useState<{ name: string; kind: 'picked' | 'download' } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  /** 마지막으로 진행률이 움직인 시각. 정체 감지용이라 렌더링과 무관해 ref 로 둔다. */
  const lastTickRef = useRef(Date.now());
  const [stalled, setStalled] = useState(false);

  /**
   * 화면을 벗어나면 진행 중인 내보내기를 끊는다. 안 끊으면 사용자가 떠난 뒤에도 MTProto
   * 요청이 계속 나가서 FLOOD_WAIT 만 쌓인다.
   */
  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    if (phase !== 'running') {
      setStalled(false);
      return;
    }
    const timer = setInterval(() => {
      setStalled(Date.now() - lastTickRef.current > STALL_THRESHOLD_MS);
    }, 1000);
    return () => clearInterval(timer);
  }, [phase]);

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

    try {
      await exportChat({
        dialog,
        // 파일 이름에서 뺐으므로 meta.json 에는 반드시 남긴다.
        account: me ? { id: me.id, name: me.name } : undefined,
        peer,
        sink,
        // 날짜 키를 그대로 넘긴다. 로컬 자정/하루 끝으로 바꾸는 건 exportChat 이 맡는다.
        range: wholeHistory ? {} : { from: from || undefined, to: to || undefined },
        include: { photos: includePhotos },
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
  }, [dialog, from, to, wholeHistory, includePhotos, me]);

  const running = phase === 'running';

  return (
    <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-bold text-slate-900">{t('export.title')}</h2>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{t('export.description')}</p>
        </div>

        {running ? (
          <Button variant="secondary" size="sm" onClick={() => abortRef.current?.abort()}>
            {t('export.cancel')}
          </Button>
        ) : (
          <Button size="sm" onClick={() => void start()}>
            <Download className="h-3.5 w-3.5" />
            {t('export.start')}
          </Button>
        )}
      </div>

      {/*
        내보내기 전에 규모를 알려준다. 이게 없으면 사용자는 몇 시간짜리인지도 모르는 작업을
        무작정 시작하게 된다. 요청 두 번이면 구할 수 있는 정보다(useChatStatsQuery 참고).
      */}
      {stats.data && (
        <dl className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-xs">
          <div>
            <dt className="text-slate-500">{t('export.stats.total')}</dt>
            <dd className="font-semibold text-slate-900">
              {t('export.stats.messages', { count: stats.data.total })}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">{t('export.stats.period')}</dt>
            <dd className="font-semibold text-slate-900">
              {stats.data.firstDate
                ? `${dateKeyOf(stats.data.firstDate)} ~ ${
                    stats.data.lastDate ? dateKeyOf(stats.data.lastDate) : ''
                  }`
                : '—'}
            </dd>
          </div>
        </dl>
      )}

      {!running && (
        <div className="space-y-3">
          <Checkbox
            checked={wholeHistory}
            onChange={(e) => setWholeHistory(e.target.checked)}
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
            <div className="mt-1.5">
              <Checkbox
                checked={includePhotos}
                onChange={(e) => setIncludePhotos(e.target.checked)}
                label={t('export.includePhotos')}
                hint={t('export.includePhotosHint')}
              />
            </div>
            <p className="mt-1.5 text-xs text-slate-500">{t('export.includeNote')}</p>
          </div>

          {/* 전체를 고르면 날짜 칸은 의미가 없다. 비활성이 아니라 아예 감춘다. */}
          {!wholeHistory && (
            <div className="space-y-2">
              {/*
                자주 쓰는 기간은 눌러서 넣는다.

                날짜 칸은 두 개를 각각 맞춰야 해서, "오늘 것만" 같은 흔한 요구에도 손이
                네 번 간다. 특히 **오늘**은 증거를 남기려는 사람이 방금 오간 대화를 바로
                떠 가는 경우라 가장 자주 쓰인다.
              */}
              <div className="flex flex-wrap items-center gap-1.5">
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

              <div className="grid gap-3 mobile:grid-cols-2">
              {/*
                대화가 존재하는 구간 밖은 아예 못 고르게 막는다. 첫 메시지 이전이나 마지막
                메시지 이후를 골라 봐야 빈 파일만 나오고, 사용자는 "왜 아무것도 안 나오지"로
                읽는다. 달력 화면과 같은 근거(useChatStatsQuery)를 쓴다.
              */}
              <Field label={t('export.from')} htmlFor="export-from">
                <Input
                  id="export-from"
                  type="date"
                  value={from}
                  min={firstKey}
                  max={to || lastKey}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </Field>
              <Field label={t('export.to')} htmlFor="export-to" hint={t('export.rangeHint')}>
                <Input
                  id="export-to"
                  type="date"
                  value={to}
                  min={from || firstKey}
                  max={lastKey}
                  onChange={(e) => setTo(e.target.value)}
                />
                </Field>
              </div>
            </div>
          )}
        </div>
      )}

      {running && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-primary">
            {/*
              사진을 받는 동안에는 메시지 수가 멈춰 있다. 같은 문구를 쓰면 사용자는 그걸
              고장으로 읽는다. 단계가 바뀌면 세는 대상도 바꿔서 보여준다.
            */}
            {progress.phase === 'files'
              ? t('export.progressFiles', {
                  files: progress.files ?? 0,
                  totalFiles: progress.totalFiles ?? 0,
                })
              : t('export.progress', { count: progress.count })}
            <span className="ml-2 font-normal text-slate-500">
              {formatBytes(progress.bytes)}
              {progress.phase !== 'files' && progress.lastDate && ` · ~${dateKeyOf(progress.lastDate)}`}
            </span>
          </p>
          {stalled && <p className="text-xs text-amber-700">{t('export.waiting')}</p>}
        </div>
      )}

      {phase === 'done' && (
        <Alert tone="trust">
          <p>{t('export.done', { count: progress.count })}</p>
          {saved && (
            <p className="mt-1">
              <span className="font-mono font-semibold">{saved.name}</span>
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

      {!window.showSaveFilePicker && (
        <p className="flex items-start gap-1.5 text-xs text-slate-500">
          <HardDrive className="mt-0.5 h-3 w-3 shrink-0" />
          {t('export.memoryFallback')}
        </p>
      )}

      <ErrorNotice error={error ?? stats.error} />
    </section>
  );
}
